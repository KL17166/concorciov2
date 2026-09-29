-- CreateTable
CREATE TABLE "pixel_configs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "pixelId" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pixel_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pixel_configs_provider_key" ON "pixel_configs"("provider");

