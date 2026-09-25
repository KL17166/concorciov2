-- Flag manual por gateway (tela /admin/gateways): só mostra "aprovação manual" no app quando a gateway usada for manual
ALTER TABLE "gateway_configs" ADD COLUMN "requiresManualReview" BOOLEAN NOT NULL DEFAULT false;

-- Sementes coerentes com o comportamento real: Eldorado/G2G não têm webhook (baixa manual); PixGo/Sigilopay confirmam por webhook
UPDATE "gateway_configs" SET "requiresManualReview" = true WHERE "name" IN ('eldorado', 'g2g');
