'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '../../lib/api';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center text-slate-400">Loading…</main>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      const { accessToken } = await api.post<{ accessToken: string }>('/auth/reset-password', {
        token,
        newPassword: password,
      });
      // Straight in — they just proved account ownership by clicking the
      // emailed link, no reason to make them log in again separately.
      localStorage.setItem('accessToken', accessToken);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="mb-4 text-sm text-red-700">This link is missing its reset token.</p>
          <Link href="/forgot-password" className="text-sm text-slate-900 underline">
            Request a new link
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold">Choose a new password</h1>

        {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-slate-600">New password</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
        </label>

        <label className="mb-6 block text-sm">
          <span className="mb-1 block text-slate-600">Confirm new password</span>
          <input
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Reset password'}
        </button>
      </form>
    </main>
  );
}
