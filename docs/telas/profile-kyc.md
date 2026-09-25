# Validação de documentos (`/profile/kyc`)
- **Objetivo:** Enviar frente/verso do documento + selfie e acompanhar o status KYC.
- **O que precisa do servidor:**
  - `GET /api/kyc/status` (via `fetchStatus` no mount) → `kycStatus`, `rejectReason`, `documentsUploaded`, `documentFrontUrl|documentBackUrl|selfieUrl` (pré-preenchem a tela)
  - `POST /api/auth/upload?type=document|document_back|selfie` (via `uploadDocument`, `FormData{file}`) → `url` (por tipo)
  - `POST /api/kyc/submit` (via `submitAll`, body `{documentFrontUrl, documentBackUrl, selfieUrl}`) → `success`, `kycStatus`
  - `POST /api/track` (via `trackScreenView('kyc')` no mount) → pixel `SCREEN_VIEW`
- **Ações → chamadas:**
  - Selecionar cada foto → `POST /api/auth/upload?type=...`
  - "ENVIAR PARA VALIDAÇÃO" → `POST /api/kyc/submit` (+ `markKycRejectedRead` limpa a notificação de recusa)
- **Estados:**
  - Banner por status: REJECTED (motivo), SUBMITTED/sucesso (em análise), APPROVED (verificado, esconde upload), default (pendente).
  - Travado em `SUBMITTED`: inputs `disabled`, labels sem clique, botão vira "DOCUMENTOS EM ANÁLISE — AGUARDE" (sem reenvio/seleção; guards também em `handleFileUpload`/`handleSubmit`).
  - Hidratação: botão/inputs nascem `disabled` (`!isMounted`) nos dois lados e liberam pós-mount — sem warn de mismatch.
  - Banner global de recusa (`app.vue`, via `useNotificationsStore.unreadKycRejected`) some nesta rota; "Reenviar documentos" navega para cá.
  - Sem as 3 fotos → botão desabilitado + erro local; falha → `submitError`.
  - Sucesso → `submitSuccess` + `auth.user.kycStatus='SUBMITTED'`.

- Pixel global: `SCREEN_VIEW` emitido pelo middleware `track.global.ts` a cada navegação (sem duplicar no mount da página).
