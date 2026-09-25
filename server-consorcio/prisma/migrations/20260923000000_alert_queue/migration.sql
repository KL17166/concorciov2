-- Central de Notificações fase 1: fila operacional em system_alerts
ALTER TABLE "system_alerts" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'OPEN';
ALTER TABLE "system_alerts" ADD COLUMN "assignedTo" TEXT;
ALTER TABLE "system_alerts" ADD COLUMN "assignedAt" TIMESTAMP(3);
ALTER TABLE "system_alerts" ADD COLUMN "resolvedAt" TIMESTAMP(3);
ALTER TABLE "system_alerts" ADD COLUMN "entityKind" TEXT;
ALTER TABLE "system_alerts" ADD COLUMN "entityId" TEXT;
ALTER TABLE "system_alerts" ADD COLUMN "claimToken" TEXT;

-- Backfill: lidos viram RESOLVED, não-lidos viram OPEN
UPDATE "system_alerts" SET "status" = CASE WHEN "read" = true THEN 'RESOLVED' ELSE 'OPEN' END;
UPDATE "system_alerts" SET "resolvedAt" = "readAt" WHERE "read" = true;

CREATE INDEX "system_alerts_status_createdAt_idx" ON "system_alerts"("status", "createdAt");
CREATE INDEX "system_alerts_assignedTo_status_idx" ON "system_alerts"("assignedTo", "status");
CREATE INDEX "system_alerts_entityKind_entityId_idx" ON "system_alerts"("entityKind", "entityId");
