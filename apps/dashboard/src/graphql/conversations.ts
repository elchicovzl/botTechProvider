import { gql } from '@apollo/client';

export const CONVERSATIONS_QUERY = gql`
  query Conversations($status: String, $first: Int, $after: String, $search: String) {
    conversations(status: $status, first: $first, after: $after, search: $search) {
      edges {
        node {
          id
          waContactPhone
          waContactName
          status
          isSessionOpen
          lastInboundAt
          lastMessage {
            id
            content
            direction
            type
            createdAt
          }
          createdAt
          updatedAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

export const MESSAGES_QUERY = gql`
  query Messages($conversationId: ID!, $first: Int, $before: String) {
    messages(conversationId: $conversationId, first: $first, before: $before) {
      edges {
        node {
          id
          waMessageId
          direction
          type
          content
          mediaUrl
          status
          sentAt
          deliveredAt
          readAt
          failedReason
          createdAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const UPDATE_CONVERSATION_STATUS_MUTATION = gql`
  mutation UpdateConversationStatus($conversationId: ID!, $status: String!, $botId: ID) {
    updateConversationStatus(conversationId: $conversationId, status: $status, botId: $botId) {
      id
      status
      isSessionOpen
    }
  }
`;
