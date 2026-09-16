'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../../lib/api';
import { ConnectorProduct, StoreConnector } from '../../../lib/types';

type AuthMethod = 'oauth' | 'admin';

const OAUTH_FIELDS = [
  ['consumerKey', 'Consumer Key'],
  ['consumerSecret', 'Consumer Secret'],
  ['accessToken', 'Access Token'],
  ['accessTokenSecret', 'Access Token Secret'],
] as const;

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<StoreConnector[] | null>(null);
  const existingMagento = (connectors ?? []).find((c) => c.platform === 'magento') ?? null;
  const hasExistingMagento = existingMagento !== null;

  const [baseUrl, setBaseUrl] = useState('');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('oauth');
  const [oauthForm, setOauthForm] = useState({ consumerKey: '', consumerSecret: '', accessToken: '', accessTokenSecret: '' });
  const [adminForm, setAdminForm] = useState({ adminUsername: '', adminPassword: '' });
  const [revealed, setRevealed] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const PRODUCTS_PAGE_SIZE = 25;
  const [activeConnectorId, setActiveConnectorId] = useState<string | null>(null);
  const [products, setProducts] = useState<ConnectorProduct[] | null>(null);
  const [productsTotal, setProductsTotal] = useState(0);
  const [productsPage, setProductsPage] = useState(0);
  const [viewingProduct, setViewingProduct] = useState<ConnectorProduct | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ id: string; productsSynced: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [baseUrlTouched, setBaseUrlTouched] = useState(false);
  // Once a connection exists, the credential fields start LOCKED — shown
  // as disabled, visibly non-empty (masked) inputs, rather than blank
  // editable ones with only a placeholder hinting something's saved. That
  // placeholder-only approach kept reading as "empty" no matter how the
  // wording was tweaked. Explicitly unlocking is what switches to real,
  // editable blank fields for entering a replacement.
  const [credentialsLocked, setCredentialsLocked] = useState(false);

  function loadConnectors() {
    api
      .get<StoreConnector[]>('/connectors')
      .then((list) => {
        setConnectors(list);
        // Pre-fill the base URL from the existing connection so it doesn't
        // look blank/unconfigured — but only once, so it never clobbers
        // something the owner is actively mid-edit on.
        const magento = list.find((c) => c.platform === 'magento');
        if (magento?.baseUrl && !baseUrlTouched) setBaseUrl(magento.baseUrl);
      })
      .catch(() => setConnectors([]));
  }

  useEffect(loadConnectors, []);

  // Lock the credential fields the moment a connection first shows up —
  // exactly once, so re-fetching after every save doesn't fight with an
  // owner who just deliberately unlocked them to type a replacement.
  const [everLocked, setEverLocked] = useState(false);
  useEffect(() => {
    if (hasExistingMagento && !everLocked) {
      setCredentialsLocked(true);
      setEverLocked(true);
    }
  }, [hasExistingMagento, everLocked]);

  function buildPayload() {
    return {
      baseUrl,
      ...(authMethod === 'oauth' ? oauthForm : {}),
      ...(authMethod === 'admin' ? adminForm : {}),
    };
  }

  async function onTest() {
    setError(null);
    setNotice(null);
    setTesting(true);
    try {
      await api.post('/connectors/magento/test', buildPayload());
      setNotice('Connection successful.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not connect to Magento');
    } finally {
      setTesting(false);
    }
  }

  async function onConnect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setConnecting(true);
    try {
      await api.post('/connectors/magento/connect', buildPayload());
      setOauthForm({ consumerKey: '', consumerSecret: '', accessToken: '', accessTokenSecret: '' });
      setAdminForm({ adminUsername: '', adminPassword: '' });
      setRevealed(false);
      setCredentialsLocked(true);
      setNotice(hasExistingMagento ? 'Connection updated.' : 'Connected and saved.');
      loadConnectors();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not connect to Magento');
    } finally {
      setConnecting(false);
    }
  }

  async function onSync(id: string) {
    setSyncingId(id);
    setSyncResult(null);
    setError(null);
    try {
      const result = await api.post<{ productsSynced: number; totalCount: number }>(`/connectors/${id}/sync`);
      setSyncResult({ id, productsSynced: result.productsSynced });
      loadConnectors();
      if (activeConnectorId === id) await viewProducts(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  }

  async function viewProducts(id: string, page = 0) {
    setActiveConnectorId(id);
    setSelected(new Set());
    setImportResult(null);
    setError(null);
    try {
      const result = await api.get<{ items: ConnectorProduct[]; total: number }>(
        `/connectors/${id}/products?skip=${page * PRODUCTS_PAGE_SIZE}&take=${PRODUCTS_PAGE_SIZE}`,
      );
      setProducts(result.items);
      setProductsTotal(result.total);
      setProductsPage(page);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load products');
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function onImport() {
    if (!activeConnectorId || selected.size === 0) return;
    setImporting(true);
    setImportResult(null);
    setError(null);
    try {
      const result = await api.post<{ imported: number }>(`/connectors/${activeConnectorId}/import`, {
        connectorProductIds: Array.from(selected),
      });
      setSelected(new Set());
      setImportResult(`Imported ${result.imported} item${result.imported === 1 ? '' : 's'} to your library.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  // Imports the FULL synced set for this connector server-side, not just
  // whatever page happens to be loaded on screen — the individual
  // checkbox selection above only ever sees one page at a time.
  async function onImportAll() {
    if (!activeConnectorId) return;
    setImporting(true);
    setImportResult(null);
    setError(null);
    try {
      const result = await api.post<{ imported: number; total: number }>(`/connectors/${activeConnectorId}/import-all`);
      setSelected(new Set());
      setImportResult(`Imported ${result.imported} of ${result.total} synced products to your library.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Connectors</h1>

      <div className="mb-8 max-w-xl rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <p className="text-lg font-semibold">Magento connection</p>
          {hasExistingMagento && (
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
              ✓ {existingMagento?.credentialsPreview ?? 'Credentials saved'}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Uses Integration credentials from Admin → System → Extensions → Integrations. The full secret values are
          encrypted before they&apos;re stored and are never sent back to this browser — that&apos;s why these fields
          always look blank, even when already connected (the green badge above confirms what&apos;s on file).
        </p>

        <form onSubmit={onConnect} className="mt-5 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Magento base URL</span>
            <input
              required
              value={baseUrl}
              onChange={(e) => {
                setBaseUrlTouched(true);
                setBaseUrl(e.target.value);
              }}
              placeholder="https://yourstore.com"
              className="w-full rounded border border-slate-300 px-3 py-1.5"
            />
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Credentials</span>
              {!credentialsLocked && (
                <button type="button" onClick={() => setRevealed((r) => !r)} className="text-sm text-slate-500 underline hover:text-slate-800">
                  {revealed ? 'Hide' : 'Show'}
                </button>
              )}
            </div>

            {credentialsLocked ? (
              <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2.5">
                <span className="text-sm text-slate-600">
                  🔒 {existingMagento?.credentialsPreview ?? 'Credentials on file'}
                </span>
                <button
                  type="button"
                  onClick={() => setCredentialsLocked(false)}
                  className="text-sm text-slate-500 underline hover:text-slate-800"
                >
                  Replace credentials
                </button>
              </div>
            ) : (
              <>
            <div className="mb-3 grid grid-cols-2 overflow-hidden rounded border border-slate-200 text-sm">
              <button
                type="button"
                onClick={() => setAuthMethod('oauth')}
                className={`px-3 py-2 ${authMethod === 'oauth' ? 'bg-slate-900 font-medium text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                Integration Keys (OAuth)
              </button>
              <button
                type="button"
                onClick={() => setAuthMethod('admin')}
                className={`px-3 py-2 ${authMethod === 'admin' ? 'bg-slate-900 font-medium text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                Admin Username/Password
              </button>
            </div>

            {authMethod === 'oauth' ? (
              <>
                <p className="mb-3 text-xs text-slate-500">
                  {hasExistingMagento
                    ? "Leave these four blank to keep your existing saved credentials — only fill them in if you want to replace them (e.g. after rotating your Magento keys)."
                    : 'All four are required together.'}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {OAUTH_FIELDS.map(([key, label]) => (
                    <label key={key} className="text-sm">
                      <span className="mb-1 block text-slate-600">{label}</span>
                      <input
                        type={revealed ? 'text' : 'password'}
                        value={oauthForm[key]}
                        onChange={(e) => setOauthForm((f) => ({ ...f, [key]: e.target.value }))}
                        placeholder={hasExistingMagento ? 'Leave blank to keep current' : ''}
                        className="w-full rounded border border-slate-300 px-3 py-1.5"
                      />
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="mb-3 text-xs text-slate-500">
                  Use this if the live store&apos;s Integration is missing permissions (a &ldquo;consumer isn&apos;t
                  authorized&rdquo; error) and reconfiguring it isn&apos;t practical. This uses a real Magento admin
                  login instead — it inherits whatever access that admin account already has.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    <span className="mb-1 block text-slate-600">Admin Username</span>
                    <input
                      type="text"
                      value={adminForm.adminUsername}
                      onChange={(e) => setAdminForm((f) => ({ ...f, adminUsername: e.target.value }))}
                      placeholder={hasExistingMagento ? 'Leave blank to keep current' : ''}
                      className="w-full rounded border border-slate-300 px-3 py-1.5"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-slate-600">Admin Password</span>
                    <input
                      type={revealed ? 'text' : 'password'}
                      value={adminForm.adminPassword}
                      onChange={(e) => setAdminForm((f) => ({ ...f, adminPassword: e.target.value }))}
                      placeholder={hasExistingMagento ? 'Leave blank to keep current' : ''}
                      className="w-full rounded border border-slate-300 px-3 py-1.5"
                    />
                  </label>
                </div>
              </>
            )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={connecting}
              className="rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {connecting ? 'Saving…' : hasExistingMagento ? 'Update connection' : 'Continue'}
            </button>
            <button
              type="button"
              onClick={onTest}
              disabled={testing || !baseUrl}
              className="rounded border border-slate-300 px-4 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              {testing ? 'Testing…' : 'Test connection'}
            </button>
          </div>
          {notice && <p className="text-sm text-green-700">{notice}</p>}
          {error && <p className="text-sm text-red-700">{error}</p>}
        </form>
      </div>

      {connectors === null ? (
        <p className="text-slate-400">Loading…</p>
      ) : connectors.length === 0 ? (
        <p className="text-slate-400">No connectors yet.</p>
      ) : (
        <div className="space-y-3">
          {connectors.map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{c.label ?? c.baseUrl ?? c.platform}</p>
                  <p className="text-xs text-slate-500">
                    {c.status} · {c.lastProductSyncAt ? `last synced ${new Date(c.lastProductSyncAt).toLocaleString()}` : 'never synced'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onSync(c.id)}
                    disabled={syncingId === c.id}
                    className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                  >
                    {syncingId === c.id ? 'Syncing… (this can take a while for a large catalog)' : 'Sync products'}
                  </button>
                  <button
                    onClick={() => viewProducts(c.id)}
                    className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                  >
                    View products
                  </button>
                </div>
              </div>
              {syncResult?.id === c.id && (
                <p className="mt-2 text-xs text-green-700">Synced {syncResult.productsSynced} products.</p>
              )}

              {activeConnectorId === c.id && products && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  {products.length === 0 ? (
                    <p className="text-sm text-slate-400">No products synced yet.</p>
                  ) : (
                    <>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-sm text-slate-500">
                          <input
                            type="checkbox"
                            checked={products.length > 0 && selected.size === products.length}
                            onChange={(e) => setSelected(e.target.checked ? new Set(products.map((p) => p.id)) : new Set())}
                          />
                          Select all on this page ({products.length} of {productsTotal})
                        </label>
                        <div className="flex items-center gap-3">
                          <p className="text-sm text-slate-500">{selected.size} selected</p>
                          <button
                            onClick={onImport}
                            disabled={selected.size === 0 || importing}
                            className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                          >
                            {importing ? 'Importing…' : 'Import selected'}
                          </button>
                          <button
                            onClick={onImportAll}
                            disabled={importing}
                            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                          >
                            {importing ? 'Importing…' : `Import all ${productsTotal} synced products`}
                          </button>
                        </div>
                      </div>
                      {importResult && <p className="mb-2 text-xs text-green-700">{importResult}</p>}
                      <table className="w-full text-sm">
                        <tbody>
                          {products.map((p) => (
                            <tr key={p.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50">
                              <td className="w-8 px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selected.has(p.id)}
                                  onChange={() => toggleSelected(p.id)}
                                />
                              </td>
                              <td className="px-2 py-1.5" onClick={() => setViewingProduct(p)}>
                                {p.name}
                              </td>
                              <td className="px-2 py-1.5 text-slate-500" onClick={() => setViewingProduct(p)}>
                                {p.sku}
                              </td>
                              <td className="px-2 py-1.5 text-slate-500" onClick={() => setViewingProduct(p)}>
                                {p.price ? Number(p.price).toFixed(2) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
                        <span>
                          Showing {productsPage * PRODUCTS_PAGE_SIZE + 1}–
                          {Math.min((productsPage + 1) * PRODUCTS_PAGE_SIZE, productsTotal)} of {productsTotal}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => viewProducts(c.id, productsPage - 1)}
                            disabled={productsPage === 0}
                            className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => viewProducts(c.id, productsPage + 1)}
                            disabled={(productsPage + 1) * PRODUCTS_PAGE_SIZE >= productsTotal}
                            className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {viewingProduct && <ProductDetailModal product={viewingProduct} onClose={() => setViewingProduct(null)} />}
    </div>
  );
}

function ProductDetailModal({ product, onClose }: { product: ConnectorProduct; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        {product.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt={product.name} className="mb-4 h-40 w-full rounded object-cover" />
        )}
        <p className="mb-1 text-lg font-semibold">{product.name}</p>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">SKU</dt>
            <dd>{product.sku}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Price</dt>
            <dd>{product.price ? Number(product.price).toFixed(2) : '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Status</dt>
            <dd>{product.statusLabel}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Visibility</dt>
            <dd>{product.visibilityLabel}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded border border-slate-300 py-1.5 text-sm hover:bg-slate-50"
        >
          Close
        </button>
      </div>
    </div>
  );
}
