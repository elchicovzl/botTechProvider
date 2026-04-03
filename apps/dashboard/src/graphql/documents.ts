import { gql } from '@apollo/client';

export const DOCUMENTS_QUERY = gql`
  query Documents($botId: ID!) {
    documents(botId: $botId) {
      id
      filename
      mimeType
      sizeBytes
      status
      error
      chunkCount
      createdAt
    }
  }
`;

export const CREATE_DOCUMENT_UPLOAD_URL_MUTATION = gql`
  mutation CreateDocumentUploadUrl($botId: ID!, $filename: String!, $mimeType: String!, $sizeBytes: Int!) {
    createDocumentUploadUrl(botId: $botId, filename: $filename, mimeType: $mimeType, sizeBytes: $sizeBytes) {
      document {
        id
        filename
        status
      }
      uploadUrl
    }
  }
`;

export const CONFIRM_DOCUMENT_UPLOAD_MUTATION = gql`
  mutation ConfirmDocumentUpload($documentId: ID!) {
    confirmDocumentUpload(documentId: $documentId) {
      id
      status
    }
  }
`;

export const DELETE_DOCUMENT_MUTATION = gql`
  mutation DeleteDocument($id: ID!) {
    deleteDocument(id: $id) {
      id
    }
  }
`;
