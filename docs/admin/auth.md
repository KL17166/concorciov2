# Admin · Auth — endpoints

- **Rota-base:** `src/routes/admin/authRoutes.ts` (lógica inline; sem controller dedicado). Montado em `src/routes/admin/index.ts:71`.
- **Views:** `src/views/pages/auth/login.ejs`, `src/views/pages/auth/login-2fa.ejs`.
- **CSRF global** (`index.ts:28-43`): `GET /`, `/login`, `/logout` são isentos de `generateToken` e `validateToken`; `POST /login` é isento de validação. `POST /login/2fa` **exige** `_csrf` (o form `login-2fa.ejs:348` envia; `login.ejs` **não** envia `_csrf` — rota isenta).
- **Gates:** rotas públicas não usam `isAdmin`; só `GET /token` usa `isAdmin` (sem `requireCapability`). `isAdmin` (`src/middlewares/adminAuthMiddleware.ts:37-81`) exige `session.user.role ∈ {MASTER, MANAGER, SUPPORT}`, senão flash `error` + redirect `/admin/login` (ou `403 JSON` se `wantsJson`).
- **Checklist de cobertura:** 7 `router.*` em `authRoutes.ts` (L50, 54, 58, 89, 94, 118, 124) — todos documentados abaixo.

## Helper `setupAdminSession(req, res, user, rememberMe)` — `authRoutes.ts:11-48`

- `req.session.regenerate` → `req.session.user = { id, name, email, role }` + JWT `adminToken = jwt.sign({ userId, role, type: 'admin_panel' }, JWT_SECRET, { HS256, 2h })` (`:26-31`) → `cookie.maxAge` = 30 dias se `rememberMe` senão 24 h (`:33-37`) → `session.save` → `redirect /admin/dashboard` (`:45`).
- Erro em `regenerate` (`:13-17`) ou `save` (`:40-44`): `flash('error', 'Erro interno ao processar login.')` + `redirect /admin/login`. Sem e-mail/alerta. Escreve: sessão (store) apenas.

---

### `GET /admin/`
- **Gate:** nenhum (público, CSRF isento — `index.ts:29`).
- **Ativado por (tela):** navegação direta à raiz do painel; nenhum botão/form do EJS aponta para cá.
- **Request:** sem params/query/body.
- **Resposta do servidor:** `redirect 302 → /admin/login` (`authRoutes.ts:50-52`).
- **Efeitos:** nenhum (sem escrita, sem e-mail, sem alerta).
- **Erros:** nenhum.

### `GET /admin/login`
- **Gate:** nenhum (público, CSRF isento).
- **Ativado por (tela):** destino de todos os redirects de login (`POST /login` falhas, `GET /login/2fa` sem `pending2FAUserId`, `POST /login/2fa` exceção, `GET /logout`); link sidebar **“Sair”** (`partials/sidebar.ejs:199`, `href="/admin/logout"` → cai aqui); link **“Cancelar e Voltar ao Início”** em `login-2fa.ejs:363` (`href="/admin/logout"` → aqui); link **“Voltar para o site principal”** (`login.ejs:484`, `href="/"`) é o inverso (sai do login).
- **Request:** sem params/query/body.
- **Resposta do servidor:** `render('pages/auth/login')` sem vars do servidor (`authRoutes.ts:54-56`). A view lê apenas flash `error` (`login.ejs:435-442`).
- **Efeitos:** nenhum.
- **Erros:** nenhum (a página só exibe `error` gravado por outras rotas).

### `POST /admin/login`
- **Gate:** nenhum (público; CSRF **isento** — `index.ts:36-39`; por isso `login.ejs:444` não tem `_csrf`).
- **Ativado por (tela):** `login.ejs:444` — `<form action="/admin/login" method="POST">`, botão submit **“Entrar no Painel”** (`:473-476`).
- **Request:** body (urlencoded) — `email: string` (obrigatório), `password: string` (obrigatório), `remember: 'on' | undefined` (opcional, checkbox `login.ejs:468` `name="remember"`).
- **Resposta do servidor:**
  - 2FA necessário → `redirect → /admin/login/2fa` (`:78`) após gravar `session.pending2FAUserId = user.id`, `session.rememberMe`.
  - Sucesso sem 2FA → `setupAdminSession(...)` → `redirect → /admin/dashboard`.
  - Falhas → `redirect → /admin/login` com flash (ver Erros).
- **Efeitos:** lê `User.findFirst({ where: { email } })` (`:62`); `verifyPassword(password, user.passwordHash)` (`:69`, `src/security/password.ts`); em sucesso escreve sessão + JWT `adminToken` (2 h, `type: 'admin_panel'`) e ajusta `cookie.maxAge` (30 d com remember, 24 h sem). Sem e-mail/alerta/tabela além da sessão.
- **Erros:**
  - `!user || role ∉ {MASTER, MANAGER, SUPPORT}` → `flash('error', 'Credenciais inválidas ou sem permissão.')` + redirect `/admin/login` (`:64-67`).
  - Senha inválida → `flash('error', 'Credenciais inválidas.')` + redirect `/admin/login` (`:70-73`).
  - Exceção → `logger.error('Admin login error:')` + `flash('error', 'Erro interno ao processar login.')` + redirect `/admin/login` (`:82-86`).
  - Falha interna de `setupAdminSession` → `flash('error', 'Erro interno ao processar login.')` + redirect `/admin/login` (`:15`, `:42`).

### `GET /admin/login/2fa`
- **Gate:** nenhum middleware; guarda de sessão inline (`:90`).
- **Ativado por (tela):** redirect automático do `POST /login` quando `user.twoFactorEnabled && user.twoFactorSecret` (`:75-79`); refresh/revisita direta.
- **Request:** sem body; exige `session.pending2FAUserId: string` (pré-condição).
- **Resposta do servidor:** se `pending2FAUserId` ausente → `redirect → /admin/login` (`:90`); senão `render('pages/auth/login-2fa')` sem vars (`:91`; a view lê flash `error` em `login-2fa.ejs:338-345`).
- **Efeitos:** nenhum.
- **Erros:** sem `pending2FAUserId` → redirect silencioso (sem flash) para `/admin/login`.

### `POST /admin/login/2fa`
- **Gate:** nenhum middleware; guarda de sessão inline (`:95-96`); CSRF **exigido** (não está na lista de isenção).
- **Ativado por (tela):** `login-2fa.ejs:347` — `<form action="/admin/login/2fa" method="POST">` + hidden `_csrf` (`:348`), botão **“Verificar Código”** (`:356-359`).
- **Request:** body — `token: string` (obrigatório; input `login-2fa.ejs:352-353`, `maxlength=6`, `pattern=[0-9]{6}`, `required`); `session.pending2FAUserId: string` (pré-condição de sessão). Sem params/query.
- **Resposta do servidor:** sucesso → `delete session.pending2FAUserId` + `setupAdminSession(req, res, user, session.rememberMe)` → `redirect /admin/dashboard`; falhas → redirect (ver Erros).
- **Efeitos:** lê `User.findUnique({ where: { id: userId } })` (`:100`); `authenticator.verify({ token, secret: user.twoFactorSecret })` via `otplib` (`:103`); em sucesso escreve sessão + JWT como no login. Sem e-mail/alerta.
- **Erros:**
  - Sem `pending2FAUserId` → `redirect /admin/login` silencioso (`:96`).
  - `!user || !user.twoFactorSecret` → `redirect /admin/login` silencioso (`:101`).
  - TOTP inválido → `flash('error', 'Código 2FA inválido.')` + `redirect /admin/login/2fa` (`:105-106`).
  - Exceção → `logger.error('2FA verification error:')` + `flash('error', 'Erro interno ao validar 2FA.')` + `redirect /admin/login` (`:112-114`).

### `GET /admin/logout`
- **Gate:** nenhum (público, CSRF isento — `index.ts:29`).
- **Ativado por (tela):** sidebar **“Sair”** (`partials/sidebar.ejs:199`, `<a href="/admin/logout" class="text-danger">`); link **“Cancelar e Voltar ao Início”** em `login-2fa.ejs:362-367` (`href="/admin/logout"`).
- **Request:** sem params/query/body.
- **Resposta do servidor:** `req.session.destroy(...)` → `redirect → /admin/login` (`:118-122`).
- **Efeitos:** destrói a sessão (remove `session.user` + `adminToken`). Sem escrita em banco, sem e-mail/alerta.
- **Erros:** nenhum (callback ignora erro de destroy e sempre redireciona).

### `GET /admin/token`
- **Gate:** `isAdmin` (só sessão admin; **sem** capability — `authRoutes.ts:124`).
- **Ativado por (tela):** nenhum botão/form do EJS; endpoint utilitário para clientes JS autenticados lerem o JWT da sessão (ex.: chamadas API manuais). Não há `fetch('/admin/token')` nas views atuais.
- **Request:** sem params/query/body; usa `session.adminToken`.
- **Resposta do servidor:** JSON — `{ token: string }` (`:129`); se ausente → `401 { error: 'Token não disponível. Faça login novamente.' }` (`:127`).
- **Efeitos:** nenhum (leitura de sessão). Nota: `isAdmin` pode rotacionar `adminToken` se faltar < 15 min para expirar (`adminAuthMiddleware.ts:49-67`).
- **Erros:**
  - Sem sessão admin → `isAdmin` nega: `redirect /admin/login` + flash `error='Por favor, faça login como administrador.'` (HTML) ou `403 { error: 'UNAUTHORIZED', ... }` (JSON) — `adminAuthMiddleware.ts:72-80`.
  - `adminToken` ausente → `401 JSON` acima.
