import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/crypto/encryption.service';
import { getCurrentTenantId } from '../common/context/tenant-context';
import { ConnectEmailDto, EmailProviderPresetValue } from './dto/connect-email.dto';
import { verifyResendApiKey } from './resend-api.client';

// Every popular transactional email provider exposes a standard SMTP relay
// alongside its own REST API — so one generic SMTP sender with presets for
// the well-known ones (host/port only; the tenant still supplies their own
// username/password) covers all of them without a separate integration
// per provider. "custom" is the escape hatch for anything else.
export const PROVIDER_SMTP_PRESETS: Record<Exclude<EmailProviderPresetValue, 'custom'>, { host: string; port: number }> = {
  brevo: { host: 'smtp-relay.brevo.com', port: 587 },
  sendgrid: { host: 'smtp.sendgrid.net', port: 587 },
  postmark: { host: 'smtp.postmarkapp.com', port: 587 },
  mailgun: { host: 'smtp.mailgun.org', port: 587 },
  resend: { host: 'smtp.resend.com', port: 587 },
};

interface ResolvedSmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

@Injectable()
export class EmailConnectorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async test(dto: ConnectEmailDto) {
    const existing = await this.prisma.forTenant((tx) => tx.emailConnector.findUnique({ where: { tenantId: getCurrentTenantId()! } }));
    const resolved = this.resolveConfig(dto, existing);
    await this.verifyConnection(dto.provider, resolved);
    return { success: true };
  }

  async connect(dto: ConnectEmailDto) {
    const existing = await this.prisma.forTenant((tx) => tx.emailConnector.findUnique({ where: { tenantId: getCurrentTenantId()! } }));
    const resolved = this.resolveConfig(dto, existing);

    // Verify before saving — same reasoning as the Magento connector: a
    // connector marked "connected" that was never actually reachable is
    // worse than none at all.
    await this.verifyConnection(dto.provider, resolved);

    const encryptedPassword = this.encryption.encrypt(resolved.password);

    return this.prisma.forTenant(async (tx) => {
      const data = {
        provider: dto.provider,
        status: 'connected' as const,
        fromEmail: dto.fromEmail,
        fromName: dto.fromName,
        smtpHost: resolved.host,
        smtpPort: resolved.port,
        smtpUsername: resolved.username,
        credentials: encryptedPassword,
      };
      const connector = existing
        ? await tx.emailConnector.update({ where: { id: existing.id }, data })
        : await tx.emailConnector.create({ data: { ...data, tenantId: getCurrentTenantId()! } });
      return this.toSafeConnector(connector);
    });
  }

  async get() {
    const connector = await this.prisma.forTenant((tx) => tx.emailConnector.findUnique({ where: { tenantId: getCurrentTenantId()! } }));
    if (!connector) throw new NotFoundException('No email connector configured');
    return this.toSafeConnector(connector);
  }

  async remove() {
    const existing = await this.prisma.forTenant((tx) => tx.emailConnector.findUnique({ where: { tenantId: getCurrentTenantId()! } }));
    if (!existing) throw new NotFoundException('No email connector configured');
    await this.prisma.forTenant((tx) => tx.emailConnector.delete({ where: { id: existing.id } }));
  }

  // Resolves host/port (from the preset, or the DTO for "custom") and the
  // password (from the DTO, or the existing saved one if left blank).
  private resolveConfig(
    dto: ConnectEmailDto,
    existing: { smtpHost: string; smtpPort: number; credentials: string } | null,
  ): ResolvedSmtpConfig {
    let host: string;
    let port: number;
    if (dto.provider === 'custom') {
      if (!dto.smtpHost || !dto.smtpPort) {
        throw new BadRequestException('SMTP host and port are required for a custom provider');
      }
      host = dto.smtpHost;
      port = dto.smtpPort;
    } else {
      ({ host, port } = PROVIDER_SMTP_PRESETS[dto.provider]);
    }

    let password: string;
    if (dto.smtpPassword) {
      password = dto.smtpPassword;
    } else if (existing) {
      password = this.encryption.decrypt(existing.credentials);
    } else {
      throw new BadRequestException('SMTP password/API key is required');
    }

    return { host, port, username: dto.smtpUsername, password };
  }

  private async verifyConnection(provider: EmailProviderPresetValue, config: ResolvedSmtpConfig) {
    // Resend goes over its HTTPS API, not SMTP — see resend-api.client.ts
    // for why (Render's free tier blocks outbound SMTP ports entirely,
    // which would otherwise make "Test connection"/"Connect" hang or fail
    // for this provider specifically, same as sending would).
    if (provider === 'resend') {
      try {
        await verifyResendApiKey(config.password);
      } catch (err) {
        throw new BadGatewayException((err as Error).message);
      }
      return;
    }
    await this.verifyTransport(config);
  }

  private async verifyTransport(config: ResolvedSmtpConfig) {
    // Without an explicit timeout, nodemailer's own default is up to 2
    // minutes before it gives up — if the provider silently drops the
    // connection (e.g. an IP-allowlist blocking Render's servers, unlike
    // whichever IP was allowlisted for local testing), the request just
    // hangs with no feedback in the UI ("Saving…" forever) instead of
    // failing fast with a clear error.
    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.username, pass: config.password },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
    });
    try {
      await transport.verify();
    } catch (err) {
      throw new BadGatewayException(`Could not verify SMTP connection: ${(err as Error).message}`);
    }
  }

  private toSafeConnector<T extends { credentials: string }>(connector: T) {
    const { credentials: _credentials, ...safe } = connector;
    return safe;
  }
}
