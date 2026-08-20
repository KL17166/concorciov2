# Evidências da auditoria — concorciov2

Versão auditada: `cc80b3383210caf54aac81707503ad8affca5494`.

## Validações anteriores

- `npm run build`: aprovado.

- `npm test -- --runInBand`: 42 testes aprovados em 6 suítes.

- Não houve mudança em package.json/package-lock.json na atualização mais recente.

## Pontos confirmados

1. `src/domain/calculations/groupQuotaAllocator.ts`: alocação sequencial de grupo/cota; faz leitura e depois criação. O schema não possui `@@unique([groupNumber, quotaNumber])`; `schema.prisma` linhas 93-126 mostra os campos sem constraint composta. Recomendar migration, constraint única, tratamento de conflito e retry.

1. `src/application/payments/listSubscriptionPayments.ts`: regra de listagem foi retirada do controller, mas o caso de uso importa Prisma diretamente (linhas 27-42). Melhorar arquitetura com repository tipado.

1. `src/utils/errors.ts`: `AppError`/`handleApiError` foi criado. Busca de uso mostrou apenas `src/controllers/api/paymentsApiController.ts`; controllers de subscriptions, bids, KYC e admin gateway ainda retornam `error.message`/`details: error.message`.

1. `src/services/subscriptionCleanupService.ts`: serviço foi criado, mas busca fora do próprio arquivo não encontrou `SubscriptionCleanupService`, `cancelExpiredPending` ou `cancelOrphans`. Está sem job/agendamento/integração operacional.

1. `src/middlewares/requestSignatureMiddleware.ts`: assinatura HMAC e nonce estão implementados, mas busca fora do arquivo encontrou apenas comentário em config/redis.ts; não há montagem em app.ts/routes. Além disso, fallback global `katari-hmac-secret-change-in-prod` existe; nonce falha aberto quando Redis indisponível; segredo por sessão cai para o global.

1. `src/middlewares/payloadObfuscationMiddleware.ts`: middleware existe, mas busca não encontrou montagem ativa. `env.ts` ainda possui defaults perigosos para `PAYLOAD_ENCRYPTION_SECRET` (`super-secret-payload-encryption-key!`) e `ENCRYPTION_BYPASS_SECRET` (`admin-bypass-123`). Se o middleware for ativado sem corrigir defaults, a proteção fica previsível.

1. `src/app.ts`: monta helmet, permissions policy, CORS, body parsers, rate limits, session, webhooks, securityMiddleware, routes/admin/static/error. Não importa requestSignatureMiddleware, payloadObfuscationMiddleware, wafMiddleware, antiScrapingMiddleware ou csrf global. Webhooks são montados antes de securityMiddleware (`app.ts` 147-151), intencionalmente, mas exigem proteção própria.

1. `src/routes/admin/index.ts`: CSRF parece aplicado ao router admin via `generateToken`/`validateToken`; não é proteção para API JWT, o que é esperado, mas deve ser auditado em todas as mutações admin.

1. `src/middlewares/authMiddleware.ts`: JWT é verificado com HS256. Blacklist JTI em Redis falha aberto quando Redis indisponível (linhas 65-70), permitindo token revogado durante outage. `authorize` usa strings de role e devolve o perfil do usuário na mensagem 403.

1. `src/config/env.ts`: JWT_SECRET e SESSION_SECRET exigem 32 chars; PIXGO_WEBHOOK_SECRET é exigido em produção. Porém PAYLOAD_ENCRYPTION_SECRET possui default previsível e ENCRYPTION_BYPASS_SECRET possui default previsível. REQUEST_SIGNING_SECRET é opcional no schema apesar da intenção de ser obrigatório em produção; middleware faz fail-fast apenas se for montado/importado.

1. `src/config/session.ts`: RedisStore é opcional e cai para sessão em memória quando Redis não existe. Em produção/múltiplas instâncias, isso quebra persistência e invalidação coerente. Cookies são httpOnly, secure em produção, sameSite strict, com `__Host-` em produção; faltam garantias explícitas de Redis obrigatório em produção e rotação/regeneração na autenticação admin.

1. `src/routes/webhookRoutes.ts`: webhooks fazem autenticação e idempotência, mas concentram lógica financeira na rota, usam Prisma direto, `console.*`, tratamento de erro específico e providers com padrões diferentes. PixGo aceita timestamp opcional: só valida replay temporal se o header existir. Se o secret estiver ausente, o fluxo rejeita assinatura ausente, mas a configuração deveria falhar antes em produção. SigiloPay usa replay key hash de `provider:reference:status`; eventos distintos com mesma referência/status são tratados como replay. O log é criado antes de `markInstallmentAsPaid`; qualquer falha transitória após o log pode impedir retry legítimo. Em falha de liquidação, retorna 200 para evitar retry, podendo perder confirmação.

1. `src/middlewares/uploadMiddleware.ts` e `authController.ts`: documentos KYC são gravados em `public/uploads/documents/<userId>` e `app.ts` serve `public` estaticamente. URLs dos documentos são persistidas e retornadas. Isso pode expor documentos pessoais por URL se descoberta. A validação atual confere extensão e MIME declarados, mas não inspeciona magic bytes/conteúdo real. Recomendar armazenamento privado, download autenticado e validação por assinatura de arquivo.

1. `src/controllers/api/authController.ts`: login retorna `signingSecret` e `payloadSecret` ao cliente, aparentemente necessário para o app; Redis indisponível gera fallback silencioso para segredos estáticos. O registro responde 409 diferenciando usuário existente, permitindo enumeração de CPF/email. Login usa mensagens iguais para credenciais inválidas, o que é positivo. Há auditoria de login/registro.

1. `src/security/password.ts`: usa Argon2id + PEPPER, mas `const PEPPER = process.env.PASSWORD_PEPPER` pode ser undefined; concatenar `undefined` vira texto literal e não impede inicialização. Deve ser obrigatório em produção, com rotação planejada.

1. Scripts perigosos/sensíveis encontrados: `seedDevUsers.ts` usa senha default `123456` e emails `@katari.com.br`; `createTestClient.ts` tem credenciais fixas; `debugUser.ts` lista CPF/email e reseta senha para valor fixo, imprimindo a senha; `getTokens.ts` imprime tokens; `securityTest.ts` cria usuários e imprime tokens. Esses scripts devem ser isolados fora do build de produção, protegidos por confirmação de ambiente e removidos/anonimizados.

1. `src/config/roles.ts` centraliza constantes, mas `User.role` no Prisma é String e status/kyc/payment também são strings. Recomendar enums Prisma ou validação central, especialmente para ações financeiras e admin.

1. `schema.prisma`: `User.address`, `Product.imageUrls`, `Product.specs` e AuditLog.details são JSON armazenado em String, sem schema/constraint. GatewayConfig armazena apiKey/apiSecret/webhookSecret em texto no banco. Recomendar criptografia em repouso/aplicação, controle de acesso e mascaramento em logs/admin.

1. `src/app.ts`: health check `/health` retorna uptime e métricas de memória publicamente e consulta banco. Pode auxiliar fingerprinting/DoS; separar liveness de readiness e proteger detalhes em produção.

1. `src/app.ts`: logger de requisições usa `req.url` completo. Verificar se query strings podem conter tokens, CPF, dados pessoais ou secrets; sanitizar URL antes de logar.

1. Upload usa `Math.random( )` apenas para nome de arquivo (não é alocação de cota), mas deve preferir `crypto.randomUUID()`/randomBytes. IDs de usuário em caminho podem permitir inferência se UUID não for segredo; autorização deve ser obrigatória no download.

1. A atualização mantém muitos `any` em controllers, repositories, securityMiddleware, schemas/DTOs. Isso enfraquece contratos em fluxo de dinheiro, pagamentos e dados pessoais. Priorizar pagamentos, contratos, webhooks e admin.

1. `src/routes/api/subscriptionsRoutes.ts` usa `getSingleSubscription` com `authenticate`, mas deve confirmar ownership no próprio use case/route; rotas com IDs de contrato precisam ser auditadas contra IDOR mesmo quando existe middleware de ownership para outras rotas.

1. `src/routes/webhookRoutes.ts` grava payload parcial em WebhookLog; é útil para auditoria, mas pode conter dados pessoais. Definir retenção, mascaramento e acesso restrito.

## Ordem recomendada

P0: retirar documentos KYC da árvore pública; tornar segredos de produção obrigatórios; adicionar constraint de grupo/cota; corrigir idempotência e retry dos webhooks; aplicar error mapper global; decidir fail-open/fail-closed para Redis em autenticação e assinatura; revisar scripts de credenciais.

P1: conectar cleanup a job idempotente; extrair webhooks para controllers/use cases; repository de pagamentos; enums/validação de status e roles; testes de concorrência, webhook duplicado/falha transitória, IDOR e upload de arquivo poliglota.

P2: observabilidade, retenção de logs/payloads, health endpoints separados, remoção de shims/legado, eliminação progressiva de any, documentação operacional e rotação de segredos.

