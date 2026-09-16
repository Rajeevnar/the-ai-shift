export interface PlatformSmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  appDatabaseUrl: string;
  jwtSecret: string;
  encryptionKey: string;
  // Used to build the link in password-reset emails — the admin app's own
  // public URL, which the API has no other way to know (NEXT_PUBLIC_API_URL
  // is the reverse: how the admin app finds the API).
  adminAppUrl: string;
  // The API's own public URL — used to build the logo image URL embedded in
  // outgoing emails (see settings/logo-url.util.ts). Uploaded logos are
  // stored as data: URLs in Postgres (see SettingsService.updateLogo), but
  // most email clients (Gmail included) strip/block data: URIs in <img
  // src>, and a multi-MB data URL inline in the HTML also pushes the
  // message over Gmail's ~102KB clip threshold. Emails reference a real
  // HTTPS URL to a public endpoint that serves the decoded bytes instead.
  apiPublicUrl: string;
  // Fallback sender used when a tenant hasn't connected their own
  // EmailConnector — undefined (not a half-filled object) unless ALL of
  // host/username/password/fromEmail are actually set, so EmailService can
  // do a single truthy check rather than validating individual fields.
  platformSmtp?: PlatformSmtpConfig;
}

export default (): { app: AppConfig } => {
  const host = process.env.PLATFORM_SMTP_HOST;
  const username = process.env.PLATFORM_SMTP_USERNAME;
  const password = process.env.PLATFORM_SMTP_PASSWORD;
  const fromEmail = process.env.PLATFORM_SMTP_FROM_EMAIL;

  const platformSmtp: PlatformSmtpConfig | undefined =
    host && username && password && fromEmail
      ? {
          host,
          port: parseInt(process.env.PLATFORM_SMTP_PORT ?? '587', 10),
          username,
          password,
          fromEmail,
        }
      : undefined;

  return {
    app: {
      port: parseInt(process.env.PORT ?? '3001', 10),
      nodeEnv: process.env.NODE_ENV ?? 'development',
      appDatabaseUrl: process.env.APP_DATABASE_URL ?? '',
      jwtSecret: process.env.JWT_SECRET ?? '',
      encryptionKey: process.env.ENCRYPTION_KEY ?? '',
      adminAppUrl: process.env.ADMIN_APP_URL ?? 'http://localhost:3000',
      apiPublicUrl: process.env.API_PUBLIC_URL ?? 'http://localhost:3001',
      platformSmtp,
    },
  };
};
