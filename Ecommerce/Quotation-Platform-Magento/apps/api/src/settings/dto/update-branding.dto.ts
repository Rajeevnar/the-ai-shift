import { IsOptional, IsString, Matches } from 'class-validator';

export class UpdateBrandingDto {
  // Accepts either a normal http(s) URL (pasted by the tenant) or a
  // data:image/...;base64,... URI (produced by the logo upload endpoint) —
  // this same field round-trips through this DTO whenever any other
  // branding field is saved, so it must tolerate whichever form is
  // currently stored, not just freshly-typed URLs.
  @IsOptional()
  @IsString()
  @Matches(/^(https?:\/\/|data:image\/)/, { message: 'logoUrl must be a valid image URL' })
  logoUrl?: string;

  @IsOptional()
  @IsString()
  brandColor?: string;

  @IsOptional()
  @IsString()
  emailBgColor?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  emailFromName?: string;

  @IsOptional()
  @IsString()
  quoteHeaderTitle?: string;

  @IsOptional()
  @IsString()
  quoteIntroMessage?: string;

  @IsOptional()
  @IsString()
  quoteFooterMessage?: string;
}
