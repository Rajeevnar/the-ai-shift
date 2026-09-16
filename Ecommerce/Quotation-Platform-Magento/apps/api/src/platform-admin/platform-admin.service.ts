import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';

// Every method here uses prisma.unscoped deliberately — tenants/admin_users
// are not RLS-scoped (see rls-policies.sql), and a platform admin managing
// tenants is, by definition, operating across every tenant at once, not
// within any single one's context.
@Injectable()
export class PlatformAdminService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.unscoped.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
        adminUsers: { select: { id: true, email: true, role: true, isPlatformAdmin: true } },
      },
    });
  }

  async get(id: string) {
    const tenant = await this.prisma.unscoped.tenant.findUnique({
      where: { id },
      include: { adminUsers: { select: { id: true, email: true, role: true, isPlatformAdmin: true, createdAt: true } } },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async updateStatus(id: string, dto: UpdateTenantStatusDto) {
    await this.get(id);
    return this.prisma.unscoped.tenant.update({ where: { id }, data: { isActive: dto.isActive } });
  }

  async remove(id: string) {
    await this.get(id);
    // Cascades to every tenant-owned table (admin_users, store_connectors,
    // item_library_items, clients, quotes -> sections -> line items) via
    // the onDelete: Cascade relations declared in schema.prisma.
    await this.prisma.unscoped.tenant.delete({ where: { id } });
  }
}
