import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from './guards/platform-admin.guard';
import { PlatformAdminService } from './platform-admin.service';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';

@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('platform-admin/tenants')
export class PlatformAdminController {
  constructor(private readonly platformAdmin: PlatformAdminService) {}

  @Get()
  list() {
    return this.platformAdmin.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.platformAdmin.get(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateTenantStatusDto) {
    return this.platformAdmin.updateStatus(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.platformAdmin.remove(id);
  }
}
