import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getCurrentTenantId } from '../common/context/tenant-context';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateClientDto) {
    return this.prisma.forTenant((tx) =>
      tx.client.create({ data: { ...dto, tenantId: getCurrentTenantId()! } }),
    );
  }

  // Includes a per-client quote count so the list page can show "a bit of
  // history" (how many quotes/invoices this client has) without a separate
  // round trip per row.
  async list() {
    const clients = await this.prisma.forTenant((tx) =>
      tx.client.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { quotes: true } } } }),
    );
    return clients.map(({ _count, ...client }) => ({ ...client, quoteCount: _count.quotes }));
  }

  async get(id: string) {
    const client = await this.prisma.forTenant((tx) => tx.client.findUnique({ where: { id } }));
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.get(id); // 404s if missing or belongs to another tenant
    return this.prisma.forTenant((tx) => tx.client.update({ where: { id }, data: dto }));
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.forTenant((tx) => tx.client.delete({ where: { id } }));
  }

  // Powers the client history panel: every quote/invoice ever raised for
  // this client, newest first, with just enough fields to render a list
  // (number, document type, status, total, date) without pulling in full
  // section/line-item detail. sentCount is how many times it was actually
  // (re)sent — sentAt alone only ever reflects the most recent send, so a
  // quote resent 3 times looked identical to one sent once.
  async quoteHistory(id: string) {
    await this.get(id);
    const quotes = await this.prisma.forTenant((tx) =>
      tx.quote.findMany({
        where: { clientId: id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          quoteNumber: true,
          invoiceNumber: true,
          documentType: true,
          status: true,
          grandTotal: true,
          createdAt: true,
          sentAt: true,
          _count: { select: { activities: { where: { type: 'sent' } } } },
        },
      }),
    );
    return quotes.map(({ _count, ...quote }) => ({ ...quote, sentCount: _count.activities }));
  }
}
