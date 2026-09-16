-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

