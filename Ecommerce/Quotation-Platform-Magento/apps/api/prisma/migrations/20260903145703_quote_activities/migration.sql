-- CreateEnum
CREATE TYPE "QuoteActivityType" AS ENUM ('sent', 'accepted', 'declined', 'converted_to_invoice', 'reverted_to_quote');

-- CreateTable
CREATE TABLE "quote_activities" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "type" "QuoteActivityType" NOT NULL,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quote_activities_quote_id_idx" ON "quote_activities"("quote_id");

-- AddForeignKey
ALTER TABLE "quote_activities" ADD CONSTRAINT "quote_activities_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

