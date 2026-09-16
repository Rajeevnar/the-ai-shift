import { PartialType } from '@nestjs/mapped-types';
import { CreateLineItemDto } from './create-line-item.dto';

export class UpdateLineItemDto extends PartialType(CreateLineItemDto) {}
