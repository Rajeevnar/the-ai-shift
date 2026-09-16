export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  tags: string[];
}

export interface ClientSummary extends Client {
  quoteCount: number;
}

export interface ClientQuoteHistoryEntry {
  id: string;
  quoteNumber: string;
  invoiceNumber: string | null;
  documentType: QuoteDocumentType;
  status: QuoteStatus;
  grandTotal: string;
  createdAt: string;
  sentAt: string | null;
  sentCount: number;
}

export interface ItemLibraryItem {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  defaultUnitPrice: string;
  defaultVatRate: string;
  account: string | null;
  unit: string | null;
  sourceConnectorProductId: string | null;
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
export type QuoteDocumentType = 'quote' | 'invoice';

export interface QuoteSummary {
  id: string;
  quoteNumber: string;
  invoiceNumber: string | null;
  documentType: QuoteDocumentType;
  status: QuoteStatus;
  currency: string;
  issueDate: string;
  grandTotal: string;
  client: { id: string; name: string } | null;
}

export interface QuoteLineItem {
  id: string;
  itemLibraryItemId: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  account: string | null;
  vatRate: string;
  amount: string;
  taxAmount: string;
  position: number;
}

export interface QuoteSection {
  id: string;
  title: string;
  position: number;
  subtotal: string;
  vatTotal: string;
  lineItems: QuoteLineItem[];
}

export type QuoteActivityType = 'sent' | 'accepted' | 'declined' | 'converted_to_invoice' | 'reverted_to_quote';

export interface QuoteActivity {
  id: string;
  type: QuoteActivityType;
  detail: string | null;
  createdAt: string;
}

export interface QuoteFull {
  id: string;
  quoteNumber: string;
  invoiceNumber: string | null;
  documentType: QuoteDocumentType;
  status: QuoteStatus;
  currency: string;
  reference: string | null;
  notes: string | null;
  issueDate: string;
  dueDate: string | null;
  subtotal: string;
  vatTotal: string;
  grandTotal: string;
  client: Client | null;
  sections: QuoteSection[];
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  convertedToInvoiceAt: string | null;
  activities: QuoteActivity[];
}

export interface QuoteTemplateLineItem {
  id: string;
  itemLibraryItemId: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  account: string | null;
  vatRate: string;
  position: number;
}

export interface QuoteTemplateSection {
  id: string;
  title: string;
  position: number;
  lineItems: QuoteTemplateLineItem[];
}

export interface QuoteTemplateSummary {
  id: string;
  name: string;
}

export interface QuoteTemplateFull extends QuoteTemplateSummary {
  sections: QuoteTemplateSection[];
}

export type ConnectorStatus = 'not_connected' | 'pending' | 'connected' | 'error' | 'disabled';

export interface StoreConnector {
  id: string;
  platform: 'magento' | 'shopify' | 'custom';
  status: ConnectorStatus;
  label: string | null;
  baseUrl: string | null;
  lastProductSyncAt: string | null;
  credentialsPreview: string | null;
}

export interface ConnectorProduct {
  id: string;
  sku: string;
  name: string;
  price: string | null;
  imageUrl: string | null;
  statusLabel: string;
  visibilityLabel: string;
}

export interface TeamMember {
  id: string;
  email: string;
  role: string;
  isPlatformAdmin: boolean;
  createdAt: string;
}

export interface PlatformAdminUser {
  id: string;
  email: string;
  role: string;
  isPlatformAdmin: boolean;
}

export interface PlatformTenant {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  adminUsers: PlatformAdminUser[];
}

export interface DashboardOverview {
  totals: {
    quotes: number;
    draft: number;
    sent: number;
    accepted: number;
    declined: number;
    expired: number;
    acceptanceRate: number | null;
    acceptedValue: string;
    totalValue: string;
  };
  recentActivity: {
    id: string;
    type: QuoteActivityType;
    detail: string | null;
    createdAt: string;
    quoteId: string;
    quoteNumber: string;
    invoiceNumber: string | null;
    documentType: QuoteDocumentType;
    clientName: string | null;
  }[];
  topClients: { id: string; name: string; quoteCount: number; totalValue: string }[];
}

export interface Branding {
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
  emailBgColor: string | null;
  address: string | null;
  phone: string | null;
  emailFromName: string | null;
  quoteHeaderTitle: string | null;
  quoteIntroMessage: string | null;
  quoteFooterMessage: string | null;
}

export type EmailProvider = 'brevo' | 'sendgrid' | 'postmark' | 'mailgun' | 'resend' | 'custom';

export interface EmailConnector {
  id: string;
  provider: EmailProvider;
  status: ConnectorStatus;
  fromEmail: string;
  fromName: string;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
}
