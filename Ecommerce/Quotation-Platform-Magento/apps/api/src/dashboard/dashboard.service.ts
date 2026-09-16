import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // `since` filters everything to quotes/activity created on or after that
  // date — undefined means all-time. Kept as one query per concern (not
  // one giant join) since each aggregates a different table/shape.
  async overview(since?: Date) {
    return this.prisma.forTenant(async (tx) => {
      const createdWhere = since ? { createdAt: { gte: since } } : {};

      const [statusCounts, acceptedValue, totalValue, recentActivityRaw, topClientsRaw] = await Promise.all([
        tx.quote.groupBy({ by: ['status'], where: createdWhere, _count: true }),
        tx.quote.aggregate({ where: { ...createdWhere, status: 'accepted' }, _sum: { grandTotal: true } }),
        tx.quote.aggregate({ where: createdWhere, _sum: { grandTotal: true } }),
        tx.quoteActivity.findMany({
          where: since ? { createdAt: { gte: since } } : {},
          orderBy: { createdAt: 'desc' },
          take: 15,
          include: { quote: { select: { quoteNumber: true, invoiceNumber: true, documentType: true, client: { select: { name: true } } } } },
        }),
        tx.quote.groupBy({
          by: ['clientId'],
          where: { ...createdWhere, clientId: { not: null } },
          _sum: { grandTotal: true },
          _count: true,
          orderBy: { _sum: { grandTotal: 'desc' } },
          take: 5,
        }),
      ]);

      const countByStatus = Object.fromEntries(statusCounts.map((s) => [s.status, s._count]));
      const draft = countByStatus.draft ?? 0;
      const sent = countByStatus.sent ?? 0;
      const accepted = countByStatus.accepted ?? 0;
      const declined = countByStatus.declined ?? 0;
      const expired = countByStatus.expired ?? 0;
      const total = draft + sent + accepted + declined + expired;
      // Of quotes that got a definite response (accepted or declined) —
      // sent-but-still-pending quotes don't count against the rate either
      // way, since there's no answer yet to judge.
      const responded = accepted + declined;

      const clientIds = topClientsRaw.map((c) => c.clientId).filter((id): id is string => id !== null);
      const clients = clientIds.length
        ? await tx.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } })
        : [];
      const clientNameById = new Map(clients.map((c) => [c.id, c.name]));

      return {
        totals: {
          quotes: total,
          draft,
          sent,
          accepted,
          declined,
          expired,
          acceptanceRate: responded > 0 ? Math.round((accepted / responded) * 100) : null,
          acceptedValue: (acceptedValue._sum.grandTotal ?? 0).toString(),
          totalValue: (totalValue._sum.grandTotal ?? 0).toString(),
        },
        recentActivity: recentActivityRaw.map((a) => ({
          id: a.id,
          type: a.type,
          detail: a.detail,
          createdAt: a.createdAt,
          quoteId: a.quoteId,
          quoteNumber: a.quote.quoteNumber,
          invoiceNumber: a.quote.invoiceNumber,
          documentType: a.quote.documentType,
          clientName: a.quote.client?.name ?? null,
        })),
        topClients: topClientsRaw.map((c) => ({
          id: c.clientId!,
          name: clientNameById.get(c.clientId!) ?? 'Unknown',
          quoteCount: c._count,
          totalValue: (c._sum.grandTotal ?? 0).toString(),
        })),
      };
    });
  }
}
