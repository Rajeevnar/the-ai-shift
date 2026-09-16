import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SettingsController } from './settings.controller';
import { PublicBrandingController } from './public-branding.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [AuthModule],
  controllers: [SettingsController, PublicBrandingController],
  providers: [SettingsService],
})
export class SettingsModule {}
