import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getCurrentTenantId } from '../common/context/tenant-context';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { UpdateQuoteStatusDto } from './dto/update-quote-status.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { CreateLineItemDto } from './dto/create-line-item.dto';
import { UpdateLineItemDto } from './dto/update-line-item.dto';
import { SendQuoteDto } from './dto/send-quote.dto';
import { round2 } from './money.util';
import { EmailService } from '../email/email.service';
import { escapeHtml, renderQuoteEmail } from './quote-email.template';
import { toEmailLogoUrl } from '../settings/logo-url.util';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

const STATUS_TIMESTAMP_FIELD: Record<'sent' | 'accepted' | 'declined', 'sentAt' | 'acceptedAt' | 'declinedAt'> = {
  sent: 'sentAt',
  accepted: 'acceptedAt',
  declined: 'declinedAt',
};

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  // -------------------- Quote header --------------------

  create(dto: CreateQuoteDto) {
    return this.prisma.forTenant(async (tx) => {
      if (dto.clientId) {
        const client = await tx.client.findUnique({ where: { id: dto.clientId } });
        if (!client) throw new NotFoundException('Client not found');
      }

      const template = dto.templateId
        ? await tx.quoteTemplate.findUnique({
            where: { id: dto.templateId },
            include: { sections: { orderBy: { position: 'asc' }, include: { lineItems: { orderBy: { position: 'asc' } } } } },
          })
        : null;
      if (dto.templateId && !template) throw new NotFoundException('Template not found');

      const existingCount = await tx.quote.count();
      const quoteNumber = `Q-${1000 + existingCount + 1}`;

      const quote = await tx.quote.create({
        data: {
          tenantId: getCurrentTenantId()!,
          clientId: dto.clientId,
          quoteNumber,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          reference: dto.reference,
          currency: dto.currency ?? 'GBP',
          notes: dto.notes,
        },
      });

      if (template?.sections?.length) {
        for (const section of template.sections) {
          const newSection = await tx.quoteSection.create({
            data: { quoteId: quote.id, title: section.title, position: section.position },
          });
          for (const li of section.lineItems) {
            const quantity = Number(li.quantity);
            const unitPrice = Number(li.unitPrice);
            const discountPercent = Number(li.discountPercent);
            const vatRate = Number(li.vatRate);
            const { amount, taxAmount } = computeLineTotals(quantity, unitPrice, discountPercent, vatRate);
            await tx.quoteLineItem.create({
              data: {
                quoteSectionId: newSection.id,
                itemLibraryItemId: li.itemLibraryItemId,
                description: li.description,
                quantity,
                unitPrice,
                discountPercent,
                vatRate,
                account: li.account,
                position: li.position,
                amount,
                taxAmount,
              },
            });
          }
          await this.recomputeSection(tx, newSection.id);
        }
        await this.recomputeQuote(tx, quote.id);
        return this.loadFull(tx, quote.id);
      }

      return quote;
    });
  }

  // Clones this quote's current sections/line items into a new reusable
  // QuoteTemplate — the "capture what already works" path to building a
  // template, as an alternative to building one from scratch.
  async saveAsTemplate(id: string, name: string) {
    return this.prisma.forTenant(async (tx) => {
      const quote = await tx.quote.findUnique({
        where: { id },
        include: { sections: { orderBy: { position: 'asc' }, include: { lineItems: { orderBy: { position: 'asc' } } } } },
      });
      if (!quote) throw new NotFoundException('Quote not found');

      const template = await tx.quoteTemplate.create({ data: { tenantId: getCurrentTenantId()!, name } });

      for (const section of quote.sections) {
        const newSection = await tx.quoteTemplateSection.create({
          data: { quoteTemplateId: template.id, title: section.title, position: section.position },
        });
        for (const li of section.lineItems) {
          await tx.quoteTemplateLineItem.create({
            data: {
              quoteTemplateSectionId: newSection.id,
              itemLibraryItemId: li.itemLibraryItemId,
              description: li.description,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
              discountPercent: li.discountPercent,
              account: li.account,
              vatRate: li.vatRate,
              position: li.position,
            },
          });
        }
      }

      return template;
    });
  }

  async convertToInvoice(id: string) {
    return this.prisma.forTenant(async (tx) => {
      const quote = await tx.quote.findUnique({ where: { id } });
      if (!quote) throw new NotFoundException('Quote not found');
      if (quote.documentType === 'invoice') {
        throw new BadRequestException('This is already an invoice');
      }

      const existingInvoiceCount = await tx.quote.count({ where: { documentType: 'invoice' } });
      const invoiceNumber = `INV-${1000 + existingInvoiceCount + 1}`;

      const updated = await tx.quote.update({
        where: { id },
        data: { documentType: 'invoice', invoiceNumber, convertedToInvoiceAt: new Date() },
      });
      await tx.quoteActivity.create({ data: { quoteId: id, type: 'converted_to_invoice' } });
      return updated;
    });
  }

  // The undo for convertToInvoice above — same record, same sections/line
  // items/totals, just relabelled back. Drops the invoice number and
  // conversion timestamp rather than keeping them around unused; converting
  // again later assigns a fresh invoice number rather than reusing the old
  // one, since @@unique([tenantId, invoiceNumber]) allows any number of
  // NULLs but would reject two live rows sharing one now-stale number.
  async revertToQuote(id: string) {
    return this.prisma.forTenant(async (tx) => {
      const quote = await tx.quote.findUnique({ where: { id } });
      if (!quote) throw new NotFoundException('Quote not found');
      if (quote.documentType !== 'invoice') {
        throw new BadRequestException('This is already a quote');
      }

      const updated = await tx.quote.update({
        where: { id },
        data: { documentType: 'quote', invoiceNumber: null, convertedToInvoiceAt: null },
      });
      await tx.quoteActivity.create({ data: { quoteId: id, type: 'reverted_to_quote' } });
      return updated;
    });
  }

  list() {
    return this.prisma.forTenant((tx) =>
      tx.quote.findMany({
        orderBy: { createdAt: 'desc' },
        include: { client: { select: { id: true, name: true } } },
      }),
    );
  }

  async getFull(id: string) {
    const quote = await this.prisma.forTenant((tx) => this.loadFull(tx, id));
    if (!quote) throw new NotFoundException('Quote not found');
    return quote;
  }

  private loadFull(tx: Tx, id: string) {
    return tx.quote.findUnique({
      where: { id },
      include: {
        client: true,
        sections: {
          orderBy: { position: 'asc' },
          include: { lineItems: { orderBy: { position: 'asc' } } },
        },
        activities: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async updateHeader(id: string, dto: UpdateQuoteDto) {
    return this.prisma.forTenant(async (tx) => {
      const quote = await tx.quote.findUnique({ where: { id } });
      if (!quote) throw new NotFoundException('Quote not found');

      if (dto.clientId && dto.clientId !== quote.clientId) {
        const client = await tx.client.findUnique({ where: { id: dto.clientId } });
        if (!client) throw new NotFoundException('Client not found');
      }

      return tx.quote.update({
        where: { id },
        data: {
          clientId: dto.clientId,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          reference: dto.reference,
          currency: dto.currency,
          notes: dto.notes,
        },
      });
    });
  }

  async updateStatus(id: string, dto: UpdateQuoteStatusDto) {
    return this.prisma.forTenant(async (tx) => {
      const quote = await tx.quote.findUnique({ where: { id } });
      if (!quote) throw new NotFoundException('Quote not found');

      const timestampField = dto.status === 'expired' ? undefined : STATUS_TIMESTAMP_FIELD[dto.status];

      const updated = await tx.quote.update({
        where: { id },
        data: {
          status: dto.status,
          ...(timestampField ? { [timestampField]: new Date() } : {}),
        },
      });
      if (dto.status === 'sent' || dto.status === 'accepted' || dto.status === 'declined') {
        await tx.quoteActivity.create({ data: { quoteId: id, type: dto.status } });
      }
      return updated;
    });
  }

  async remove(id: string) {
    await this.getFull(id); // 404s if missing or belongs to another tenant
    await this.prisma.forTenant((tx) => tx.quote.delete({ where: { id } }));
  }

  async sendEmail(id: string, dto: SendQuoteDto) {
    const quote = await this.getFull(id);
    const toEmail = dto.toEmail ?? quote.client?.email;
    if (!toEmail) {
      throw new BadRequestException('No recipient email — provide one, or add an email to this quote\'s client first');
    }

    const tenant = await this.prisma.unscoped.tenant.findUniqueOrThrow({
      where: { id: getCurrentTenantId()! },
      select: {
        name: true,
        logoUrl: true,
        brandColor: true,
        emailBgColor: true,
        emailFromName: true,
        quoteHeaderTitle: true,
        quoteIntroMessage: true,
        quoteFooterMessage: true,
      },
    });

    const documentLabel = quote.documentType === 'invoice' ? 'Invoice' : 'Quote';
    const number = quote.documentType === 'invoice' ? quote.invoiceNumber! : quote.quoteNumber;
    // The name shown to the recipient — subject line, email alt text, and
    // the header/intro fallbacks below — follows the branding settings
    // (emailFromName), not the raw registered tenant.name, so what's
    // configured in Settings is what actually shows up everywhere.
    const brandName = tenant.emailFromName || tenant.name;

    // Fallback chain: per-send message (this dialog) -> this quote's own
    // Notes field -> the tenant's branding default. `||` (not `??`) so a
    // blank/whitespace-only message — the normal case, since the dialog's
    // field is left empty on purpose — falls through instead of sending an
    // empty intro. The first two sources are always plain text (a bare
    // <textarea>, never sanitized-on-write), so they're converted to safe
    // HTML here; the tenant's own default is already sanitized HTML from
    // the Settings rich-text editor and passes through as-is.
    const plainMessage = dto.message?.trim() || quote.notes?.trim();
    const introMessage = plainMessage ? escapeHtml(plainMessage).replace(/\n/g, '<br>') : (tenant.quoteIntroMessage ?? null);

    const html = renderQuoteEmail(
      {
        tenantName: brandName,
        logoUrl: toEmailLogoUrl(this.config.get<string>('app.apiPublicUrl')!, getCurrentTenantId()!, tenant.logoUrl),
        brandColor: tenant.brandColor,
        emailBgColor: tenant.emailBgColor,
        headerTitle: tenant.quoteHeaderTitle,
        introMessage,
        footerMessage: tenant.quoteFooterMessage,
      },
      {
        documentLabel,
        number,
        clientName: quote.client?.name ?? 'Customer',
        currency: quote.currency,
        sections: quote.sections.map((s) => ({
          title: s.title,
          subtotal: Number(s.subtotal).toFixed(2),
          vatTotal: Number(s.vatTotal).toFixed(2),
          lineItems: s.lineItems.map((li) => ({
            description: li.description,
            quantity: li.quantity.toString(),
            unitPrice: Number(li.unitPrice).toFixed(2),
            discountPercent: Number(li.discountPercent).toFixed(2),
            vatRate: Number(li.vatRate).toFixed(2),
            amount: Number(li.amount).toFixed(2),
          })),
        })),
        subtotal: Number(quote.subtotal).toFixed(2),
        vatTotal: Number(quote.vatTotal).toFixed(2),
        grandTotal: Number(quote.grandTotal).toFixed(2),
      },
    );

    await this.email.send({
      to: toEmail,
      subject: dto.subject ?? `${documentLabel} ${number} from ${brandName}`,
      html,
    });

    await this.prisma.forTenant(async (tx) => {
      // Sending a draft quote is what actually moves it into the "sent"
      // workflow state — mirrors real-world intent (this document has now
      // genuinely gone to the customer), and unlocks the accepted/declined
      // actions in the UI. Doesn't downgrade an already-further-along
      // status, but sentAt always advances to the latest send regardless —
      // "last sent" should reflect the most recent send, not just the
      // first, so resending shows up rather than looking like nothing
      // happened.
      await tx.quote.update({
        where: { id },
        data: { sentAt: new Date(), ...(quote.status === 'draft' ? { status: 'sent' as const } : {}) },
      });
      // A discrete row per send — this is what makes "sent 3 times" visible
      // instead of collapsing every resend into the same single timestamp.
      await tx.quoteActivity.create({ data: { quoteId: id, type: 'sent', detail: toEmail } });
    });

    return { success: true, sentTo: toEmail };
  }

  // -------------------- Sections --------------------

  async createSection(quoteId: string, dto: CreateSectionDto) {
    return this.prisma.forTenant(async (tx) => {
      const quote = await tx.quote.findUnique({ where: { id: quoteId } });
      if (!quote) throw new NotFoundException('Quote not found');

      const position = dto.position ?? (await tx.quoteSection.count({ where: { quoteId } }));

      return tx.quoteSection.create({
        data: { quoteId, title: dto.title, position },
      });
    });
  }

  async updateSection(quoteId: string, sectionId: string, dto: UpdateSectionDto) {
    return this.prisma.forTenant(async (tx) => {
      await this.requireSection(tx, quoteId, sectionId);
      return tx.quoteSection.update({ where: { id: sectionId }, data: dto });
    });
  }

  async removeSection(quoteId: string, sectionId: string) {
    return this.prisma.forTenant(async (tx) => {
      await this.requireSection(tx, quoteId, sectionId);
      await tx.quoteSection.delete({ where: { id: sectionId } });
      await this.recomputeQuote(tx, quoteId);
    });
  }

  // -------------------- Line items --------------------

  async createLineItem(quoteId: string, sectionId: string, dto: CreateLineItemDto) {
    return this.prisma.forTenant(async (tx) => {
      await this.requireSection(tx, quoteId, sectionId);

      const libraryItem = dto.itemLibraryItemId
        ? await tx.itemLibraryItem.findUnique({ where: { id: dto.itemLibraryItemId } })
        : null;
      if (dto.itemLibraryItemId && !libraryItem) {
        throw new NotFoundException('Item library item not found');
      }

      const description = dto.description ?? libraryItem?.name;
      if (!description) {
        throw new BadRequestException('description is required when not picking an item from the library');
      }

      const quantity = dto.quantity ?? 1;
      const unitPrice = dto.unitPrice ?? Number(libraryItem?.defaultUnitPrice ?? 0);
      const discountPercent = dto.discountPercent ?? 0;
      const vatRate = dto.vatRate ?? Number(libraryItem?.defaultVatRate ?? 20);
      const account = dto.account ?? libraryItem?.account ?? undefined;
      const position = dto.position ?? (await tx.quoteLineItem.count({ where: { quoteSectionId: sectionId } }));

      const { amount, taxAmount } = computeLineTotals(quantity, unitPrice, discountPercent, vatRate);

      const lineItem = await tx.quoteLineItem.create({
        data: {
          quoteSectionId: sectionId,
          itemLibraryItemId: libraryItem?.id,
          description,
          quantity,
          unitPrice,
          discountPercent,
          vatRate,
          account,
          position,
          amount,
          taxAmount,
        },
      });

      await this.recomputeSection(tx, sectionId);
      await this.recomputeQuote(tx, quoteId);
      return lineItem;
    });
  }

  async updateLineItem(quoteId: string, sectionId: string, lineItemId: string, dto: UpdateLineItemDto) {
    return this.prisma.forTenant(async (tx) => {
      await this.requireSection(tx, quoteId, sectionId);
      const existing = await tx.quoteLineItem.findFirst({ where: { id: lineItemId, quoteSectionId: sectionId } });
      // A genuinely benign race, not an error worth surfacing: an edit to
      // this row's OTHER field (e.g. Tab-away-triggered autosave) can still
      // be in flight when the row itself gets deleted moments later. By the
      // time this update lands, there's simply nothing left to update —
      // treat it as a no-op rather than a scary "not found" failure.
      if (!existing) return null;

      const quantity = dto.quantity ?? Number(existing.quantity);
      const unitPrice = dto.unitPrice ?? Number(existing.unitPrice);
      const discountPercent = dto.discountPercent ?? Number(existing.discountPercent);
      const vatRate = dto.vatRate ?? Number(existing.vatRate);
      const { amount, taxAmount } = computeLineTotals(quantity, unitPrice, discountPercent, vatRate);

      const lineItem = await tx.quoteLineItem.update({
        where: { id: lineItemId },
        data: {
          description: dto.description,
          account: dto.account,
          position: dto.position,
          quantity,
          unitPrice,
          discountPercent,
          vatRate,
          amount,
          taxAmount,
        },
      });

      await this.recomputeSection(tx, sectionId);
      await this.recomputeQuote(tx, quoteId);
      return lineItem;
    });
  }

  async removeLineItem(quoteId: string, sectionId: string, lineItemId: string) {
    return this.prisma.forTenant(async (tx) => {
      await this.requireSection(tx, quoteId, sectionId);
      const existing = await tx.quoteLineItem.findFirst({ where: { id: lineItemId, quoteSectionId: sectionId } });
      if (!existing) return; // already gone — same benign race as updateLineItem above

      await tx.quoteLineItem.delete({ where: { id: lineItemId } });
      await this.recomputeSection(tx, sectionId);
      await this.recomputeQuote(tx, quoteId);
    });
  }

  // -------------------- Internal helpers --------------------

  private async requireSection(tx: Tx, quoteId: string, sectionId: string) {
    const section = await tx.quoteSection.findFirst({ where: { id: sectionId, quoteId } });
    if (!section) throw new NotFoundException('Section not found');
    return section;
  }

  private async recomputeSection(tx: Tx, sectionId: string) {
    const totals = await tx.quoteLineItem.aggregate({
      where: { quoteSectionId: sectionId },
      _sum: { amount: true, taxAmount: true },
    });
    await tx.quoteSection.update({
      where: { id: sectionId },
      data: {
        subtotal: totals._sum.amount ?? 0,
        vatTotal: totals._sum.taxAmount ?? 0,
      },
    });
  }

  private async recomputeQuote(tx: Tx, quoteId: string) {
    const totals = await tx.quoteSection.aggregate({
      where: { quoteId },
      _sum: { subtotal: true, vatTotal: true },
    });
    const subtotal = Number(totals._sum.subtotal ?? 0);
    const vatTotal = Number(totals._sum.vatTotal ?? 0);
    await tx.quote.update({
      where: { id: quoteId },
      data: { subtotal, vatTotal, grandTotal: round2(subtotal + vatTotal) },
    });
  }
}

function computeLineTotals(quantity: number, unitPrice: number, discountPercent: number, vatRate: number) {
  const amount = round2(quantity * unitPrice * (1 - discountPercent / 100));
  const taxAmount = round2(amount * (vatRate / 100));
  return { amount, taxAmount };
}
