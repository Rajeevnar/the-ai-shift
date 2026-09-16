import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload } from './jwt-payload.interface';
import { EmailService } from '../email/email.service';
import { renderPasswordResetEmail } from './password-reset-email.template';
import { tenantContextStorage } from '../common/context/tenant-context';
import { toEmailLogoUrl } from '../settings/logo-url.util';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  // tenants/admin_users are not RLS-scoped (see rls-policies.sql), and there
  // is no tenant context yet at this point anyway — both operations go
  // through prisma.unscoped rather than forTenant().
  async register(dto: RegisterDto) {
    const existing = await this.prisma.unscoped.adminUser.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    // isPlatformAdmin defaults to false and is never settable here —
    // deliberately no self-service path to platform-admin (see
    // AdminUser.isPlatformAdmin in schema.prisma).
    const { tenant, adminUser } = await this.prisma.unscoped.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: dto.tenantName, email: dto.email },
      });
      const adminUser = await tx.adminUser.create({
        data: { tenantId: tenant.id, email: dto.email, passwordHash, role: 'owner' },
      });
      return { tenant, adminUser };
    });

    return this.issueToken({ sub: adminUser.id, tenantId: tenant.id, isPlatformAdmin: adminUser.isPlatformAdmin });
  }

  async login(dto: LoginDto) {
    const adminUser = await this.prisma.unscoped.adminUser.findUnique({
      where: { email: dto.email },
      include: { tenant: true },
    });
    if (!adminUser || !(await bcrypt.compare(dto.password, adminUser.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!adminUser.tenant.isActive) {
      throw new ForbiddenException('This account has been paused. Contact support for help.');
    }

    return this.issueToken({ sub: adminUser.id, tenantId: adminUser.tenantId, isPlatformAdmin: adminUser.isPlatformAdmin });
  }

  // Self-service only — there's no separate "admin resets someone else's
  // password" path. If an owner needs to reset a team member who's locked
  // out, the workaround is to remove and re-invite them (see TeamService),
  // which issues a fresh temporary password.
  async changePassword(adminUserId: string, dto: ChangePasswordDto) {
    const adminUser = await this.prisma.unscoped.adminUser.findUniqueOrThrow({ where: { id: adminUserId } });
    if (!(await bcrypt.compare(dto.currentPassword, adminUser.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.unscoped.adminUser.update({ where: { id: adminUserId }, data: { passwordHash } });
  }

  // Always resolves the same way regardless of whether the email matches an
  // account — the caller shows one generic message either way, so this
  // never reveals which emails exist (a real, if minor, enumeration risk
  // otherwise: an attacker could otherwise probe which of your merchants'
  // staff emails are registered).
  async forgotPassword(dto: ForgotPasswordDto) {
    const adminUser = await this.prisma.unscoped.adminUser.findUnique({ where: { email: dto.email } });
    if (adminUser) {
      const token = randomBytes(32).toString('hex');
      await this.prisma.unscoped.adminUser.update({
        where: { id: adminUser.id },
        data: { resetToken: token, resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
      });

      const tenant = await this.prisma.unscoped.tenant.findUniqueOrThrow({
        where: { id: adminUser.tenantId },
        select: { name: true, logoUrl: true, brandColor: true, quoteHeaderTitle: true },
      });
      const resetUrl = `${this.config.get<string>('app.adminAppUrl')}/reset-password?token=${token}`;
      const html = renderPasswordResetEmail(
        {
          tenantName: tenant.name,
          logoUrl: toEmailLogoUrl(this.config.get<string>('app.apiPublicUrl')!, adminUser.tenantId, tenant.logoUrl),
          brandColor: tenant.brandColor,
          headerTitle: tenant.quoteHeaderTitle,
        },
        resetUrl,
      );

      // EmailService reads the current tenant from AsyncLocalStorage (see
      // TenantMiddleware) — there's no logged-in request here to establish
      // that the normal way, so it's set explicitly just for this send.
      await tenantContextStorage.run({ tenantId: adminUser.tenantId, adminUserId: adminUser.id }, () =>
        this.email.send({ to: adminUser.email, subject: 'Reset your password', html }),
      );
    }

    return { message: 'If an account exists for that email, a password reset link has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const adminUser = await this.prisma.unscoped.adminUser.findUnique({ where: { resetToken: dto.token } });
    if (!adminUser || !adminUser.resetTokenExpiresAt || adminUser.resetTokenExpiresAt < new Date()) {
      throw new BadRequestException('This reset link is invalid or has expired. Request a new one.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.unscoped.adminUser.update({
      where: { id: adminUser.id },
      data: { passwordHash, resetToken: null, resetTokenExpiresAt: null },
    });

    // Logs them straight in — they just proved account ownership via email,
    // so there's no reason to make them type the new password again on a
    // separate login screen.
    return this.issueToken({ sub: adminUser.id, tenantId: adminUser.tenantId, isPlatformAdmin: adminUser.isPlatformAdmin });
  }

  private issueToken(payload: JwtPayload) {
    return { accessToken: this.jwt.sign(payload) };
  }
}
