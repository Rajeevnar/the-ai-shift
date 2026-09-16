'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { useDialog } from '../../../lib/dialog';
import { TeamMember } from '../../../lib/types';

export default function TeamPage() {
  const { user } = useAuth();
  const { confirmDialog, alertDialog } = useDialog();
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'staff' | 'owner'>('staff');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isOwner = user?.role === 'owner';

  function load() {
    api.get<TeamMember[]>('/team').then(setMembers).catch(() => setMembers([]));
  }

  useEffect(load, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const member = await api.post<TeamMember & { temporaryPassword: string }>('/team', { email, role });
      setEmail('');
      setRole('staff');
      load();
      await alertDialog(
        `Account created for ${member.email}.\n\nTemporary password:\n${member.temporaryPassword}\n\n` +
          'Share this with them directly — it will not be shown again. They can change it after logging in, from Settings.',
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add team member');
    } finally {
      setSubmitting(false);
    }
  }

  async function onRemove(member: TeamMember) {
    const ok = await confirmDialog(`Remove ${member.email} from the team? They will no longer be able to log in.`, {
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/team/${member.id}`);
      load();
    } catch (err) {
      await alertDialog(err instanceof ApiError ? err.message : 'Could not remove team member');
    }
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">Team</h1>
      <p className="mb-6 text-sm text-slate-500">
        Everyone here has full access to quotes, clients, connectors and settings — the same as you.
        {!isOwner && ' Only an owner can add or remove people.'}
      </p>

      {isOwner && (
        <form onSubmit={onSubmit} className="mb-8 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded border border-slate-300 px-3 py-1.5"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'staff' | 'owner')}
              className="rounded border border-slate-300 px-3 py-1.5"
            >
              <option value="staff">Staff</option>
              <option value="owner">Owner</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? 'Adding…' : 'Add team member'}
          </button>
          {error && <span className="text-sm text-red-700">{error}</span>}
        </form>
      )}

      {members === null ? (
        <p className="text-slate-400">Loading…</p>
      ) : (
        <table className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Added</th>
              <th className="w-20 px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  {m.email}
                  {m.id === user?.id && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                </td>
                <td className="px-4 py-2 text-slate-500 capitalize">{m.role}</td>
                <td className="px-4 py-2 text-slate-500">{new Date(m.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-right">
                  {isOwner && m.id !== user?.id && (
                    <button onClick={() => onRemove(m)} className="text-xs text-slate-400 hover:text-red-600">
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
