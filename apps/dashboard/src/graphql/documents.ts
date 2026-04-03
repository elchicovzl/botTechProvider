import { gql } from '@apollo/client';

export const DOCUMENTS_QUERY = gql`
  query Documents($botId: String!) {
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
  mutation CreateDocumentUploadUrl($botId: String!, $filename: String!, $mimeType: String!, $sizeBytes: Int!) {
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
  mutation ConfirmDocumentUpload($documentId: String!) {
    confirmDocumentUpload(documentId: $documentId) {
      id
      status
    }
  }
`;

export const DELETE_DOCUMENT_MUTATION = gql`
  mutation DeleteDocument($id: String!) {
    deleteDocument(id: $id) {
      id
    }
  }
`;
