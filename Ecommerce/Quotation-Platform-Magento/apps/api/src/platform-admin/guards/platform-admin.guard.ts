import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { JwtPayload } from '../../auth/jwt-payload.interface';

// Must run AFTER JwtAuthGuard, which populates req.user from a verified JWT.
// isPlatformAdmin can only ever be true because it was set directly in the
// database (see prisma/scripts/seed-platform-admin.ts) — there is no API
// path that lets an account grant this to itself or anyone else.
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    if (!req.user?.isPlatformAdmin) {
      throw new ForbiddenException('Platform admin access required');
    }
    return true;
  }
}
