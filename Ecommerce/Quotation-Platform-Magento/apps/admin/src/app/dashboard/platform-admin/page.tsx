'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../../lib/api';
import { useDialog } from '../../../lib/dialog';
import { PlatformTenant } from '../../../lib/types';

export default function PlatformAdminPage() {
  const { confirmDialog } = useDialog();
  const [tenants, setTenants] = useState<PlatformTenant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    api
      .get<PlatformTenant[]>('/platform-admin/tenants')
      .then(setTenants)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load tenants'));
  }

  useEffect(load, []);

  async function toggleActive(tenant: PlatformTenant) {
    setBusyId(tenant.id);
    try {
      await api.patch(`/platform-admin/tenants/${tenant.id}/status`, { isActive: !tenant.isActive });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update tenant');
    } finally {
      setBusyId(null);
    }
  }

  async function removeTenant(tenant: PlatformTenant) {
    const ok = await confirmDialog(
      `Permanently delete "${tenant.name}" and everything they've created? This cannot be undone.`,
      { confirmLabel: 'Delete', danger: true },
    );
    if (!ok) return;
    setBusyId(tenant.id);
    try {
      await api.delete(`/platform-admin/tenants/${tenant.id}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete tenant');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Platform Admin</h1>
      <p className="mb-6 text-slate-500">Every tenant on this platform, across all owners.</p>

      {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {tenants === null ? (
        <p className="text-slate-400">Loading…</p>
      ) : tenants.length === 0 ? (
        <p className="text-slate-400">No tenants yet.</p>
      ) : (
        <table className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Tenant</th>
              <th className="px-4 py-2 font-medium">Owner(s)</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Created</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{t.name}</td>
                <td className="px-4 py-2 text-slate-500">
                  {t.adminUsers.map((u) => (
                    <div key={u.id}>
                      {u.email}
                      {u.isPlatformAdmin && <span className="ml-1 text-xs text-slate-400">(platform admin)</span>}
                    </div>
                  ))}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      t.isActive ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {t.isActive ? 'active' : 'paused'}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => toggleActive(t)}
                    disabled={busyId === t.id}
                    className="mr-2 rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                  >
                    {t.isActive ? 'Pause' : 'Activate'}
                  </button>
                  <button
                    onClick={() => removeTenant(t)}
                    disabled={busyId === t.id}
                    className="rounded border border-red-200 px-3 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
