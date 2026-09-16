-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "reset_token" TEXT,
ADD COLUMN     "reset_token_expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_reset_token_key" ON "admin_users"("reset_token");

