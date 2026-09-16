import { BadGatewayException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/crypto/encryption.service';
import { getCurrentTenantId } from '../common/context/tenant-context';
import { PlatformSmtpConfig } from '../config/configuration';
import { sendViaResendApi } from './resend-api.client';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Sends via the current tenant's own EmailConnector if they've connected
   * one; otherwise falls back to the platform-level SMTP config (env vars)
   * using the TENANT's brand name as the From Name and the tenant's own
   * email as Reply-To, so replies still reach them even though the actual
   * sending account is the platform's.
   */
  async send(input: SendEmailInput): Promise<void> {
    const tenantId = getCurrentTenantId();
    const [connector, tenant] = await Promise.all([
      this.prisma.forTenant((tx) => tx.emailConnector.findUnique({ where: { tenantId: tenantId! } })),
      this.prisma.forTenant((tx) => tx.tenant.findUnique({ where: { id: tenantId! } })),
    ]);
    if (!tenant) throw new InternalServerErrorException('Tenant not found while sending email');

    // Only used for the platform-fallback path below — a tenant's own
    // connector already has its own dedicated fromName field.
    const fromName = tenant.emailFromName || tenant.name;

    if (connector) {
      // Resend goes over its HTTPS API, not SMTP — see resend-api.client.ts.
      if (connector.provider === 'resend') {
        await this.dispatchViaResendApi(this.encryption.decrypt(connector.credentials), {
          from: `${connector.fromName} <${connector.fromEmail}>`,
          ...input,
        });
        return;
      }
      const transport = nodemailer.createTransport({
        host: connector.smtpHost,
        port: connector.smtpPort,
        secure: connector.smtpPort === 465,
        auth: { user: connector.smtpUsername, pass: this.encryption.decrypt(connector.credentials) },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000,
      });
      await this.dispatchViaSmtp(transport, {
        from: `"${connector.fromName}" <${connector.fromEmail}>`,
        ...input,
      });
      return;
    }

    const platform = this.config.get<PlatformSmtpConfig | undefined>('app.platformSmtp');
    if (!platform) {
      throw new BadGatewayException(
        'No email connector is configured for this tenant, and the platform has no fallback sender set up. Connect an email provider under Settings, or ask the platform operator to configure PLATFORM_SMTP_* env vars.',
      );
    }

    // Same Resend-API special case for the platform fallback — detected by
    // host rather than a separate env var, since PLATFORM_SMTP_HOST is
    // already how the operator identifies which provider they configured.
    if (platform.host === 'smtp.resend.com') {
      await this.dispatchViaResendApi(platform.password, {
        from: `${fromName} <${platform.fromEmail}>`,
        replyTo: tenant.email,
        ...input,
      });
      return;
    }

    const transport = nodemailer.createTransport({
      host: platform.host,
      port: platform.port,
      secure: platform.port === 465,
      auth: { user: platform.username, pass: platform.password },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
    });
    await this.dispatchViaSmtp(transport, {
      from: `"${fromName}" <${platform.fromEmail}>`,
      replyTo: tenant.email,
      ...input,
    });
  }

  private async dispatchViaSmtp(
    transport: nodemailer.Transporter,
    mail: { from: string; to: string; subject: string; html: string; replyTo?: string },
  ) {
    try {
      await transport.sendMail(mail);
    } catch (err) {
      throw new BadGatewayException(`Failed to send email: ${(err as Error).message}`);
    }
  }

  private async dispatchViaResendApi(
    apiKey: string,
    mail: { from: string; to: string; subject: string; html: string; replyTo?: string },
  ) {
    try {
      await sendViaResendApi(apiKey, mail);
    } catch (err) {
      throw new BadGatewayException(`Failed to send email: ${(err as Error).message}`);
    }
  }
}
