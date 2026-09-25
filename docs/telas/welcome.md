# Boas-vindas (`/welcome`)
- **Objetivo:** Onboarding institucional de visitantes (apresentar a Katari e levar a login/cadastro).
- **O que precisa do servidor:** nada — a tela não chama o servidor (só renderiza `WelcomeOnboarding`).
- **Ações → chamadas:** só navegação local para `/auth/login` e `/auth/register` (dentro do componente `WelcomeOnboarding`); nenhum `$fetch`.
- **Estados:**
  - Autenticado → middleware `guest` redireciona para `/`.
  - Sem estados de servidor, loading ou erro (página estática; aliases `/intro`, `/onboarding`).

- Pixel global: middleware `track.global.ts` só emite `SCREEN_VIEW` logado — esta tela é de visitante (guest), então sem evento até autenticar.
