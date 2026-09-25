# Login (`/auth/login`)
- **Objetivo:** Autenticar o cliente com CPF + senha e restaurar a sessão.
- **O que precisa do servidor:**
  - `POST /api/auth/login` (via `authStore.login`, body `{cpf` sem máscara, `password}`) → `token`, `user` (gravados em cookie de 15 min)
- **Ações → chamadas:**
  - Botão ENTRAR / Enter → `POST /api/auth/login`
  - "Esqueceu a senha?" → só `toast.info` (sem chamada; funcionalidade futura)
  - Evento `dev-fill-credentials` → só preenche o form (dev, sem chamada)
- **Estados:**
  - Sucesso → `router.push(query.redirect || '/')`.
  - Falha → `errors.general` + `toast.error` (ex.: credenciais inválidas vira "CPF ou senha incorretos"; sem resposta → "Erro de conexão com o servidor").
  - `authStore.isLoading` → spinner + botão desabilitado.
  - Nenhum `GET` ao montar; CPF é só formatado localmente (`formatCpf`).

- Pixel global: middleware `track.global.ts` só emite `SCREEN_VIEW` logado — esta tela é de visitante (guest), então sem evento até autenticar.
