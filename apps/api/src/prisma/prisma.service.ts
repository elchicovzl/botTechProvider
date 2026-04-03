import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { createTenantExtension } from './tenant.middleware';
import { getCurrentTenantId } from '../common/context';

/**
 * Extended Prisma Client with tenant isolation.
 *
 * Prisma 7 requires a driver adapter (no built-in query engine).
 * We use @prisma/adapter-pg with the node-postgres (pg) driver.
 */
function createExtendedClient() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);
  const base = new PrismaClient({ adapter });
  return { client: base.$extends(createTenantExtension(getCurrentTenantId)), pool };
}

type ExtendedPrismaClient = ReturnType<typeof createExtendedClient>['client'];

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly client: ExtendedPrismaClient;
  private readonly pool: pg.Pool;

  constructor() {
    const { client, pool } = createExtendedClient();
    this.client = client;
    this.pool = pool;
  }

  /**
   * Access the extended Prisma client.
   * Use this for all database operations — tenant isolation is automatic.
   */
  get db(): ExtendedPrismaClient {
    return this.client;
  }

  async onModuleInit() {
    // Test connection
    const res = await this.pool.query('SELECT 1');
    if (res.rows.length > 0) {
      this.logger.log('Connected to database');
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
    this.logger.log('Disconnected from database');
  }

  /**
   * Execute raw SQL query. Use for pgvector operations
   * where Prisma's query builder doesn't support vector types.
   *
   * WARNING: Raw queries bypass tenant isolation middleware.
   * Always include WHERE tenant_id = $tenantId manually.
   */
  get $queryRaw() {
    return (this.client as unknown as PrismaClient).$queryRaw.bind(this.client);
  }

  /**
   * Execute raw SQL command (INSERT/UPDATE/DELETE).
   *
   * WARNING: Raw queries bypass tenant isolation middleware.
   */
  get $executeRaw() {
    return (this.client as unknown as PrismaClient).$executeRaw.bind(
      this.client,
    );
  }

  /**
   * Transaction support.
   */
  get $transaction() {
    return (this.client as unknown as PrismaClient).$transaction.bind(
      this.client,
    );
  }
}
