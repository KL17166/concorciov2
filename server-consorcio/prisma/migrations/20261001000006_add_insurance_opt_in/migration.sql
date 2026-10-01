-- Seguro de vida em grupo (opt-in no detalhe do produto)
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "insuranceOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "insuranceRate" NUMERIC(65,30);
