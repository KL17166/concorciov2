# Admin · Payments (Financeiro)

> **Escopo:** `src/routes/admin/paymentRoutes.ts` (3× `router.get` + 5× `router.post` = 8 registros, linhas 10–13, 16, 35, 62, 80). Controller `src/controllers/admin/paymentsController.ts`; 4 dos 5 POSTs têm handler **inline na rota** (approve/expire/reject/mark-paid) e só `update` está no controller. Baixa real = `settlePayment` (`src/application/payments/settlePayment.ts:11-28`, wrapper de `markInstallmentAsPaid`, `src/services/installmentService.ts:25+`). Views `src/views/pages/payments/{index,calendar,overdue}.ejs`. Montagem `src/routes/admin/index.ts:77`.
> **Gate:** leitura `payments.view` (MASTER/MANAGER/SUPPORT); escrita `payments.manage` (só MASTER/MANAGER). `csrfToken` **não** é passado explícito nos `render` deste controller — vem de `res.locals` (middleware global `generateToken`, `index.ts:28-33`); os forms/JS o usam via `<%= csrfToken %>` (`payments/index.ejs:508,587,595,604`).
> **Travas globais do módulo:** (1) adesão (parcela 1 de contrato `PENDING`) nunca pode ir a `OVERDUE`; (2) reversão `PAID→não-PAID` exige **MASTER + `motivo` ≥ 8 chars**; (3) `updatePayment` e `confirmBidPayment` rodam em transação `Serializable` (`timeout 10000`); (4) **não existe estado `REFUND_PENDING`** no código — só `REFUNDED` terminal (leitura em summary/reports); (5) `paymentMethod` do `update` é restrito a `/^[A-Z0-9_\-]{2,32}$/` (anti XSS/log-injection).

### `GET /admin/payments`
- **Gate:** `isAdmin` + `payments.view` (`paymentRoutes.ts:10`) → `getPayments` (`paymentsController.ts:7-295`)
- **Ativado por (tela):** sidebar `/admin/payments`; abas `payments/index.ejs:134-155` (`status=ALL|PAID|ADESOES|PENDING|OVERDUE`, preservam `month/search`); form GET `index.ejs:177-209` (`search`, `month type=month`, `method` select de `paymentMethodOptions`, hidden `status`, botões `Filtrar`/`Limpar`); voltar de `calendar`/`overdue`.
- **Request:** query — `status` (string, opcional, **default `'ADESOES'`**; virtuais `ADESOES` = parcela 1 em aberto `PENDING|OVERDUE`, `PENDING` = demais atuais `number>1 == primeiro em aberto`; `ALL` exclui agendadas via `NOT IN scheduledIds`, `paymentsController.ts:25-48`), `month` (string `YYYY-MM`, opcional; validado por `/^\d{4}-(0[1-9]|1[0-2])$/`, inválido **ignorado**, `paymentsController.ts:57`), `search` (opcional; `subscription.user` nome/email/cpf `contains`), `method` (opcional; `paymentMethod` exato), `page/limit` via `paginate(req)`.
- **Resposta do servidor:** `render pages/payments/index` com: `path='/payments'`, `installments` (= `finalInstallments`), `currentMap` (`subscriptionId→primeiro number em aberto`, p/ selo `A PAGAR`), `summary={totalPending,totalOverdue,totalPaid,totalRefunded,paidCount,pendingCount,overdueCount,refundedCount,dueCount,dueTotal,scheduledCount,scheduledTotal,adesaoCount,adesaoTotal,pendCount,pendTotal,count,receivedThisMonth,nearDueCount}` (SQL raw; totais de status **só de contratos não-`PENDING`**, `paymentsController.ts:209-223`), `status,month,search,method,paymentMethodOptions` (métodos distintos de parcelas `PAID`), `pagination` (sobre `finalTotal` virtual), `buildPageUrl`.
- **Efeitos:** somente leitura (múltiplas queries + raws). Sem escrita.
- **Erros:** exceção → `next(error)` (error middleware; **sem** flash/redirect próprio).

### `GET /admin/payments/calendar`
- **Gate:** `isAdmin` + `payments.view` (`paymentRoutes.ts:11`) → `getPaymentsCalendar` (`paymentsController.ts:298-335`)
- **Ativado por (tela):** `payments/index.ejs:19` botão `Calendário` (`<a href="/admin/payments/calendar">`); navegação mês `calendar.ejs:25,32` (`?year=&month=` anterior/próximo).
- **Request:** query — `year` (int, opcional, default ano atual), `month` (int 1–12, opcional, default mês atual; `parseInt(...) || atual`); intervalo `[new Date(y,m-1,1), new Date(y,m,0)]`.
- **Resposta do servidor:** `render pages/payments/calendar` com: `path='/payments'`, `calendar` (`Record<dia, installments[]>` agrupado por `dueDate.getDate()`), `year`, `month`.
- **Efeitos:** somente leitura (installments do mês + `subscription.user` + `plan.product`, order `dueDate asc`).
- **Erros:** exceção → `next(error)`.

### `GET /admin/payments/overdue`
- **Gate:** `isAdmin` + `payments.view` (`paymentRoutes.ts:12`) → `getOverduePayments` (`paymentsController.ts:491-540`)
- **Ativado por (tela):** `payments/index.ejs:13` botão `Inadimplentes` (`<a href="/admin/payments/overdue">`).
- **Request:** sem query/body.
- **Resposta do servidor:** `render pages/payments/overdue` com: `path='/payments'`, `groupedByUser` (`{user,installments[],totalOverdue}` por `userId`), `totalOverdue` (soma).
- **Efeitos:** **GET com escrita**: `prisma.installment.updateMany` (`paymentsController.ts:496-503`) — `PENDING` + `dueDate < hoje(0h)` + subscription `ACTIVE|CONTEMPLATED` → `OVERDUE` em massa **antes** de ler. (Adesões de contrato `PENDING`/`PENDING_KYC` ficam de fora pelo filtro de status da subscription.)
- **Erros:** exceção → `next(error)`.

### `POST /admin/payments/:id/update`
- **Gate:** `isAdmin` + `payments.manage` (`paymentRoutes.ts:13`) → `updatePayment` (`paymentsController.ts:352-488`)
- **Ativado por (tela):** `payments/index.ejs` botão lápis `Editar` — renderizado no `else` do bloco `*_WAITING_APPROVAL` (tabela `index.ejs:326-335`, cards `index.ejs:470-477`; linhas com PIX aguardando mostram Aprovar/Rejeitar/Expirar em vez do lápis) → `openUpdateModal` (`index.ejs:562-574`) seta `#updatePaymentForm.action=/admin/payments/<id>/update` e preenche via `dataset{id,status,date,method,number,substatus}`; modal `Atualizar Pagamento` (`index.ejs:504-553`): select `status` (`PENDING|PAID|OVERDUE`, `index.ejs:518`), `paymentDate` date (`index.ejs:527`), `paymentMethod` select (`index.ejs:531`: `PIX|BOLETO|DEBITO|DINHEIRO|ADMIN_MANUAL`), botões `Cancelar`/`Salvar Alterações`. JS esconde option `OVERDUE` p/ adesão (`number==1 && substatus==PENDING`, `index.ejs:568-573`). **Gap:** o modal **não tem campo `motivo`** — reversão `PAID→outro` pelo modal falha por falta de motivo (só passa via request direta).
- **Request:** params `id` (installment, obrigatório). Body zod `updatePaymentSchema` (`paymentsController.ts:337-349`): `status` (enum `PAID|PENDING|OVERDUE`, **obrigatório**), `paymentDate` (string data válida, opcional/nullable), `paymentMethod` (string `/^[A-Z0-9_\-]{2,32}$/`, opcional/nullable), `motivo` (string `max(500)`, opcional/nullable — **obrigatório na prática p/ regressão**), `_csrf`.
- **Resposta do servidor:** nunca `render`. Sucesso → `302 /admin/payments` + `success_msg` `Pagamento atualizado com sucesso!`. Falhas → mesma rota + `error_msg` (abaixo).
- **Efeitos:** transação `Serializable/10000` (`paymentsController.ts:365-476`): lê installment+subscription+installments+`kycStatus`; **trava regressão** (`paymentsController.ts:374-388`): `PAID→não-PAID` sem `MASTER` → erro; sem `motivo≥8` → erro; **trava adesão** (`paymentsController.ts:392-398`): `number==1 && subscription PENDING && status==OVERDUE` → erro; escreve installment (`PAID`→method/date, senão `method=null,date=null`), `paymentAttempt ACTIVE→PAID|EXPIRED`, `auditLog UPDATE_PAYMENT {installmentId,oldStatus,newStatus,adminName,regressionReason?}`; subscription: baixa nova → `paidInstallments+1`, `balanceDue-amount`, adesão→`ACTIVE` (KYC aprovado) ou `PENDING_KYC`, todas pagas→`COMPLETED`; regressão → `-1`/`+amount`, `COMPLETED` com pendente→`ACTIVE`.
- **Erros:** zod inválido → `Dados inválidos: <issues>`; regra de negócio (`isBusinessRule`: MASTER, motivo, adesão→atrasado) → `error.message`; demais exceções → `next(error)` (500). Sem capability → `deny`.

### `POST /admin/payments/:id/approve`
- **Gate:** `isAdmin` + `payments.manage` (`paymentRoutes.ts:16`, handler **inline** `:16-32`)
- **Ativado por (tela):** `payments/index.ejs:321` (tabela) e `:465` (cards) botão `Aprovar` (check) — renderizado **só se** `(paymentMethod||'').endsWith('_WAITING_APPROVAL') && status==='PENDING'` (`index.ejs:319`); JS `quickApprove(btn)` (`index.ejs:583-589`) faz `fetch POST` JSON `{_csrf}` e `location.reload()` se `r.ok`.
- **Request:** params `id` (installment, obrigatório). Sem body útil.
- **Resposta do servidor:** sempre `302 /admin/payments` + flash (`success_msg|error_msg = result.message`, ou erro fixo).
- **Efeitos:** guarda (`paymentRoutes.ts:20`): exige `inst && status==='PENDING' && paymentMethod` termina com `_WAITING_APPROVAL` (qualquer gateway). Depois `settlePayment({installmentId, paymentMethod:'PIX', channel:'ADMIN'})` → `markInstallmentAsPaid` completo (baixa `PAID`, contadores, ativação adesão/KYC, `COMPLETED`).
- **Erros:** fora da guarda → `error_msg` `Parcela não está aguardando aprovação.`; `result.success=false` (ex.: já paga, contrato cancelado, adesão pendente — mensagens do service) → `error_msg=result.message`; exceção → log + `Erro ao aprovar pagamento.`; sem capability → `deny`.

### `POST /admin/payments/:id/expire`
- **Gate:** `isAdmin` + `payments.manage` (`paymentRoutes.ts:35`, inline `:35-60`)
- **Ativado por (tela):** `payments/index.ejs:323` (tabela, `Expirar`) e `:467` (cards, `Expirar`) — dentro do bloco `*_WAITING_APPROVAL && PENDING` (`index.ejs:319`); JS `quickExpire(btn)` (`index.ejs:601-609`) com `confirm('Marcar este PIX como expirado? O cliente poderá gerar um novo.')` + `fetch POST {_csrf}`.
- **Request:** params `id` (obrigatório). Sem body útil.
- **Resposta do servidor:** sempre `302 /admin/payments` + flash.
- **Efeitos:** guarda: exige `inst && status==='PENDING'`; escreve `installment.paymentMethod = null` **só se** era `*_WAITING_APPROVAL` (senão mantém, `paymentRoutes.ts:45`); `paymentAttempt ACTIVE→EXPIRED` em `try/catch` silencioso (`:48-52`).
- **Erros:** fora da guarda → `Parcela não está pendente.`; sucesso → `success_msg` `PIX marcado como expirado. O cliente pode gerar um novo.`; exceção → `Erro ao expirar pagamento.`; sem capability → `deny`.

### `POST /admin/payments/:id/reject`
- **Gate:** `isAdmin` + `payments.manage` (`paymentRoutes.ts:62`, inline `:62-78`)
- **Ativado por (tela):** `payments/index.ejs:322` (tabela) e `:466` (cards) botão `Rejeitar` (X) — mesma condição `*_WAITING_APPROVAL && PENDING`; JS `quickReject(btn)` (`index.ejs:592-598`) `fetch POST {_csrf}` + reload.
- **Request:** params `id` (obrigatório). Sem body útil.
- **Resposta do servidor:** sempre `302 /admin/payments` + flash.
- **Efeitos:** guarda igual ao approve (exige `PENDING` + `*_WAITING_APPROVAL`); escreve `installment.paymentMethod=null` (**volta a PENDENTE limpo** p/ gerar novo PIX; status continua `PENDING`; attempts **não** tocadas aqui).
- **Erros:** fora da guarda → `Parcela não está aguardando aprovação.`; sucesso → `Pagamento rejeitado. O cliente pode gerar um novo PIX.`; exceção → `Erro ao rejeitar pagamento.`; sem capability → `deny`.

### `POST /admin/payments/:id/mark-paid`
- **Gate:** `isAdmin` + `payments.manage` (`paymentRoutes.ts:80`, inline `:80-101`)
- **Ativado por (tela):** `src/views/pages/payments/overdue.ejs:93` — form por linha `<form action="/admin/payments/<%= inst.id %>/mark-paid" method="POST">` com hiddens `paymentMethod=ADMIN_MANUAL` + `paymentDate=<hoje YYYY-MM-DD>`, botão `Pagar`.
- **Request:** params `id` (obrigatório). Body: `paymentMethod` (string, opcional → `undefined` → default `ADMIN_MANUAL` no service), `paymentDate` (string, opcional → `new Date(paymentDate)` se presente, senão `now`; **sem validação** — data inválida vira `Invalid Date`).
- **Resposta do servidor:** nunca `render`. `302 (installment ? /admin/contracts/<subscriptionId> : /admin/contracts)` + flash `result.message`; exceção → `302 /admin/contracts` + `Erro ao marcar parcela como paga.`.
- **Efeitos:** `settlePayment({installmentId, paymentMethod, paymentDate, channel:'ADMIN'})` (efeitos idênticos ao approve, com método/data informados).
- **Erros:** `result.success=false` → `error_msg=result.message` (mensagens do service); exceção → `Erro ao marcar parcela como paga.`; sem capability → `deny`.

> **Conferência de cobertura:** `paymentRoutes.ts` tem 8 registros (`get` linhas 10,11,12 + `post` linhas 13,16,35,62,80) — todos documentados acima, 8/8.
