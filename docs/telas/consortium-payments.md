# Pagamentos (`/consortium/payments`)
- **Objetivo:** Ver parcelas (atual, pagas, agendadas/antecipação) e gerar PIX de parcela.
- **O que precisa do servidor:**
  - `GET /api/subscriptions/:userId` (via `loadHomeData`) → `activeContracts[0]` (contrato base)
  - `GET /api/subscription/:id` (via `paymentStore.fetchSubscription`) → recalcula valores; `installments`, `paidInstallments`, `installmentValues`, `installmentDueDates`, `installmentIds`, `installmentTokens`, `nextPaymentAmount`, `dueDate`, `totalInstallments`, `status`
  - `POST /api/payments/:installmentId/pix` (via `generatePix`, body `{idTokenPay, anticipate}`; `anticipate=true` se parcela futura) → redireciona a `/payment`
- **Ações → chamadas:**
  - "PAGAR ESTA PARCELA" / clicar futura → modal → "Pagar via PIX" → `POST /api/payments/:id/pix`
  - KYC `REJECTED` → modal "Documentos Recusados" → `/profile/kyc` (sem chamada)
- **Estados:**
  - `!isAdesaoPaid` → guard "Funcionalidade Bloqueada" → `/consortium/adhesion`.
  - Sem pendências → "Contrato Quitado"; erro do PIX → `errorMessage` no modal.
  - Pagas/agendadas, progresso e vencimentos são derivados localmente dos campos acima.

- Pixel global: `SCREEN_VIEW` emitido pelo middleware `track.global.ts` a cada navegação (sem duplicar no mount da página).
  - Gerar PIX da parcela → `GENERATE_QR_CLICK` (entity installment, metadata productId + installmentNumber + anticipate) e navega p/ `/payment`.
- Contadores: Pagas (PAID), **A pagar = vencidas OVERDUE do servidor** (0 quando nada venceu — era o número da parcela atual, bug que somava 61), Agendadas = futuras não-vencidas (Pagas+A pagar+Agendadas = total).
