# CENTRAL DE NOTIFICAÇÕES — fase 1 entregue (2026-09-23)

Decisões: EJS admin atual, live SSE/polling, SUPPORT=atendente / MANAGER=gerente, fase 1 completa.
Plano: `implementation_plan-notificacoes-2026-09-23.md`.

## O que entrou
- Migration `20260923000000_alert_queue`: `system_alerts` += `status/assignedTo/assignedAt/resolvedAt/entityKind/entityId/claimToken` + índices; backfill `read→status`. `prisma migrate deploy` + `generate` OK.
- Capabilities `notifications.view` (MASTER/MANAGER/SUPPORT) + `notifications.manage` (MASTER/MANAGER).
- Helpers `src/application/alerts/alertQueue.ts`: `claimAlert/transitionAlert/releaseAlert` (Serializable, idempotente, AuditLog).
- Central `GET /admin/notifications` + `claim/release/progress/resolve/dismiss` + `SSE /stream` + `GET /unread-count`; EJS `pages/notifications/index.ejs`; sidebar item `Notificações` + sino deep-link (bidPayment→payments?paymentId=, bid→details, subscription→contracts) + poll 30s.
- `dashboardController` sino passa a ler `status IN (OPEN,ACK,IN_PROGRESS)`; `read-all` dispensa só minhas + sem dono.
- `GET /admin/bids/payments` v2: busca, gateway, `onlyClaimed` (só com Já-paguei), paginação, join `BID_PAYMENT_CHECK` (hora + contagem), highlight `?paymentId=&alertId=`, countdown <5min; ações Confirmar / Recusar (motivo≥8→EXPIRED+encerra alertas) / Pedir estorno + Confirmar estorno (dupla aprovação, `providerRefundId`, voucher→CANCELLED).
- KYC maker-checker: `POST /admin/kyc/:userId/propose` (SUPPORT, dedupe 30min, `SystemAlert KYC_PROPOSAL` + `auditLog KYC_PROPOSED`); `approve/reject` com `auditLog KYC_APPROVED/REJECTED` + approve encerra alertas do user; EJS mostra Aprovar/Rejeitar p/ quem tem `compliance.review` e Propor p/ atendente; texto do `confirm` de reject corrigido (não cancela nada).
- `notifyBidPaymentCheck/notifyPaymentCheck`: criam alerta com `status OPEN + entityKind/entityId`.
- Cliente `bids.vue`: texto honesto (manual em até 30 min úteis), botão “Já realizei” desabilitado até ter `pixCopiaECola`, re-fetch em 8s após avisar.
- Testes: `alertQueue.test.ts` (3 testes) — `jest` 12 suites 77/77 OK; `tsc --noEmit` OK; backend restartado, `/health` OK, `/admin/login` 200, rotas novas montadas (403 sem sessão = gate ativo).

## Pendente / próximos passos
- `overrideKyc/retrigger` ainda sem tela (só JSON); `REFUND_REQUEST` aparece na Central mas sem tela dedicada de tesouraria; sem upload de comprovante no confirm (só modal confirm nativo).
- Validar com login real de MANAGER: claim→progress→resolve, refuse com motivo, refund com 2 gerentes distintos, sino deep-link.
- `docs/admin/kyc.md`, `bids.md`, `INDICE.md` (contadores) devem ser atualizados no commit seguinte com o detalhe das novas rotas (este arquivo é o apêndice da fase 1).

## Adendo 23/09 (a pedido do operador): manual só se a gateway for manual
- `gateway_configs.requiresManualReview` (migration `20260923000001_gateway_manual_review`; Eldorado/G2G=true, PixGo/Sigilopay=false) + switch na tela /admin/gateways + pill "Manual" na lista.
- `PaymentFailoverService` faz OR: `adapter.isManualApproval || config.requiresManualReview`.
- `generateBidPix` retorna `provider + isManualApproval` (novo e reutilizado).
- App `bids.vue`: `isManualGateway` (flag, fallback provider) — texto/toast manual só quando true; gateway automática mostra "confirmação automática".

## Adendo 23/09 (2): alerta rico + visual caprichado
- `notifyPaymentCheck`: título `Cliente verificou pagamento — Adesão|Parcela N`; details com kind/kindLabel, installmentId/Number/Status/dueDate, amount, paymentMethod, provider (via paymentAttempt), productName/planName; severity WARNING se OVERDUE.
- `notifyBidPaymentCheck`: título com tipo do lance (Livre/Fixo/Embutido) + details `bidType/bidTypeLabel/bidStatus/kind=LANCE`.
- Novo `public/css/ops-queue.css` (link no header): tema da fila (contadores, chips, status pills, sino premium, voucher highlight).
- `pages/notifications/index.ejs` reescrita: cabeçalho com contadores, tabela com coluna Tipo (code+severity+selo Adesão/Parcela N/Lance), chips (valor, gateway, método, status parcela, vencimento, produto, cliente).
- `sidebar.ejs`: sino com chips (tipo+valor+gateway), footer "Ver Central", CSS inline removido (foi p/ o .css), deep-link mantido + poll 30s.
- `pages/bids/payments.ejs`: título com ícone, classes novas (mono-code, paidclick-badge, countdown-urgent, voucher-hl).
- Docs: `notifyPaymentCheck.md`, `notifyBidPaymentCheck.md` atualizados.

## Adendo 23/09 (3): tema sóbrio profissional em todas as telas
- Auditoria: 41 EJS + 2 CSS; ~400 estilos inline coloridos mapeados (top: success #10b981, warning #f59e0b, danger #ef4444, índigo, roxo, azul).
- Referência (pesquisa web): chrome neutro, cor só com significado (ponto+texto), um raio, um cabeçalho (Linear/Stripe/shadcn).
- `public/css/admin-design-system.css` += seção TEMA SÓBRIO: botões (primário slate escuro, resto outline neutro), selos todos neutros com ponto de status, stat-cards número escuro/rótulo cinza/ícone neutro, tabelas discretas, abas neutras, sino sóbrio, dark mode sem arco-íris. Neutraliza badge-premium/gw-pill/inline via !important.
- `public/css/ops-queue.css` reescrito sóbrio (só layout; sem fills coloridos).
- `pages/notifications/index.ejs`: cabeçalho convertido p/ `top-bar + page-title` padrão; `pages/bids/payments.ejs`: ícone sem cor inline.
- Smoke com sessão MASTER: 14 telas 200 (clients/users redirecionam p/ /admin/people — legado, OK). jest 77/77, tsc OK.

## Adendo 23/09 (4): sweep modo escuro tela por tela (com navegador)
- Causa raiz dos roxos: `header.ejs` injetava gradientes DEPOIS do CSS externo (`.btn-primary`, `.sidebar-header`, `a.active`, `.user-avatar`, `.stat-card.gradient-*`) — corrigido na fonte (flat slate) + rede `background-image:none` no CSS + regra p/ `div/span[style*=linear-gradient]` (35 inlines em 19 arquivos).
- Abas ativas (`.btn-outline-*.active`) viraram slate sóbrio nos dois temas.
- Gateways: neutralizados tabs, balance cards, ícones por gateway, picker, withdraw (texto com gradiente virou tinta sólida).
- Imagens do catálogo 404 no admin: `app.ts` agora serve `/img` de `zuvio-web/public/img`.
- Sweep dark (19 telas, com sessão MASTER): zero gradientes, zero fundo-branco, zero imgs quebradas visíveis. Sino abre no escuro, modal de pagamento abre legível, QR do 2FA renderiza.
- Achados menores (não-dark, anotados): `GET /admin/gateways/sigilopay/balance` 500 em dev sem chaves (UI mostra "Sem conexão"); previews ocultos de products com src vazio (painel d-none, inofensivo); /admin/clients e /admin/users redirecionam p/ /admin/people (legado).
- Cache: CSS com `?v=20260923d` — recarregue a página com Ctrl+Shift+R uma vez.

## Adendo 23/09 (6): parcela exata no alerta (adesão/parcela/antecipação)
- Problema: `POST /api/subscription/:id/payment-check` só recebia o contrato — o backend adivinhava a 1ª em aberto; antecipação era invisível; alerta da Mariana (antigo) não dizia nada.
- Backend: `notifyPaymentCheck({subscriptionId, requesterUserId, installmentId?})` — com `installmentId` valida dono (403 se de outro contrato) e carimba a parcela exata; `isAntecipacao = number > primeira em aberto`; título `... — Adesão | Parcela N | Parcela N (antecipação)`; details += `isAntecipacao, parcelaInformadaPeloApp, installmentId/Number/Status/dueDate/amount/paymentMethod/provider`.
- Controller + BFF repassam `installmentId`; `adhesion.vue` manda `first.id`; `checkout` salva `paymentData.installmentId` e `payment.vue` manda.
- Central: chip ANTECIPAÇÃO + fallback "tipo a confirmar — abra o contrato" p/ alertas antigos sem kind.
- Smoke real: Carlos → Parcela 3 (antecipação) R$ 672,555 com details completos; Central renderizou selo + chip; alerta de teste apagado. jest 77/77, tsc OK.
- Docs: `notifyPaymentCheck.md` + `POST-subscription-subscriptionId-payment-check.md` (abaixo).

## Adendo 23/09 (7): nomes profissionais + o quê no contrato
- Novo `src/utils/adminLabels.ts` (fonte única, com teste `adminLabels.test.ts`): nenhum código técnico chega à tela — tipo vira "Verificação de pagamento/lance", status "Aguardando atendimento/Em andamento/Concluído", contrato "Aguardando KYC", IDs curtos (8 chars).
- Central: coluna Tipo mostra rótulo humano + selo do quê (Adesão/Parcela N/antecipação); status traduzido; filtro de tipo aceita nome humano; placeholder sem código.
- Dedupe agora É POR PARCELA (antes suprimia a 2ª parcela verificada).
- Contrato (`/admin/contracts/:id`): nova seção "O que o cliente pediu para verificar" (data/hora, o quê, valor, gateway, atendimento) + link p/ Central.
- Dashboard: PENDING_KYC/COMPLETED com rótulo (antes vazava cru no else); flash de baixa com id curto.
- Smoke: Central sem `PAYMENT_CHECK|BID_|PENDING_KYC|bid-` no HTML; contrato lista a seção. jest 13 suites 81/81, tsc OK.

## Adendo 23/09 (8): N parcelas em 1 PIX + verificação plural + baixa em lote
- Banco: `payment_batches` + `payment_attempts.batchId` (migration 20260923000002).
- `POST /api/payments/batch/pix` (`generateBatchPayment`): valida dono/tokens, adesão inclusa, soma com `calculateInstallmentValue`, idempotente por conjunto, cobra total (`batch-<uuid>`), 1 attempt por parcela. Smoke: cancelado→400, outro dono→403, vazio→400.
- Webhook `batch-` (`processBatchPaymentWebhook`): total ±5%, liquida as N em 1 tx + `BATCH_PAYMENT_CONFIRMED`.
- `payment-check` plural (`installmentIds[]` do app; BFF repassa): alerta único `Parcelas 2, 3 e 5 (com antecipação)` com `items[]`; dedupe por conjunto. Smoke real (Parcelas 2+4) OK, teste apagado.
- App: multi-select em `payments.vue` (checkboxes + barra do lote, adesão auto-inclusa) → `paymentStore.generateBatchPix` → BFF `/api/payments/batch/pix` → `checkout/payment.vue` lista o lote e verifica as N.
- Financeiro: banner de lotes ACTIVE (confirmar lote baixa as N) + checkboxes + "Baixar selecionadas" (`bulk-mark-paid`, audit `BULK_*`).
- Rótulos: `verificationKindLabel` multi ("Parcelas 2, 3 e 5", "Adesão + Parcela 2"); Central com chips por parcela; contrato detalha o lote.
- Validação: tsc OK, jest 14 suites 83/83, backend UP, telas 200.
- Docs: `generateBatchPayment.md`, `processBatchPaymentWebhook.md`, `POST-payments-batch-pix.md`, `notifyPaymentCheck.md`, `POST-subscription-subscriptionId-payment-check.md` atualizados.

## Adendo 23/09 (9): cobrança REAL + verificar como o cliente (teste vivo)
- Contrato de teste criado via API (Carlos, Honda Fan 24x, `a7d14849…` PENDING) após aprovar o KYC dele como gerente.
- Gateway real padrão é Eldorado, mas o provedor recusa tudo (`CHECKOUT_FAILURE` no primer — conta/operação, fora do código); G2G sem `G2G_CHARACTER_NAME` (pendente do operador). Failover funcionou na ordem certa.
- Cobrança de teste via sandbox (temporário, revertido): lote Adesão+Parcela 2+Parcela 4 = R$ 2.771,22 (`a333d39c…`, provider sandbox). Achado e corrigido: adapters não conheciam prefixo `batch-` (tentavam update em installment inexistente) — guard estendido nos 3 adapters.
- Request do cliente reproduzida (`payment-check` com `batchId`): alerta `Adesão, Parcela 2 e Parcela 4 (com antecipação)` com total do lote (com desconto) — captura exata confirmada na Central.
- `payment-check` aceita `batchId` (usa itens/total do lote); valores sempre 2dp na tela.
- Bug real corrigido no caminho: `updateGateway` apagava apiKey/baseUrl ao salvar parcial → update parcial + hidden `requiresManualReview=false` no form.
- Gateways restauradas ao original (Eldorado default). Contrato/lote/alerta de teste MANTIDOS p/ demonstração (Financeiro mostra o lote p/ confirmar).
- Validação: tsc OK, jest 14 suites 83/83, backend UP.

## Adendo 24/09: limpeza + sanduíche + mensagens curtas
- Fila limpa: 9 spams de teste apagados (falhas de gateway + meus payment-checks); restam os 2 da Mariana (1 OPEN real + 1 resolvido).
- Central redesenhada: linha compacta (título + cliente · grupo/cota + chips total/gateway/produto) + sanduíche `<details>` "Ver as N parcelas" (Nº, valor, vencimento, antecipação, status) — cobre 3+7 não-sequenciais.
- Mensagens de gateway sem JSON cru nem CPF (resumo 140–160 chars, técnico no log).
- Screenshot validado no dark: 1 alerta, zero códigos.
- Validação: tsc OK, jest 14 suites 83/83, backend UP.

## Adendo 24/09 (4): upload na galeria + prévia fiel ao app
- `POST /admin/products/upload` (`uploadCatalogImage` + `catalogUpload`): JPG/PNG/WebP 5MB → `zuvio-web/public/img/catalogo/<tipo>/slug-ts-rand.ext`, magic bytes, erro em JSON. CSRF global protegido p/ multipart (`req.body?` + token no header).
- Galeria (`products/form.ejs`): cada linha com miniatura 56px + selo "capa" na 1ª + input + botão de envio + remover; prévia atualiza ao enviar.
- Prévia refeita com as medidas exatas do `.offer-card` do app (card 18px, imagem 135px cover, tag DESTAQUE, nome 15px ellipsis, "Parcelas a partir de" 11px, preço 18px #FF6D00, seta) — mesmos ids JS, checklist mantido.
- Validação: upload webp 200 servido 200, .exe bloqueado em JSON, form 200, tsc OK, jest 83/83.

## Adendo 24/09 (8): upload 403 era CORS contra o próprio painel
- Log mostrava `[CORS] Blocked origin: "http://localhost:3030"` no POST /admin/products/upload: a allowlist não incluía a :3030, então TODO fetch do admin com header `csrf-token` caía (o 403 HTML vinha do errorHandler p/ CORS).
- Fix em `app.ts`: dev aceita qualquer localhost/127.0.0.1 (`/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/`) + `allowedHeaders` com `csrf-token` e `X-Admin-Token` (preflight 204).
- Validação: preflight 204, upload com Origin 200 + servido, zero "Blocked origin" no log, tsc OK, jest 83/83.
- Também: botão de verificação da galeria trocado `bi-fire` → `bi-patch-check` (fogo = popular); `toggleFlag` redireciona p/ login em 401/403 de sessão.
