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
