'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '../../lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/auth/forgot-password', { email });
      // Same message regardless of whether the email matched an account —
      // the backend already made this choice, this just displays it.
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-xl font-semibold">Reset your password</h1>

        {sent ? (
          <p className="text-sm text-slate-600">
            If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link — check your inbox.
          </p>
        ) : (
          <>
            <p className="mb-6 text-sm text-slate-500">Enter your email and we&apos;ll send you a link to reset it.</p>
            <form onSubmit={onSubmit}>
              {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <label className="mb-6 block text-sm">
                <span className="mb-1 block text-slate-600">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {submitting ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          </>
        )}

        <p className="mt-4 text-center text-sm text-slate-500">
          <Link href="/login" className="text-slate-900 underline">
            Back to log in
          </Link>
        </p>
      </div>
    </main>
  );
}
