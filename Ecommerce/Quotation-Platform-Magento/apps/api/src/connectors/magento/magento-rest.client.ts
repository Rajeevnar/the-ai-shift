import { BadGatewayException, InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';
import OAuth from 'oauth-1.0a';

export interface MagentoStoreConfig {
  id: number;
  code: string;
  website_id: number;
  locale: string;
  base_url: string;
  store_name?: string;
}

export interface MagentoOauthCredentials {
  authMethod: 'oauth';
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

// Alternative to Integration-based OAuth — uses Magento's built-in admin
// token endpoint (POST /rest/V1/integration/admin/token), which just needs
// a real admin username/password and inherits whatever permissions that
// admin account already has. Useful when a client's Integration is missing
// specific ACL resource grants and reconfiguring it isn't practical.
export interface MagentoAdminTokenCredentials {
  authMethod: 'admin_token';
  username: string;
  password: string;
}

export type MagentoCredentials = MagentoOauthCredentials | MagentoAdminTokenCredentials;

export interface MagentoMediaGalleryEntry {
  file: string;
  types?: string[];
  position?: number;
}

/**
 * Full raw product payload from Magento. Only the fields this connector
 * actually maps (sku, name, price, image) are typed explicitly; everything
 * else stays under the index signature and is preserved as-is in
 * ConnectorProduct.raw for later use without needing a re-sync.
 */
export interface MagentoProductRaw {
  id: number;
  sku: string;
  name: string;
  price: number;
  status: number;
  type_id: string;
  media_gallery_entries?: MagentoMediaGalleryEntry[];
  [key: string]: unknown;
}

export interface MagentoProductPage {
  items: MagentoProductRaw[];
  totalCount: number;
}

/**
 * Thin wrapper around Magento's REST API, supporting the two auth methods
 * exposed in the connect UI: OAuth 1.0a (Integration Consumer/Access
 * key-secret pairs) or a real admin username/password via Magento's admin
 * token endpoint — the latter is the fallback when an Integration is
 * missing ACL permissions and reconfiguring it isn't practical.
 *
 * Deliberately minimal beyond that: this product only pulls products in as
 * quote line items, so it doesn't need an existing sibling product's
 * CMS/blog/attribute-enrichment/2FA machinery — just enough to verify
 * credentials and page through products.
 *
 * Uses Node's built-in fetch (Node 18+) — the only extra dependency is
 * oauth-1.0a for request signing, since hand-rolling OAuth1 signing
 * correctly is easy to get subtly wrong.
 */
export class MagentoRestClient {
  private readonly oauth: OAuth | null = null;
  private readonly token: { key: string; secret: string } | null = null;
  private readonly adminCredentials: { username: string; password: string } | null = null;
  // Cached in-memory for this client instance's lifetime (typically one
  // sync run) — re-fetched automatically on a 401.
  private cachedAdminToken: string | null = null;

  constructor(
    private readonly baseUrl: string,
    credentials: MagentoCredentials,
  ) {
    if (credentials.authMethod === 'admin_token') {
      this.adminCredentials = { username: credentials.username, password: credentials.password };
    } else {
      this.oauth = new OAuth({
        consumer: { key: credentials.consumerKey, secret: credentials.consumerSecret },
        // Some Magento OAuth configs reject HMAC-SHA1 ("Signature method
        // HMAC-SHA1 is not supported") and require SHA-256 instead — using
        // SHA-256 unconditionally avoids having to detect and retry.
        signature_method: 'HMAC-SHA256',
        hash_function(baseString: string, key: string) {
          return crypto.createHmac('sha256', key).update(baseString).digest('base64');
        },
      });
      this.token = { key: credentials.accessToken, secret: credentials.accessTokenSecret };
    }
  }

  private async fetchAdminToken(): Promise<string> {
    if (!this.adminCredentials) {
      throw new InternalServerErrorException('fetchAdminToken called without admin_token credentials configured.');
    }
    const url = `${this.baseUrl.replace(/\/+$/, '')}/rest/V1/integration/admin/token`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.adminCredentials),
      });
    } catch (err) {
      throw new BadGatewayException(`Could not reach Magento at ${this.baseUrl}: ${(err as Error).message}`);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new BadGatewayException(`Magento admin login failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const token = (await res.json()) as string;
    if (typeof token !== 'string' || !token) {
      throw new BadGatewayException('Magento admin token endpoint returned an unexpected response.');
    }
    return token;
  }

  private async request<T>(path: string, retriesLeft = 3): Promise<T> {
    const url = `${this.baseUrl.replace(/\/+$/, '')}/rest/V1${path}`;

    let authHeader: Record<string, string>;
    if (this.adminCredentials) {
      if (!this.cachedAdminToken) {
        this.cachedAdminToken = await this.fetchAdminToken();
      }
      authHeader = { Authorization: `Bearer ${this.cachedAdminToken}` };
    } else {
      authHeader = this.oauth!.toHeader(this.oauth!.authorize({ url, method: 'GET' }, this.token!)) as unknown as Record<
        string,
        string
      >;
    }

    let res: Response;
    try {
      res = await fetch(url, { headers: { ...authHeader } });
    } catch (err) {
      // A raw fetch failure (DNS blip, connection reset, TLS hiccup) is
      // just as often transient as a 5xx response — but unlike the 5xx
      // branch below, this used to fail immediately with no retry at all.
      // On a sync looping over many pages, one momentary network blip
      // shouldn't abort the entire run.
      if (retriesLeft > 0) {
        const delayMs = (4 - retriesLeft) * 1500;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return this.request<T>(path, retriesLeft - 1);
      }
      throw new BadGatewayException(`Could not reach Magento at ${this.baseUrl}: ${(err as Error).message}`);
    }

    // Admin token expired mid-session — fetch a fresh one and retry once.
    if (res.status === 401 && this.adminCredentials && retriesLeft > 0) {
      this.cachedAdminToken = null;
      return this.request<T>(path, retriesLeft - 1);
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      // A real, observed cause: using an admin PANEL path (e.g.
      // "https://store.com/obcadmin") as the base URL instead of the plain
      // site domain — the REST API is always mounted at the root regardless
      // of what the admin login page's path is customized to.
      throw new BadGatewayException(
        `Magento returned a non-JSON (likely HTML) response from ${url} — this usually means the base URL is wrong. Use the plain site domain (e.g. https://yourstore.com), not an admin panel path.`,
      );
    }

    if (!res.ok) {
      // 5xx errors are often transient (a heavy request occasionally times
      // out under load) — worth a few retries with backoff. 4xx errors
      // (bad credentials, not found, etc.) never are, so fail immediately.
      if (res.status >= 500 && retriesLeft > 0) {
        const delayMs = (4 - retriesLeft) * 1500; // 1.5s, 3s, 4.5s
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return this.request<T>(path, retriesLeft - 1);
      }

      const body = await res.text().catch(() => '');
      throw new BadGatewayException(`Magento returned ${res.status} for ${path}: ${body.slice(0, 300)}`);
    }

    return res.json() as Promise<T>;
  }

  /** Lightweight, read-only call used purely to verify credentials work. */
  async testConnection(): Promise<MagentoStoreConfig[]> {
    return this.request<MagentoStoreConfig[]>('/store/storeConfigs');
  }

  /** Single page of products, with total count — looped by the sync job. */
  async getProductsPage(pageSize = 50, currentPage = 1): Promise<MagentoProductPage> {
    const query = `?searchCriteria[pageSize]=${pageSize}&searchCriteria[currentPage]=${currentPage}`;
    const result = await this.request<{ items: MagentoProductRaw[]; total_count: number }>(`/products${query}`);
    return { items: result.items, totalCount: result.total_count };
  }
}
