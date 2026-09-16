import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { tenantContextStorage, TenantContextData } from '../context/tenant-context';
import { JwtPayload } from '../../auth/jwt-payload.interface';

/**
 * Verifies the Authorization: Bearer <token> header (if present) and
 * establishes the request's tenant context in ONE step, via
 * tenantContextStorage.run() — not a later enterWith() mutation from a
 * Guard.
 *
 * This split matters and is NOT how it was first built: the original
 * version only seeded an EMPTY context here and had JwtAuthGuard populate
 * tenantId afterward via enterWith(). That silently broke every
 * tenant-scoped request — Nest runs guards through
 * `Promise.all(guards.map(async g => g.canActivate(ctx)))`, and ANY
 * mutation a guard makes via enterWith() (even from a fully synchronous
 * guard body) lands in a context branch that Promise.all's own
 * continuation never sees, so the controller method that runs afterward
 * was always back to the ORIGINAL empty context — every forTenant() call
 * then threw "no tenant context" despite the guard itself reporting
 * success. Confirmed empirically (not just theorized) by tracing
 * AsyncLocalStorage.getStore() at each stage before landing on this fix.
 *
 * The fix: resolve the JWT and pass the REAL store straight into `.run()`
 * here, before any guard runs at all. `.run()` (unlike enterWith) wraps the
 * entire downstream continuation — every following middleware, guard, and
 * the controller itself — so this is immune to the Promise.all issue.
 * JwtAuthGuard now only READS this already-established context (and can
 * safely do async work afterward, e.g. the tenant-paused check) — it never
 * needs to WRITE to it, which is what made the guard-based approach unsafe.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly jwt: JwtService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const store: TenantContextData = {};
    const authHeader = req.headers['authorization'];

    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = this.jwt.verify<JwtPayload>(authHeader.slice('Bearer '.length).trim());
        store.tenantId = payload.tenantId;
        store.adminUserId = payload.sub;
        (req as Request & { user?: JwtPayload }).user = payload;
      } catch {
        // Invalid/expired token: leave the store empty. JwtAuthGuard (on
        // routes that require it) rejects the request since no tenantId
        // was established; public routes (login/register) never check.
      }
    }

    tenantContextStorage.run(store, () => next());
  }
}
