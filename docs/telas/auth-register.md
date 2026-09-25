# Criar conta (`/auth/register`)
- **Objetivo:** Cadastrar novo cliente (nome, e-mail, CPF, telefone, senha).
- **O que precisa do servidor:**
  - `POST /api/auth/register` (via `authStore.register`, body `{name, email` minúsculo, `cpf, phone?, password}`) → `token`, `user`, `message`
- **Ações → chamadas:**
  - Submit "Criar Minha Conta" → `POST /api/auth/register` (só após validação local)
- **Estados:**
  - Sucesso → `toast.success` + `router.push(query.redirect || '/')` (com token, sessão é criada).
  - Falha → `error-banner` (`errors.general`) + `toast.error` com a mensagem do servidor.
  - `isSubmitting || authStore.isLoading` → spinner + botão desabilitado.
  - Validação local prévia (sem servidor): nome obrigatório, e-mail regex, `isValidCpf`, senha ≥ 6, confirmação igual — erros por campo.

- Pixel global: middleware `track.global.ts` só emite `SCREEN_VIEW` logado — esta tela é de visitante (guest), então sem evento até autenticar.
