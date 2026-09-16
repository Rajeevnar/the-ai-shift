import { Controller, Get, Header, NotFoundException, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

// Deliberately unauthenticated and outside SettingsController's
// JwtAuthGuard — this is what outgoing emails' <img src> points at (see
// logo-url.util.ts), fetched by the recipient's mail client, which has no
// way to send this tenant's bearer token. tenantId in the URL is a
// non-secret identifier (same trust level as it appearing in a JWT payload
// or any other tenant-scoped API response), and only the logo bytes
// (already meant to be publicly displayed) are exposed here.
@Controller('public/branding')
export class PublicBrandingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':tenantId/logo')
  @Header('Cache-Control', 'public, max-age=3600')
  async logo(@Param('tenantId') tenantId: string, @Res() res: Response) {
    const tenant = await this.prisma.unscoped.tenant.findUnique({
      where: { id: tenantId },
      select: { logoUrl: true },
    });
    if (!tenant?.logoUrl?.startsWith('data:')) {
      throw new NotFoundException('No logo set for this tenant');
    }

    const match = /^data:([^;]+);base64,(.+)$/s.exec(tenant.logoUrl);
    if (!match) throw new NotFoundException('Stored logo is malformed');
    const [, mimeType, base64] = match;

    res.setHeader('Content-Type', mimeType);
    res.send(Buffer.from(base64, 'base64'));
  }
}
