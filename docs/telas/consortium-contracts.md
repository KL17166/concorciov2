# Meus contratos (`/consortium/contracts`)
- **Objetivo:** Listar contratos e permitir cancelar (adesão) ou pedir cancelamento (com parcelas pagas).
- **O que precisa do servidor:**
  - `GET /api/subscriptions/:userId` (via `loadHomeData`) → `id`, `product.name`, `groupNumber`, `quotaNumber`, `status`, `creditValue|product.price`, `paidInstallments|currentInstallment`, `totalInstallments`, `nextPaymentAmount`
  - `POST /api/subscriptions/:id/cancel` (`$fetch` direto em `confirmCancel`) → cancela e recarrega
  - `POST /api/tickets` (`$fetch` direto em `sendTicket`, body `{subscriptionId, type:'CANCELLATION', subject, message}`) → abre atendimento
- **Ações → chamadas:**
  - "Cancelar contrato" (só `pending`/adesão não paga) → `POST .../cancel`
  - "Solicitar cancelamento" (com parcelas pagas) → `POST /api/tickets`
- **Estados:**
  - `status` → pill: `pending`=Em adesão, `active`=Ativo, `canceled`=Cancelado, `finished`=Concluído; cancelado/concluído → "Sem ações disponíveis".
  - Sucesso → toast + `loadHomeData`; falha → `toast.error` com msg do servidor.
  - Lista vazia → "Você ainda não tem contratos" → `/`; `isLoading` → spinner.

- Pixel global: `SCREEN_VIEW` emitido pelo middleware `track.global.ts` a cada navegação (sem duplicar no mount da página).
