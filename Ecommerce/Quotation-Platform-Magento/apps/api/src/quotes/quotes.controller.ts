import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { UpdateQuoteStatusDto } from './dto/update-quote-status.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { CreateLineItemDto } from './dto/create-line-item.dto';
import { UpdateLineItemDto } from './dto/update-line-item.dto';
import { SaveAsTemplateDto } from './dto/save-as-template.dto';
import { SendQuoteDto } from './dto/send-quote.dto';

@UseGuards(JwtAuthGuard)
@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Post()
  create(@Body() dto: CreateQuoteDto) {
    return this.quotes.create(dto);
  }

  @Get()
  list() {
    return this.quotes.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.quotes.getFull(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateQuoteDto) {
    return this.quotes.updateHeader(id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateQuoteStatusDto) {
    return this.quotes.updateStatus(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.quotes.remove(id);
  }

  @Post(':id/save-as-template')
  saveAsTemplate(@Param('id') id: string, @Body() dto: SaveAsTemplateDto) {
    return this.quotes.saveAsTemplate(id, dto.name);
  }

  @Post(':id/convert-to-invoice')
  convertToInvoice(@Param('id') id: string) {
    return this.quotes.convertToInvoice(id);
  }

  @Post(':id/revert-to-quote')
  revertToQuote(@Param('id') id: string) {
    return this.quotes.revertToQuote(id);
  }

  @Post(':id/send')
  sendEmail(@Param('id') id: string, @Body() dto: SendQuoteDto) {
    return this.quotes.sendEmail(id, dto);
  }

  @Post(':id/sections')
  createSection(@Param('id') quoteId: string, @Body() dto: CreateSectionDto) {
    return this.quotes.createSection(quoteId, dto);
  }

  @Patch(':id/sections/:sectionId')
  updateSection(
    @Param('id') quoteId: string,
    @Param('sectionId') sectionId: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.quotes.updateSection(quoteId, sectionId, dto);
  }

  @Delete(':id/sections/:sectionId')
  removeSection(@Param('id') quoteId: string, @Param('sectionId') sectionId: string) {
    return this.quotes.removeSection(quoteId, sectionId);
  }

  @Post(':id/sections/:sectionId/line-items')
  createLineItem(
    @Param('id') quoteId: string,
    @Param('sectionId') sectionId: string,
    @Body() dto: CreateLineItemDto,
  ) {
    return this.quotes.createLineItem(quoteId, sectionId, dto);
  }

  @Patch(':id/sections/:sectionId/line-items/:lineItemId')
  updateLineItem(
    @Param('id') quoteId: string,
    @Param('sectionId') sectionId: string,
    @Param('lineItemId') lineItemId: string,
    @Body() dto: UpdateLineItemDto,
  ) {
    return this.quotes.updateLineItem(quoteId, sectionId, lineItemId, dto);
  }

  @Delete(':id/sections/:sectionId/line-items/:lineItemId')
  removeLineItem(
    @Param('id') quoteId: string,
    @Param('sectionId') sectionId: string,
    @Param('lineItemId') lineItemId: string,
  ) {
    return this.quotes.removeLineItem(quoteId, sectionId, lineItemId);
  }
}
