import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getCurrentTenantId } from '../common/context/tenant-context';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { sanitizeRichText } from './rich-text.util';

const BRANDING_SELECT = {
  name: true,
  logoUrl: true,
  brandColor: true,
  emailBgColor: true,
  address: true,
  phone: true,
  emailFromName: true,
  quoteHeaderTitle: true,
  quoteIntroMessage: true,
  quoteFooterMessage: true,
} as const;

// Tenants aren't RLS-scoped (see rls-policies.sql) — same reasoning as
// AuthController's /auth/me: goes through prisma.unscoped with an explicit
// id rather than forTenant().
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  getBranding() {
    return this.prisma.unscoped.tenant.findUniqueOrThrow({
      where: { id: getCurrentTenantId()! },
      select: BRANDING_SELECT,
    });
  }

  updateBranding(dto: UpdateBrandingDto) {
    // quoteIntroMessage/quoteFooterMessage arrive as HTML from the
    // Settings page's rich-text editor — sanitized here, at the point of
    // storage, so every reader (the outgoing email template, the admin's
    // own live preview) can trust what's already in the database instead
    // of re-sanitizing on every read.
    const data = {
      ...dto,
      quoteIntroMessage: dto.quoteIntroMessage !== undefined ? sanitizeRichText(dto.quoteIntroMessage) : undefined,
      quoteFooterMessage: dto.quoteFooterMessage !== undefined ? sanitizeRichText(dto.quoteFooterMessage) : undefined,
    };
    return this.prisma.unscoped.tenant.update({
      where: { id: getCurrentTenantId()! },
      data,
      select: BRANDING_SELECT,
    });
  }

  // Stores the uploaded logo directly as a data: URL in the same logoUrl
  // column used for pasted external URLs — both render identically in an
  // <img> tag, so no schema change or separate storage service is needed.
  updateLogo(file: { mimetype: string; buffer: Buffer }) {
    const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    return this.prisma.unscoped.tenant.update({
      where: { id: getCurrentTenantId()! },
      data: { logoUrl: dataUrl },
      select: BRANDING_SELECT,
    });
  }
}
