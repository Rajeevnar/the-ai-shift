import { IsString, MinLength } from 'class-validator';

export class SaveAsTemplateDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
