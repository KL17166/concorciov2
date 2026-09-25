# Admin · Clients (compat legada) — endpoints

- **Rota-base:** `src/routes/admin/clientRoutes.ts` (5 `router.post`: L11-14 + L17). **Não há `GET` aqui** — os `GET /clients*` são resolvidos pelos redirects de `peopleRoutes.ts:9-15` (montado antes em `index.ts:74-75`).
- **Delegação:** 4 rotas delegam 1:1 para `peopleController` (criação/edição/exclusão/reset); a 5ª (`mark-paid`) é financeira e chama `settlePayment` (`src/application/payments/settlePayment.ts:11-25`) → `markInstallmentAsPaid` (`src/services/installmentService.ts`).
- **Views legadas (órfãs, sem link no sidebar atual):** `src/views/pages/clients/index.ejs`, `form.ejs`, `details.ejs`. O sidebar só linka `/admin/people` (`sidebar.ejs:181`). Os forms legados ainda disparam estas rotas quando as telas antigas são acessadas diretamente.
- **Código morto:** `src/controllers/admin/clientsController.ts` (`getNewClient`, `createClient`, `getClients`, `getClientDetails`, `getEditClient`, `updateClient`, `deleteClient`) **não é referenciado por nenhuma rota** (grep em `src/routes` retorna zero) — documentado aqui apenas para evitar uso; o comportamento vigente é o de `peopleController` + `settlePayment`.
- **Checklist de cobertura (5/5):** `POST /clients/new`, `POST /clients/:id/edit`, `POST /clients/:id/delete`, `POST /clients/:id/reset-password`, `POST /clients/:clientId/installments/:installmentId/mark-paid`.

---

### `POST /admin/clients/new`
- **Gate:** `isAdmin` + `people.create` (`clientRoutes.ts:11`).
- **Ativado por (tela):** view legada `pages/clients/form.ejs:85` — `<form action="/admin/clients/<%= editing ? client.id + '/edit' : '' %>" method="POST">` (modo criação: action `/admin/clients/` + `new` conforme rota), botão submit (`form.ejs:111`); link antigo **“Novo cliente”** (`clients/index.ejs:13`, hoje redirect para `/admin/people/new?role=CLIENT` via `peopleRoutes.ts:11`). Sem ponto de entrada no sidebar atual.
- **Request:** idêntico a `POST /admin/people/new` (handler `peopleController.createPerson`): body `name*`, `email*`, `cpf*` (11 dígitos), `phone?`, `password*` (≥ 8), `role?` (só MASTER), `address_cep/street/number/complement/neighborhood/city/state?`. Detalhe campo a campo em `people.md` (`POST /admin/people/new`).
- **Resposta do servidor:** a do `createPerson`: sucesso → `flash('success_msg','Pessoa/conta criada com sucesso.')` + `redirect /admin/people` (atenção: **não** volta para `/admin/clients`); falha → `flash('error_msg', ...)` + `redirect /admin/people/new`. **Diferença do legado morto:** `clientsController.createClient` redirecionava para `/admin/clients` com `'Cliente cadastrado com sucesso!'` — esse controller não é mais chamado.
- **Efeitos:** `User.create` (ver `people.md`). Sem e-mail/alerta.
- **Erros:** os de `createPerson` (campos obrigatórios / duplicado / exceção) + deny de `people.create`.

### `POST /admin/clients/:id/edit`
- **Gate:** `isAdmin` + `people.edit_profile` (`clientRoutes.ts:12`).
- **Ativado por (tela):** view legada `pages/clients/form.ejs:85` (modo edição: `action="/admin/clients/<id>/edit"`), botão submit (`:111`); links antigos **editar** (`clients/index.ejs:219,299`, `clients/details.ejs:18,255`). Hoje `GET /clients/:id/edit` redireciona para `/admin/people/:id/edit`.
- **Request:** `params.id*` (id do `User`); handler `peopleController.updateProfile` lê body `name?`, `email*`, `phone?`, `address_*?` (ver `people.md` `POST /admin/people/:id/profile`). Nota: a rota legada também aceita `password` no form antigo, mas `updateProfile` **ignora** senha (senha só via `/password` ou `/reset-password`).
- **Resposta do servidor:** a do `updateProfile`: sucesso → `flash('success_msg','Perfil atualizado com sucesso.')` + `redirect /admin/people/:id/edit`; falhas com redirects para edit ou `/admin/people` (ver `people.md`). **Diferença do legado morto:** `clientsController.updateClient` redirecionava para `/admin/clients/:id` com `'Cliente atualizado com sucesso!'` — não vigente.
- **Efeitos:** `User.update({ name, email, phone, address })`. Sem e-mail/alerta.
- **Erros:** os de `updateProfile` (e-mail obrigatório / troca de e-mail sem `MASTER|MANAGER` / duplicado / inexistente / exceção) + deny de `people.edit_profile`.

### `POST /admin/clients/:id/delete`
- **Gate:** `isAdmin` + `people.delete` (só MASTER — `clientRoutes.ts:13`).
- **Ativado por (tela):** modal **“Excluir Cliente”** em `pages/clients/details.ejs:717` — `<form action="/admin/clients/<%= client.id %>/delete" method="POST">` + `_csrf`, botão **“Sim, excluir”** (`:720`); helper JS `deleteClient()` (`details.ejs:728-...`, monta form POST dinâmico com `confirm()` citando “só é possível se não houver contratos ativos” — mensagem herdada do controller morto, **não** aplicada pelo handler vigente).
- **Request:** `params.id*`; sem body; handler `peopleController.deletePerson` (auto-exclusão bloqueada via `session.user.id`).
- **Resposta do servidor:** a do `deletePerson`: sucesso → `flash('success_msg','Pessoa/conta excluída com sucesso.')` + `redirect /admin/people`; auto-exclusão/exceção → `flash('error_msg',...)` + redirect `/admin/people`. **Diferença do legado morto:** `clientsController.deleteClient` bloqueava com `'Não é possível excluir cliente com contratos ativos'` (checava `Subscription.count ACTIVE|PENDING`) — o handler vigente **não** faz essa checagem; falha de FK cai em `'Não foi possível excluir esta pessoa/conta.'`.
- **Efeitos:** `AuditLog.updateMany(userId→null)` + `User.delete`. Irreversível.
- **Erros:** `Você não pode excluir a própria conta.` / `Não foi possível excluir esta pessoa/conta.` + deny de `people.delete`.

### `POST /admin/clients/:id/reset-password`
- **Gate:** `isAdmin` + `people.change_password` (só MASTER — `clientRoutes.ts:14`).
- **Ativado por (tela):** modal de reset em `pages/clients/details.ejs:688` — `<form action="/admin/clients/<%= client.id %>/reset-password" method="POST">` + `_csrf`, botão **“Sim, resetar”** (`:692`); aviso “Uma nova senha aleatória será gerada e exibida na tela. Anote-a antes de fechar!” (`:684-687`).
- **Request:** `params.id*`; sem body; handler `peopleController.resetPassword`.
- **Resposta do servidor:** a do `resetPassword`: sucesso → `flash('success_msg','Senha temporária de <name>: <12 chars>')` + `redirect /admin/people/:id` (details unificado — **não** volta para `/admin/clients/:id`); inexistente/erro → flash + redirect (`/admin/people` ou `/admin/people/:id`). A senha temporária (`crypto.randomBytes(12).base64url[0:12]`) aparece uma única vez no flash.
- **Efeitos:** `User.update({ passwordHash })`. Sem e-mail/alerta.
- **Erros:** `Pessoa/conta não encontrada.` / `Erro ao alterar a senha.` + deny de `people.change_password`.

### `POST /admin/clients/:clientId/installments/:installmentId/mark-paid`
- **Gate:** `isAdmin` + `payments.manage` (`clientRoutes.ts:17`). Têm: MASTER e MANAGER (`adminCapabilities.ts:41-47`); SUPPORT **não** tem. Deny padrão (flash `error_msg` + redirect Referer ou 403 JSON).
- **Ativado por (tela):** `pages/clients/details.ejs:522-539` — por parcela com `inst.status !== 'PAID'`: `<form action="/admin/clients/<%= client.id %>/installments/<%= inst.id %>/mark-paid" method="POST">` + `_csrf` (`:530-532`), botão check **“Marcar como paga”** (`title`, `:533-538`), com `onsubmit="return confirm(...)"` — `'Marcar adesão como paga?'` se `inst.number===1`, senão `'Marcar parcela #N como paga?'` (`:527`). Visibilidade no EJS restrita a `['MASTER','MANAGER'].includes(user.role)` (`:521`) — espelha o gate, mas a autoridade é o servidor. **A view unificada `pages/people/details.ejs` não possui botão mark-paid** — ação só alcançável pela tela legada.
- **Request:** `params.clientId: string*` (só usado para o redirect), `params.installmentId: string*` (id da `Installment` liquidada); sem query/body. Handler inline (`clientRoutes.ts:17-28`) chama `settlePayment({ installmentId, channel: 'ADMIN' })`.
- **Resposta do servidor:** sempre `redirect → /admin/people/:clientId` (`:27`); antes, `flash(result.success ? 'success_msg' : 'error_msg', result.message)` (`:22`) — texto vem de `markInstallmentAsPaid` (ex.: confirmação de liquidação ou motivo da recusa).
- **Efeitos:** `settlePayment` → `markInstallmentAsPaid(installmentId, { paymentMethod: 'ADMIN_MANUAL', paymentDate: now })` (`settlePayment.ts:17-20`): atualiza `Installment` (status pago, `paidAt`, método), move `Subscription`/contrato adiante e registra logs (`logger.info/warn` — `:14,23-27`). Tabelas via `installmentService` (installment/subscription/audit conforme o serviço). Sem e-mail direto. Redirect cai no perfil unificado (`GET /admin/people/:id`, que lista só as 12 primeiras parcelas por contrato — `peopleController.ts:147`).
- **Erros:**
  - `result.success === false` → `flash('error_msg', result.message)` + redirect perfil (`:22`).
  - Exceção → `logger.error('Mark client installment paid error:')` + `flash('error_msg','Erro ao marcar parcela como paga.')` + redirect perfil (`:23-26`).
  - Sem `payments.manage` → deny (SUPPORT bloqueado).
