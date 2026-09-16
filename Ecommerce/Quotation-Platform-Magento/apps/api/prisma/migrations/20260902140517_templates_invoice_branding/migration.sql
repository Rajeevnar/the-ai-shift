-- CreateEnum
CREATE TYPE "QuoteDocumentType" AS ENUM ('quote', 'invoice');

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "converted_to_invoice_at" TIMESTAMP(3),
ADD COLUMN     "document_type" "QuoteDocumentType" NOT NULL DEFAULT 'quote',
ADD COLUMN     "invoice_number" TEXT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "address" TEXT,
ADD COLUMN     "brand_color" TEXT,
ADD COLUMN     "logo_url" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "quote_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_template_sections" (
    "id" TEXT NOT NULL,
    "quote_template_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_template_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_template_line_items" (
    "id" TEXT NOT NULL,
    "quote_template_section_id" TEXT NOT NULL,
    "item_library_item_id" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "account" TEXT,
    "vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_template_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quote_templates_tenant_id_idx" ON "quote_templates"("tenant_id");

-- CreateIndex
CREATE INDEX "quote_template_sections_quote_template_id_idx" ON "quote_template_sections"("quote_template_id");

-- CreateIndex
CREATE INDEX "quote_template_line_items_quote_template_section_id_idx" ON "quote_template_line_items"("quote_template_section_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotes_tenant_id_invoice_number_key" ON "quotes"("tenant_id", "invoice_number");

-- AddForeignKey
ALTER TABLE "quote_templates" ADD CONSTRAINT "quote_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_template_sections" ADD CONSTRAINT "quote_template_sections_quote_template_id_fkey" FOREIGN KEY ("quote_template_id") REFERENCES "quote_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_template_line_items" ADD CONSTRAINT "quote_template_line_items_quote_template_section_id_fkey" FOREIGN KEY ("quote_template_section_id") REFERENCES "quote_template_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_template_line_items" ADD CONSTRAINT "quote_template_line_items_item_library_item_id_fkey" FOREIGN KEY ("item_library_item_id") REFERENCES "item_library_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

