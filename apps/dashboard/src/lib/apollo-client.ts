import { ApolloClient, InMemoryCache, createHttpLink, ApolloLink } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import { CombinedGraphQLErrors } from '@apollo/client/errors';

const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/graphql',
});

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

export const apolloClient = new ApolloClient({
  link: ApolloLink.from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network' },
  },
});
