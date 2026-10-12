-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "adminEnvSyncedHash" TEXT,
ADD COLUMN     "copyright" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3);

