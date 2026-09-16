import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/crypto/encryption.service';
import { getCurrentTenantId } from '../common/context/tenant-context';
import { ConnectMagentoDto } from './dto/connect-magento.dto';
import { ImportProductsDto } from './dto/import-products.dto';
import { MagentoCredentials, MagentoRestClient } from './magento/magento-rest.client';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

const PRODUCTS_PER_SYNC_PAGE = 50;

@Injectable()
export class ConnectorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async testMagento(dto: ConnectMagentoDto) {
    const existing = await this.prisma.forTenant((tx) => tx.storeConnector.findFirst({ where: { platform: 'magento' } }));
    const credentials = this.resolveMagentoCredentials(dto, existing?.credentials ?? null);
    const client = new MagentoRestClient(dto.baseUrl, credentials);
    await client.testConnection();
    return { success: true };
  }

  async connectMagento(dto: ConnectMagentoDto) {
    const existing = await this.prisma.forTenant((tx) => tx.storeConnector.findFirst({ where: { platform: 'magento' } }));
    const credentials = this.resolveMagentoCredentials(dto, existing?.credentials ?? null);

    // Verify the credentials actually work BEFORE saving anything — a
    // connector saved as "connected" that was never actually reachable is
    // worse than no connector at all (silent failure on every later sync).
    // Deliberately outside the DB transaction below — a slow/hung network
    // call has no business holding a Postgres connection open.
    const client = new MagentoRestClient(dto.baseUrl, credentials);
    await client.testConnection();

    const encryptedCredentials = this.encryption.encrypt(JSON.stringify(credentials));

    return this.prisma.forTenant(async (tx) => {
      const data = {
        baseUrl: dto.baseUrl,
        credentials: encryptedCredentials,
        credentialsPreview: this.buildCredentialsPreview(credentials),
        status: 'connected' as const,
        label: dto.label,
      };

      const connector = existing
        ? await tx.storeConnector.update({ where: { id: existing.id }, data })
        : await tx.storeConnector.create({
            data: { ...data, tenantId: getCurrentTenantId()!, platform: 'magento' },
          });

      return this.toSafeConnector(connector);
    });
  }

  // Every credential field on the DTO is optional so a merchant can update
  // just the base URL/label without retyping secrets. Resolution rules:
  //  - both OAuth AND admin fields provided at once -> reject (ambiguous)
  //  - any of the 4 OAuth fields provided -> all 4 required together
  //  - either admin field provided -> both required together
  //  - nothing provided -> reuse the existing connector's stored method,
  //    which must exist (nothing to reuse on a brand new connector)
  private resolveMagentoCredentials(dto: ConnectMagentoDto, existingEncrypted: string | null): MagentoCredentials {
    const oauthFields = [dto.consumerKey, dto.consumerSecret, dto.accessToken, dto.accessTokenSecret];
    const hasOauthInput = oauthFields.some(Boolean);
    const adminFields = [dto.adminUsername, dto.adminPassword];
    const hasAdminInput = adminFields.some(Boolean);

    if (hasOauthInput && hasAdminInput) {
      throw new BadRequestException('Provide either Integration Keys (OAuth) or an admin username/password, not both');
    }

    if (hasOauthInput) {
      if (!oauthFields.every(Boolean)) {
        throw new BadRequestException('All four OAuth fields (consumer key/secret, access token/secret) are required together');
      }
      return {
        authMethod: 'oauth',
        consumerKey: dto.consumerKey!,
        consumerSecret: dto.consumerSecret!,
        accessToken: dto.accessToken!,
        accessTokenSecret: dto.accessTokenSecret!,
      };
    }

    if (hasAdminInput) {
      if (!adminFields.every(Boolean)) {
        throw new BadRequestException('Both admin username and password are required together');
      }
      return { authMethod: 'admin_token', username: dto.adminUsername!, password: dto.adminPassword! };
    }

    if (!existingEncrypted) {
      throw new BadRequestException('Provide either Integration Keys (OAuth) or an admin username/password');
    }
    return JSON.parse(this.encryption.decrypt(existingEncrypted)) as MagentoCredentials;
  }

  // Deliberately shows only the LEAST sensitive fragment of what's saved —
  // an OAuth Consumer Key functions more like a client id than a secret
  // (the Consumer Secret, Access Token, and Access Token Secret are never
  // hinted at), and an admin username is already not sensitive on its own.
  // Same "•••• 4242" pattern Stripe/AWS use for saved cards/keys: enough to
  // visibly confirm something real is on file, never enough to use it.
  private buildCredentialsPreview(credentials: MagentoCredentials): string {
    if (credentials.authMethod === 'admin_token') {
      return `Admin login — ${credentials.username}`;
    }
    const last4 = credentials.consumerKey.slice(-4);
    return `OAuth — Consumer Key ····${last4}`;
  }

  list() {
    return this.prisma.forTenant(async (tx) => {
      const connectors = await tx.storeConnector.findMany({ orderBy: { createdAt: 'asc' } });
      return connectors.map((c) => this.toSafeConnector(c));
    });
  }

  async get(id: string) {
    const connector = await this.requireConnector(id);
    return this.toSafeConnector(connector);
  }

  async remove(id: string) {
    await this.requireConnector(id);
    await this.prisma.forTenant((tx) => tx.storeConnector.delete({ where: { id } }));
  }

  async sync(id: string) {
    const connector = await this.requireConnector(id);
    if (!connector.credentials || !connector.baseUrl) {
      throw new NotFoundException('Connector has no stored credentials');
    }
    const credentials = JSON.parse(this.encryption.decrypt(connector.credentials));
    const client = new MagentoRestClient(connector.baseUrl, credentials);

    let currentPage = (connector.lastSyncCompletedPage ?? 0) + 1;
    let totalCount = Infinity;
    let productsSynced = 0;

    while ((currentPage - 1) * PRODUCTS_PER_SYNC_PAGE < totalCount) {
      const page = await client.getProductsPage(PRODUCTS_PER_SYNC_PAGE, currentPage);
      totalCount = page.totalCount;

      await this.prisma.forTenant(async (tx) => {
        for (const product of page.items) {
          const imageFile = product.media_gallery_entries?.[0]?.file;
          const imageUrl = imageFile
            ? `${connector.baseUrl!.replace(/\/+$/, '')}/media/catalog/product${imageFile}`
            : undefined;

          await tx.connectorProduct.upsert({
            where: { storeConnectorId_sku: { storeConnectorId: id, sku: product.sku } },
            create: {
              storeConnectorId: id,
              externalId: String(product.id),
              sku: product.sku,
              name: product.name,
              price: product.price,
              imageUrl,
              raw: product as object,
            },
            update: {
              externalId: String(product.id),
              name: product.name,
              price: product.price,
              imageUrl,
              raw: product as object,
            },
          });
        }
        await tx.storeConnector.update({
          where: { id },
          data: { lastSyncCompletedPage: currentPage },
        });
      });

      productsSynced += page.items.length;
      currentPage += 1;
    }

    await this.prisma.forTenant((tx) =>
      tx.storeConnector.update({
        where: { id },
        data: { lastProductSyncAt: new Date(), lastSyncCompletedPage: null },
      }),
    );

    return { productsSynced, totalCount };
  }

  listProducts(connectorId: string, skip = 0, take = 50) {
    return this.prisma.forTenant(async (tx) => {
      await this.requireConnectorTx(tx, connectorId);
      const [products, total] = await Promise.all([
        tx.connectorProduct.findMany({
          where: { storeConnectorId: connectorId },
          orderBy: { name: 'asc' },
          skip,
          take,
        }),
        tx.connectorProduct.count({ where: { storeConnectorId: connectorId } }),
      ]);
      // Magento's own numeric codes (1=Enabled/2=Disabled for status,
      // 1-4 for visibility) are already sitting in `raw` from the sync —
      // decoded here into plain labels so the frontend doesn't need to
      // know Magento's encoding to show something meaningful in the
      // product detail view.
      const items = products.map((p) => ({
        ...p,
        statusLabel: decodeMagentoStatus((p.raw as { status?: number } | null)?.status),
        visibilityLabel: decodeMagentoVisibility((p.raw as { visibility?: number } | null)?.visibility),
      }));
      return { items, total, skip, take };
    });
  }

  async importToLibrary(connectorId: string, dto: ImportProductsDto) {
    return this.prisma.forTenant(async (tx) => {
      await this.requireConnectorTx(tx, connectorId);
      const products = await tx.connectorProduct.findMany({
        where: { id: { in: dto.connectorProductIds }, storeConnectorId: connectorId },
      });
      const imported = await this.upsertLibraryItemsFromProducts(tx, products);
      return { imported: imported.length };
    });
  }

  // Imports EVERY product this connector has ever synced, not just a
  // hand-picked page of them — the selection-based import above only ever
  // sees whatever page the products list happens to be showing (a real
  // gap on a catalog with thousands of products, spread across many
  // pages). This runs entirely server-side against the full set.
  async importAllFromConnector(connectorId: string) {
    return this.prisma.forTenant(async (tx) => {
      await this.requireConnectorTx(tx, connectorId);
      const products = await tx.connectorProduct.findMany({ where: { storeConnectorId: connectorId } });
      const imported = await this.upsertLibraryItemsFromProducts(tx, products);
      return { imported: imported.length, total: products.length };
    });
  }

  private async upsertLibraryItemsFromProducts(
    tx: Tx,
    products: { id: string; name: string; sku: string; price: Prisma.Decimal | null }[],
  ) {
    const created = [];
    for (const product of products) {
      const existingItem = await tx.itemLibraryItem.findFirst({ where: { sourceConnectorProductId: product.id } });
      const item = existingItem
        ? await tx.itemLibraryItem.update({
            where: { id: existingItem.id },
            data: { name: product.name, sku: product.sku, defaultUnitPrice: product.price ?? 0 },
          })
        : await tx.itemLibraryItem.create({
            data: {
              tenantId: getCurrentTenantId()!,
              sourceConnectorProductId: product.id,
              name: product.name,
              sku: product.sku,
              defaultUnitPrice: product.price ?? 0,
            },
          });
      created.push(item);
    }
    return created;
  }

  private async requireConnector(id: string) {
    return this.prisma.forTenant((tx) => this.requireConnectorTx(tx, id));
  }

  private async requireConnectorTx(tx: Tx, id: string) {
    const connector = await tx.storeConnector.findUnique({ where: { id } });
    if (!connector) throw new NotFoundException('Connector not found');
    return connector;
  }

  // Never return `credentials` — even encrypted, there's no reason for it
  // to ever leave the server. `credentialsPreview` is fine to return as-is
  // (see buildCredentialsPreview) — it was already stripped of anything
  // sensitive before it was ever saved.
  private toSafeConnector<T extends { credentials: string | null }>(connector: T) {
    const { credentials: _credentials, ...safe } = connector;
    return safe;
  }
}

function decodeMagentoStatus(status: number | undefined): string {
  return { 1: 'Enabled', 2: 'Disabled' }[status ?? -1] ?? 'Unknown';
}

function decodeMagentoVisibility(visibility: number | undefined): string {
  return (
    { 1: 'Not visible individually', 2: 'Catalog only', 3: 'Search only', 4: 'Catalog & Search' }[visibility ?? -1] ??
    'Unknown'
  );
}
