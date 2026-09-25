# Admin · People (Pessoas e Contas) — endpoints

- **Rota-base:** `src/routes/admin/peopleRoutes.ts` (17 `router.*`: L9-15 compat + L17-26 canônicas). Controller: `src/controllers/admin/peopleController.ts`.
- **Views:** `src/views/pages/people/index.ejs` (diretório), `form.ejs` (novo + edição), `details.ejs` (perfil). Montagem: `peopleRoutes` antes de `clientRoutes` em `index.ts:74-75`, então os `GET` legados `/clients*`/`/users*` caem nos redirects daqui.
- **Capabilities do módulo** (`adminCapabilities.ts:3-11,31-54`): `people.view` (MASTER/MANAGER/SUPPORT), `people.create` (MASTER/MANAGER), `people.edit_profile` (MASTER/MANAGER), `people.change_email` (MASTER/MANAGER), `people.change_role` (só MASTER), `people.change_password` (só MASTER), `people.delete` (só MASTER). Negação: flash `error_msg='Seu perfil não pode executar a ação "<cap>".'` + redirect Referer/dashboard (ou 403 JSON).
- **Regras de papel no controller:** `newPersonForm`/`createPerson` forçam `role='CLIENT'` salvo se ator for MASTER (`peopleController.ts:84-85,101`); `updateProfile` só MASTER/MANAGER podem trocar e-mail (`:209`); `updateAccess` tem defesa em profundidade via `canManageRole` (só MASTER — `:250`); `canManageAccess = actorRole==='MASTER'`, `canChangeEmail = MASTER||MANAGER` (`:92`, `:178-185`).
- **Checklist de cobertura (17/17):** `GET /clients`, `GET /users`, `GET /clients/new`, `GET /users/new`, `GET /clients/:id`, `GET /clients/:id/edit`, `GET /users/:id/edit`, `GET /people`, `GET /people/new`, `POST /people/new`, `GET /people/:id`, `GET /people/:id/edit`, `POST /people/:id/profile`, `POST /people/:id/access`, `POST /people/:id/password`, `POST /people/:id/reset-password`, `POST /people/:id/delete`.

## Redirects de compatibilidade (7)

### `GET /admin/clients`
- **Gate:** `isAdmin` + `people.view` (`peopleRoutes.ts:9`).
- **Ativado por (tela):** bookmarks/links antigos para `/admin/clients` (nenhum link atual do sidebar aponta aqui; sidebar usa `/admin/people` — `sidebar.ejs:181`).
- **Request:** query ignorada (não repassada).
- **Resposta do servidor:** `redirect → /admin/people?role=CLIENT`.
- **Efeitos:** nenhum. **Erros:** só deny de capability.

### `GET /admin/users`
- **Gate:** `isAdmin` + `people.view` (`:10`).
- **Ativado por (tela):** URLs antigas `/admin/users`.
- **Request:** —. **Resposta:** `redirect → /admin/people`. **Efeitos:** nenhum. **Erros:** só deny.

### `GET /admin/clients/new`
- **Gate:** `isAdmin` + `people.create` (`:11`).
- **Ativado por (tela):** URL antiga de criação (view legada `pages/clients/index.ejs:13` apontava para `/admin/clients/new`; hoje órfã).
- **Request:** —. **Resposta:** `redirect → /admin/people/new?role=CLIENT`. **Efeitos:** nenhum. **Erros:** só deny.

### `GET /admin/users/new`
- **Gate:** `isAdmin` + `people.create` (`:12`). **Request:** —.
- **Resposta:** `redirect → /admin/people/new?role=CLIENT` (mesmo destino do anterior).
- **Ativado por/Efeitos/Erros:** idem anterior.

### `GET /admin/clients/:id`
- **Gate:** `isAdmin` + `people.view` (`:13`).
- **Ativado por (tela):** links antigos `pages/clients/index.ejs:213,293` (`/admin/clients/<id>`) e `pages/clients/form.ejs`.
- **Request:** `params.id: string` (obrigatório). **Resposta:** `redirect → /admin/people/:id`.
- **Efeitos:** nenhum. **Erros:** só deny (id inexistente só será avaliado na rota destino).

### `GET /admin/clients/:id/edit`
- **Gate:** `isAdmin` + `people.edit_profile` (`:14`).
- **Ativado por (tela):** links antigos (`clients/index.ejs:219,299`, `clients/details.ejs:18,255`).
- **Request:** `params.id: string`. **Resposta:** `redirect → /admin/people/:id/edit`. **Efeitos:** nenhum. **Erros:** só deny.

### `GET /admin/users/:id/edit`
- **Gate:** `isAdmin` + `people.edit_profile` (`:15`).
- **Ativado por (tela):** URLs antigas `/admin/users/<id>/edit`.
- **Request:** `params.id: string`. **Resposta:** `redirect → /admin/people/:id/edit`. **Efeitos:** nenhum. **Erros:** só deny.

## Rotas canônicas (10)

### `GET /admin/people`
- **Gate:** `isAdmin` + `people.view` (`:17`).
- **Ativado por (tela):** sidebar **“Pessoas e Contas”** (`sidebar.ejs:181`); botão **“Voltar”** em `people/form.ejs:11` e `details.ejs:13`; links **“Cancelar”** (`form.ejs:39`) e **“Limpar”** filtro (`index.ejs:52`); destino dos redirects de erro/sucesso (`redirectPeople`, `peopleController.ts:31-33`).
- **Request:** query — `search?: string` (nome/e-mail/CPF; CPF com dígitos extraídos — `:37-47`), `role?: string` (só se `∈ ALL_VALID_ROLES`, senão ignorado — `:38`).
- **Resposta do servidor:** `render('pages/people/index', { path: '/people', people, filters: { search, role }, roleOptions })` (`:67-72`); cada item com `roleLabel`, `contractCount` (`_count.subscriptions`), `activeContractCount` (status ACTIVE/CONTEMPLATED — `:60-65`). Limite `take: 500`, `orderBy createdAt desc` (`:50-58`).
- **Efeitos:** só leitura (`User.findMany` + `_count` + `subscriptions.status`).
- **Erros:** exceção → `logger.error('Load unified people directory error:')` + `flash('error_msg','Erro ao carregar Pessoas e Contas.')` + `redirect /admin/people` (`:73-77`) — redirect para si mesma (sem loop prático; segunda falha repete o ciclo).
- **View (`index.ejs`):** botão **“Nova pessoa”** (`:11-14`, só com `people.create`) → `GET /people/new`; form filtro `GET /admin/people` (`:36`, campos `search`/`role`, **“Filtrar”** `:51`); por linha: **“Ver”** (`:88` → details), lápis (`:89`, só `people.edit_profile` → edit), chave (`:90`, só `people.change_password` → form `POST reset-password`); stats contam `people.length`, CLIENT, administrativas, `activeContractCount` (`:30-33`).

### `GET /admin/people/new`
- **Gate:** `isAdmin` + `people.create` (`:18`).
- **Ativado por (tela):** botão **“Nova pessoa”** em `people/index.ejs:12`; redirects de compat `/clients/new`, `/users/new` (com `?role=CLIENT`).
- **Request:** query — `role?: string` (só respeitado se ator for MASTER, senão força `CLIENT` — `peopleController.ts:80-85`).
- **Resposta do servidor:** `render('pages/people/form', { path: '/people', editing: false, person: { role, roleLabel }, parsedAddress: {}, canManageAccess })` (`:87-93`); `canManageAccess = actorRole==='MASTER'`.
- **Efeitos:** nenhum. **Erros:** nenhum (síncrona, sem I/O).
- **View (`form.ejs:17-42`, `!editing`):** `<form method="post" action="/admin/people/new">` (`:21`) + `_csrf` (`:22`); campos `name*`, `email*` (type email), `cpf*` (maxlength 14), `phone`, `password*` (minlength 8), `role` (select CLIENT/SUPPORT/MANAGER/MASTER, **só se `canManageAccess`** — `:29`), `address_cep/street/number/complement/neighborhood/city/state` (`:31-37`); submit **“Criar cadastro”** (`:39`); **“Cancelar”** → `/admin/people`.

### `POST /admin/people/new`
- **Gate:** `isAdmin` + `people.create` (`:19`).
- **Ativado por (tela):** submit **“Criar cadastro”** em `people/form.ejs:39` (também recebe os `POST /clients/new` legados — `clientRoutes.ts:11` delega para este mesmo handler).
- **Request:** body — `name: string*` (trim, obrigatório), `email: string*` (trim+lowercase, obrigatório), `cpf: string*` (só dígitos, exatamente 11 — `:100`), `phone?: string`, `password: string*` (≥ 8 — `:103`), `role?: string` (só aplicado se ator MASTER e `∈ ALL_VALID_ROLES`, senão `CLIENT` — `:101`), `address_cep/street/number/complement/neighborhood/city/state?: string` (serializado via `serializeAddress`, `null` se vazios — `:18-29`).
- **Resposta do servidor:** sucesso → `flash('success_msg','Pessoa/conta criada com sucesso.')` + `redirect /admin/people` (`:129-130`); validações/duplicatas → `redirect /admin/people/new` com flash (ver Erros).
- **Efeitos:** lê `User.findFirst({ OR: [email, cpf] })` (`:108-111`); escreve `User.create({ name, email, cpf, phone?, passwordHash: hashPassword(password), role, address })` (`:117-127`). Sem e-mail/alerta.
- **Erros:**
  - Campos inválidos (`!name || !email || cpf≠11 || !password || len<8`) → `flash('error_msg','Nome, e-mail, CPF válido e senha com pelo menos 8 caracteres são obrigatórios.')` + redirect `/admin/people/new` (`:103-106`).
  - E-mail/CPF duplicado → `flash('error_msg','E-mail ou CPF já cadastrado.')` + redirect `/admin/people/new` (`:112-115`).
  - Exceção → `logger.error('Create unified person error:')` + `flash('error_msg','Erro ao criar pessoa/conta.')` + redirect `/admin/people/new` (`:131-135`).

### `GET /admin/people/:id`
- **Gate:** `isAdmin` + `people.view` (`:20`).
- **Ativado por (tela):** link **“Ver”** em `people/index.ejs:88`; botão **“Cancelar”** do form de perfil (`form.ejs:64` → `/admin/people/<id>`); redirect pós-`resetPassword` (`peopleController.ts:311`); destino dos redirects de compat `/clients/:id`.
- **Request:** `params.id: string*` (id do `User`).
- **Resposta do servidor:** `render('pages/people/details', { path: '/people', person: { ...+roleLabel }, parsedAddress })` (`:159-163`); `subscriptions` com `plan.product`, primeiras 12 `installments`, `_count { bids, installments }` (`:142-151`). Se `!person` → flash + redirect (ver Erros).
- **Efeitos:** só leitura (`User.findUnique` + includes).
- **Erros:**
  - Inexistente → `flash('error_msg','Pessoa/conta não encontrada.')` + `redirect /admin/people` (`:154-157`).
  - Exceção → `logger.error('Load unified person details error:')` + `flash('error_msg','Erro ao carregar os detalhes.')` + redirect `/admin/people` (`:164-168`).
- **View (`details.ejs`):** botão **“Editar”** (`:12`, só `people.edit_profile`) → edit; seção Segurança com forms `POST .../password` (`:42`) e `POST .../reset-password` (`:49`, só `people.change_password`); tabela Contratos → **“Detalhes”** `/admin/contracts/<subId>` (`:89`); **“Excluir cadastro”** (`:113`, só `people.delete` → form `POST .../delete`); endereço montado de `parsedAddress` (`:29`).

### `GET /admin/people/:id/edit`
- **Gate:** `isAdmin` + `people.edit_profile` (`:21`).
- **Ativado por (tela):** lápis em `people/index.ejs:89`; botão **“Editar”** em `details.ejs:12`; destino dos redirects de compat `/clients/:id/edit`, `/users/:id/edit`.
- **Request:** `params.id: string*`.
- **Resposta do servidor:** `render('pages/people/form', { path: '/people', editing: true, person: { ...+roleLabel }, parsedAddress, canManageAccess, canChangeEmail })` (`:179-186`); `canChangeEmail = MASTER||MANAGER` (`:185`).
- **Efeitos:** só leitura (`User.findUnique` — `:173`).
- **Erros:** inexistente → `flash('error_msg','Pessoa/conta não encontrada.')` + redirect `/admin/people` (`:174-177`); exceção → `flash('error_msg','Erro ao carregar edição.')` + redirect `/admin/people` (`:187-191`).
- **View (`form.ejs:43-103`, `editing`):** form **perfil** `POST /admin/people/<id>/profile` (`:48`, campos `name`, `email` — `readonly` salvo `canChangeEmail` — `:52`, `phone`, `address_*`; **“Salvar perfil”** `:64`); form **acesso** `POST .../access` (`:74`, select `role`, **“Atualizar acesso”** `:78`, só `canManageAccess`); form **senha direta** `POST .../password` (`:83`, input `name="password"`, **“Salvar Senha”** `:89`); form **aleatória** `POST .../reset-password` (`:93`, **“Gerar Senha Aleatória Automática”** `:95`); sem `canManageAccess` mostra “restritas ao mestre” (`:99`).

### `POST /admin/people/:id/profile`
- **Gate:** `isAdmin` + `people.edit_profile` (`:22`).
- **Ativado por (tela):** **“Salvar perfil”** em `people/form.ejs:64` (também recebe `POST /clients/:id/edit` legado — `clientRoutes.ts:12`).
- **Request:** `params.id*`; body — `name?: string`, `email: string*` (obrigatório, lowercase), `phone?: string`, `address_cep/street/number/complement/neighborhood/city/state?: string` (via `serializeAddress`).
- **Resposta do servidor:** sucesso → `flash('success_msg','Perfil atualizado com sucesso.')` + `redirect /admin/people/:id/edit` (`:229-230`); falhas → redirect (ver Erros).
- **Efeitos:** lê atual (`:198`) + checa duplicata de e-mail (`:214`); escreve `User.update({ name, email, phone, address })` (`:220-228`). Sem e-mail/alerta.
- **Erros:**
  - Inexistente → `flash('error_msg','Pessoa/conta não encontrada.')` + redirect `/admin/people` (`:199-202`).
  - E-mail vazio → `flash('error_msg','O e-mail é obrigatório.')` + redirect `/admin/people/:id/edit` (`:205-208`).
  - Não-MASTER/MANAGER trocando e-mail → `flash('error_msg','Seu perfil não pode alterar o e-mail.')` + redirect edit (`:209-212`).
  - E-mail em uso → `flash('error_msg','Este e-mail já está em uso.')` + redirect edit (`:214-218`).
  - Exceção → `logger.error('Update unified person profile error:')` + `flash('error_msg','Erro ao atualizar o perfil.')` + redirect edit (`:231-235`).

### `POST /admin/people/:id/access`
- **Gate:** `isAdmin` + `people.change_role` (só MASTER tem — `:23`; `adminCapabilities.ts:32-40`).
- **Ativado por (tela):** **“Atualizar acesso”** em `people/form.ejs:78` (seção visível só com `canManageAccess`, i.e. MASTER).
- **Request:** `params.id*`; body — `role: string*` (deve `∈ ALL_VALID_ROLES`).
- **Resposta do servidor:** sucesso → `flash('success_msg','Perfil de acesso atualizado.')` + `redirect /admin/people/:id/edit` (`:260-261`).
- **Efeitos:** escreve `User.update({ role })` (`:259`). Loga tentativa indevida (`logger.warn [RBAC]...` — `:251`).
- **Erros:**
  - `role` inválido → `flash('error_msg','Perfil de acesso inválido.')` + redirect edit (`:244-247`).
  - `!canManageRole(actor, role)` (não-MASTER) → `flash('error_msg','Seu perfil não pode atribuir esse nível de acesso. Apenas MASTER gerencia papéis.')` + redirect edit (`:250-254`).
  - Auto-rebaixamento (`id===actorId && role!=='MASTER'`) → `flash('error_msg','Você não pode remover seu próprio acesso de mestre.')` + redirect edit (`:255-258`).
  - Exceção → `logger.error('Update unified person access error:')` + `flash('error_msg','Erro ao atualizar o perfil de acesso.')` + redirect edit (`:262-266`).

### `POST /admin/people/:id/password`
- **Gate:** `isAdmin` + `people.change_password` (só MASTER — `:24`).
- **Ativado por (tela):** **“Salvar Senha”** em `people/form.ejs:89` e **“Salvar”** em `people/details.ejs:46` (ambos `action="/admin/people/<id>/password"`, input `name="password"`, `minlength=6`, `required`).
- **Request:** `params.id*`; body — `password: string*` (trim, ≥ 6 — `:274`).
- **Resposta do servidor:** sucesso → `flash('success_msg','Senha de <name> alterada com sucesso!')` + `redirect /admin/people/:id/edit` (`:291-292`).
- **Efeitos:** escreve `User.update({ passwordHash: hashPassword(password) })` (`:286-289`). Sem e-mail/alerta.
- **Erros:**
  - Senha curta/ausente → `flash('error_msg','A nova senha deve ter pelo menos 6 caracteres.')` + redirect edit (`:274-277`).
  - Inexistente → `flash('error_msg','Pessoa/conta não encontrada.')` + redirect `/admin/people` (`:279-283`).
  - Exceção → `logger.error('Direct password change error:')` + `flash('error_msg','Erro ao alterar a senha.')` + redirect edit (`:293-297`).

### `POST /admin/people/:id/reset-password`
- **Gate:** `isAdmin` + `people.change_password` (só MASTER — `:25`).
- **Ativado por (tela):** botão chave na linha do diretório (`people/index.ejs:90`, form inline sem confirmação); **“Gerar Senha Aleatória Automática”** (`form.ejs:95`); **“Gerar Senha Aleatória”** (`details.ejs:51`); modais legados `clients/details.ejs:688` (via rota `/clients/...` — ver `clients.md`).
- **Request:** `params.id*`; sem body.
- **Resposta do servidor:** sucesso → `flash('success_msg','Senha temporária de <name>: <12 chars>')` + `redirect /admin/people/:id` (details — `:310-311`, **não** edit). A senha aparece uma única vez no flash; anote antes de navegar.
- **Efeitos:** gera `crypto.randomBytes(12).toString('base64url').slice(0,12)` (`:308`); escreve `User.update({ passwordHash })` (`:309`). Sem e-mail/alerta.
- **Erros:** inexistente → `flash('error_msg','Pessoa/conta não encontrada.')` + redirect `/admin/people` (`:303-307`); exceção → `logger.error('Reset unified person password error:')` + `flash('error_msg','Erro ao alterar a senha.')` + redirect `/admin/people/:id` (`:312-316`).

### `POST /admin/people/:id/delete`
- **Gate:** `isAdmin` + `people.delete` (só MASTER — `:26`).
- **Ativado por (tela):** **“Excluir cadastro”** na Zona de risco em `people/details.ejs:113` (form `POST /admin/people/<id>/delete` + `_csrf`, sem `confirm()`); modal legado `clients/details.ejs:717` (via `/clients/...`).
- **Request:** `params.id*`; sem body. Usa `session.user.id` como `actorId` (`:322`).
- **Resposta do servidor:** sucesso → `flash('success_msg','Pessoa/conta excluída com sucesso.')` + `redirect /admin/people` (`:329-330`).
- **Efeitos:** `AuditLog.updateMany({ where: { userId: id }, data: { userId: null } })` (preserva trilha — `:327`) + `User.delete({ where: { id } })` (`:328`). Irreversível. Sem e-mail.
- **Erros:**
  - Auto-exclusão (`id===actorId`) → `flash('error_msg','Você não pode excluir a própria conta.')` + redirect `/admin/people` (`:323-326`).
  - Exceção (ex.: FK de subscriptions/contratos) → `logger.error('Delete unified person error:')` + `flash('error_msg','Não foi possível excluir esta pessoa/conta.')` + redirect `/admin/people` (`:331-335`).
