# PLANO DE EXPANSÃO DO RASTREAMENTO
Estado atual: pixel autenticado em 13 telas + 3 pagamentos com productId, funil + por-tela + curva diária + top entidades no `/admin/tracking`, algoritmo online (`learning_weights`) e recomendações. Sem mudar schema (só `metadata.*` e novos eventos do enum).

## F1 — Atribuição de ads (UTM, próximo)
Capturar `utm_source/medium/campaign` do primeiro `route.query` da sessão e enviar em
`metadata` do primeiro `SCREEN_VIEW` (frontend guarda em `sessionStorage`, anexa 1x).
Dashboard: nova coluna "origem" (groupBy via parse do metadata em JS, como top produtos).
Custo: só front + agregação. Valor: ROAS por campanha até o "já paguei".

## F2 — Pixel anônimo pré-login (topo do funil)
`welcome`/`auth` hoje não emitem (endpoint exige JWT). Criar `POST /api/track-anon`
com fingerprint assinado (HMAC server-side via BFF, rate-limit IP duro, sem userId,
tabela separada ou `userId=null` + flag). Valor: funil completo visitante→cadastro→pagamento.

## F3 — Outcomes server-side fechando o loop
Webhooks (`PAID` real) e confirmações manuais (`confirmBidPayment`, `updatePayment`)
chamam `learnFromEvent` com `OUTCOME_PAID` (novo evento, sem user-action).
Hoje o algoritmo aprende de cliques; com outcomes ele aprende de dinheiro.

## F4 — Segmentos e propensão
Pesos por segmento: `seg:{hour|dow|category|device}:...` (hora, dia, categoria do produto,
mobile/desktop via UA). `getRecommendations` soma o segmento ativo. Valor: "melhor hora
de cutucar" + ordenação por contexto, não só histórico.

## F5 — Nudges automáticos (job)
Job 15min: QR gerado sem `VERIFY` em 20min → `Notification` ("seu PIX expira em X");
afinidade alta sem lance em 7d → oferta do produto. Base (`notifications`) já existe;
falta o job + regras + cooldown por usuário.

## F6 — Export + retenção (LGPD)
`GET /admin/tracking/export?days=` (CSV, `reports.view`); retenção: raw 90d
(job de purge como `webhook_logs`), agregados mantidos; documentar no RoPA.

## F7 — A/B testing do ranking
`recOrder` com variantes (coorte por hash do userId, `explore` 15% vs 30% vs 0%),
conversão por coorte no dashboard. Sem isso, mudanças no algoritmo são chute.

Ordem sugerida: F1 → F3 → F5 → F2 → F6 → F4 → F7.
