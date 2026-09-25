# Pagar adesão — contrato existente (`/consortium/adhesion`)
- **Objetivo:** Gerar/exibir o PIX da 1ª parcela (adesão) de um contrato já criado.
- **O que precisa do servidor:**
  - `GET /api/subscriptions/:userId` (via `loadHomeData`) → `activeContracts[0]`: `id`, `product`, `totalInstallments`, `groupNumber`, `quotaNumber`, `isAdesaoPaid`, `status`
  - `GET /api/subscription/:id` (via `paymentStore.fetchSubscription`) → `installments[0].{id, idTokenPay, valueToPay, amount}` (valor preferido da tela)
  - `POST /api/payments/:installmentId/pix` (via `generateAdhesionPix`, body `{idTokenPay, anticipate:false}`) → `amount`, `requestedAmount`, `copyPaste`, `qrCode`, `expirationDate`
  - `POST /api/subscription/:id/payment-check` (best-effort no "Verificar") → resposta ignorada
- **Ações → chamadas:**
  - Automático no mount (se sem `copyPaste`) e botão "GERAR PIX" → `POST /api/payments/:id/pix` (+ pixel `GENERATE_QR_CLICK` e `QR_SHOWN`, entity installment, metadata productId)
  - Copiar código → clipboard + pixel `COPY_PIX_CLICK`
  - "VERIFICAR STATUS DO PAGAMENTO" → `loadHomeData` + `POST .../payment-check` (+ pixel `VERIFY_PAYMENT_CLICK`; `PAYMENT_CONFIRMED_VIEW` se confirmar)
- **Estados:**
  - `isPreparingPix/isGeneratingPix` → "Gerando código PIX..." + copiar desabilitado; `pixError` → msg + retry.
  - `isAdesaoPaid || status==='active'` → modal "Adesão Confirmada!" → `/`.
  - Countdown 30 min visual; polling 12 s não valida nada (verificação é manual).

- Pixel global: `SCREEN_VIEW` emitido pelo middleware `track.global.ts` a cada navegação (sem duplicar no mount da página).
- Resumo: foto SÓ se real (`photoUrl`: contrato ou catálogo API via `productsReal`), senão skeleton/placeholder; valor SÓ se puxado (`hasRealPrice`), senão skeleton (nunca R$ 0,00); com desconto: original riscado pequeno no canto superior + final aplicado + pílula com %.
