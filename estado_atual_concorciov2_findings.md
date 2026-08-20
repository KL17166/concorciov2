# Estado atual do concorciov2 — achados de revisão

Versão atual verificada: `9530679cbb6c9eaf83058d243e245174254e084e`.
Versão anterior preservada para comparação: `cc80b3383210caf54aac81707503ad8affca5494`.

## Validação

- `npm run build`: aprovado.
- `npm test -- --runInBand`: 7 suítes e 54 testes aprovados.
- Dependências não mudaram nesta atualização, segundo o diff entre os commits.

## Correções que foram realmente aplicadas

1. KYC: `uploadMiddleware.ts` agora usa `storage/kyc/<userId>` fora de `public`; `app.ts` bloqueia acessos diretos aos caminhos antigos; `kycApiController.ts` tem endpoint autenticado com ownership/admin e defesa contra path traversal; `authController.ts` persiste URL `/api/kyc/documents/...`.
2. Magic bytes: foi criado `security/magicBytes.ts` e um middleware `verifyUploadedMagicBytes`.
3. Webhooks: a baixa financeira saiu da rota para `application/payments/processPaymentWebhook.ts`; falha de liquidação retorna 500; há validação de underpayment e testes de replay/erro transitório.
4. Liquidação: `markInstallmentAsPaid` usa transação serializável, relê o estado dentro da transação, impede pagamento de contrato cancelado, exige parcelas anteriores pagas e atualiza parcela/saldo/estado atomicamente.
5. Grupo/cota: `createSubscription.ts` usa transação serializável e retry de até 3 vezes; ainda depende da proteção do banco.
6. Limpeza: `subscriptionCleanupJob.ts` foi conectado ao `server.ts`, com intervalo e parada no shutdown.
7. Erros: `errors.ts` agora tem `requestId`, códigos padronizados e mensagens públicas mais seguras; vários controllers foram migrados.
8. Scripts: `guard.ts` impede execução quando não é desenvolvimento ou `ALLOW_DEV_SCRIPTS=true`, e os scripts atualizados usam o guard.
9. Health: `livez` e `readyz` foram adicionados; memória não é devolvida em produção no `/health`.
10. Logs: URL do request tem redaction de token/secret/password/cpf/key/apiKey.

## Pendências ainda confirmadas

1. Schema não possui `@@unique([groupNumber, quotaNumber])`; há apenas `@@index` em `Subscription`.
2. `WebhookLog` ainda tem apenas `signature @unique`, sem `providerEventId`, estado de processamento, tentativas, erro e chave única provider/event.
3. `processPaymentWebhook.ts` grava o `WebhookLog` depois da liquidação e fora da mesma transação; uma baixa confirmada pode ocorrer sem log de auditoria, e o log não protege perfeitamente o check-then-set concorrente.
4. PixGo só valida timestamp se o header existir. A rota usa a própria assinatura como `eventSignature`; não há ID de evento específico.
5. SigiloPay usa hash de `sigilopay:reference:status`; eventos diferentes com mesma referência/status podem colidir.
6. `requestSignatureMiddleware`, `payloadObfuscationMiddleware`, `wafMiddleware` e `antiScrapingMiddleware` não aparecem montados em `app.ts`, routes ou server. Proteções não conectadas não têm efeito.
7. `requestSignatureMiddleware.ts` ainda possui fallback `katari-hmac-secret-change-in-prod`; `env.ts` mantém defaults de desenvolvimento para payload e bypass, e `REDIS_URL` defaulta localhost. Em produção, a exigência de Redis/session store persistente ainda não está garantida no schema.
8. `verifyUploadedMagicBytes` existe, mas `routes/authRoutes.ts` monta `/upload` como `authenticate, upload.single('file'), uploadDocument` e não inclui `verifyUploadedMagicBytes`. Portanto a validação magic-byte não está aplicada ao upload real.
9. `authController.ts` mantém sidecars KYC no diretório de upload e faz `pushToKycStorage` fire-and-forget; a persistência local pode concluir sem confirmação da cópia externa. O endpoint de documento mantém fallback para `public/uploads/documents` legado.
10. `GatewayConfig` guarda apiKey/apiSecret/webhookSecret em texto no banco.
11. Scripts continuam imprimindo dados sensíveis e credenciais: `getTokens.ts` imprime CPF/ID/token e salva `test_tokens.json`; `seedDevUsers.ts` mantém senha 123456 e imprime a senha; `createGabriella.ts` e `createTestClient.ts` imprimem email/senha/CPF; `debugUser.ts` imprime CPF/email e redefine senha fixa. O guard reduz execução acidental, mas não corrige exposição.
12. `contractsController.ts` ainda usa `req.flash('error_msg', error.message ...)`; logs de gateways imprimem mensagens/respostas de erro, exigindo redaction e padronização.
13. `authRoutes.ts` upload retorna ao cliente a URL do documento; isso é aceitável apenas como identificador privado, mas o download deve continuar autenticado e URLs não devem ser tratados como tokens.
14. `Subscription`, `Installment`, `Bid`, `User.role` e outros estados continuam strings livres; JSON permanece armazenado como String.
15. Cleanup é timer dentro do processo web; `isJobRunning` só evita sobreposição na mesma instância. Não há lock distribuído.
16. `processPaymentWebhook` e `getKycDocument` usam `any`/acesso Prisma direto em alguns pontos; a arquitetura melhorou mas ainda não está totalmente separada.
17. `app.ts` serve `public` estaticamente, embora bloqueie os caminhos antigos de documentos; a migração/remoção definitiva de arquivos legados ainda é necessária.

## Prioridade revisada

P0: constraint grupo/cota; idempotência e log de webhook em transação/por evento; exigência real de Redis e secrets; conectar magic bytes ao upload e remover fallback público/legado; proteger/rotacionar credenciais de gateway.

P1: job distribuído; remover sidecars públicos/garantir storage durável; padronizar todos os controllers e logs; limpar scripts sensíveis; completar separação de repositories e tipagem.

P2: enums/JSON tipados, remoção de shims, métricas, retenção e documentação operacional.

## Referências de código

- https://github.com/KL17166/concorciov2/blob/9530679cbb6c9eaf83058d243e245174254e084e/server-consorcio/src/app.ts
- https://github.com/KL17166/concorciov2/blob/9530679cbb6c9eaf83058d243e245174254e084e/server-consorcio/src/middlewares/uploadMiddleware.ts
- https://github.com/KL17166/concorciov2/blob/9530679cbb6c9eaf83058d243e245174254e084e/server-consorcio/src/routes/authRoutes.ts
- https://github.com/KL17166/concorciov2/blob/9530679cbb6c9eaf83058d243e245174254e084e/server-consorcio/src/controllers/api/kycApiController.ts
- https://github.com/KL17166/concorciov2/blob/9530679c6b9eaf83058d243e245174254e084e/server-consorcio/src/routes/webhookRoutes.ts
- https://github.com/KL17166/concorciov2/blob/9530679cbb6c9eaf83058d243e245174254e084e/server-consorcio/src/application/payments/processPaymentWebhook.ts
- https://github.com/KL17166/concorciov2/blob/9530679cbb6c9eaf83058d243e245174254e084e/server-consorcio/prisma/schema.prisma
- https://github.com/KL17166/concorciov2/blob/9530679cbb6c9eaf83058d243e245174254e084e/server-consorcio/src/config/env.ts
- https://github.com/KL17166/concorciov2/blob/9530679cbb6c9eaf83058d243e245174254e084e/server-consorcio/src/server.ts
- https://github.com/KL17166/concorciov2/blob/9530679cbb6c9eaf83058d243e245174254e084e/server-consorcio/src/scripts/guard.ts
