# Extrato (`/consortium/statement`)
- **Objetivo:** Mostrar total pago, distribuição (fundo comum/taxas) e histórico da cota — só leitura.
- **O que precisa do servidor:**
  - `GET /api/subscriptions/:userId` (via `loadHomeData`, só se lista vazia) → `paidInstallments`, `currentInstallment`, `installmentValues`, `installmentDueDates`, `nextPaymentAmount`, `totalInstallments`, `isAdesaoPaid`, `groupNumber`, `quotaNumber`, `contractDate`, `administrationFee`
- **Ações → chamadas:** nenhuma — a tela não faz `$fetch` nem POST; só botão voltar.
- **Estados:**
  - `isAdesaoPaid=false` → primeiro item da timeline é "Adesão Pendente"; `true` → "Adesão Confirmada".
  - Total, distribuição e timeline são calculados localmente (fallback `289.90` e data `15/09/2026` quando ausentes).
  - Sem `contract` → tela vazia (`v-if`); falha no fetch é silenciosa (sem erro visível).

- Pixel global: `SCREEN_VIEW` emitido pelo middleware `track.global.ts` a cada navegação (sem duplicar no mount da página).
