'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/auth';
import { ApiError } from '../../lib/api';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold">Log in</h1>

        {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-slate-600">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
        </label>

        <label className="mb-2 block text-sm">
          <span className="mb-1 block text-slate-600">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
        </label>

        <div className="mb-6 text-right">
          <Link href="/forgot-password" className="text-sm text-slate-500 hover:text-slate-800 hover:underline">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? 'Logging in…' : 'Log in'}
        </button>

        <p className="mt-4 text-center text-sm text-slate-500">
          No account?{' '}
          <Link href="/register" className="text-slate-900 underline">
            Register
          </Link>
        </p>
      </form>
    </main>
  );
}
