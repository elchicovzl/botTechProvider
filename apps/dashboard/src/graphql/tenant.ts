import { gql } from '@apollo/client';

export const MY_TENANT_QUERY = gql`
  query MyTenant {
    myTenant {
      id
      name
      slug
      status
      createdAt
      whatsappConfig {
        isActive
        displayPhoneNumber
        phoneVerificationStatus
        connectedAt
      }
    }
  }
`;

export const UPDATE_TENANT_MUTATION = gql`
  mutation UpdateTenant($name: String!) {
    updateTenant(name: $name) {
      id
      name
      slug
      status
    }
  }
`;

export const ACTIVATE_WHATSAPP_SANDBOX_MUTATION = gql`
  mutation ActivateWhatsAppSandbox {
    activateWhatsAppSandbox {
      id
      name
      status
      whatsappConfig {
        isActive
        displayPhoneNumber
      }
    }
  }
`;
