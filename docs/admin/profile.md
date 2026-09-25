# Admin — Profile / 2FA (conta própria)

Fontes: `server-consorcio/src/routes/admin/profileRoutes.ts` (3 `router.*`: 1 GET + 2 POST, todos conferidos abaixo),
`server-consorcio/src/controllers/admin/profileController.ts` (TOTP via `otplib.authenticator` + `qrcode`),
`server-consorcio/src/views/pages/2fa/index.ejs` (**não há pasta `profile/`** — a view mora em `pages/2fa/`).
Montagem: `src/app.ts:154` `app.use('/admin', adminRoutes)` + `src/routes/admin/index.ts:73` `router.use(profileRoutes)`.
CSRF global (`routes/admin/index.ts:24-43`): os 2 POSTs exigem `_csrf` válido.
Gate base `isAdmin` (`middlewares/adminAuthMiddleware.ts:37-81`): sessão `role` ∈ MASTER/MANAGER/SUPPORT; senão
`redirect /admin/login` ou `403 JSON` se `wantsJson`. `requireCapability` (`adminAuthMiddleware.ts:83-92`): padrão.
Matriz (`security/adminCapabilities.ts:32-55`): `account.security` = MASTER/MANAGER/SUPPORT — cada admin gerencia
o **próprio** 2FA (sempre `session.user.id`, nunca param de outro usuário).

### `GET /admin/profile/2fa`
- **Gate:** `isAdmin` + `account.security` (`profileRoutes.ts:7`).
- **Ativado por (tela):** navegação/sidebar (`sidebar` com `path:'/profile/2fa'`, `2fa/index.ejs:3`; título
  "Segurança da Conta", subtítulo "Gerencie a verificação em duas etapas (2FA)", linhas 9-10). Sem query/form —
  é a porta de entrada da tela.
- **Request:** sem params/query/body. Identidade: `userId = req.session.user.id` (controller:7).
- **Resposta do servidor:** `render('pages/2fa/index')` em 2 variantes (controller:12-33), sempre com
  `path='/profile/2fa'` + `breadcrumbs=[{name:'Início',url:'/admin/dashboard'},{name:'Segurança da Conta',url:'#'}]`:
  (a) `twoFactorEnabled===true` → vars `{enabled:true, path, breadcrumbs}` (controller:12-16);
  (b) senão → gera `secret=authenticator.generateSecret()`, `otpauth=authenticator.keyuri(email,'Katari Admin',secret)`,
  `qrCodeImage=await QRCode.toDataURL(otpauth)`, grava `req.session.temp2FASecret=secret` (controller:25) e
  render com `{enabled:false, qrCodeImage, secret, path, breadcrumbs}` (controller:27-33).
- **Efeitos:** (b) escreve `temp2FASecret` na sessão (sobrescrito a cada GET com 2FA desligado). Leitura
  `user.findUnique where {id}` (controller:8). Sem escrita em DB, sem e-mail.
- **Erros:** `user` inexistente no DB → `redirect('/admin/login')` **puro, sem flash** (controller:9).
  Falha no `toDataURL` → exceção não tratada (sem try/catch neste handler). Gate negado → padrão.

### `POST /admin/profile/2fa/enable`
- **Gate:** `isAdmin` + `account.security` (`profileRoutes.ts:8`).
- **Ativado por (tela):** `2fa/index.ejs:195` (só no estado `!enabled`, linha 149) —
  `<form action="/admin/profile/2fa/enable" method="POST">` + hidden `_csrf` (linha 196) +
  `<label>Código de Verificação</label>` + `<input type="text" name="token" placeholder="000000" required
  pattern="[0-9]{6}" maxlength="6" style="...monospace...">` (linhas 199-200) + botão submit "Ativar 2FA"
  (ícone `bi-shield-lock`, linha 201). Passos 1-4 acima (linhas 177-193): baixar Aegis (Android)/2FAS (iOS),
  escanear QR (`qrCodeImage` 180px, linha 166) ou digitar `secret` manual (linha 169-171), código TOTP 30s.
- **Request:** body `token: string` (obrigatório — código TOTP de 6 dígitos do app; controller:38 desestrutura
  `req.body`). Segredo esperado: `req.session.temp2FASecret` (gravado pelo GET, controller:39). Só `_csrf` além disso.
- **Resposta do servidor:** `redirect('/admin/profile/2fa')` sempre (controller:43,49,59) + flash `success_msg`/`error_msg`
  (lidas pelo EJS linhas 34-48). Sucesso → `flash('success_msg','Autenticação em 2 etapas habilitada com sucesso!
  Na próxima vez que tentar logar, esse código será exigido.')` (controller:58).
- **Efeitos:** sucesso → `user.update where {id} data {twoFactorEnabled:true, twoFactorSecret:secret}`
  (controller:52-55) + `delete req.session.temp2FASecret` (controller:57). Verificação
  `authenticator.verify({token, secret})` (controller:46). Sem e-mail/alerta.
- **Erros:** `!secret || !token` (sessão expirada — ex: GET nunca feito ou sessão reciclada) →
  `flash('error_msg','Sessão expirada. Tente novamente.')` + redirect (controller:42-43);
  TOTP inválido → `flash('error_msg','Código inválido. Tente novamente.')` + redirect, **sem** limpar `temp2FASecret`
  (pode tentar de novo, controller:47-49). CSRF inválido → 403 global. Gate negado → padrão.

### `POST /admin/profile/2fa/disable`
- **Gate:** `isAdmin` + `account.security` (`profileRoutes.ts:9`).
- **Ativado por (tela):** `2fa/index.ejs:133` (só no estado `enabled`, linha 113 — card "Verificação em Duas
  Etapas Ativa"/"Sua conta está blindada") — `<form action="/admin/profile/2fa/disable" method="POST">` +
  hidden `_csrf` (linha 134) + `<label>Para desativar, digite o código atual:</label>` +
  `<input type="text" name="token" placeholder="000000" pattern="[0-9]{6}" maxlength="6" required ...>` (linhas 137-138)
  + botão submit "Desativar" (`btn-outline-danger`, ícone `bi-shield-x`, linhas 139-141).
- **Request:** body `token: string` (obrigatório — TOTP atual do app; controller:64). Segredo esperado:
  `user.twoFactorSecret` persistido (controller:66-69). Só `_csrf` além disso.
- **Resposta do servidor:** `redirect('/admin/profile/2fa')` sempre (controller:67,72,81) + flash:
  sucesso → `flash('success_msg','Autenticação em 2 etapas foi desabilitada. Sua conta agora está menos segura.')`
  (controller:80).
- **Efeitos:** sucesso → `user.update where {id} data {twoFactorEnabled:false, twoFactorSecret:null}`
  (controller:75-78). Verificação `authenticator.verify({token, secret:user.twoFactorSecret})` (controller:69).
  Leitura `user.findUnique` antes (controller:66). Sem e-mail/alerta.
- **Erros:** `!user || !user.twoFactorSecret` → `redirect('/admin/profile/2fa')` **puro, sem flash**
  (controller:67); TOTP inválido → `flash('error_msg','Código inválido. Verifique o app Autenticador.')` + redirect
  (controller:71-72). CSRF inválido → 403 global. Gate negado → padrão.
