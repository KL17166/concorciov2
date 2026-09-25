# Admin — Tickets (suporte)

Fontes: `server-consorcio/src/routes/admin/ticketsRoutes.ts` (3 `router.*`: 1 GET + 2 POST, todos conferidos abaixo),
`server-consorcio/src/controllers/admin/ticketsController.ts`,
`server-consorcio/src/views/pages/tickets/index.ejs`.
Montagem: `src/app.ts:154` `app.use('/admin', adminRoutes)` + `src/routes/admin/index.ts:86` `router.use(ticketsRoutes)`.
CSRF global (`routes/admin/index.ts:24-43`): os 2 POSTs exigem `_csrf` válido.
Gate base `isAdmin` (`middlewares/adminAuthMiddleware.ts:37-81`): sessão `role` ∈ MASTER/MANAGER/SUPPORT; senão
`redirect /admin/login` ou `403 JSON {error:'UNAUTHORIZED',...}` se `wantsJson`.
`requireCapability` (`adminAuthMiddleware.ts:83-92`): sem capability → `403 JSON {error:'FORBIDDEN',...}` ou
flash `error_msg` + redirect `Referer||/admin/dashboard`.
Matriz (`security/adminCapabilities.ts:32-55`): `support.view` e `support.manage` = MASTER/MANAGER/SUPPORT
(qualquer admin logado opera tickets).

### `GET /admin/tickets`
- **Gate:** `isAdmin` + `support.view` (`ticketsRoutes.ts:7`).
- **Ativado por (tela):** `src/views/pages/tickets/index.ejs:38-41` — abas-link
  `href="/admin/tickets?status=OPEN"` (label "Abertos"), `?status=IN_PROGRESS` ("Em atendimento"),
  `?status=CLOSED` ("Encerrados"), `?status=ALL` ("Todos"); entrada via sidebar (`path:'/tickets'`, linha 3).
  Badge no topo (linha 13-15): `<%= openCount %> em aberto` se `openCount>0`.
- **Request:** query `status?: string` — opcional, default `'OPEN'`; whitelist `['OPEN','IN_PROGRESS','CLOSED','ALL']`,
  valor fora cai em `'OPEN'` (controller:8-10). Sem params/body.
- **Resposta do servidor:** `render('pages/tickets/index')` (controller:24-30) com vars **todas**:
  `path='/tickets'`, `tickets` (até 100, `orderBy createdAt desc`; `where` = `{}` se `ALL` senão `{status:filter}`;
  include `user{id,name,email,cpf}` + `subscription{id,groupNumber,quotaNumber,status,paidInstallments}`),
  `filter` (normalizado), `openCount` (`supportTicket.count where {status:'OPEN'}`),
  `csrfToken` (`res.locals.csrfToken || req.session.csrfToken || ''`).
- **Efeitos:** leitura pura (`findMany` + `count`). Sem escrita, sem e-mail.
- **Erros:** exceção → `500 send('Erro ao carregar atendimentos')` (controller:33). Gate negado → padrão.

### `POST /admin/tickets/:id/reply`
- **Gate:** `isAdmin` + `support.manage` (`ticketsRoutes.ts:8`).
- **Ativado por (tela):** `index.ejs:78` (só renderizado se `t.status!=='CLOSED'`, linha 77) —
  `<form action="/admin/tickets/<%= t.id %>/reply" method="POST" class="mt-2">` + hidden `_csrf` +
  `<div class="input-group">` com `<input type="text" name="adminReply" placeholder="Responder ao cliente..."`
  `required maxlength="2000">` (linha 81) + botão submit "Responder" (linha 82) + botão submit
  `name="close" value="true"` label "Responder e encerrar" (linha 83). Resposta existente exibida acima
  (linhas 72-76): `Resposta (<%= t.repliedBy || 'admin' %>): <%= t.adminReply %>`.
- **Request:** param `id: string` (obrigatório, PK do `supportTicket`); body `adminReply: string`
  (obrigatório — `trim()` não-vazio, controller:43; truncado em 2000 chars via `.trim().slice(0,2000)`,
  controller:53), `close?: string` (opcional; só `==='true'` fecha, qualquer outro valor mantém em atendimento).
  Só `_csrf` além disso.
- **Resposta do servidor:** `redirect('/admin/tickets')` sempre (controller:45,61,65) + flash chave `success_msg`/`error_msg`
  (lidas pelo EJS linhas 23-34): `close==='true'` → `flash('success_msg','Atendimento respondido e encerrado!')`;
  senão → `flash('success_msg','Resposta enviada ao cliente!')` (controller:60).
- **Efeitos:** `supportTicket.update where {id} data {adminReply, repliedBy:(session.user.email||'admin'),
  status, closedAt?}` (controller:50-58): `status='CLOSED'+closedAt=now` se `close==='true'`,
  senão `status='IN_PROGRESS'` (sem tocar `closedAt`). Sem notificação/e-mail — o cliente vê `adminReply` no app.
- **Erros:** `adminReply` vazio/só-espaço → `flash('error_msg','Escreva uma resposta antes de enviar.')` +
  `redirect('/admin/tickets')` **sem tocar o banco** (controller:44-46); `id` inexistente (`update` sem registro) →
  cai no `catch` → `flash('error_msg','Erro ao responder atendimento.')` + `redirect('/admin/tickets')`
  (controller:63-65). CSRF inválido → 403 do middleware global. Gate negado → padrão.

### `POST /admin/tickets/:id/close`
- **Gate:** `isAdmin` + `support.manage` (`ticketsRoutes.ts:9`).
- **Ativado por (tela):** `index.ejs:65` (só se `t.status!=='CLOSED'`, linha 64) —
  `<form action="/admin/tickets/<%= t.id %>/close" method="POST" style="display:inline;">` + hidden `_csrf` +
  botão `type=submit` label "Encerrar" (`btn-outline-secondary`, linha 67). Encerra **sem** resposta.
- **Request:** param `id: string` (obrigatório). Sem query/body (só `_csrf`).
- **Resposta do servidor:** `redirect('/admin/tickets')` + `flash('success_msg','Atendimento encerrado.')`
  (controller:78-79).
- **Efeitos:** `supportTicket.update where {id} data {status:'CLOSED', closedAt:new Date()}` (controller:73-76).
  Não escreve `adminReply`/`repliedBy`. Sem notificação/e-mail.
- **Erros:** `id` inexistente/exceção → `flash('error_msg','Erro ao encerrar atendimento.')` +
  `redirect('/admin/tickets')` (controller:81-83). CSRF inválido → 403 global. Gate negado → padrão.
