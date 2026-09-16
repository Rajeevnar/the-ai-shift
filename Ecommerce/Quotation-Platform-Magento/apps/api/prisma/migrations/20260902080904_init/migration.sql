-- CreateEnum
CREATE TYPE "ConnectorPlatform" AS ENUM ('magento', 'shopify', 'custom');

-- CreateEnum
CREATE TYPE "ConnectorStatus" AS ENUM ('not_connected', 'pending', 'connected', 'error', 'disabled');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('draft', 'sent', 'accepted', 'declined', 'expired');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "external_system_ref" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "is_platform_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_connectors" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "platform" "ConnectorPlatform" NOT NULL DEFAULT 'magento',
    "status" "ConnectorStatus" NOT NULL DEFAULT 'not_connected',
    "label" TEXT,
    "base_url" TEXT,
    "credentials" TEXT,
    "last_product_sync_at" TIMESTAMP(3),
    "last_sync_completed_page" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connector_products" (
    "id" TEXT NOT NULL,
    "store_connector_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2),
    "currency" TEXT DEFAULT 'GBP',
    "image_url" TEXT,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connector_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_library_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "source_connector_product_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "default_unit_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "default_vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "account" TEXT,
    "unit" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_library_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "billing_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "quote_number" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'draft',
    "reference" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "issue_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3),
    "notes" TEXT,
    "sent_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vat_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_sections" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vat_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_line_items" (
    "id" TEXT NOT NULL,
    "quote_section_id" TEXT NOT NULL,
    "item_library_item_id" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "account" TEXT,
    "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_email_key" ON "tenants"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_users_tenant_id_idx" ON "admin_users"("tenant_id");

-- CreateIndex
CREATE INDEX "store_connectors_tenant_id_idx" ON "store_connectors"("tenant_id");

-- CreateIndex
CREATE INDEX "connector_products_store_connector_id_idx" ON "connector_products"("store_connector_id");

-- CreateIndex
CREATE UNIQUE INDEX "connector_products_store_connector_id_sku_key" ON "connector_products"("store_connector_id", "sku");

-- CreateIndex
CREATE INDEX "item_library_items_tenant_id_idx" ON "item_library_items"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_library_items_tenant_id_source_connector_product_id_key" ON "item_library_items"("tenant_id", "source_connector_product_id");

-- CreateIndex
CREATE INDEX "clients_tenant_id_idx" ON "clients"("tenant_id");

-- CreateIndex
CREATE INDEX "quotes_tenant_id_idx" ON "quotes"("tenant_id");

-- CreateIndex
CREATE INDEX "quotes_tenant_id_status_idx" ON "quotes"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_tenant_id_quote_number_key" ON "quotes"("tenant_id", "quote_number");

-- CreateIndex
CREATE INDEX "quote_sections_quote_id_idx" ON "quote_sections"("quote_id");

-- CreateIndex
CREATE INDEX "quote_line_items_quote_section_id_idx" ON "quote_line_items"("quote_section_id");

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_connectors" ADD CONSTRAINT "store_connectors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_products" ADD CONSTRAINT "connector_products_store_connector_id_fkey" FOREIGN KEY ("store_connector_id") REFERENCES "store_connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_library_items" ADD CONSTRAINT "item_library_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_library_items" ADD CONSTRAINT "item_library_items_source_connector_product_id_fkey" FOREIGN KEY ("source_connector_product_id") REFERENCES "connector_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_sections" ADD CONSTRAINT "quote_sections_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_quote_section_id_fkey" FOREIGN KEY ("quote_section_id") REFERENCES "quote_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_item_library_item_id_fkey" FOREIGN KEY ("item_library_item_id") REFERENCES "item_library_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
