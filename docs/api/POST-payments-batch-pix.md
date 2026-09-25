# POST /api/payments/batch/pix
- **Ativado por:** multi-seleção em `consortium/payments.vue` (via `paymentStore.generateBatchPix`)
  - BFF espelho: `zuvio-web/server/api/payments/batch/pix.post.ts`
  - Handler: `generateBatchPixPayment` → `generateBatchPayment`
- **Auth / rate-limit:** `authenticate` + `transactionRateLimiter`
- **Request:** `{ subscriptionId, items: [{ number, idTokenPay }] }` (1–12)
- **O que o servidor retorna:**
  - 200 `{ success, batchId, items[{installmentId, number, amount, anticipated}], totalAmount, provider, isManualApproval, copyPaste, qrCode, expiresAt, reused }`
  - 400/403/404 → validações (ver `generateBatchPayment`)
- **Efeitos:** cria `payment_batches` + attempts; cobrança real do total na gateway
