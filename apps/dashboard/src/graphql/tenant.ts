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
