# Contrato de adesão (`/checkout/contract`)
- **Objetivo:** Exibir o contrato + documentos para leitura, aceite e assinatura digital.
- **O que precisa do servidor:**
  - `GET /api/products` (via `ensureProductsLoaded`) → resolve `?productId/?planId` contra o catálogo real
  - `POST /api/subscriptions` (via `finalizeCheckout`, body `{userId, productId, planId, token, termsAccepted, documentFrontUrl, documentBackUrl, selfieUrl}`) → `subscriptionId`, `installments[0].{id, idTokenPay}`
  - `POST /api/payments/:installmentId/pix` (auto, após criar; body `{idTokenPay}`) → `amount`, `requestedAmount`, `copyPaste`, `qrCode`, `expirationDate` (vira `paymentData`)
- **Ações → chamadas:**
  - "ASSINAR CONTRATO DIGITALMENTE" → `POST /api/subscriptions` (+ PIX automático)
  - Re-upload de frente/verso/selfie → só atualiza a store local (sem chamada)
- **Estados:**
  - Sem scroll até o fim ou sem aceite → botão desabilitado.
  - Sucesso → `router.push('/checkout/payment?subscriptionId=...')`.
  - Falha → `errorMessage`; se menciona expiração/token → botão "Fazer login novamente" (`clearSession` + `/welcome?redirect=`).
  - Sem `personal.name` ou `?productId` inválido → volta a `/checkout` ou `/`.

- Pixel global: `SCREEN_VIEW` emitido pelo middleware `track.global.ts` a cada navegação (sem duplicar no mount da página).
