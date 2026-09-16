import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateItemDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultUnitPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultVatRate?: number;

  @IsOptional()
  @IsString()
  account?: string;

  @IsOptional()
  @IsString()
  unit?: string;
}
