import { IsEmail, IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

const PROVIDERS = ['brevo', 'sendgrid', 'postmark', 'mailgun', 'resend', 'custom'] as const;
export type EmailProviderPresetValue = (typeof PROVIDERS)[number];

export class ConnectEmailDto {
  @IsIn(PROVIDERS)
  provider!: EmailProviderPresetValue;

  // Must be a sender verified with the provider, or their send will be
  // rejected — that verification happens on the provider's side, this app
  // has no way to check it in advance.
  @IsEmail()
  fromEmail!: string;

  @IsString()
  @MinLength(1)
  fromName!: string;

  // Only required/used when provider is "custom" — known presets resolve
  // their own host/port server-side (see PROVIDER_SMTP_PRESETS).
  @IsOptional()
  @IsString()
  smtpHost?: string;

  @IsOptional()
  @IsInt()
  smtpPort?: number;

  @IsString()
  @MinLength(1)
  smtpUsername!: string;

  // Optional — leave blank on an update to keep the existing saved
  // password/API-key, same "blank means keep current" pattern as the
  // Magento connector.
  @IsOptional()
  @IsString()
  smtpPassword?: string;
}
