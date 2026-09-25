# POST /api/bids/:id/pix
- **Ativado por:** tela de pagamento do lance aprovado (Gerar PIX)
  - BFF espelho: `zuvio-web/server/api/bids/[id]/pix.post.ts`
  - Handler: `generateClientBidPix` → `generateBidPix` (application)
- **Auth / rate-limit:** `authenticate` + `transactionRateLimiter`
  - App: `bidLimiter` + `generalLimiter` + `securityMiddleware`
- **Request:** param `id` (bid aprovado do dono)
  - Sem body; sem schema zod
- **O que o servidor retorna:**
  - 200 `{ success: true, message: 'PIX do lance gerado com sucesso', ...result }`
  - `result`: `bidId`, `bidPaymentId`, `amount`, `percentage`, `productName`,
    `qrCode`, `qrCodeText`/`pixCopiaECola`, `expiresAt`, `reused`
  - 400 → lance não elegível a PIX
  - 401/403 → sem auth ou não dono
  - 404 → lance inexistente
  - 503 GATEWAY_UNAVAILABLE → gateway fora
  - 429 → rate limit
- **Efeitos:**
  - Cria/atualiza cobrança PIX do lance no gateway
  - Grava referência de pagamento no banco
