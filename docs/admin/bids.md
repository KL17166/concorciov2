# Admin · Bids (lances)

> **Escopo:** `src/routes/admin/bidRoutes.ts` (5× `router.get` + 5× `router.post` = 10 registros, linhas 7–16). Controller `src/controllers/admin/bidsController.ts`. Views `src/views/pages/bids/{index,pending,payments,details,draw}.ejs`. Montagem `src/routes/admin/index.ts:78`. **Ordem importa:** `GET /bids/payments` (`:9`) e `GET /bids/draw` (`:11`) vêm **antes** de `GET /bids/:id` (`:13`), senão `payments`/`draw` cairiam no `:id`.
> **Gate:** leitura `bids.view` (MASTER/MANAGER/SUPPORT); escrita `bids.manage` (só MASTER/MANAGER — SUPPORT é só-leitura aqui). Negação → flash `Seu perfil não pode executar a ação "bids.X".` + `302 Referer || /admin/dashboard`. `csrfToken` via `res.locals` (global `index.ts:28-43`, POST valida token; forms incluem `_csrf`, ex. `details.ejs:117,123`).
> **Modelo:** `bid.status ∈ {PENDING, APPROVED, REJECTED, CONTEMPLATED, CANCELLED}` + `isWinner`, `drawDate`, `contemplatedDate`; `bidPayment.status ∈ {ACTIVE, PAID, EXPIRED, CANCELLED, RESERVED}` (voucher PIX — Eldorado/G2G **sem webhook automático**, baixa conferida manualmente). Frequência de lembretes = **memória do processo** (`src/config/notificationSettings.ts`, default `HOURLY`; reset no restart).

### `GET /admin/bids`
- **Gate:** `isAdmin` + `bids.view` (`bidRoutes.ts:7`) → `getBids` (`bidsController.ts:9-82`)
- **Ativado por (tela):** sidebar `/admin/bids`; abas `bids/index.ejs:124-136` (Todos/`PENDING`/`APPROVED`/`CONTEMPLATED`/`REJECTED`, preservam `type`); form GET `index.ejs:144-163` (`search` nome/email/cpf, `type`, `Filtrar`/`Limpar`); voltar de `pending`/`draw`/`details`/`payments`.
- **Request:** query — `status` (string, opcional; filtro direto), `type` (string, opcional; filtro direto), `search` (opcional; `subscription.user` nome/email/cpf `contains`), `page/limit` via `paginate(req)`.
- **Resposta do servidor:** `render pages/bids/index` com: `path='/bids'`, `bids` (include `subscription.user` + `plan.product`; order `createdAt desc`; `skip/take`), `summary={totalPending,totalApproved,totalContemplated,totalRejected,totalAmount,total}` (**global, ignora filtros**, `bidsController.ts:50-55`), `status,type,search,pagination`, `notificationFrequency` (p/ select do form), `buildPageUrl(p)` → `/admin/bids?...`.
- **Efeitos:** somente leitura (lista + count + full-scan p/ summary). Sem escrita.
- **Erros:** exceção → `500 send('Erro ao carregar lances')` (log, sem flash/redirect).

### `GET /admin/bids/pending`
- **Gate:** `isAdmin` + `bids.view` (`bidRoutes.ts:8`) → `getPendingBids` (`bidsController.ts:85-111`)
- **Ativado por (tela):** `bids/index.ejs:13` botão `Pendentes`; `bids/draw.ejs:13,196` botão voltar `Pendente(s)`; sem filtros (lista pura).
- **Request:** sem query/body.
- **Resposta do servidor:** `render pages/bids/pending` com: `path='/bids'`, `bids` (`status='PENDING'`, order `amount desc, createdAt asc`), `totalAmount` (soma).
- **Efeitos:** somente leitura.
- **Erros:** exceção → `500 send('Erro ao carregar lances pendentes')`.

### `GET /admin/bids/payments`
- **Gate:** `isAdmin` + `bids.view` (`bidRoutes.ts:9`) → `getBidPayments` (`bidsController.ts:209-249`)
- **Ativado por (tela):** entrada pelo menu de lances; abas `bids/payments.ejs:44-47` (`status=ACTIVE|PAID|EXPIRED|CANCELLED`); voltar `payments.ejs:13` (`<a href="/admin/bids">`).
- **Request:** query — `status` (string, opcional, **default `'ACTIVE'`**; allowlist `ACTIVE|PAID|EXPIRED|CANCELLED|RESERVED` — valor fora da lista = filtro vazio `{}` = todos, `bidsController.ts:212-213`). Sem paginação (`take:100` fixo).
- **Resposta do servidor:** `render pages/bids/payments` com: `path='/bids'`, `payments` (include `bid.subscription.user{select id,name,email,cpf}` + `plan.product{select id,name}`; order `createdAt desc`), `total` (count no filtro), `pendingCount` (count `ACTIVE` global), `status` (eco validado ou `''`).
- **Efeitos:** somente leitura.
- **Erros:** exceção → `500 send('Erro ao carregar pagamentos de lances')`.

### `POST /admin/bids/payments/:paymentId/confirm`
- **Gate:** `isAdmin` + `bids.manage` (`bidRoutes.ts:10`) → `confirmBidPayment` (`bidsController.ts:253-319`)
- **Ativado por (tela):** `bids/payments.ejs:88-91` — form por linha (só `status==='ACTIVE'`) `<form method="POST" action="/admin/bids/payments/<%= p.id %>/confirm" onsubmit="return confirm('Confirma que o valor de R$ ... caiu na conta da operação?');">` + `_csrf`, botão `Confirmar baixa`.
- **Request:** params `paymentId` (string, obrigatório). Sem body útil (só `_csrf`). `adminUser` da sessão p/ auditoria.
- **Resposta do servidor:** nunca `render`. Sempre `302 /admin/bids/payments` + flash.
- **Efeitos:** transação `Serializable/10000` (`bidsController.ts:257-306`) — **confirmação de voucher** com travas em ordem: (1) payment inexistente → `Pagamento não encontrado`; (2) `status!=='ACTIVE'` → `` `Voucher já está ${status} — só ACTIVE pode ser confirmado.` ``; (3) `bid.status==='CANCELLED'` → `Lance cancelado — trate como estorno, não como baixa.`; (4) `expiresAt < now` → marca `EXPIRED` + `Voucher expirado — peça ao cliente gerar um novo PIX.`; senão: voucher → `PAID + paidAt=now`, irmãos `ACTIVE` do mesmo `bidId` → `EXPIRED` (`updateMany ... id != paymentId`), `auditLog BID_PAYMENT_CONFIRMED_MANUAL {bidPaymentId,bidId,provider,amount,adminName}` + IP. **Não altera `bid.status`** (baixa financeira ≠ aprovação — passo manual separado).
- **Erros:** regras (`isBusinessRule`) → `error_msg=message` + mesma rota; sucesso → `success_msg` `` `Baixa confirmada: lance ${bidId} liquidado (R$ ${amount}).` ``; exceção → log + `Erro ao confirmar pagamento do lance`; sem capability → `deny`.

### `GET /admin/bids/draw`
- **Gate:** `isAdmin` + `bids.manage` (`bidRoutes.ts:11`) → `getDrawPage` (`bidsController.ts:322-362`)
- **Ativado por (tela):** `bids/index.ejs:19` botão sorteio (`<a href="/admin/bids/draw">`).
- **Request:** sem query/body.
- **Resposta do servidor:** `render pages/bids/draw` com: `path='/bids'`, `groupedBids` (chave `productId-planId` → `{product,plan,bids[],totalAmount}`; fonte: `status='APPROVED' && !isWinner`, order `amount desc`), `totalGroups`, `totalApproved`.
- **Efeitos:** somente leitura.
- **Erros:** exceção → `500 send('Erro ao carregar página de sorteio')`.

### `POST /admin/bids/draw`
- **Gate:** `isAdmin` + `bids.manage` (`bidRoutes.ts:12`) → `performDraw` (`bidsController.ts:365-407`)
- **Ativado por (tela):** `bids/draw.ejs:159-189` — um form por grupo `<form action="/admin/bids/draw" method="POST" onsubmit="return confirm('Confirmar sorteio para <produto> — <plano>?\n\nEsta ação não pode ser desfeita.')">`, hiddens `productId` + `planId` + `_csrf`, number `numberOfWinners` (default 1, `min=1 max=grupo.length`), botão `Contemplar` (alerta: maiores valores primeiro).
- **Request:** body — `productId` (string, obrigatório implícito), `planId` (string, obrigatório implícito), `numberOfWinners` (string numérica, opcional → `parseInt(...) || 1`) + `_csrf`.
- **Resposta do servidor:** nunca `render`. Sucesso → `302 /admin/bids` + `N lance(s) contemplado(s) com sucesso!`. Sem elegíveis/erro → `302 /admin/bids/draw` + `error_msg`.
- **Efeitos:** elegíveis = `APPROVED && !isWinner && planId && plan.productId`, order `amount desc` (top-N por **maior valor**); `winners = slice(0, n)`; `$transaction` (padrão): por winner `bid → {CONTEMPLATED, isWinner:true, drawDate, contemplatedDate}` + `subscription → {contemplated:true, contemplationDate, contemplationType:'BID', status:'CONTEMPLATED'}`. Sem KYC/travas adicionais; sem e-mail (notificação é job separado que lê a frequência).
- **Erros:** zero elegíveis → `Não há lances elegíveis para sorteio`; exceção → log + `Erro ao realizar sorteio`; sem capability → `deny`.

### `GET /admin/bids/:id`
- **Gate:** `isAdmin` + `bids.view` (`bidRoutes.ts:13`) → `getBidDetails` (`bidsController.ts:114-167`)
- **Ativado por (tela):** `bids/index.ejs:267` (`Ver Detalhes`), `bids/pending.ejs:141` (`Detalhes`), `bids/draw.ejs:147` (eye); redirect pós-approve (`approveBid`, linha 180).
- **Request:** params `id` (string, obrigatório).
- **Resposta do servidor:** `render pages/bids/details` com: `path='/bids'`, `bid` (include `subscription.user`, `plan.product`, `installments` asc), `installmentsFromBid` (`round(bid.amount / 1ª parcela)`), `bidPercentage` (`amount/creditValue*100`, 2dp string), `paidInstallments`, `totalInstallments`, `totalPaid`.
- **Efeitos:** somente leitura.
- **Erros:** inexistente → flash `Lance não encontrado` + `302 /admin/bids`; exceção → flash `Erro ao carregar detalhes do lance` + `302 /admin/bids`.

### `POST /admin/bids/:id/approve`
- **Gate:** `isAdmin` + `bids.manage` (`bidRoutes.ts:14`) → `approveBid` (`bidsController.ts:170-186`)
- **Ativado por (tela):** `bids/details.ejs:116-121` form `action="/admin/bids/<%= bid.id %>/approve"` (só no bloco `bid.status==='PENDING'`), botão `Aprovar Lance`; `bids/pending.ejs:144-149` botão ícone check (title `Aprovar`).
- **Request:** params `id` (obrigatório). Sem body útil.
- **Resposta do servidor:** nunca `render`. Sucesso → `302 /admin/bids/:id` + `success_msg` `Lance aprovado com sucesso!`. Falhas → redirect (abaixo; **note: erro volta p/ `/admin/bids`, sucesso volta p/ `/:id`**).
- **Efeitos:** guarda `bid && status==='PENDING'`; escreve `bid.status='APPROVED'`. (Não contempla, não baixa voucher.)
- **Erros:** já processado/inexistente → `Lance não encontrado ou já processado` + `302 /admin/bids`; exceção → log + `Erro ao aprovar lance` + `302 /admin/bids/:id`; sem capability → `deny`.

### `POST /admin/bids/:id/reject`
- **Gate:** `isAdmin` + `bids.manage` (`bidRoutes.ts:15`) → `rejectBid` (`bidsController.ts:189-205`)
- **Ativado por (tela):** `bids/details.ejs:122-127` botão `Rejeitar` (mesmo bloco PENDING); `bids/pending.ejs:150-155` botão ícone X (title `Rejeitar`).
- **Request:** params `id` (obrigatório). Sem body útil (sem motivo).
- **Resposta do servidor:** nunca `render`. Sucesso → `302 /admin/bids` + `success_msg` `Lance rejeitado` (**lista, não details — difere do approve**). Falhas abaixo.
- **Efeitos:** mesma guarda; escreve `bid.status='REJECTED'`.
- **Erros:** já processado/inexistente → `Lance não encontrado ou já processado` + `302 /admin/bids`; exceção → log + `Erro ao rejeitar lance` + `302 /admin/bids/:id`; sem capability → `deny`.

### `POST /admin/bids/notification-frequency`
- **Gate:** `isAdmin` + `bids.manage` (`bidRoutes.ts:16`) → `updateNotificationFrequency` (`bidsController.ts:410-424`)
- **Ativado por (tela):** `bids/index.ejs:180-188` form `Lembrete ao Cliente` (`action="/admin/bids/notification-frequency"`) — select `frequency` (`HOURLY De hora em hora` / `DAILY Dia a dia (Diário)`, seleciona `notificationFrequency` atual) com `onchange="this.form.submit()"`.
- **Request:** body — `frequency` (string; válido: `HOURLY|DAILY`) + `_csrf`.
- **Resposta do servidor:** nunca `render`. Sempre `302 /admin/bids` + flash.
- **Efeitos:** `setBidNotificationFrequency(frequency)` — variável **em memória** (`notificationSettings.ts`); consumida pelo job de lembretes de lance. Sem escrita em banco.
- **Erros:** valor inválido → `error_msg` `Frequência inválida`; sucesso → `Frequência de lembretes atualizada para: De hora em hora|Diariamente`; exceção → log + `Erro ao atualizar frequência de notificações`; sem capability → `deny`.

> **Conferência de cobertura:** `bidRoutes.ts` tem 10 registros (`get` linhas 7,8,9,11,13 + `post` linhas 10,12,14,15,16) — todos documentados acima, 10/10.
