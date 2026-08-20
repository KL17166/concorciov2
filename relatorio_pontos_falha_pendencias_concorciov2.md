# Relatório técnico de pontos de falha e pendências

## Backend do projeto de consórcios — concorciov2

**Versão auditada:** `cc80b3383210caf54aac81707503ad8affca5494`  
**Escopo:** auditoria estática do backend Node.js/TypeScript/Express/Prisma, com foco em segurança, integridade financeira, autorização, proteção de dados, arquitetura e operação.  
**Validação já realizada:** o build TypeScript foi aprovado e a suíte existente registrou **42 testes aprovados em 6 suítes**. Isso confirma que o código compila e que os comportamentos cobertos pelos testes atuais permanecem funcionando, mas não comprova segurança de produção, concorrência, integração real com gateways ou proteção de dados pessoais.

> **Conclusão executiva:** a nova versão evoluiu estruturalmente, mas ainda não deve ser considerada pronta para produção financeira. Existem cinco grupos de prioridade P0: exposição potencial de documentos KYC, inconsistência de webhooks de pagamento, colisão concorrente de grupo/cota, segredos e controles de segurança com fallback inseguro ou não conectados, e scripts operacionais com credenciais/dados sensíveis. Os demais itens são P1 ou P2 e devem ser tratados antes da abertura comercial ampla.

---

## 1. Como interpretar as prioridades

A classificação abaixo considera não apenas a probabilidade de ocorrer um problema, mas principalmente o impacto sobre dinheiro, identidade, privacidade, autorização e continuidade operacional.

| Prioridade | Critério | Decisão recomendada |
|---|---|---|
| **P0 — bloqueia produção** | Pode expor KYC, confirmar pagamento incorretamente, permitir inconsistência financeira ou tornar uma proteção previsível. | Corrigir antes de aceitar clientes ou pagamentos reais. |
| **P1 — alta** | Pode gerar falhas operacionais, dificultar auditoria, vazar detalhes internos ou deixar a arquitetura parcialmente inconsistente. | Corrigir antes do lançamento comercial estável. |
| **P2 — média** | Dívida técnica, observabilidade, tipagem, documentação ou melhorias de manutenção sem evidência de exploração imediata. | Planejar para o próximo ciclo. |

---

## 2. Pontos positivos que devem ser preservados

A auditoria não encontrou apenas problemas. O projeto já possui uma base útil: autenticação JWT com algoritmo restrito a HS256, Argon2id para senhas, rate limits separados por fluxo, proteção CSRF no router administrativo, controle de ownership em vários endpoints, casos de uso para contratos e pagamentos, tratamento centralizado de erros em parte da API e testes automatizados. O detalhe de contrato também verifica o `userId` do token antes de retornar os dados, o que reduz o risco de IDOR nesse caminho específico [17] [18].

A recomendação é corrigir as fronteiras sem desfazer essa evolução. Em particular, não é necessário voltar a um grande controller ou concentrar tudo em um único arquivo. O próximo passo deve ser completar a migração para casos de uso, repositories, adaptadores de gateway e políticas de autorização.

| Componente | Situação atual | Decisão |
|---|---|---|
| `paymentsApiController.ts` | É o melhor exemplo de controller fino e usa `handleApiError`. | Usar como padrão para os demais controllers. |
| `admin/index.ts` | O CSRF administrativo está conectado ao router. | Preservar e ampliar os testes de todas as mutações. |
| `getSubscriptionDetails.ts` | Recebe o usuário solicitante e valida propriedade. | Manter a autorização também dentro do caso de uso. |
| `groupQuotaAllocator.ts` | Já substituiu o uso de aleatoriedade por sequência determinística. | Completar com constraint única e retry transacional. |

---

# 3. Falhas P0 — corrigir antes de produção

## P0.1 — Documentos KYC ficam dentro da árvore pública

### Evidência e localização

O middleware de upload cria os arquivos em `public/uploads/documents/<userId>` [2]. O controller persiste e devolve URLs como `/public/uploads/documents/<userId>/<arquivo>` [3]. O bootstrap serve a pasta `public` como conteúdo estático [1]. Portanto, qualquer arquivo nessa árvore pode ser entregue sem que o servidor verifique se o solicitante é o próprio cliente ou um administrador autorizado.

Além da imagem ou PDF principal, o fluxo de KYC grava sidecars como `kyc-facial-result.json` e `kyc-biographical-result.json` na mesma pasta pública. Esses JSONs podem conter respostas de validação, motivos de reprovação e dados de auditoria. Isso amplia o risco além do documento visual.

### Impacto

Trata-se de possível exposição de documentos de identidade, selfie, CPF, dados biométricos e resultados de validação. Um vazamento desse tipo pode gerar fraude, dano ao cliente, incidente de privacidade e obrigação de resposta a incidente. O fato de o nome do arquivo ser aleatório não é controle de acesso.

### Como corrigir

1. Remover `public/uploads` do caminho de armazenamento. Criar, por exemplo, `private-storage/kyc/<userId>/` fora da raiz servida por `express.static`.
2. Parar de persistir uma URL pública. Armazenar apenas `storageKey`, tipo de documento, hash, tamanho, MIME validado e timestamps.
3. Criar `GET /api/kyc/documents/:documentId` protegido por `authenticate`, com autorização de proprietário ou papel administrativo. O controller deve buscar o documento pelo ID e fazer a autorização antes de abrir o arquivo.
4. Para administradores, aplicar `requireRoles(['MASTER', 'MANAGER', 'SUPPORT'])` conforme a função. Para clientes, permitir apenas os próprios documentos.
5. Se for usado S3 ou armazenamento compatível, gerar URL assinada com validade curta, sem tornar o objeto público. Se for armazenamento local, usar `res.sendFile` somente depois de resolver o caminho a partir de um identificador persistido, nunca concatenando diretamente um caminho recebido do usuário.
6. Validar conteúdo real por magic bytes. A extensão e o MIME declarado pelo cliente não bastam. Usar uma biblioteca de detecção de tipo, rejeitar arquivos cujo conteúdo não corresponda ao tipo permitido e considerar antivírus para documentos.
7. Mover os sidecars para uma tabela ou bucket privado de auditoria. Criptografar ou mascarar respostas que contenham dados pessoais e definir retenção.
8. Fazer migração dos arquivos existentes: copiar para o armazenamento privado, atualizar referências e invalidar as URLs antigas. Só depois remover a rota pública.

### Testes de aceite

Um cliente A não deve conseguir baixar documento do cliente B trocando o ID. Uma requisição sem JWT deve receber 401. Um usuário comum tentando o endpoint administrativo deve receber 403. Uma URL antiga `/public/uploads/...` deve deixar de retornar o documento. Um arquivo PDF renomeado para `.png` deve ser rejeitado.

---

## P0.2 — Webhooks de pagamento ainda podem perder confirmações ou aceitar eventos inadequados

### Evidência e localização

Os webhooks PixGo e SigiloPay continuam concentrando autenticação, idempotência, consulta Prisma e mutação financeira dentro de `src/routes/webhookRoutes.ts` [5]. Há diferenças entre os providers: o timestamp do PixGo é validado somente quando o header existe; SigiloPay usa como chave de replay o hash de `provider + reference + status`; e o evento é gravado antes da liquidação.

Quando `markInstallmentAsPaid` retorna falha, os handlers respondem 200 para impedir novos retries. Esse comportamento pode transformar uma falha transitória de banco, gateway ou serviço em confirmação perdida. Além disso, a chave `reference + status` pode tratar dois eventos legítimos com a mesma referência e status como duplicados, caso o provedor envie eventos distintos para o mesmo pagamento.

### Impacto

O sistema pode deixar uma parcela sem baixa depois de o cliente pagar, ou registrar um evento como processado antes de concluir a mutação. Em ambos os casos, o painel, o saldo, o status do contrato e a comunicação com o cliente podem ficar incorretos. Como é um fluxo financeiro, não basta o endpoint responder 200: é necessário comprovar processamento idempotente e auditável.

### Como corrigir

1. Criar um modelo de evento de webhook com campos como `provider`, `providerEventId`, `signature`, `status`, `attempts`, `receivedAt`, `processedAt`, `lastError` e `payloadHash`.
2. Adicionar uma constraint única em `provider + providerEventId`. Se algum provedor não fornecer ID de evento, usar uma chave composta com os campos oficialmente garantidos pelo provedor, não apenas referência e status.
3. Tornar timestamp obrigatório quando o provider o suporta. Rejeitar timestamp ausente, inválido ou fora da tolerância.
4. Validar schema do payload, identificador da parcela, valor, moeda, status e referência do gateway antes de alterar a parcela. O valor confirmado deve ser comparado ao valor esperado, admitindo apenas regras de tolerância explicitamente documentadas.
5. Separar o fluxo em adaptadores: `PixGoWebhookAdapter` e `SigiloPayWebhookAdapter`. Cada adaptador valida seu protocolo e devolve um DTO comum, como `PaymentWebhookEvent`.
6. Criar um caso de uso `ProcessPaymentWebhook`. Ele deve abrir uma transação, registrar ou reservar o evento, localizar a parcela, verificar o estado atual e chamar o serviço de liquidação idempotente.
7. Diferenciar resultados: evento já processado ou parcela já paga pode retornar 200; erro transitório deve retornar 5xx para permitir retry; payload inválido deve retornar 4xx; falha de configuração deve impedir o processamento e gerar alerta.
8. Só marcar o evento como `PROCESSED` depois de a mutação financeira estar confirmada. Em falha, guardar `FAILED` e permitir reprocessamento controlado.
9. Trocar `console.log` e `console.error` por logger estruturado, com máscara de CPF, tokens, payloads e segredos.

### Testes de aceite

O mesmo evento enviado dez vezes deve gerar uma única baixa. Um evento duplicado após sucesso deve retornar 200 sem nova mutação. Um erro de banco simulado deve retornar 5xx e permitir retry. Um evento de valor diferente deve ser rejeitado. Dois eventos distintos da mesma parcela devem obedecer a uma política explícita de estado, sem dupla liquidação.

---

## P0.3 — Grupo e cota ainda podem colidir sob concorrência

### Evidência e localização

O alocador sequencial consulta o último grupo, conta cotas e calcula o próximo número em memória [6]. O schema Prisma não possui constraint composta em `Subscription` para `groupNumber + quotaNumber` [4]. Duas transações concorrentes podem ler o mesmo estado e retornar a mesma combinação antes que qualquer uma grave.

O comentário do alocador afirma que a alocação é atômica, mas o código não contém lock, isolamento serializável, constraint única ou retry de conflito. O algoritmo ficou melhor do que `Math.random()`, mas ainda não garante unicidade em concorrência real.

### Como corrigir

No schema, adicionar:

```prisma
model Subscription {
  // campos existentes...
  groupNumber String
  quotaNumber String

  @@unique([groupNumber, quotaNumber], name: "subscription_group_quota_unique")
}
```

Depois gerar uma migration. Antes de aplicá-la, detectar e resolver duplicidades existentes. No caso de uso de criação, executar alocação e criação dentro de uma transação com isolamento apropriado. Capturar o erro Prisma `P2002`, refazer a alocação e tentar novamente um número limitado de vezes.

A correção deve ficar em `createSubscription.ts` e `groupQuotaAllocator.ts`, não apenas no controller. O banco é a autoridade final; a lógica TypeScript apenas escolhe um candidato.

### Testes de aceite

Disparar 50 criações simultâneas para o mesmo plano e confirmar que nenhuma combinação se repete. Executar o teste em PostgreSQL real, não apenas em mock. Testar também o caminho de grupo/cota informado manualmente pelo administrador.

---

## P0.4 — Controles de assinatura e criptografia existem, mas não estão conectados

### Evidência e localização

`requestSignatureMiddleware.ts` implementa HMAC, timestamp e nonce, mas a busca no código ativo não encontrou sua montagem no bootstrap ou nos routers [13]. O mesmo ocorre com `payloadObfuscationMiddleware.ts`. O `app.ts` monta Helmet, CORS, rate limits, sessões, webhooks, `securityMiddleware`, rotas e arquivos estáticos, mas não importa esses dois middlewares [1].

Há ainda fallbacks previsíveis em `env.ts`: `PAYLOAD_ENCRYPTION_SECRET` possui valor padrão conhecido e `ENCRYPTION_BYPASS_SECRET` possui valor padrão administrativo previsível [11]. O middleware de assinatura também contém o fallback `katari-hmac-secret-change-in-prod` [13].

### Impacto

Uma proteção que não está montada não protege a rota. Um fallback conhecido transforma uma camada criptográfica em uma senha pública. Além disso, se o middleware for montado em `app.use('/api', ...)` sem ajustar o uso de `req.path`, a checagem pode não funcionar como esperado porque o Express remove o prefixo montado de `req.path`.

### Como corrigir

Há duas opções válidas, e o projeto deve escolher uma conscientemente:

**Opção A — remover o código não utilizado.** Se o app não precisa de assinatura HMAC ou obfuscação de payload, remover os middlewares, os comentários de integração Flutter e as variáveis correspondentes. Isso reduz superfície e evita falsa sensação de segurança.

**Opção B — ativar e testar de ponta a ponta.** Nesse caso:

1. Tornar `REQUEST_SIGNING_SECRET`, `PAYLOAD_ENCRYPTION_SECRET` e qualquer bypass obrigatório em produção, sem defaults.
2. Montar o middleware no nível do app, depois do body parser e antes das rotas, ou alterar a implementação para usar `req.originalUrl`.
3. Aplicar assinatura apenas aos endpoints compatíveis com o cliente oficial, documentando como login e registro serão assinados.
4. Em endpoints de mutação, falhar fechado se Redis estiver indisponível, pois sem Redis não há garantia de nonce único. Para rotas públicas de leitura, aplicar política separada.
5. Não usar simultaneamente HMAC, AES, WAF e regras próprias sem testes de compatibilidade. Escolher uma cadeia simples e documentada.
6. Criar testes com requisição válida, timestamp expirado, nonce repetido, corpo alterado e Redis indisponível.

---

## P0.5 — Fallbacks de Redis e segredos podem invalidar logout e sessão

O middleware JWT consulta blacklist no Redis e, quando o Redis falha, permite a requisição [10]. Isso preserva disponibilidade, mas significa que um token revogado pode continuar funcionando durante a indisponibilidade. A configuração de sessão também permite fallback para memória quando não há Redis [12]. Em múltiplas instâncias, uma sessão pode existir em um processo e desaparecer em outro.

O `PASSWORD_PEPPER` também não é validado como obrigatório em produção [15]. Se estiver ausente, a concatenação transforma o valor em comportamento implícito e o processo pode iniciar sem a proteção pretendida.

### Como corrigir

Em produção, exigir Redis quando a arquitetura depende de sessão, blacklist, nonce ou chaves por sessão. O `env.ts` deve validar `REDIS_URL`, `PASSWORD_PEPPER`, `REQUEST_SIGNING_SECRET` e demais segredos críticos conforme `NODE_ENV`. O `session.ts` deve falhar na inicialização se estiver em produção sem store persistente.

Para tokens, adotar uma política explícita: ou a blacklist falha fechado nos endpoints sensíveis, ou o sistema usa access tokens curtos com refresh tokens rotativos e revogação server-side. Não deixar o comportamento como decisão implícita dentro de um `catch`.

Rotacionar segredos exige plano: aceitar secret antigo apenas durante uma janela controlada, emitir tokens com a versão nova, invalidar sessões antigas e registrar a operação.

---

# 4. Falhas P1 — corrigir antes do lançamento estável

## P1.1 — Tratamento de erros ainda é inconsistente

`errors.ts` já oferece `AppError` e `handleApiError` [8], e pagamentos adotou esse padrão. Contudo, `subscriptionsApiController.ts` ainda devolve `error.message` diretamente em listagem, detalhe, criação e cancelamento [9]. Controllers administrativos e outros fluxos seguem padrões diferentes.

### Risco

Mensagens internas podem revelar detalhes de banco, gateway ou regras de negócio. A resposta também fica inconsistente para o aplicativo: algumas rotas usam `error`, outras `message`, outras incluem detalhes internos.

### Correção

Migrar todos os controllers para o padrão abaixo:

```ts
try {
  const result = await useCase.execute(input);
  return res.status(200).json(result);
} catch (error) {
  return handleApiError(res, error, 'Não foi possível concluir a operação');
}
```

Os casos de uso devem lançar `AppError` com `code`, `statusCode` e `isPublic`. O mapper deve esconder mensagens de erro 5xx em produção. Criar testes que garantam que `DATABASE_URL`, stack trace, SQL, token e credenciais nunca apareçam na resposta.

---

## P1.2 — Webhook e persistência ainda estão acoplados à camada HTTP

Mesmo após a refatoração, `webhookRoutes.ts` acessa Prisma, interpreta payload, grava log e altera parcela. `listSubscriptionPayments.ts` já é um caso de uso, mas ainda consulta Prisma diretamente e mistura ownership, cálculo e mapeamento de resposta [7].

### Correção

Criar interfaces de repository, por exemplo `SubscriptionRepository` e `InstallmentRepository`, e concentrar acesso Prisma em `infrastructure/repositories`. O caso de uso deve receber dependências ou importar um adapter único; o controller deve apenas traduzir HTTP para DTO.

Para webhooks, usar o fluxo `adapter -> controller -> ProcessPaymentWebhook -> payment service -> repositories`. Assim, o mesmo caso de uso pode ser testado sem Express e sem gateway real.

---

## P1.3 — Serviço de limpeza foi criado, mas não está operacional

`SubscriptionCleanupService` oferece `cancelExpiredPending` e `cancelOrphans`, mas a busca no código não encontrou um job ou scheduler que o invoque [14]. Um serviço sem chamada real não corrige contratos pendentes ou órfãos.

### Correção

Criar um job idempotente, por exemplo `src/jobs/subscriptionCleanupJob.ts`, executado por cron externo, worker ou scheduler confiável. O job deve:

1. adquirir lock distribuído para impedir execução duplicada;
2. buscar lotes pequenos de contratos elegíveis;
3. cancelar em transação, registrando motivo e timestamp;
4. emitir métricas e alertas;
5. repetir falhas transitórias sem duplicar efeitos;
6. possuir comando manual `dry-run` e execução limitada por ambiente.

Não depender de um `setInterval` dentro do processo web se houver mais de uma instância.

---

## P1.4 — GatewayConfig armazena segredos em texto e há dados sensíveis em logs

O schema guarda `apiKey`, `apiSecret` e `webhookSecret` diretamente em `GatewayConfig` [4]. O bootstrap registra a URL completa da requisição [1], e os webhooks usam `console` com referências e mensagens de falha [5]. Scripts de diagnóstico imprimem CPF, email, senha ou token.

### Correção

Criptografar segredos na aplicação antes de persistir, usando uma chave fora do banco, ou mover credenciais para um secret manager. A leitura deve descriptografar somente no adapter do gateway. Nunca devolver segredos em listagens administrativas.

Criar logger estruturado com redaction para `authorization`, `cookie`, `x-*signature`, CPF, email, payload de webhook, query string e dados KYC. Definir retenção de logs e de `WebhookLog.payload`; guardar o mínimo necessário para auditoria.

---

## P1.5 — Scripts de desenvolvimento contêm credenciais e operações destrutivas

`seedDevUsers.ts` cria usuários com senha padrão `123456`; `debugUser.ts` lista dados pessoais e redefine senha; `getTokens.ts` imprime JWTs; scripts de teste criam usuários, tokens e dados previsíveis [16]. Mesmo que não sejam rotas, eles podem ser executados acidentalmente em um ambiente conectado ao banco real.

### Correção

Mover esses arquivos para uma área de desenvolvimento não incluída no build. Exigir simultaneamente `NODE_ENV=development`, `ALLOW_DEV_SCRIPTS=1` e confirmação explícita. Substituir senhas fixas por valores informados via variável de ambiente, nunca imprimir senha ou token e anonimizar dados. Scripts destrutivos devem exigir `--confirm-production-data-will-be-deleted` e, idealmente, nunca aceitar produção.

Adicionar um teste CI que falhe se aparecerem padrões como `123456`, `password =`, CPF real, `jwt.sign` com `console.log` ou domínio de teste em código de produção.

---

## P1.6 — Tipos e estados de negócio ainda são strings livres

`User.role`, `Subscription.status`, `Installment.status`, `Bid.status`, `Product.type` e `kycStatus` são strings no schema [4]. Isso permite gravar valores inválidos e espalha literais pelo código. Campos JSON também são armazenados como `String`, sem validação estrutural.

### Correção

Introduzir enums Prisma para roles e estados estáveis, ou uma camada de value objects se houver necessidade de compatibilidade. Para JSON, usar `Json` do Prisma quando apropriado e validar com Zod na borda. Criar migrations de limpeza antes de transformar os campos. Centralizar transições permitidas, por exemplo, `PENDING -> PAID`, sem permitir `CANCELLED -> PAID` fora de um fluxo de estorno documentado.

---

## P1.7 — Upload valida extensão e MIME declarado, mas não o conteúdo

`uploadMiddleware.ts` bloqueia extensões perigosas, verifica MIME e extensão, e limita tamanho a 5 MB [2]. Isso é positivo, porém o MIME é fornecido pelo cliente e pode ser falsificado. Para KYC, essa proteção é insuficiente como única barreira.

### Correção

Inspecionar magic bytes, decodificar imagens e reencodá-las para remover payloads embutidos, validar PDF com parser seguro, eliminar metadados quando possível e executar antivírus. Definir limites de dimensão e quantidade de páginas. Armazenar fora do web root e servir somente via autorização.

---

# 5. Pontos P2 de arquitetura e operação

## P2.1 — Health check expõe detalhes operacionais

`/health` retorna uptime, RSS, heap e estado do banco [1]. Para monitoramento interno isso é útil, mas expor métricas de memória e disponibilidade do banco publicamente auxilia fingerprinting e pode ser usado para gerar carga.

Separar `GET /livez`, que apenas confirma que o processo está vivo, de `GET /readyz`, que verifica dependências e deve ser restrito à rede de infraestrutura. Remover detalhes de memória da resposta pública.

## P2.2 — `any` permanece em fluxos críticos

Há `any` em controllers, respostas de parcelas, middleware de segurança, dados de sessão e payloads de webhook. Em pagamentos e KYC, isso reduz a capacidade do compilador de detectar campos ausentes ou tipos incorretos.

Priorizar DTOs Zod inferidos, tipos de sessão declarados no namespace Express, tipos de webhook por provider e retorno tipado dos repositories. Ativar regras progressivas de ESLint para `no-explicit-any` nos diretórios de domínio e aplicação.

## P2.3 — Compatibilidade e legado precisam de prazo de remoção

A existência de aliases, routers legados e controllers antigos pode ser necessária durante a migração, mas manter dois caminhos indefinidamente gera correções duplicadas e comportamento divergente. Registrar cada shim, adicionar métrica de uso, documentar o endpoint substituto e remover o legado após uma janela de compatibilidade.

## P2.4 — Auditoria de acesso deve ser ampliada

O sistema já grava alguns `AuditLog`, mas operações como leitura de documento KYC, alteração de gateway, aprovação/reprovação de KYC, liquidação manual, cancelamento administrativo e desbloqueio de dispositivo devem registrar ator, alvo, motivo, IP, request ID e resultado. O log deve ser append-only para a aplicação e ter retenção definida.

---

# 6. Plano de correção recomendado

A sequência abaixo minimiza o risco de corrigir arquitetura e, ao mesmo tempo, manter uma falha financeira ou de privacidade.

| Fase | Objetivo | Arquivos principais | Saída obrigatória |
|---|---|---|---|
| **0 — Preparação** | Congelar referência, backup e contratos de API. | `package.json`, migrations, documentação | Backup verificado, ambiente de staging e plano de rollback. |
| **1 — Privacidade e segredos** | Tirar KYC do público e eliminar defaults. | `uploadMiddleware.ts`, `authController.ts`, `app.ts`, `env.ts`, `session.ts` | Download autenticado, secrets obrigatórios, Redis definido em produção. |
| **2 — Integridade de pagamento** | Tornar webhooks idempotentes e reprocessáveis. | `webhookRoutes.ts`, novo `ProcessPaymentWebhook`, `schema.prisma` | Eventos com estado, retry correto e validação de valor. |
| **3 — Unicidade financeira** | Impedir colisão de grupo/cota. | `schema.prisma`, migration, `groupQuotaAllocator.ts`, `createSubscription.ts` | Constraint única, transação e retry de conflito. |
| **4 — Autorização e erros** | Uniformizar respostas e ownership. | controllers, `errors.ts`, repositories, casos de uso | Nenhum `error.message` interno em produção e testes de IDOR. |
| **5 — Jobs e operação** | Conectar cleanup e observabilidade. | `src/jobs`, logger, health routes | Job idempotente, alertas, métricas e logs redigidos. |
| **6 — Endurecimento** | Reduzir dívida técnica. | tipos, enums, shims, scripts | CI com lint, testes de concorrência e remoção de legado. |

### Ordem prática de execução

Primeiro criar uma branch de correção e um banco de staging com cópia sanitizada. Depois corrigir armazenamento privado e secrets, pois ambos reduzem risco imediato sem alterar regras financeiras. Em seguida implementar o modelo de webhook e a constraint de grupo/cota, com migrations reversíveis e testes de concorrência. Só depois migrar todos os controllers para `handleApiError` e completar a separação de repositories.

Cada fase deve ser entregue em commit pequeno, acompanhado de migration, teste e nota de rollback. A aplicação não deve ser considerada corrigida porque o build passou: para este projeto, o critério de aceite precisa incluir cenários adversos e concorrentes.

---

# 7. Matriz mínima de testes antes da produção

| Área | Teste necessário | Resultado esperado |
|---|---|---|
| KYC | Cliente A tenta ler documento de B | 403 ou 404 sem vazamento de existência. |
| KYC | URL pública antiga | Documento não é servido. |
| Upload | Arquivo com extensão falsa | Rejeitado por magic bytes. |
| Webhook | Mesmo evento repetido | Uma única liquidação. |
| Webhook | Falha transitória no banco | 5xx e reprocessamento seguro. |
| Webhook | Valor diferente da parcela | Rejeição e alerta. |
| Grupo/cota | 50 criações simultâneas | Nenhuma combinação duplicada. |
| JWT | Token revogado com Redis indisponível | Comportamento definido por política, preferencialmente bloqueio em rota sensível. |
| Sessão | Duas instâncias sem Redis | Processo não deve iniciar em produção. |
| Erro | Banco lança erro interno | Resposta genérica, sem SQL ou stack. |
| Autorização | Cliente acessa contrato alheio | 403/404. |
| Scripts | Execução em produção | Abortada antes de acessar o banco. |
| Logs | Request com token na query/header | Token mascarado. |

---

# 8. Critério de liberação

A versão pode continuar em desenvolvimento e staging, mas eu não recomendaria abrir pagamentos reais enquanto os itens P0 não forem resolvidos. O mínimo para uma liberação controlada é: documentos KYC privados; secrets obrigatórios; Redis e sessões com política de falha definida; webhooks com idempotência por evento, validação de valor e retry; constraint única de grupo/cota; tratamento seguro de erros; scripts de desenvolvimento isolados; e testes adversariais passando.

Depois disso, o lançamento deve ocorrer inicialmente com monitoramento reforçado, limite de volume e reconciliação diária entre pagamentos do gateway, parcelas e registros de webhook. A reconciliação não substitui a idempotência, mas reduz o tempo de descoberta de divergências.

> **Resumo final:** a nova versão está melhor organizada e os testes atuais passam, porém “compilar” e “passar a suíte existente” não são suficientes para um sistema que armazena identidade e movimenta pagamentos. O próximo trabalho deve priorizar privacidade, consistência financeira e operação segura; a limpeza arquitetural vem logo depois, sem perder as proteções que já foram implementadas.

---

## Referências ao código auditado

[1]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/src/app.ts "Bootstrap do Express"
[2]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/src/middlewares/uploadMiddleware.ts "Middleware de upload"
[3]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/src/controllers/api/authController.ts "Controller de autenticação e upload"
[4]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/prisma/schema.prisma "Schema Prisma"
[5]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/src/routes/webhookRoutes.ts "Rotas de webhook"
[6]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/src/domain/calculations/groupQuotaAllocator.ts "Alocador de grupo e cota"
[7]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/src/application/payments/listSubscriptionPayments.ts "Caso de uso de pagamentos"
[8]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/src/utils/errors.ts "Error mapper"
[9]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/src/controllers/api/subscriptionsApiController.ts "Controller de contratos"
[10]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/src/middlewares/authMiddleware.ts "Autenticação JWT e blacklist"
[11]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/src/config/env.ts "Validação de ambiente"
[12]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/src/config/session.ts "Configuração de sessão"
[13]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/src/middlewares/requestSignatureMiddleware.ts "Assinatura HMAC"
[14]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/src/services/subscriptionCleanupService.ts "Serviço de limpeza de contratos"
[15]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/src/security/password.ts "Hash e pepper de senhas"
[16]: https://github.com/KL17166/concorciov2/tree/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/src/scripts "Scripts operacionais e de teste"
[17]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/src/routes/api/subscriptionsRoutes.ts "Rotas de contratos"
[18]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/src/application/subscriptions/getSubscriptionDetails.ts "Detalhes de contrato e ownership"
