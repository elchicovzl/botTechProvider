import { gql } from '@apollo/client';

export const BOTS_QUERY = gql`
  query Bots {
    bots {
      id
      name
      isActive
      systemPrompt
      noMatchBehavior
      maxContextChunks
      temperature
      documentCount
      createdAt
    }
  }
`;

export const BOT_QUERY = gql`
  query Bot($id: ID!) {
    bot(id: $id) {
      id
      name
      isActive
      systemPrompt
      noMatchBehavior
      maxContextChunks
      temperature
      documentCount
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_BOT_MUTATION = gql`
  mutation CreateBot($input: CreateBotInputType!) {
    createBot(input: $input) {
      id
      name
      isActive
    }
  }
`;

export const UPDATE_BOT_MUTATION = gql`
  mutation UpdateBot($id: ID!, $input: UpdateBotInputType!) {
    updateBot(id: $id, input: $input) {
      id
      name
      systemPrompt
      isActive
    }
  }
`;

export const ACTIVATE_BOT_MUTATION = gql`
  mutation ActivateBot($id: ID!) {
    activateBot(id: $id) {
      id
      isActive
    }
  }
`;

export const DEACTIVATE_BOT_MUTATION = gql`
  mutation DeactivateBot($id: ID!) {
    deactivateBot(id: $id) {
      id
      isActive
    }
  }
`;

export const DELETE_BOT_MUTATION = gql`
  mutation DeleteBot($id: ID!) {
    deleteBot(id: $id) {
      id
    }
  }
`;
