import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { getCurrentAdminUserId, getCurrentTenantId } from '../common/context/tenant-context';
import { CreateTeamMemberDto } from './dto/create-team-member.dto';

const TEAM_MEMBER_SELECT = { id: true, email: true, role: true, isPlatformAdmin: true, createdAt: true } as const;

// admin_users isn't RLS-scoped (see rls-policies.sql) — same reasoning as
// SettingsService and AuthController: every query here goes through
// prisma.unscoped with an explicit tenantId filter instead of forTenant().
@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.unscoped.adminUser.findMany({
      where: { tenantId: getCurrentTenantId()! },
      select: TEAM_MEMBER_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(dto: CreateTeamMemberDto) {
    await this.requireOwner('add team members');

    const existing = await this.prisma.unscoped.adminUser.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    // 9 random bytes -> 12 URL-safe base64 characters — short enough to
    // read aloud/type over chat, long enough (72 bits) to be safe for the
    // brief window before the member logs in and changes it themselves
    // (see AuthController's PATCH /auth/password).
    const temporaryPassword = randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    const member = await this.prisma.unscoped.adminUser.create({
      data: {
        tenantId: getCurrentTenantId()!,
        email: dto.email,
        passwordHash,
        role: dto.role ?? 'staff',
      },
      select: TEAM_MEMBER_SELECT,
    });

    // The only point this plaintext password ever exists — returned once so
    // the owner can hand it to the new member, never retrievable again.
    return { ...member, temporaryPassword };
  }

  async remove(id: string) {
    const requestingUserId = getCurrentAdminUserId()!;
    if (id === requestingUserId) {
      throw new ForbiddenException('You cannot remove your own account');
    }
    await this.requireOwner('remove team members');

    const member = await this.prisma.unscoped.adminUser.findFirst({
      where: { id, tenantId: getCurrentTenantId()! },
    });
    if (!member) throw new NotFoundException('Team member not found');

    await this.prisma.unscoped.adminUser.delete({ where: { id } });
  }

  private async requireOwner(action: string) {
    const requester = await this.prisma.unscoped.adminUser.findUniqueOrThrow({
      where: { id: getCurrentAdminUserId()! },
    });
    if (requester.role !== 'owner') {
      throw new ForbiddenException(`Only an owner can ${action}`);
    }
  }
}
