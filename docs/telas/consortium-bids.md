# Ofertar lance (`/consortium/bids`)
- **Objetivo:** Simular, registrar, pagar (PIX) ou cancelar lances do consórcio.
- **O que precisa do servidor:**
  - `GET /api/subscriptions/:userId` (via `loadHomeData`) → `contract`: `product`, `groupNumber`, `quotaNumber`, `creditValue`, `nextPaymentAmount`, `isAdesaoPaid`, `paidInstallments`
  - `GET /api/bids/:userId` (via `fetchUserBids`) → `approvedBid.{id, amount, percentage, type, subscriptionId, payment.status}`, `pendingBid.{amount, percentage}`
  - `GET /api/kyc/status` (via `kycStore.fetchStatus`) → `kycStatus` (gate do pagamento do lance)
  - `POST /api/bids` (via `submitBid`, body `{subscriptionId, amount, percentage, type: FREE|FIXED}`) → `bid`
  - `POST /api/bids/:bidId/pix` (via `generatePix`) → `pixCopiaECola|qrCodeText`, `amount`, `provider`, `isManualApproval`, `reused`
  - `POST /api/bids/:bidId/cancel` → marca `CANCELLED`; `POST /api/bids/:bidId/payment-check` (best-effort "já paguei")
- **Ações → chamadas:**
  - "REGISTRAR LANCE AGORA" → `POST /api/bids`; "PAGAR LANCE VIA PIX" → `POST .../pix`; "Cancelar" → `POST .../cancel`; "Já realizei o pagamento" → `POST .../payment-check`
- **Estados:**
  - `hasApprovedBid` → tela exclusiva de pagamento (`payment.status` PAID → confirmado; ACTIVE → acompanhe aqui).
  - Modal PIX: texto condicional por `isManualApproval` (manual → “confirmação manual em até 30 min úteis + Já realizei”; automática → “confirmação automática em segundos”). Botão “Já realizei” habilita após ter `pixCopiaECola`.
  - `!isAdesaoPaid` → bloqueio → `/consortium/adhesion`; sem contrato → "Nenhum Consórcio Ativo" → `/`.
  - `!isKycApproved` ao pagar → modal "Documentação em Análise" antes do PIX.
  - `hasPendingBid` → alerta "em análise" + cancelar inline; erros → `toastMessage`/toast.

- Pixel global: `SCREEN_VIEW` emitido pelo middleware `track.global.ts` a cada navegação (sem duplicar no mount da página).
