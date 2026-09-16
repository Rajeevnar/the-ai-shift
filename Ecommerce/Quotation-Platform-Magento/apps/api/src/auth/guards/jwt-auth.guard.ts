import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentTenantId } from '../../common/context/tenant-context';

/**
 * Rejects any request that TenantMiddleware couldn't resolve a tenant
 * context for (missing/invalid/expired token — see TenantMiddleware for
 * why establishing that context lives there, not here), then re-checks
 * Tenant.isActive on every request so a platform admin pausing a tenant
 * takes effect immediately rather than only blocking that tenant's NEXT
 * login.
 *
 * Deliberately only READS the tenant context, never writes it — see
 * TenantMiddleware's doc comment for why a guard mutating
 * AsyncLocalStorage via enterWith() doesn't reliably reach the controller.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(_context: ExecutionContext): Promise<boolean> {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const tenant = await this.prisma.unscoped.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || !tenant.isActive) {
      throw new ForbiddenException('This account has been paused. Contact support for help.');
    }

    return true;
  }
}
