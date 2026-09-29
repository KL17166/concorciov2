-- AlterTable
ALTER TABLE "tracking_events" ADD COLUMN     "guestId" TEXT;

-- CreateIndex
CREATE INDEX "tracking_events_guestId_createdAt_idx" ON "tracking_events"("guestId", "createdAt");

