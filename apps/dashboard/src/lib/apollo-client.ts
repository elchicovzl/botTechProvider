import { ApolloClient, InMemoryCache, createHttpLink, ApolloLink, split } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { createClient } from 'graphql-ws';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/graphql';
const WS_URL = API_URL.replace(/^http/, 'ws');

const httpLink = createHttpLink({ uri: API_URL });

const wsLink = typeof window !== 'undefined'
  ? new GraphQLWsLink(
      createClient({
        url: WS_URL,
        connectionParams: () => ({
          Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}`,
        }),
      }),
    )
  : null;

const authLink = new SetContextLink((prevContext) => {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('accessToken')
    : null;
  return {
    ...prevContext,
    headers: {
      ...(prevContext['headers'] as Record<string, string> | undefined),
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

const errorLink = new ErrorLink(({ error }) => {
  if (CombinedGraphQLErrors.is(error)) {
    for (const err of error.errors) {
      if (err.extensions?.['code'] === 'UNAUTHENTICATED') {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }
    }
  } else {
    console.error(`[Network error]: ${error}`);
  }
});

const httpChain = ApolloLink.from([errorLink, authLink, httpLink]);

// Split traffic: subscriptions go over WebSocket, everything else over HTTP
const transportLink = wsLink
  ? split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        );
      },
      wsLink,
      httpChain,
    )
  : httpChain;

export const apolloClient = new ApolloClient({
  link: transportLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network' },
  },
});
