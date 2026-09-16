import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAdminGuard } from './guards/platform-admin.guard';

@Module({
  imports: [AuthModule],
  controllers: [PlatformAdminController],
  providers: [PlatformAdminService, PlatformAdminGuard],
})
export class PlatformAdminModule {}
