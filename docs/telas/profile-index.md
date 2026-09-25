# Meu perfil (`/profile`)
- **Objetivo:** Exibir dados da conta, status KYC, atalhos e editar e-mail/telefone + logout.
- **O que precisa do servidor:**
  - `GET /api/kyc/status` (via `kycStore.fetchStatus` no mount) → `kycStatus` (atualiza `auth.user.kycStatus`; fonte da verdade)
  - `PATCH /api/profile` (via `authStore.updateProfile`, body `{email, phone}`) → `user` (atualiza a sessão)
  - `POST /api/auth/logout` (via `authStore.logout`, best-effort com `Authorization`) → limpa sessão e vai a `/welcome`
- **Ações → chamadas:**
  - "Salvar alterações" (Meus dados) → `PATCH /api/profile`
  - "SAIR" → `POST /api/auth/logout`; demais cards → navegação (`/consortium/contracts|statement|payments`, `/profile/kyc`)
- **Estados:**
  - `kycStatus` → pill: APPROVED=Verificado, SUBMITTED=Em Análise, REJECTED=Recusado, default=Pendente.
  - `dataMsg` ok/erro ("Dados atualizados!" ou msg do servidor); `isSavingData` → "Salvando...".
  - Validação local: e-mail regex e telefone 10–11 dígitos antes de chamar.

- Pixel global: `SCREEN_VIEW` emitido pelo middleware `track.global.ts` a cada navegação (sem duplicar no mount da página).
