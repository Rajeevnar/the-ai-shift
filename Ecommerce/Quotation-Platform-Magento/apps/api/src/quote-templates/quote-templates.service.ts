import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getCurrentTenantId } from '../common/context/tenant-context';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { CreateSectionDto } from '../quotes/dto/create-section.dto';
import { UpdateSectionDto } from '../quotes/dto/update-section.dto';
import { CreateLineItemDto } from '../quotes/dto/create-line-item.dto';
import { UpdateLineItemDto } from '../quotes/dto/update-line-item.dto';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

// A template's line items store the same reference fields a QuoteLineItem
// does (quantity/price/discount/VAT/account) but deliberately skip
// amount/taxAmount — those are computed roll-ups meaningful for a REAL
// quote, not a reusable starting point whose numbers get recalculated the
// moment they're copied into one (see QuotesService.create's templateId
// handling).
@Injectable()
export class QuoteTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateTemplateDto) {
    return this.prisma.forTenant((tx) =>
      tx.quoteTemplate.create({ data: { tenantId: getCurrentTenantId()!, name: dto.name } }),
    );
  }

  list() {
    return this.prisma.forTenant((tx) => tx.quoteTemplate.findMany({ orderBy: { name: 'asc' } }));
  }

  async getFull(id: string) {
    const template = await this.prisma.forTenant((tx) =>
      tx.quoteTemplate.findUnique({
        where: { id },
        include: { sections: { orderBy: { position: 'asc' }, include: { lineItems: { orderBy: { position: 'asc' } } } } },
      }),
    );
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async update(id: string, dto: UpdateTemplateDto) {
    await this.getFull(id);
    return this.prisma.forTenant((tx) => tx.quoteTemplate.update({ where: { id }, data: dto }));
  }

  async remove(id: string) {
    await this.getFull(id);
    await this.prisma.forTenant((tx) => tx.quoteTemplate.delete({ where: { id } }));
  }

  // -------------------- Sections --------------------

  async createSection(templateId: string, dto: CreateSectionDto) {
    return this.prisma.forTenant(async (tx) => {
      const template = await tx.quoteTemplate.findUnique({ where: { id: templateId } });
      if (!template) throw new NotFoundException('Template not found');

      const position = dto.position ?? (await tx.quoteTemplateSection.count({ where: { quoteTemplateId: templateId } }));
      return tx.quoteTemplateSection.create({ data: { quoteTemplateId: templateId, title: dto.title, position } });
    });
  }

  async updateSection(templateId: string, sectionId: string, dto: UpdateSectionDto) {
    return this.prisma.forTenant(async (tx) => {
      await this.requireSection(tx, templateId, sectionId);
      return tx.quoteTemplateSection.update({ where: { id: sectionId }, data: dto });
    });
  }

  async removeSection(templateId: string, sectionId: string) {
    return this.prisma.forTenant(async (tx) => {
      await this.requireSection(tx, templateId, sectionId);
      await tx.quoteTemplateSection.delete({ where: { id: sectionId } });
    });
  }

  // -------------------- Line items --------------------

  async createLineItem(templateId: string, sectionId: string, dto: CreateLineItemDto) {
    return this.prisma.forTenant(async (tx) => {
      await this.requireSection(tx, templateId, sectionId);

      const libraryItem = dto.itemLibraryItemId
        ? await tx.itemLibraryItem.findUnique({ where: { id: dto.itemLibraryItemId } })
        : null;
      if (dto.itemLibraryItemId && !libraryItem) throw new NotFoundException('Item library item not found');

      const description = dto.description ?? libraryItem?.name;
      if (!description) {
        throw new BadRequestException('description is required when not picking an item from the library');
      }

      const position = dto.position ?? (await tx.quoteTemplateLineItem.count({ where: { quoteTemplateSectionId: sectionId } }));

      return tx.quoteTemplateLineItem.create({
        data: {
          quoteTemplateSectionId: sectionId,
          itemLibraryItemId: libraryItem?.id,
          description,
          quantity: dto.quantity ?? 1,
          unitPrice: dto.unitPrice ?? Number(libraryItem?.defaultUnitPrice ?? 0),
          discountPercent: dto.discountPercent ?? 0,
          vatRate: dto.vatRate ?? Number(libraryItem?.defaultVatRate ?? 20),
          account: dto.account ?? libraryItem?.account ?? undefined,
          position,
        },
      });
    });
  }

  async updateLineItem(templateId: string, sectionId: string, lineItemId: string, dto: UpdateLineItemDto) {
    return this.prisma.forTenant(async (tx) => {
      await this.requireSection(tx, templateId, sectionId);
      const existing = await tx.quoteTemplateLineItem.findFirst({
        where: { id: lineItemId, quoteTemplateSectionId: sectionId },
      });
      // Benign race — see QuotesService.updateLineItem for the full
      // explanation: a field-edit's autosave can still be in flight when
      // the row itself gets deleted moments later. No-op, not an error.
      if (!existing) return null;

      return tx.quoteTemplateLineItem.update({ where: { id: lineItemId }, data: dto });
    });
  }

  async removeLineItem(templateId: string, sectionId: string, lineItemId: string) {
    return this.prisma.forTenant(async (tx) => {
      await this.requireSection(tx, templateId, sectionId);
      const existing = await tx.quoteTemplateLineItem.findFirst({
        where: { id: lineItemId, quoteTemplateSectionId: sectionId },
      });
      if (!existing) return; // already gone

      await tx.quoteTemplateLineItem.delete({ where: { id: lineItemId } });
    });
  }

  private async requireSection(tx: Tx, templateId: string, sectionId: string) {
    const section = await tx.quoteTemplateSection.findFirst({ where: { id: sectionId, quoteTemplateId: templateId } });
    if (!section) throw new NotFoundException('Section not found');
    return section;
  }
}
