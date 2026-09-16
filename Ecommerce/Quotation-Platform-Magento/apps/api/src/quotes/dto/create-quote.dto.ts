import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateQuoteDto {
  // Optional — a quote can be started with no client attached yet and one
  // picked/created from the builder page afterward, so "New quote" never
  // has to gate on a client-picker step first.
  @IsOptional()
  @IsString()
  @MinLength(1)
  clientId?: string;

  // Optional — defaults to today server-side (see QuotesService.create) so
  // a quote can be created with a single click.
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // When set, the new quote's sections/line items are cloned from this
  // template instead of starting empty — see QuotesService.create.
  @IsOptional()
  @IsString()
  templateId?: string;
}
