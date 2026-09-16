import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getCurrentTenantId } from '../common/context/tenant-context';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Injectable()
export class ItemLibraryService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateItemDto) {
    return this.prisma.forTenant((tx) =>
      tx.itemLibraryItem.create({ data: { ...dto, tenantId: getCurrentTenantId()! } }),
    );
  }

  list() {
    return this.prisma.forTenant((tx) => tx.itemLibraryItem.findMany({ orderBy: { name: 'asc' } }));
  }

  // Paginated + searchable variant for the standalone Item Library
  // management page — with 1300+ synced products, rendering everything in
  // one table made the page enormous. `list()` above is left untouched
  // since the quote/template builders' "Add from library" picker still
  // needs the FULL set for its own client-side search.
  search(query: string | undefined, skip: number, take: number) {
    return this.prisma.forTenant(async (tx) => {
      const where = query
        ? { OR: [{ name: { contains: query, mode: 'insensitive' as const } }, { sku: { contains: query, mode: 'insensitive' as const } }] }
        : {};
      const [items, total] = await Promise.all([
        tx.itemLibraryItem.findMany({ where, orderBy: { name: 'asc' }, skip, take }),
        tx.itemLibraryItem.count({ where }),
      ]);
      return { items, total, skip, take };
    });
  }

  async get(id: string) {
    const item = await this.prisma.forTenant((tx) => tx.itemLibraryItem.findUnique({ where: { id } }));
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  async update(id: string, dto: UpdateItemDto) {
    await this.get(id);
    return this.prisma.forTenant((tx) => tx.itemLibraryItem.update({ where: { id }, data: dto }));
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.forTenant((tx) => tx.itemLibraryItem.delete({ where: { id } }));
  }

  // Re-pulls name/price for every item that was originally imported from a
  // connector, using whatever that connector's LAST sync already cached
  // (see ConnectorsService.sync) — doesn't hit Magento again itself, that's
  // a separate, slower step from the Connectors page. This just re-applies
  // prices that sync already fetched but a tenant hasn't re-imported since.
  async refreshFromConnectors() {
    return this.prisma.forTenant(async (tx) => {
      const items = await tx.itemLibraryItem.findMany({
        where: { sourceConnectorProductId: { not: null } },
        include: { sourceConnectorProduct: true },
      });

      let refreshed = 0;
      for (const item of items) {
        if (!item.sourceConnectorProduct) continue; // the connector product itself was deleted
        await tx.itemLibraryItem.update({
          where: { id: item.id },
          data: { name: item.sourceConnectorProduct.name, defaultUnitPrice: item.sourceConnectorProduct.price ?? 0 },
        });
        refreshed += 1;
      }
      return { refreshed, total: items.length };
    });
  }
}
