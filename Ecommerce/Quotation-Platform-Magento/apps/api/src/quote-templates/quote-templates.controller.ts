import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QuoteTemplatesService } from './quote-templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { CreateSectionDto } from '../quotes/dto/create-section.dto';
import { UpdateSectionDto } from '../quotes/dto/update-section.dto';
import { CreateLineItemDto } from '../quotes/dto/create-line-item.dto';
import { UpdateLineItemDto } from '../quotes/dto/update-line-item.dto';

@UseGuards(JwtAuthGuard)
@Controller('quote-templates')
export class QuoteTemplatesController {
  constructor(private readonly templates: QuoteTemplatesService) {}

  @Post()
  create(@Body() dto: CreateTemplateDto) {
    return this.templates.create(dto);
  }

  @Get()
  list() {
    return this.templates.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.templates.getFull(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.templates.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.templates.remove(id);
  }

  @Post(':id/sections')
  createSection(@Param('id') templateId: string, @Body() dto: CreateSectionDto) {
    return this.templates.createSection(templateId, dto);
  }

  @Patch(':id/sections/:sectionId')
  updateSection(@Param('id') templateId: string, @Param('sectionId') sectionId: string, @Body() dto: UpdateSectionDto) {
    return this.templates.updateSection(templateId, sectionId, dto);
  }

  @Delete(':id/sections/:sectionId')
  removeSection(@Param('id') templateId: string, @Param('sectionId') sectionId: string) {
    return this.templates.removeSection(templateId, sectionId);
  }

  @Post(':id/sections/:sectionId/line-items')
  createLineItem(
    @Param('id') templateId: string,
    @Param('sectionId') sectionId: string,
    @Body() dto: CreateLineItemDto,
  ) {
    return this.templates.createLineItem(templateId, sectionId, dto);
  }

  @Patch(':id/sections/:sectionId/line-items/:lineItemId')
  updateLineItem(
    @Param('id') templateId: string,
    @Param('sectionId') sectionId: string,
    @Param('lineItemId') lineItemId: string,
    @Body() dto: UpdateLineItemDto,
  ) {
    return this.templates.updateLineItem(templateId, sectionId, lineItemId, dto);
  }

  @Delete(':id/sections/:sectionId/line-items/:lineItemId')
  removeLineItem(
    @Param('id') templateId: string,
    @Param('sectionId') sectionId: string,
    @Param('lineItemId') lineItemId: string,
  ) {
    return this.templates.removeLineItem(templateId, sectionId, lineItemId);
  }
}
