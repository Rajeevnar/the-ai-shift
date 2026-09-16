import { IsEmail, IsOptional, IsString } from 'class-validator';

export class SendQuoteDto {
  // Defaults to the attached client's email if omitted.
  @IsOptional()
  @IsEmail()
  toEmail?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  // Overrides the tenant's default intro message for just this send —
  // falls back to Quote.notes, then Tenant.quoteIntroMessage.
  @IsOptional()
  @IsString()
  message?: string;
}
