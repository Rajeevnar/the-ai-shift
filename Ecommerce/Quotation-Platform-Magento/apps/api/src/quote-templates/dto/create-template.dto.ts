import { IsString, MinLength } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
