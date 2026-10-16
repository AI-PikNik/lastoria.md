-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "analyticsLabel" TEXT;

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "dataUpgrades" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "homeShowInfo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "homeShowShortAnswer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "homeShowStory" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "faq_items" (
    "id" TEXT NOT NULL,
    "question" JSONB NOT NULL DEFAULT '{}',
    "answer" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "name" JSONB NOT NULL DEFAULT '{}',
    "description" JSONB NOT NULL DEFAULT '{}',
    "address" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "hours" JSONB NOT NULL DEFAULT '{}',
    "mapUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_images" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "faq_items_isActive_sortOrder_idx" ON "faq_items"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "locations_isActive_sortOrder_idx" ON "locations"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "location_images_locationId_sortOrder_idx" ON "location_images"("locationId", "sortOrder");

-- AddForeignKey
ALTER TABLE "location_images" ADD CONSTRAINT "location_images_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

