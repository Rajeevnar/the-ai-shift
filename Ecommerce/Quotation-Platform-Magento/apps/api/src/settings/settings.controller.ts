import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SettingsService } from './settings.service';
import { UpdateBrandingDto } from './dto/update-branding.dto';

// gif included specifically for animated logos — png/jpeg/webp/svg don't
// animate (webp technically can, but gif is what people actually use).
const ALLOWED_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/gif']);
// 5MB — still stored inline in Postgres (see SettingsService.updateLogo),
// so this stays well short of anything that would bloat the tenant row;
// 2MB was too tight for a real animated gif logo.
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

@UseGuards(JwtAuthGuard)
@Controller('settings/branding')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get() {
    return this.settings.getBranding();
  }

  @Patch()
  update(@Body() dto: UpdateBrandingDto) {
    return this.settings.updateBranding(dto);
  }

  @Post('logo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_LOGO_BYTES } }))
  uploadLogo(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!ALLOWED_LOGO_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Logo must be a PNG, JPEG, WebP, GIF or SVG image');
    }
    return this.settings.updateLogo(file);
  }
}
