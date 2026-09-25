-- Cobrança combinada: 1 PIX somando N parcelas
CREATE TABLE "payment_batches" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "installmentIds" TEXT NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'pending',
    "externalId" TEXT,
    "copyPaste" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_batches_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "payment_batches_subscriptionId_status_idx" ON "payment_batches"("subscriptionId", "status");
ALTER TABLE "payment_batches" ADD CONSTRAINT "payment_batches_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Attempts passam a aceitar vínculo de lote (installmentId fica opcional)
ALTER TABLE "payment_attempts" ADD COLUMN "batchId" TEXT;
ALTER TABLE "payment_attempts" ALTER COLUMN "installmentId" DROP NOT NULL;
CREATE INDEX "payment_attempts_batchId_status_idx" ON "payment_attempts"("batchId", "status");
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "payment_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
