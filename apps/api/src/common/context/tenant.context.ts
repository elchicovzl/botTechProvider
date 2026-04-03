import { AsyncLocalStorage } from 'async_hooks';

export interface TenantStore {
  tenantId: string;
  userId: string;
}

/**
 * AsyncLocalStorage for tenant context.
 * This allows the Prisma tenant middleware to access tenantId
 * without dependency injection or request-scoped providers.
 */
export const tenantStorage = new AsyncLocalStorage<TenantStore>();

export function getCurrentTenantId(): string | undefined {
  return tenantStorage.getStore()?.tenantId;
}

export function getCurrentUserId(): string | undefined {
  return tenantStorage.getStore()?.userId;
}
