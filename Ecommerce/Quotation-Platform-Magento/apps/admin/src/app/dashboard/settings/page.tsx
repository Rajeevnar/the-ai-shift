'use client';

import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../../lib/api';
import { Branding, EmailConnector, EmailProvider } from '../../../lib/types';
import { RichTextEditor } from '../../../components/RichTextEditor';
import { buildPreviewHtml } from '../../../lib/email-preview';

const EMAIL_PROVIDERS: { value: EmailProvider; label: string }[] = [
  { value: 'brevo', label: 'Brevo' },
  { value: 'sendgrid', label: 'SendGrid' },
  { value: 'postmark', label: 'Postmark' },
  { value: 'mailgun', label: 'Mailgun' },
  { value: 'resend', label: 'Resend' },
  { value: 'custom', label: 'Custom SMTP' },
];

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 text-2xl font-semibold">Settings</h1>
      <BrandingCard />
      <div className="mx-auto mt-8 max-w-2xl space-y-8">
        <EmailConnectorCard />
        <PasswordCard />
      </div>
    </div>
  );
}

function PasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveState('saving');
    setError(null);
    try {
      await api.patch('/auth/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setSaveState('saved');
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1500);
    } catch (err) {
      setSaveState('error');
      setError(err instanceof ApiError ? err.message : 'Could not change password');
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold">Your password</p>
          <p className="text-sm text-slate-500">Change the password for your own account.</p>
        </div>
        {saveState !== 'idle' && (
          <span className={`text-xs ${saveState === 'error' ? 'text-red-600' : 'text-slate-400'}`}>
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : 'Not saved'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Current password</span>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-1.5"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">New password</span>
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-1.5"
          />
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        className="mt-4 rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Change password
      </button>
    </form>
  );
}

function BrandingCard() {
  const [branding, setBranding] = useState<Branding | null>(null);
  const [form, setForm] = useState({
    logoUrl: '',
    brandColor: '',
    emailBgColor: '',
    address: '',
    phone: '',
    emailFromName: '',
    quoteHeaderTitle: '',
    quoteIntroMessage: '',
    quoteFooterMessage: '',
  });
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<Branding>('/settings/branding').then((b) => {
      setBranding(b);
      setForm({
        logoUrl: b.logoUrl ?? '',
        brandColor: b.brandColor ?? '',
        emailBgColor: b.emailBgColor ?? '',
        address: b.address ?? '',
        phone: b.phone ?? '',
        emailFromName: b.emailFromName ?? '',
        quoteHeaderTitle: b.quoteHeaderTitle ?? '',
        quoteIntroMessage: b.quoteIntroMessage ?? '',
        quoteFooterMessage: b.quoteFooterMessage ?? '',
      });
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveState('saving');
    setError(null);
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v || undefined]));
      await api.patch('/settings/branding', payload);
      setSaveState('saved');
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1500);
    } catch (err) {
      setSaveState('error');
      setError(err instanceof ApiError ? err.message : 'Could not save branding');
    }
  }

  async function onLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const updated = await api.uploadFile<Branding>('/settings/branding/logo', file);
      setBranding(updated);
      setForm((f) => ({ ...f, logoUrl: updated.logoUrl ?? '' }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload logo');
    } finally {
      setUploading(false);
    }
  }

  if (!branding) return <p className="text-slate-400">Loading…</p>;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
    <form onSubmit={onSubmit} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold">Brand & quote emails</p>
          <p className="text-sm text-slate-500">Shown in the header of every quote/invoice you send, and used as email defaults.</p>
        </div>
        {saveState !== 'idle' && (
          <span className={`text-xs ${saveState === 'error' ? 'text-red-600' : 'text-slate-400'}`}>
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : 'Not saved'}
          </span>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <span className="mb-1 block text-sm text-slate-600">Logo</span>
          <div className="flex flex-wrap items-center gap-3">
            {form.logoUrl && (
              <img
                src={form.logoUrl}
                alt="Logo preview"
                className="h-12 w-12 shrink-0 rounded border border-slate-200 object-contain"
              />
            )}
            {/* The native file input is triggered via ref instead of a
                wrapping <label> — its own "Choose File / No file chosen"
                chrome can't be reliably hidden with a CSS class across
                browsers, and when it renders it blows out this row's width
                past the card's border. */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
              onChange={onLogoFileChange}
              disabled={uploading}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Upload image…'}
            </button>
            {form.logoUrl && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, logoUrl: '' }))}
                className="text-sm text-slate-500 hover:text-slate-800"
              >
                Remove
              </button>
            )}
          </div>
          <input
            value={form.logoUrl}
            onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
            placeholder="or paste an image URL: https://yoursite.com/logo.png"
            className="mt-2 w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Brand color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(form.brandColor) ? form.brandColor : '#0f172a'}
                onChange={(e) => setForm((f) => ({ ...f, brandColor: e.target.value }))}
                className="h-9 w-11 shrink-0 cursor-pointer rounded border border-slate-300 p-0.5"
              />
              <input
                type="text"
                value={form.brandColor}
                onChange={(e) => setForm((f) => ({ ...f, brandColor: e.target.value }))}
                placeholder="#0f172a"
                className="w-full rounded border border-slate-300 px-3 py-1.5"
              />
            </div>
            <span className="mt-1 block text-xs text-slate-400">Accent border under the header and the reset-password button.</span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Email background</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(form.emailBgColor) ? form.emailBgColor : '#f8fafc'}
                onChange={(e) => setForm((f) => ({ ...f, emailBgColor: e.target.value }))}
                className="h-9 w-11 shrink-0 cursor-pointer rounded border border-slate-300 p-0.5"
              />
              <input
                type="text"
                value={form.emailBgColor}
                onChange={(e) => setForm((f) => ({ ...f, emailBgColor: e.target.value }))}
                placeholder="#f8fafc"
                className="w-full rounded border border-slate-300 px-3 py-1.5"
              />
            </div>
            <span className="mt-1 block text-xs text-slate-400">Fill behind the header and footer bands.</span>
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Phone</span>
          <input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="w-full rounded border border-slate-300 px-3 py-1.5"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Business address</span>
          <input
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            className="w-full rounded border border-slate-300 px-3 py-1.5"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Email "from" name</span>
          <input
            value={form.emailFromName}
            onChange={(e) => setForm((f) => ({ ...f, emailFromName: e.target.value }))}
            placeholder={branding.name}
            className="w-full rounded border border-slate-300 px-3 py-1.5"
          />
          <span className="mt-1 block text-xs text-slate-400">
            The sender name recipients see, e.g. "{branding.name} Quotes" instead of just "{branding.name}". Only
            applies when sending via the platform's shared sender — a connected provider under Email connector below
            uses its own from name instead.
          </span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Email header title</span>
          <input
            value={form.quoteHeaderTitle}
            onChange={(e) => setForm((f) => ({ ...f, quoteHeaderTitle: e.target.value }))}
            placeholder={branding.name}
            className="w-full rounded border border-slate-300 px-3 py-1.5"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Default intro message</span>
          <RichTextEditor
            value={form.quoteIntroMessage}
            onChange={(html) => setForm((f) => ({ ...f, quoteIntroMessage: html }))}
            placeholder={`Here's your quote from ${branding.name}.`}
          />
          <span className="mt-1 block text-xs text-slate-400">Can be overridden per-quote via its Notes field, or per-send.</span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Footer message (e.g. thanks)</span>
          <RichTextEditor
            value={form.quoteFooterMessage}
            onChange={(html) => setForm((f) => ({ ...f, quoteFooterMessage: html }))}
            placeholder="Thanks for your business!"
          />
        </label>
        <button type="submit" className="rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
          Save branding
        </button>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
    </form>

    <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-[420px]">
      <p className="mb-2 text-sm font-medium text-slate-600">Live preview</p>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <iframe
          title="Email preview"
          srcDoc={buildPreviewHtml({
            tenantName: branding.name,
            logoUrl: form.logoUrl,
            brandColor: form.brandColor,
            emailBgColor: form.emailBgColor,
            headerTitle: form.quoteHeaderTitle,
            introHtml: form.quoteIntroMessage,
            footerHtml: form.quoteFooterMessage,
          })}
          className="h-[600px] w-full"
        />
      </div>
      <p className="mt-2 text-xs text-slate-400">Sample quote — updates as you type, before you save.</p>
    </aside>
    </div>
  );
}

function EmailConnectorCard() {
  const [connector, setConnector] = useState<EmailConnector | null | undefined>(undefined);
  const [provider, setProvider] = useState<EmailProvider>('brevo');
  const [form, setForm] = useState({ fromEmail: '', fromName: '', smtpHost: '', smtpPort: '', smtpUsername: '', smtpPassword: '' });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);

  function load() {
    api
      .get<EmailConnector>('/email-connector')
      .then((c) => {
        setConnector(c);
        setProvider(c.provider);
        setForm((f) => ({ ...f, fromEmail: c.fromEmail, fromName: c.fromName, smtpUsername: c.smtpUsername }));
      })
      .catch(() => setConnector(null));
  }

  useEffect(load, []);

  function buildPayload() {
    return {
      provider,
      fromEmail: form.fromEmail,
      fromName: form.fromName,
      smtpUsername: form.smtpUsername,
      smtpPassword: form.smtpPassword || undefined,
      ...(provider === 'custom' ? { smtpHost: form.smtpHost, smtpPort: form.smtpPort ? Number(form.smtpPort) : undefined } : {}),
    };
  }

  async function onTest() {
    setError(null);
    setNotice(null);
    setTesting(true);
    try {
      await api.post('/email-connector/test', buildPayload());
      setNotice('Connection successful.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not verify this connection');
    } finally {
      setTesting(false);
    }
  }

  // Switching to a DIFFERENT provider than the one currently connected
  // clears username/password — reusing, say, Brevo's saved key as if it
  // were a SendGrid key would silently misconfigure the connector instead
  // of failing obviously. Switching back to the already-connected
  // provider restores its username (never the password — that's never
  // sent back regardless).
  function onProviderTabClick(next: EmailProvider) {
    setProvider(next);
    if (connector && next === connector.provider) {
      setForm((f) => ({ ...f, smtpUsername: connector.smtpUsername, smtpPassword: '' }));
    } else {
      setForm((f) => ({ ...f, smtpUsername: '', smtpPassword: '' }));
    }
  }

  async function onConnect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setConnecting(true);
    try {
      await api.post('/email-connector/connect', buildPayload());
      setForm((f) => ({ ...f, smtpPassword: '' }));
      setNotice('Saved.');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this connection');
    } finally {
      setConnecting(false);
    }
  }

  if (connector === undefined) return <p className="text-slate-400">Loading…</p>;

  return (
    <form onSubmit={onConnect} className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-2">
        <p className="text-lg font-semibold">Sending email</p>
        {connector && (
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
            ✓ Connected via {EMAIL_PROVIDERS.find((p) => p.value === connector.provider)?.label}
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Connect your own provider so quotes/invoices send from your own account. If you skip this, sends fall back to
        the platform&apos;s shared sender using your brand name.
      </p>

      <div className="mb-3 grid grid-cols-5 overflow-hidden rounded border border-slate-200 text-xs">
        {EMAIL_PROVIDERS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onProviderTabClick(p.value)}
            className={`px-2 py-2 ${provider === p.value ? 'bg-slate-900 font-medium text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {provider !== connector?.provider && (
        <p className="mb-3 text-xs text-amber-600">
          Switching provider — enter this one&apos;s username and password/API key below (they&apos;re specific to
          {' '}{EMAIL_PROVIDERS.find((p) => p.value === provider)?.label}, not reused from your current connection).
        </p>
      )}

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">From email</span>
            <input
              required
              type="email"
              value={form.fromEmail}
              onChange={(e) => setForm((f) => ({ ...f, fromEmail: e.target.value }))}
              placeholder="quotes@yourbusiness.com"
              className="w-full rounded border border-slate-300 px-3 py-1.5"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">From name</span>
            <input
              required
              value={form.fromName}
              onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))}
              className="w-full rounded border border-slate-300 px-3 py-1.5"
            />
          </label>
        </div>
        {provider === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">SMTP host</span>
              <input
                required
                value={form.smtpHost}
                onChange={(e) => setForm((f) => ({ ...f, smtpHost: e.target.value }))}
                className="w-full rounded border border-slate-300 px-3 py-1.5"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">SMTP port</span>
              <input
                required
                type="number"
                value={form.smtpPort}
                onChange={(e) => setForm((f) => ({ ...f, smtpPort: e.target.value }))}
                className="w-full rounded border border-slate-300 px-3 py-1.5"
              />
            </label>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">SMTP username</span>
            <input
              required
              value={form.smtpUsername}
              onChange={(e) => setForm((f) => ({ ...f, smtpUsername: e.target.value }))}
              className="w-full rounded border border-slate-300 px-3 py-1.5"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">SMTP password / API key</span>
            <input
              type="password"
              value={form.smtpPassword}
              onChange={(e) => setForm((f) => ({ ...f, smtpPassword: e.target.value }))}
              placeholder={connector && provider === connector.provider ? 'Leave blank to keep current' : 'Required'}
              className="w-full rounded border border-slate-300 px-3 py-1.5"
            />
          </label>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={connecting}
            className="rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {connecting ? 'Saving…' : connector ? 'Update connection' : 'Connect'}
          </button>
          <button
            type="button"
            onClick={onTest}
            disabled={testing}
            className="rounded border border-slate-300 px-4 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            {testing ? 'Testing…' : 'Test connection'}
          </button>
        </div>
        {connector && <p className="text-xs text-slate-400">Status: {connector.status}</p>}
        {notice && <p className="text-sm text-green-700">{notice}</p>}
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
    </form>
  );
}
