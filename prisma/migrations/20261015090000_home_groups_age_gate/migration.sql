-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "showOnHome" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "ageGateOnEnter" BOOLEAN NOT NULL DEFAULT false;

