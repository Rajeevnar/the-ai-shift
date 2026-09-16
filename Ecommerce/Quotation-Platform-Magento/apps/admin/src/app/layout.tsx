import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../lib/auth';
import { DialogProvider } from '../lib/dialog';

export const metadata: Metadata = {
  title: 'Quotation Builder',
  description: 'Quotation Builder — Admin Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen text-slate-900">
        <DialogProvider>
          <AuthProvider>{children}</AuthProvider>
        </DialogProvider>
      </body>
    </html>
  );
}
