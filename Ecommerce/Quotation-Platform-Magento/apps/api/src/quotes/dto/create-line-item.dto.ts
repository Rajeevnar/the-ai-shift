import { IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateLineItemDto {
  // Picked from the item library (Xero-style item picker); when set, the
  // service seeds description/unitPrice/vatRate/account from that item as
  // defaults the caller can still override with the fields below.
  @IsOptional()
  @IsString()
  itemLibraryItemId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPercent?: number;

  @IsOptional()
  @IsString()
  account?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  vatRate?: number;

  @IsOptional()
  @IsInt()
  position?: number;
}
