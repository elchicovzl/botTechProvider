import { Prisma } from '@prisma/client';

/**
 * Models that require tenant isolation.
 */
export const TENANT_SCOPED_MODELS = new Set([
  'User',
  'WhatsAppConfig',
  'Conversation',
  'Message',
  'Bot',
  'Document',
  'DocumentChunk',
  'AuditLog',
]);

/**
 * Injects tenantId into Prisma query args based on the operation type.
 * Uses `any` for args because Prisma 7's extension types are too narrow
 * to express cross-operation arg manipulation generically.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function injectTenantId(operation: string, args: any, tenantId: string): void {
  const op = operation;

  // Read / update / delete operations — inject into WHERE
  if (
    op === 'findUnique' ||
    op === 'findUniqueOrThrow' ||
    op === 'findFirst' ||
    op === 'findFirstOrThrow' ||
    op === 'findMany' ||
    op === 'update' ||
    op === 'updateMany' ||
    op === 'delete' ||
    op === 'deleteMany' ||
    op === 'count' ||
    op === 'aggregate' ||
    op === 'groupBy'
  ) {
    args.where = { ...args.where, tenantId };
  }

  // Create — inject into data
  if (op === 'create' && args.data) {
    args.data = { ...args.data, tenantId };
  }

  // CreateMany — inject into each item
  if (op === 'createMany' && Array.isArray(args.data)) {
    args.data = args.data.map((item: Record<string, unknown>) => ({
      ...item,
      tenantId,
    }));
  }

  // Upsert — inject into both where and create
  if (op === 'upsert') {
    args.where = { ...args.where, tenantId };
    if (args.create) {
      args.create = { ...args.create, tenantId };
    }
  }
}

/**
 * Prisma Client extension that enforces tenant isolation.
 *
 * All queries on tenant-scoped models automatically include
 * tenantId from the AsyncLocalStorage context.
 */
export function createTenantExtension(getTenantId: () => string | undefined) {
  return Prisma.defineExtension({
    name: 'tenantIsolation',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }

          const tenantId = getTenantId();
          if (!tenantId) {
            return query(args);
          }

          injectTenantId(operation, args, tenantId);
          return query(args);
        },
      },
    },
  });
}
