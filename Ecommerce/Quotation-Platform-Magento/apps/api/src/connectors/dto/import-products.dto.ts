import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class ImportProductsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  connectorProductIds!: string[];
}
