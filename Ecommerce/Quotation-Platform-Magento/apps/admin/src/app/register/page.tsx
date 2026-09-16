'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/auth';
import { ApiError } from '../../lib/api';

export default function RegisterPage() {
  const { register } = useAuth();
  const [tenantName, setTenantName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(tenantName, email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold">Create your account</h1>

        {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-slate-600">Business name</span>
          <input
            required
            value={tenantName}
            onChange={(e) => setTenantName(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
        </label>

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

        <label className="mb-6 block text-sm">
          <span className="mb-1 block text-slate-600">Password</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </button>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="text-slate-900 underline">
            Log In
          </Link>
        </p>
      </form>
    </main>
  );
}
