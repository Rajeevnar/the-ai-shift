import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContextData {
  tenantId?: string;
  adminUserId?: string;
}

/**
 * Carries the current request's tenant identity through the call stack
 * without threading it through every function signature. Established via
 * tenantContextStorage.run() in TenantMiddleware — the ONLY place this
 * should ever be set. See TenantMiddleware's doc comment for why: a Guard
 * mutating this via enterWith() (the original design) doesn't reliably
 * survive into the controller, because Nest runs guards through
 * Promise.all(), which forks the async context away from the continuation
 * that resumes afterward. Everything downstream (guards, services,
 * PrismaService.forTenant) only ever READS from this context via
 * getCurrentTenantId()/getCurrentAdminUserId() below.
 */
export const tenantContextStorage = new AsyncLocalStorage<TenantContextData>();

export function getCurrentTenantId(): string | undefined {
  return tenantContextStorage.getStore()?.tenantId;
}

export function getCurrentAdminUserId(): string | undefined {
  return tenantContextStorage.getStore()?.adminUserId;
}
