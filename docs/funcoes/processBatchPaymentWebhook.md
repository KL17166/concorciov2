# processBatchPaymentWebhook
- **Arquivo:** `server-consorcio/src/application/payments/processBatchPaymentWebhook.ts`
- **O que faz:** Liquida 1 PIX combinado: valida o total e dá baixa nas N parcelas em 1 transação.
- **O que ativa ela:** `processPaymentWebhook` quando `external_id` tem prefixo `batch-` (webhooks pixgo/sigilopay)
- **Entradas:** `provider, batchExternalId, paidAmount?, paymentMethod, eventSignature, providerEventId?, rawPayload`
- **Saídas:** 200 liquidado (ou já processado), 404 lote inexistente, 410 lote não-ACTIVE, 400 total divergente (±5%), 500 falha
- **Regras/efeitos:**
  - Idempotente por `webhook_logs.signature`; loop `markInstallmentAsPaid` por parcela + attempts do lote → PAID + batch PAID/paidAt + `auditLog BATCH_PAYMENT_CONFIRMED`
