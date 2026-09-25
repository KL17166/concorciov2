# Admin · Contracts

> **Escopo:** `src/routes/admin/contractRoutes.ts` (6× `router.get` + 3× `router.post` = 9 registros, linhas 7–15). Controller `src/controllers/admin/contractsController.ts`. Views `src/views/pages/contracts/{index,form,show}.ejs` (`details.ejs` é legado — o controller renderiza `show`, nunca `details`). Montagem em `src/routes/admin/index.ts:76`. `csrfToken` é passado explícito em todos os `render` deste controller (`res.locals.csrfToken || req.session.csrfToken`).
> **Gate:** leitura `contracts.view` (MASTER/MANAGER/SUPPORT, `adminCapabilities.ts:42-53`); escrita `contracts.manage` (só MASTER/MANAGER). Exceção: os dois GETs `/back` têm só `isAdmin`, sem capability. Negação de capability → flash `Seu perfil não pode executar a ação "contracts.X".` + `302 Referer || /admin/dashboard`.

### `GET /admin/contracts`
- **Gate:** `isAdmin` + `contracts.view` (`contractRoutes.ts:7`) → `contractsController.getContracts` (`contractsController.ts:12-80`)
- **Ativado por (tela):** sidebar `/admin/contracts`; `src/views/pages/contracts/index.ejs:130-133` botões Todos/Ativos/Pendentes/Contemplados via `filterStatus(status)` (`index.ejs:466-474`, seta `?status=` e reseta `page`); links de entrada: `people/details.ejs:89` (contratos do cliente), `bids/details.ejs:173` (`Ver Contrato Completo`).
- **Request:** query — `status` (string, opcional; filtro direto `subscription.status`; vazio = todos), `search` (string, opcional; `OR`: `user.name contains`, `user.cpf contains`, `groupNumber contains`, `quotaNumber contains` — **case-sensitive, sem `mode:'insensitive'`**, `contractsController.ts:24-31`), paginação via `paginate(req)` (`page/limit/skip`).
- **Resposta do servidor:** `render pages/contracts/index` com **todas** as vars: `path='/contracts'`, `contracts` (include `user`, `plan.product`, `installments` asc, `bids`; order `createdAt desc`; `skip/take`), `summary={totalActive,totalContemplated,totalPending,total}` (3 counts + total, `contractsController.ts:52-55`; `totalContemplated` conta `contemplated=true`, não status), `status`, `search`, `pagination`, `buildPageUrl(p)` (→ `/admin/contracts?...&page=p`), `csrfToken`.
- **Efeitos:** somente leitura (5 queries: lista + 4 counts). Sem escrita/alerta/e-mail.
- **Erros:** exceção → flash `error_msg` `Erro ao carregar contratos` + `302 /admin/dashboard` (`contractsController.ts:76-79`).

### `GET /admin/contracts/new`
- **Gate:** `isAdmin` + `contracts.manage` (`contractRoutes.ts:8`) → `getNewContract` (`contractsController.ts:137-166`)
- **Ativado por (tela):** `src/views/pages/contracts/index.ejs:22` botão `Novo Contrato` (`<a href="/admin/contracts/new">`); vazio da lista `index.ejs:271` mesmo destino.
- **Request:** query — `clientId` (string, opcional, trim; pré-seleciona o cliente no select, `form.ejs:56-57`).
- **Resposta do servidor:** `render pages/contracts/form` com: `path='/contracts'`, `editing=false`, `clients` (todos `role='CLIENT'`, order `name asc`), `clientId`, `plans` (só `active:true`, include `product`, order `name asc`), `csrfToken`.
- **Efeitos:** somente leitura. Sem escrita.
- **Erros:** exceção → `500 send('Erro ao carregar formulário')` (texto puro, sem redirect/flash — `contractsController.ts:164`).

### `POST /admin/contracts/new`
- **Gate:** `isAdmin` + `contracts.manage` (`contractRoutes.ts:9`) → `createContract` (`contractsController.ts:169-196`)
- **Ativado por (tela):** `src/views/pages/contracts/form.ejs:42` — `<form action="/admin/contracts/new" method="POST" id="contractForm">`, botão `Criar Contrato` (`form.ejs:150`, inicia `disabled`, habilita via JS só com cliente+plano).
- **Request:** body validado por `CreateAdminSubscriptionSchema` (`src/schemas/subscriptionSchema.ts:18-23`): `userId` (string, **obrigatório**, `min(1)`), `planId` (string, **obrigatório**, `min(1)`), `groupNumber` (string, opcional/nullable; form: text `maxlength=3` `pattern=[0-9]{1,3}`, vazio = auto), `quotaNumber` (idem). Form: `userId` = select `#clientSelect` (required); `planId` = hidden `#planId` (required, preenchido pelo cascade JS produto→duração→taxa, `form.ejs:256-397`); `+ _csrf`.
- **Resposta do servidor:** nunca `render`. Sucesso → `302 /admin/contracts/<novoId>` + `success_msg` `Contrato criado com sucesso!`. Falhas → `302 /admin/contracts/new` (abaixo).
- **Efeitos:** `createSubscription({userId, planId, groupNumber?, quotaNumber?, channel:'ADMIN_PANEL'})` (`src/application/subscriptions/createSubscription.ts`) — cria subscription `PENDING` + N installments (vencimento dia 10). Travas repassadas (`statusCode<500` → mensagem original): `Usuário não encontrado` (404), `KYC_REJECTED` (403), `Limite de contratos ativos atingido` (400), `Plano de consórcio não encontrado` (404), `O plano selecionado não está mais disponível.` (400, inativo), `Duração do plano ... fora dos limites` (400). Sem e-mail; sem `contemplated`.
- **Erros:** zod inválido → `302 /admin/contracts/new` + primeira issue (`contractsController.ts:172-176`); use-case com `statusCode<500` → mesma rota + `error.message`; demais → mesma rota + `Erro ao criar contrato. Verifique os dados e tente novamente.`; sem capability → `deny`.

### `GET /admin/contracts/:id`
- **Gate:** `isAdmin` + `contracts.view` (`contractRoutes.ts:10`) → `getContractDetails = getContract` (`contractsController.ts:83-134`, alias linha 134)
- **Ativado por (tela):** lista `index.ejs:235` link eye (`<a href="/admin/contracts/<%= contract.id %>">`, título Ver Detalhes) e card `index.ejs:346` botão `Detalhes`; `people/details.ejs:89`; `bids/details.ejs:173`; redirect pós-criação (`createContract`, linha 189).
- **Request:** params `id` (string, obrigatório).
- **Resposta do servidor:** `render pages/contracts/show` com: `path='/contracts'`, `contract` (include `user`, `plan.product`, `installments` asc, `bids` desc), `stats={paidInstallments, totalPaid, progress}` (`progress` string `toFixed(1)`, `contractsController.ts:111-115`), `csrfToken`.
- **Efeitos:** somente leitura.
- **Erros:** inexistente → flash `Contrato não encontrado` + `302 /admin/contracts`; exceção → flash `Erro ao carregar contrato` + `302 /admin/contracts`.

### `GET /admin/contracts/:id/back`
- **Gate:** só `isAdmin`, **sem** `requireCapability` (`contractRoutes.ts:11`, handler inline)
- **Ativado por (tela):** compat de views antigas (breadcrumb/voltar legados); sem form dedicado nas telas correntes.
- **Request:** params `id` (ignorado).
- **Resposta do servidor:** `302 /admin/contracts`, sem flash, sem vars.
- **Efeitos:** nenhum (redirect puro).
- **Erros:** nenhum (não toca banco; `isAdmin` negado → `302 /admin/login`).

### `GET /admin/contracts/back`
- **Gate:** só `isAdmin`, sem capability (`contractRoutes.ts:12`, handler inline)
- **Ativado por (tela):** idem acima (variante sem id).
- **Request:** sem params/query.
- **Resposta do servidor:** `302 /admin/contracts`, sem flash.
- **Efeitos:** nenhum.
- **Erros:** nenhum (fora `isAdmin`).

### `POST /admin/contracts/:id/contemplate`
- **Gate:** `isAdmin` + `contracts.manage` (`contractRoutes.ts:13`) → `contemplateContract` (`contractsController.ts:199-218`)
- **Ativado por (tela):** (a) lista `index.ejs:243,351` botão `Contemplar` (só se `!contemplated && status==='ACTIVE'`) → `contemplateContract(id,name)` (`index.ejs:440-444`) preenche `#contemplateForm.action=/admin/contracts/<id>/contemplate` e abre `#contemplateModal`; modal (`index.ejs:387-408`) select `contemplationType` (required; options `BID 🎯 Lance` / `DRAW 🎲 Sorteio` / `DIRECT ⚡ Direto`) + botão `Confirmar Contemplação`. (b) detalhe `show.ejs:368` — form direto com hidden `contemplationType=DIRECT` + `onsubmit confirm('Confirmar a contemplação deste contrato?')`, botão `Contemplar contrato`; bloco `show.ejs:363` só renderiza se contrato fora de `CANCELLED|COMPLETED|CONTEMPLATED`.
- **Request:** params `id` (string, obrigatório). Body: `contemplationType` (string, opcional; default `'DIRECT'` no use-case; UI oferece `BID|DRAW|DIRECT`) + `_csrf`.
- **Resposta do servidor:** nunca `render`. Sucesso → `302 Referer || /admin/contracts` + `success_msg` `Contrato contemplado com sucesso!`. Erro → mesmo redirect + `error_msg`.
- **Efeitos:** `contemplateSubscription({subscriptionId, contemplationType})` (`src/application/subscriptions/contemplateSubscription.ts`): escreve `contemplated=true, contemplationDate=now, contemplationType, status='CONTEMPLATED'`. **Travas:** só `status==='ACTIVE'` (`Contrato deve estar ativo para ser contemplado`, 400); `contemplated` já true → `Este contrato já foi contemplado anteriormente...` (400). **Irreversível** (sem endpoint de descontemplação; modal avisa). Sem e-mail.
- **Erros:** use-case `statusCode<500` → `error.message`; demais → `Erro ao contemplar contrato.`; ambos `302 referer`. Sem capability → `deny`.

### `POST /admin/contracts/:id/cancel`
- **Gate:** `isAdmin` + `contracts.manage` (`contractRoutes.ts:14`) → `cancelContract` (`contractsController.ts:221-240`)
- **Ativado por (tela):** (a) lista `index.ejs:251,357` botão `Cancelar` (renderizado se `status==='ACTIVE' || 'PENDING'`) → `cancelContract(id,name)` (`index.ejs:446-450`) → `#cancelForm.action=/admin/contracts/<id>/cancel`, modal `index.ejs:421-434` (só `_csrf`, sem motivo), botão `Sim, cancelar contrato`. (b) detalhe `show.ejs:370` form direto + `confirm('Confirmar o cancelamento deste contrato?')`, botão `Cancelar contrato`.
- **Request:** params `id` (string, obrigatório). Sem body útil (só `_csrf`; `requesterUserId/Role` vêm da sessão: `session.user.id || 'admin'`, `session.user.role || 'MASTER'`).
- **Resposta do servidor:** nunca `render`. Sempre `302 Referer || /admin/contracts` + `success_msg` (`result.message`) ou `error_msg`.
- **Efeitos:** `cancelSubscription` (`src/application/subscriptions/cancelSubscription.ts`): via admin pula a policy de cliente; idempotente (`Contrato já está cancelado.`); `$transaction`: subscription → `CANCELLED` + `balanceDue=0`, installments `PENDING|OVERDUE` → `CANCELLED`. **Parcelas `PAID`/`REFUNDED` não são tocadas (não há estorno automático; não existe estado `REFUND_PENDING` no código — só `REFUNDED` terminal de leitura).**
- **Erros:** `Contrato não encontrado` (404) ou demais com `statusCode<500` → `error.message`; demais → `Erro ao cancelar contrato.`; sem capability → `deny`.

### `POST /admin/contracts/:id/installments/:installmentId/pay`
- **Gate:** `isAdmin` + `contracts.manage` (`contractRoutes.ts:15`) → `markInstallmentPaid` (`contractsController.ts:243-265`)
- **Ativado por (tela):** `src/views/pages/contracts/show.ejs:226-233` botão `Dar baixa` por linha — renderizado se parcela não-`PAID` **e** `canManageContracts` (derivado em `show.ejs:39` de `hasCapability('contracts.manage')`) **e** contrato não-`CANCELLED` (paga exibe selo `Liquidada`); → `openPayInstallmentModal(id, number, amount)` (`show.ejs:377-386`) seta `#formPayInstallment.action=/admin/contracts/<contractId>/installments/<instId>/pay`; modal `Dar Baixa na Parcela` (`show.ejs:256-310`): select `paymentMethod` (required; `PIX` default, `BOLETO`, `TRANSFERENCIA`, `DINHEIRO`, `MANUAL`) + `paymentDate` date (required, default hoje) + botão `Confirmar Baixa`.
- **Request:** params `id` (subscription — usado **só** no redirect), `installmentId` (string, obrigatório). Body: `paymentMethod` (string, opcional → default `'MANUAL'`), `paymentDate` (string data, opcional → default `now`; `new Date(paymentDate)` sem validação prévia).
- **Resposta do servidor:** nunca `render`. `result.success` false → `302 /admin/contracts/:id` + `error_msg=result.message`; true → mesma rota + `success_msg=result.message`. Exceção → mesma rota + `Erro ao dar baixa na parcela.`.
- **Efeitos:** `markInstallmentAsPaid` (`src/services/installmentService.ts:25+`, transação `Serializable`, `timeout 10000`): fast-fail `Parcela não encontrada.` / `Esta parcela já está paga.` / `Esta parcela pertence a um contrato cancelado.` / `Pague a adesão antes das demais parcelas.` (n>1 com adesão não-paga); escreve installment `PAID` + `paymentAttempt ACTIVE→PAID`; subscription `paidInstallments+1`, `balanceDue-amount`; adesão #1 (`PENDING|PENDING_KYC`) → `ACTIVE` (KYC aprovado/ausente, msg `Adesão marcada como paga!`) ou `PENDING_KYC` (KYC pendente, msg `Adesão paga! Aguardando aprovação do KYC...`); todas pagas (exclui `CANCELLED`; `REFUNDED` continua bloqueando) → `COMPLETED`.
- **Erros:** ver mensagens de `result.message` acima (vão como `error_msg` sem exceção); exceção → `Erro ao dar baixa na parcela.`; sem capability → `deny`.

> **Conferência de cobertura:** `contractRoutes.ts` tem 9 registros (`get` linhas 7,8,10,11,12 + `post` linhas 9,13,14,15) — todos documentados acima, 9/9.
