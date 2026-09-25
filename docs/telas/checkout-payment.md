# Pagamento da adesão — checkout (`/checkout/payment`)
- **Objetivo:** Exibir o PIX gerado no checkout e confirmar o pagamento da adesão.
- **O que precisa do servidor:**
  - `GET /api/products` (via `ensureProductsLoaded`) → `name`, `imageUrl`, `plans[].{durationMonths, monthlyInstallment}`
  - `GET /api/subscriptions/:userId` (via `loadHomeData`, polling 8 s + botão) → procura `createdSubscriptionId`; usa `isAdesaoPaid`, `status`
  - `POST /api/subscription/:id/payment-check` (best-effort no "Verificar", com `Authorization`) → só avisa o backend; resposta ignorada
  - `POST /api/track` (pixel): `SCREEN_VIEW(payment)` no mount; `VERIFY_PAYMENT_CLICK` (entity subscription) no botão Verificar; `PAYMENT_CONFIRMED_VIEW` quando o polling confirma (polling em si não gera evento)
- **Ações → chamadas:**
  - "Verificar Pagamento no Servidor" → `loadHomeData` + `POST /api/subscription/:id/payment-check` (+ pixel `VERIFY_PAYMENT_CLICK`)
  - Copiar código → clipboard local (sem chamada; nesta tela sem evento de pixel)
- **Estados:**
  - `isAdesaoPaid || status==='active'` → `isPaymentConfirmed` → modal "Pagamento Confirmado!" → `/`.
  - Lê `paymentData`: `amount` (valor), `requestedAmount-amount` (pílula "Desconto"), `copyPaste` (QR gerado localmente via lib `qrcode`; usa `qrCode` se vier `data:`/`http`).
  - `isVerifying` → "Consultando confirmação no servidor..."; sem `paymentData` → "Gerando QR Code...".
  - Countdown 30 min é só visual (`isExpired` local, sem efeito no PIX).

- Pixel global: `SCREEN_VIEW` emitido pelo middleware `track.global.ts` a cada navegação (sem duplicar no mount da página).
- Resumo: foto SÓ se real (`photoUrl`: contrato ou catálogo API via `productsReal`), senão skeleton/placeholder; valor SÓ se puxado (`hasRealPrice`), senão skeleton (nunca R$ 0,00); com desconto: original riscado pequeno no canto superior + final aplicado + pílula com %.
