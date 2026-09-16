import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { getCurrentTenantId } from '../common/context/tenant-context';

/**
 * Wraps PrismaClient so that every query issued through `forTenant()` runs
 * inside a transaction that first sets the Postgres session variable
 * `app.current_tenant_id`, which the RLS policies (prisma/rls-policies.sql)
 * filter on. This is what makes tenant isolation a database guarantee
 * instead of something every service method has to remember to do.
 *
 * Connects as `app_user` (APP_DATABASE_URL) — the restricted role that RLS
 * actually applies to. Migrations use the separate superuser DATABASE_URL.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  public readonly client: PrismaClient;

  constructor(private readonly config: ConfigService) {
    const appDatabaseUrl = this.config.get<string>('app.appDatabaseUrl');
    this.client = new PrismaClient({
      datasources: {
        db: { url: appDatabaseUrl },
      },
    });
  }

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }

  /**
   * Runs `fn` with a Prisma client whose session has app.current_tenant_id
   * set to the current tenant context (or explicitly passed tenantId).
   * Use this for ALL tenant-scoped reads/writes.
   */
  async forTenant<T>(
    fn: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>,
    tenantIdOverride?: string,
  ): Promise<T> {
    const tenantId = tenantIdOverride ?? getCurrentTenantId();
    if (!tenantId) {
      throw new Error(
        'forTenant() called with no tenant context. This is a bug: every tenant-scoped ' +
          'query must run inside a request that has resolved a tenant id.',
      );
    }

    return this.client.$transaction(
      async (tx) => {
        // set_config with is_local=true behaves like SET LOCAL, scoped to this transaction only.
        await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', $1, true)`, tenantId);
        return fn(tx);
      },
      {
        timeout: 15000, // max duration once the transaction has started
        maxWait: 10000, // max time waiting to even acquire a connection
      },
    );
  }

  /**
   * Escape hatch for account-level operations that are intentionally NOT
   * tenant-scoped (e.g. looking up an AdminUser by email during login,
   * before any tenant context exists). `tenants` and `admin_users` are not
   * RLS-protected — application code must apply its own filtering here.
   */
  get unscoped(): PrismaClient {
    return this.client;
  }
}
