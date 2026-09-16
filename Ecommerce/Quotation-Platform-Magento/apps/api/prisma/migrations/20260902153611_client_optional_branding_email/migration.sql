-- CreateEnum
CREATE TYPE "EmailProviderPreset" AS ENUM ('brevo', 'sendgrid', 'postmark', 'mailgun', 'custom');

-- DropForeignKey
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_client_id_fkey";

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "quote_footer_message" TEXT,
ADD COLUMN     "quote_header_title" TEXT,
ADD COLUMN     "quote_intro_message" TEXT;

-- AlterTable
ALTER TABLE "quotes" ALTER COLUMN "client_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "email_connectors" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "provider" "EmailProviderPreset" NOT NULL DEFAULT 'custom',
    "status" "ConnectorStatus" NOT NULL DEFAULT 'not_connected',
    "from_email" TEXT NOT NULL,
    "from_name" TEXT NOT NULL,
    "smtp_host" TEXT NOT NULL,
    "smtp_port" INTEGER NOT NULL,
    "smtp_username" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_connectors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_connectors_tenant_id_key" ON "email_connectors"("tenant_id");

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_connectors" ADD CONSTRAINT "email_connectors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

