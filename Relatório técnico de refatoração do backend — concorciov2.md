# Relatório técnico de refatoração do backend — concorciov2

**Autor:** Manus AI  
**Escopo:** análise estática do backend e do painel administrativo  
**Repositório analisado:** [KL17166/concorciov2](https://github.com/KL17166/concorciov2)  
**Data da análise:** 20 de agosto de 2026  
**Modo de análise:** somente leitura; o projeto não foi executado, nenhuma dependência foi instalada e nenhum arquivo do repositório foi alterado.

## 1. Resumo executivo

O backend funciona como um **monólito Express/TypeScript** com Prisma, PostgreSQL, sessões, JWT, EJS, integrações de pagamento e KYC. O problema principal não é simplesmente haver muitos arquivos. O problema é que as fronteiras entre transporte HTTP, regras de negócio, acesso ao banco, integração externa e apresentação estão misturadas.

A maior concentração está em `src/routes/apiRoutes.ts`, com aproximadamente **1.237 linhas**, e em `src/routes/adminRoutes.ts`, com aproximadamente **409 linhas**. O primeiro arquivo reúne contratos, lances, parcelas, pagamentos, PIX, boleto e KYC. O segundo reúne autenticação administrativa, 2FA, CSRF, clientes, contratos, pagamentos, lances, produtos, usuários, relatórios, gateways, segurança e KYC. [1] [2]

A recomendação é **não unir tudo em uma página ou em um arquivo maior**. O caminho correto é unificar as regras repetidas em serviços de aplicação e dividir as rotas por domínio. Na interface administrativa, páginas que têm a mesma estrutura devem compartilhar partials, layout e componentes visuais; páginas com fluxos de negócio diferentes devem continuar separadas.

As maiores oportunidades são as seguintes:

| Prioridade | Área | Problema | Ação recomendada |
|---|---|---|---|
| P0 | Contratos | Criação e cancelamento existem na API do cliente e no painel admin com regras repetidas | Criar casos de uso compartilhados para criar, cancelar, ativar e contemplar contratos |
| P0 | Pagamentos | PIX e boleto repetem validação, ownership, token, cálculo, seleção de gateway e resposta | Criar um `PaymentService` com adaptadores por gateway |
| P0 | Segurança operacional | Rate limits estão marcados como `AUDIT MODE`, com limites muito elevados, e várias proteções estão desativadas | Separar configurações por ambiente e revisar antes de produção |
| P1 | Rotas | `apiRoutes.ts` e `adminRoutes.ts` acumulam muitos contextos | Dividir por routers de domínio, mantendo arquivos agregadores pequenos |
| P1 | Dados | Endereço, imagens e especificações são JSON armazenado como string | Criar DTOs e migração gradual para tipos estruturados/JSON do Prisma |
| P1 | Admin | Controllers misturam queries, transações, regras, view models e respostas HTTP | Extrair repositories, use cases e presenters |
| P1 | Views | Formulários de clientes e usuários repetem dados pessoais e endereço | Extrair partials EJS reutilizáveis |
| P2 | Higiene | Existem `.bak`, banco local, logs e scripts de debug/teste versionados | Remover do artefato de produção e reorganizar ferramentas internas |

## 2. Diagnóstico da arquitetura atual

### 2.1 O fluxo atual

O fluxo atual pode ser resumido assim:

```text
HTTP request
   ↓
app.ts
   ├─ segurança, CORS, rate limit, sessão, body parser, views
   ├─ /api → routes/index.ts → apiRoutes.ts
   └─ /admin → adminRoutes.ts → controllers/admin/*.ts
                                      ↓
                                   Prisma direto
                                      ↓
                          gateways, arquivos, Datavalid
```

Esse desenho é funcional para um protótipo, mas fica difícil de manter quando uma regra precisa ser corrigida em mais de um canal. Por exemplo, a criação de contrato pelo app e pelo painel admin calculam crédito, taxa e parcelas em lugares diferentes. O risco é corrigir uma versão e esquecer a outra.

### 2.2 Concentração em `app.ts`

`app.ts` contém configuração de Helmet, CSP, CORS, vários rate limits, parsing de body, sessões, flash messages, engine EJS, honeypots, webhooks, middlewares de segurança, rotas públicas, rotas admin, arquivos estáticos, health check e tratamento de erros. [3]

Esse arquivo deveria ser principalmente um **composition root**, isto é, o lugar onde a aplicação é montada. Ele não precisa conhecer os detalhes de cada regra de rate limit, do comportamento de gateways ou do conteúdo das páginas. Uma divisão simples seria:

| Responsabilidade atual | Destino sugerido |
|---|---|
| Helmet, CSP e headers | `config/securityHeaders.ts` |
| CORS | `config/cors.ts` |
| Rate limits | `config/rateLimits.ts` |
| Sessão e Redis | `config/session.ts` |
| EJS e estáticos | `config/views.ts` |
| Webhooks | `routes/webhookRoutes.ts` |
| Health check | `routes/healthRoutes.ts` |
| Composição das rotas | `routes/index.ts` e `routes/admin/index.ts` |

Não é necessário fazer essa separação antes dos módulos de negócio. Ela pode ser feita depois que os casos de uso críticos estiverem protegidos por testes.

### 2.3 Concentração em `apiRoutes.ts`

`apiRoutes.ts` mistura pelo menos cinco contextos: contratos, parcelas, lances, pagamentos e KYC. Há validações inline, consultas Prisma, verificações de ownership, cálculos financeiros, transações, geração de parcelas, montagem de resposta, integração com PixGo/SigiloPay e tratamento de erros no mesmo arquivo. [1]

A criação de contrato é um exemplo claro. O endpoint valida token no corpo, valida campos, valida aceite de termos, compara o `userId`, verifica KYC, limita contratos ativos, busca plano e produto, calcula crédito, gera grupo e cota provisórios, cria o contrato, submete KYC e cria todas as parcelas dentro de uma transação serializável. Essa é uma **função de negócio**, não uma responsabilidade de uma rota.

O mesmo arquivo também repete a montagem de dados de plano, produto, parcelas e lances na listagem e no detalhe de contrato. A função `safeParseImageUrls` e o cálculo de valor da parcela são sinais de que faltam mappers e serviços compartilhados.

A divisão recomendada é:

```text
routes/api/
   subscriptionsRoutes.ts
   installmentsRoutes.ts
   bidsRoutes.ts
   paymentsRoutes.ts
   kycRoutes.ts

controllers/api/
   subscriptionsController.ts
   installmentsController.ts
   bidsController.ts
   paymentsController.ts
   kycController.ts

application/
   subscriptions/createSubscription.ts
   subscriptions/cancelSubscription.ts
   subscriptions/getUserSubscriptions.ts
   bids/createBid.ts
   payments/generatePayment.ts
   kyc/submitKyc.ts

repositories/
   subscriptionRepository.ts
   installmentRepository.ts
   productRepository.ts
   paymentRepository.ts

presenters/
   subscriptionPresenter.ts
   paymentPresenter.ts
```

O controller deve receber `req`, extrair parâmetros e chamar um caso de uso. A transação, a validação de estado e as queries devem ficar fora do controller.

### 2.4 Concentração em `adminRoutes.ts`

O roteador administrativo contém aproximadamente 65 declarações de rota e reúne autenticação, refresh de JWT, login, 2FA, logout, dashboard, clientes, contratos, pagamentos, lances, produtos, usuários, relatórios, segurança, gateways e KYC. [2]

A divisão por domínio já existe parcialmente nos controllers importados, mas o arquivo ainda contém middleware global, sessão e handlers inline. Isso gera dois problemas: a autenticação fica acoplada à montagem das páginas e algumas mutações importantes não passam por uma camada uniforme de aplicação.

A organização recomendada é:

```text
routes/admin/
   index.ts
   authRoutes.ts
   dashboardRoutes.ts
   clientRoutes.ts
   contractRoutes.ts
   paymentRoutes.ts
   bidRoutes.ts
   productRoutes.ts
   userRoutes.ts
   reportRoutes.ts
   securityRoutes.ts
   gatewayRoutes.ts
   kycRoutes.ts
```

`routes/admin/index.ts` ficaria apenas com a composição dos routers. O login e o 2FA iriam para um `adminAuthController` e um `adminSessionService`. O middleware `isAdmin` deveria ficar em `middlewares/adminAuthMiddleware.ts`, e as regras de renovação de JWT deveriam ser testadas independentemente.

Os handlers inline para marcar parcela como paga e resetar senha de cliente devem sair de `adminRoutes.ts`. A rota deveria chamar um controller específico, que por sua vez chamaria `markInstallmentAsPaid` ou um `resetClientPassword` use case.

## 3. O que unir e o que não unir

### 3.1 Funções que devem ser unificadas

A unificação deve ocorrer quando a regra é a mesma independentemente do canal de entrada.

| Regra | Onde aparece | Unificação recomendada |
|---|---|---|
| Criar contrato e gerar parcelas | `apiRoutes.ts` e `contractsController.ts` | `CreateSubscriptionUseCase` |
| Cancelar contrato e parcelas abertas | API do cliente e controller admin | `CancelSubscriptionUseCase`, com política diferente por papel |
| Calcular crédito e parcela | API e controller admin | `SubscriptionCalculator` ou `PlanPricingService` |
| Gerar e validar token de pagamento | endpoints PIX/boleto | `PaymentTokenService` já existente, usado por um fluxo comum |
| Verificar ownership | vários endpoints | `OwnershipService` ou middleware parametrizado mais consistente |
| Buscar parcela, validar estado e próxima parcela | listagem, PIX, boleto | `InstallmentQueryService` |
| Gerar cobrança | PIX e boleto | `GeneratePaymentUseCase` com `PaymentGateway` |
| Atualizar pagamento e estado do contrato | painel, webhook e serviço | `InstallmentService`/`PaymentSettlementService` |
| Parsear endereço | clientes, usuários, boleto e controllers | `AddressSchema`, `parseAddress` e mapper central |
| Parsear imagens/specs | produto API e admin | `ProductMapper` e schemas Zod |
| Formulário pessoal/endereço | clientes e usuários | partials EJS compartilhados |

O serviço `installmentService.ts` é um bom modelo. Ele já concentra transação, ordem de pagamento, atualização de saldo, ativação, bloqueio por KYC e conclusão. [4] O objetivo deve ser expandir esse padrão para as demais transições, não criar novas regras paralelas.

### 3.2 Páginas que podem compartilhar estrutura

Os formulários de cliente e usuário repetem nome, e-mail, CPF, telefone e praticamente o mesmo conjunto de campos de endereço. Em `clients/form.ejs`, o endereço é convertido de JSON para campos durante o render; em `users/form.ejs`, a mesma informação é exibida por meio de `parsedAddress`. [5] [6]

A solução não é necessariamente criar uma única página chamada “Pessoa”. O melhor desenho é manter duas páginas de negócio, mas extrair partes compartilhadas:

```text
views/partials/forms/
   person-fields.ejs
   address-fields.ejs
   form-actions.ejs
   validation-errors.ejs

views/pages/clients/form.ejs
   ├─ person-fields.ejs
   ├─ address-fields.ejs
   └─ client-specific-fields.ejs

views/pages/users/form.ejs
   ├─ person-fields.ejs
   ├─ address-fields.ejs
   └─ admin-access-fields.ejs
```

Isso reduz duplicação sem misturar permissões, senha, função administrativa e documentos KYC com os campos do cliente.

### 3.3 Páginas que não devem ser fundidas

As páginas de contratos, pagamentos, lances, KYC e gateways representam operações diferentes. Elas podem compartilhar layout, cabeçalho, navegação, cards, filtros, tabelas, paginação e mensagens, mas não devem ser transformadas em uma página genérica com muitos modos condicionais.

Também não recomendo juntar `dashboard`, `reports` e `security` em uma página única. O dashboard deve ser operacional e resumido; relatórios devem ser analíticos; segurança deve ser restrita e orientada a incidentes. A unificação deve ocorrer nos componentes e nas queries reutilizáveis, não no significado da tela.

## 4. Arquitetura-alvo

### 4.1 Organização de diretórios

Uma estrutura de transição, compatível com o projeto atual, seria:

```text
server-consorcio/src/
├── app.ts
├── server.ts
├── config/
│   ├── database.ts
│   ├── env.ts
│   ├── logger.ts
│   ├── redis.ts
│   ├── session.ts
│   ├── cors.ts
│   ├── rateLimits.ts
│   └── securityHeaders.ts
├── routes/
│   ├── index.ts
│   ├── healthRoutes.ts
│   ├── api/
│   │   ├── index.ts
│   │   ├── authRoutes.ts
│   │   ├── productRoutes.ts
│   │   ├── subscriptionRoutes.ts
│   │   ├── installmentRoutes.ts
│   │   ├── bidRoutes.ts
│   │   ├── paymentRoutes.ts
│   │   └── kycRoutes.ts
│   ├── admin/
│   │   ├── index.ts
│   │   ├── authRoutes.ts
│   │   ├── clientRoutes.ts
│   │   ├── contractRoutes.ts
│   │   ├── paymentRoutes.ts
│   │   ├── bidRoutes.ts
│   │   ├── productRoutes.ts
│   │   ├── userRoutes.ts
│   │   ├── reportRoutes.ts
│   │   ├── securityRoutes.ts
│   │   ├── gatewayRoutes.ts
│   │   └── kycRoutes.ts
│   └── webhooks/
│       ├── index.ts
│       ├── pixgoRoutes.ts
│       └── sigiloPayRoutes.ts
├── controllers/
│   ├── api/
│   └── admin/
├── application/
│   ├── subscriptions/
│   ├── installments/
│   ├── bids/
│   ├── payments/
│   ├── kyc/
│   ├── catalog/
│   └── identity/
├── domain/
│   ├── subscriptions/
│   ├── installments/
│   ├── payments/
│   ├── bids/
│   └── shared/
├── repositories/
├── integrations/
│   ├── payments/
│   │   ├── PaymentGateway.ts
│   │   ├── PixGoAdapter.ts
│   │   ├── SigiloPayAdapter.ts
│   │   └── SandboxPaymentAdapter.ts
│   ├── kyc/
│   └── storage/
├── schemas/
├── mappers/
├── presenters/
├── middlewares/
├── security/
├── services/
└── views/
    ├── layouts/
    ├── partials/
    └── pages/
```

Não é necessário criar todas essas pastas de uma vez. A estrutura deve ser introduzida conforme cada fluxo é migrado.

### 4.2 Separação de responsabilidades

A regra prática deve ser esta:

| Camada | Deve fazer | Não deve fazer |
|---|---|---|
| Rota | Declarar método, caminho e middleware | Conter regra financeira ou query Prisma extensa |
| Controller | Converter HTTP em comando e comando em resposta | Decidir transições complexas de contrato |
| Use case | Orquestrar uma operação de negócio | Renderizar EJS ou conhecer detalhes de Express |
| Domínio | Validar invariantes e estados | Fazer `res.redirect`, `req.flash` ou chamada HTTP externa |
| Repository | Encapsular Prisma e consultas | Decidir se o contrato deve ser contemplado |
| Integration adapter | Falar com gateway/Datavalid/storage e normalizar resposta | Atualizar diretamente contrato ou parcela |
| Presenter/mapper | Converter entidades em DTOs ou view models | Fazer transações ou chamadas externas |
| View | Exibir dados e coletar entrada | Fazer parsing de negócio ou calcular valores financeiros |

### 4.3 Contratos de gateway

PIX e boleto devem passar pelo mesmo caso de uso, com uma interface de gateway. Um exemplo conceitual:

```ts
export type PaymentMethod = 'PIX' | 'BOLETO';

export interface PaymentRequest {
  installmentId: string;
  amount: number;
  customer: CustomerData;
  method: PaymentMethod;
  idempotencyKey: string;
}

export interface PaymentResult {
  providerPaymentId: string;
  method: PaymentMethod;
  qrCode?: string;
  qrCodeBase64?: string;
  digitableLine?: string;
  expiresAt?: Date;
}

export interface PaymentGateway {
  supports(method: PaymentMethod): boolean;
  createPayment(request: PaymentRequest): Promise<PaymentResult>;
}
```

O `GeneratePaymentUseCase` valida a parcela e o usuário, calcula o valor, escolhe o gateway ativo, chama o adaptador e retorna um DTO normalizado. PixGo, SigiloPay e sandbox ficam isolados. O endpoint não deve saber qual provedor foi escolhido nem conhecer o formato específico de cada resposta.

A mesma lógica se aplica aos webhooks: autenticação e parsing são específicos do provedor, mas a confirmação de pagamento deve passar por um único `SettlePaymentUseCase`. O roteador de webhook já apresenta uma boa direção ao delegar a mutação para `markInstallmentAsPaid`; essa fronteira deve ser preservada e ampliada. [7]

## 5. Problemas de segurança e confiabilidade a tratar antes do lançamento

### 5.1 Configuração de auditoria

No `app.ts`, vários rate limits aparecem com comentários indicando valores originais menores e valores atuais elevados por “AUDIT MODE”. Também aparecem middlewares de WAF, anti-scraping, JS challenge, assinatura de requisição e obfuscação de payload importados, mas comentados/desativados. [3]

Isso precisa ser explicitamente separado por ambiente:

```ts
const limits = env.NODE_ENV === 'production'
  ? productionLimits
  : developmentLimits;
```

Não se deve depender de comentários para determinar se uma proteção está ativa. Crie uma configuração declarativa, registre no startup quais proteções estão habilitadas e inclua um teste que falhe quando o ambiente de produção iniciar com limites de desenvolvimento.

### 5.2 Validação e confiança no cliente

A criação de contrato exige que o token apareça também no corpo e no cabeçalho. Essa duplicação deve ser revisada. O backend deve confiar na identidade derivada do token autenticado e buscar `userId`, plano, produto e valores no banco. Nunca deve aceitar do cliente um valor financeiro como fonte de verdade.

Os schemas Zod devem validar todos os payloads na borda. Depois disso, os use cases devem receber objetos tipados, não `req.body` livre. Campos como status, role, tipo de lance, método de pagamento e tipo de contemplação devem ser enums ou uniões tipadas, evitando strings arbitrárias.

### 5.3 Dados sensíveis e logs

KYC, CPF, documentos, endereço, segredos de gateway e dados de pagamento exigem logs redigidos. Os controllers devem evitar expor `gwError.message` diretamente ao cliente; a mensagem detalhada deve ir para o logger com correlação, enquanto a resposta externa deve usar um código público e uma mensagem segura.

O repositório contém banco local, logs, arquivos `.bak` e scripts de debug/teste versionados. Esses arquivos devem ser removidos do pacote de produção e avaliados no histórico do Git. Se algum segredo real já tiver sido versionado, é necessário rotacioná-lo; apagar o arquivo no commit atual não invalida o segredo exposto no histórico.

### 5.4 Estados financeiros

As transições `PENDING`, `PENDING_KYC`, `ACTIVE`, `CONTEMPLATED`, `COMPLETED` e `CANCELLED` devem ser centralizadas. O mesmo vale para os estados de parcela. O código atual já possui uma transação robusta em `installmentService.ts`, que verifica ordem, bloqueia contrato cancelado, atualiza saldo, ativa após a adesão e marca conclusão. [4]

O próximo passo deve ser criar uma máquina de estados ou funções de política explícitas, por exemplo `canCancelSubscription`, `canPayInstallment`, `canContemplateSubscription` e `transitionSubscription`. Isso reduz o risco de um controller alterar apenas uma parte do estado.

## 6. Plano passo a passo de refatoração

### Fase 0 — Congelamento e linha de base

Antes de reorganizar arquivos, crie uma branch de refatoração, registre a versão atual e faça uma lista dos endpoints e páginas que precisam continuar funcionando. Salve exemplos de respostas de contrato, parcelas, lances, PIX, boleto, KYC e login admin. Não mude simultaneamente banco, API e interface.

Crie testes de caracterização para os comportamentos atuais, mesmo que alguns sejam provisórios. O objetivo inicial não é provar que o comportamento está ideal; é impedir que uma mudança estrutural altere silenciosamente o contrato externo.

### Fase 1 — Configuração e segurança

Extraia sessões, CORS, headers, rate limits e health check de `app.ts`. Crie configurações separadas para desenvolvimento, homologação e produção. Troque os valores de “AUDIT MODE” por variáveis explícitas e documentadas.

Faça um inventário de variáveis de ambiente e garanta que o processo falhe de forma segura quando faltar `DATABASE_URL`, `SESSION_SECRET`, `JWT_SECRET`, `APP_SECRET` ou segredos de gateway exigidos no ambiente de produção.

### Fase 2 — Tipos, schemas e mappers

Crie schemas Zod para autenticação, criação/cancelamento de contrato, criação de lance, geração de cobrança, atualização de produto, usuário e KYC. O controller deve validar uma vez e passar um DTO ao use case.

Em seguida, extraia `AddressSchema`, `ProductMapper`, `SubscriptionMapper`, `InstallmentMapper` e `PaymentMapper`. O parsing de `address`, `imageUrls` e `specs` deve sair de templates e rotas. Durante a migração, os mappers podem aceitar tanto a forma antiga quanto a nova e registrar campos malformados.

### Fase 3 — Contratos e parcelas

Crie um `SubscriptionRepository` com consultas de detalhe/listagem e um `InstallmentRepository` com consultas por contrato e operações de estado. Depois extraia, nesta ordem, `CreateSubscriptionUseCase`, `CancelSubscriptionUseCase`, `GetSubscriptionDetailsUseCase`, `GetUserSubscriptionsUseCase` e `ContemplateSubscriptionUseCase`.

O fluxo de criação deve buscar o plano e o produto no servidor, recalcular valores, validar limites, aceitar termos com registro de auditoria, criar contrato e parcelas numa única transação e submeter KYC apenas quando os documentos forem válidos. O painel admin e a API devem chamar esse mesmo caso de uso, passando políticas específicas de canal e papel quando necessário.

O cancelamento deve verificar estado, registrar auditoria, alterar contrato e parcelas relacionadas em uma transação e retornar um resultado de domínio. O controller decide se esse resultado vira JSON, flash message ou redirect.

### Fase 4 — Pagamentos e gateways

Extraia primeiro a parte comum que já está duplicada entre PIX e boleto: localizar parcela, verificar usuário, validar token, verificar status, calcular valor, selecionar gateway e construir resposta. Depois implemente a interface `PaymentGateway` e os adaptadores.

Mantenha sandbox como um adaptador explícito, não como um `if` espalhado nos endpoints. Use uma chave de idempotência baseada no installment e na tentativa de cobrança. Persista o identificador externo e o status da tentativa se o negócio precisar consultar ou reconciliar pagamentos posteriormente.

Padronize os webhooks por meio de um `PaymentWebhookService`: autenticar assinatura, impedir replay, normalizar evento, localizar parcela, aplicar idempotência e chamar `SettlePaymentUseCase`. Os detalhes de PixGo e SigiloPay devem permanecer nos adaptadores.

O arquivo de saída de testes já registra falhas de integração em PixGo e SigiloPay, incluindo retorno `undefined` e falha de criação de depósito. Isso reforça a necessidade de testes de contrato com respostas mockadas e testes de erro antes de mover código entre módulos. [8]

### Fase 5 — Lances e KYC

Extraia `CreateBidUseCase`, `ListUserBidsUseCase`, `ApproveBidUseCase`, `RejectBidUseCase` e `PerformDrawUseCase`. A verificação de ownership e a regra de um lance pendente devem ser garantidas no caso de uso e, quando possível, por restrição/índice no banco.

Para KYC, divida o controller em `KycReviewService`, `KycSubmissionService`, `DatavalidAdapter` e `KycStorageAdapter`. O controller administrativo deve apenas verificar o papel, chamar o serviço e renderizar o resultado. A aprovação ou rejeição de KYC e a consequente transição do contrato devem passar pelo mesmo serviço de estado usado pela API.

### Fase 6 — Rotas e controllers

Com os use cases prontos, crie os routers novos e migre uma rota por vez. Preserve os caminhos atuais usando aliases ou reexports durante a transição. Por exemplo, `routes/index.ts` pode montar `subscriptionRoutes` e ainda manter um alias legado para `/motorcycles` enquanto o frontend for atualizado.

Depois de cada migração, remova o handler antigo somente quando os testes de contrato, autenticação, ownership, status e resposta estiverem verdes. Ao final, `apiRoutes.ts` deve desaparecer ou ficar como um compatibilidade temporário pequeno; `adminRoutes.ts` deve ser apenas um agregador.

### Fase 7 — Templates e páginas

Crie um layout base, partials de navegação, flash messages, paginação, filtros, tabela, formulário de pessoa e endereço. Migre primeiro `clients/form.ejs` e `users/form.ejs`, pois a duplicação é evidente. [5] [6]

Padronize os cards e tabelas de contratos, pagamentos, lances e KYC, mas mantenha uma página por fluxo. Para redimensionamento, use uma grade consistente, breakpoints definidos e tabelas responsivas; não esconda campos críticos apenas para fazer a página caber.

### Fase 8 — Dados e limpeza

Depois de estabilizar os mappers, planeje a migração de strings JSON para tipos `Json` do Prisma e, quando fizer sentido, enums. Faça a migração em etapas: adicionar coluna nova, ler ambos os formatos, copiar dados, validar contagens, trocar escritores, remover coluna antiga somente depois de uma janela de segurança.

Remova `.bak`, banco SQLite local, logs, dumps e scripts de execução manual do caminho de produção. Mova ferramentas de manutenção para uma pasta interna não empacotada ou para um repositório separado. Atualize `.gitignore` e a pipeline para impedir o retorno desses artefatos.

### Fase 9 — Validação e lançamento gradual

Execute typecheck, testes unitários, testes de integração com banco de teste, testes de contrato de gateway e testes de páginas administrativas. Faça um rollout por etapas: primeiro catálogo e leitura; depois criação/cancelamento; depois pagamentos e webhooks; por fim KYC e funções administrativas sensíveis.

Mantenha logs com correlação, métricas de erro por endpoint e uma forma de desativar um novo adaptador sem derrubar o restante do sistema. Só remova os caminhos antigos quando houver evidência de que o frontend e integrações externas não os utilizam mais.

## 7. Estratégia de testes

A refatoração deve criar uma pirâmide mínima de testes:

| Camada | O que testar | Exemplos |
|---|---|---|
| Unitário | Regras puras | cálculo de parcela, limites de plano, transições de status, schemas |
| Caso de uso | Orquestração | criar/cancelar contrato, gerar cobrança, liquidar parcela, aprovar KYC |
| Repository | Consultas essenciais | filtros por usuário, ownership, status e transações |
| Integração | Banco e gateways | transação serializável, idempotência, webhook e rollback |
| Contrato HTTP | Rotas públicas | status, formato de resposta, autorização e erros |
| Smoke admin | Páginas críticas | login, 2FA, clientes, contratos, pagamentos e KYC |

As duas suítes existentes não são suficientes para cobrir todas essas fronteiras. O `jest.config.ts` já permite coleta de cobertura, mas a configuração não indica uma meta mínima obrigatória. [9] Recomendo começar com metas por módulo crítico, não com uma meta global artificial. Contratos, pagamentos e KYC devem ter cobertura maior que páginas de consulta simples.

## 8. Critérios de aceite da refatoração

A refatoração pode ser considerada segura quando os seguintes critérios forem atendidos:

| Critério | Condição de aceite |
|---|---|
| Compatibilidade | As rotas mantêm caminhos e formatos ou têm versão/alias documentado |
| Financeiro | Valores são recalculados no servidor e não vêm do cliente |
| Transações | Criação, cancelamento, pagamento e contemplação são atômicos |
| Ownership | Usuário nunca acessa contrato, parcela ou lance de outra pessoa |
| Idempotência | Repetição de webhook ou cobrança não duplica efeito financeiro |
| Segurança | Produção não inicia com limites de auditoria ou proteções desativadas sem decisão registrada |
| Observabilidade | Erros possuem correlação e não expõem segredo ou stack trace ao cliente |
| Views | Formulários compartilham partials sem perder campos específicos |
| Dados | Migração de JSON possui contagem, validação e rollback |
| Manutenção | Rotas agregadoras permanecem pequenas e cada domínio tem uma entrada clara |

## 9. Ordem prática recomendada

Se você quiser uma ordem objetiva para começar, eu faria quatro entregas intermediárias. A primeira seria retirar a duplicação mais perigosa: um caso de uso único para criar e cancelar contratos, chamado tanto pela API quanto pelo admin. A segunda seria unificar PIX e boleto em um fluxo comum com adaptadores. A terceira seria dividir os routers e mover handlers inline. A quarta seria extrair partials e padronizar as páginas administrativas.

Não começaria redesenhando todas as telas nem trocando o banco. Também não começaria apagando arquivos. A prioridade é proteger as regras financeiras e de segurança, criar testes de caracterização e migrar gradualmente. Depois disso, a limpeza visual e a reorganização de diretórios se tornam muito menos arriscadas.

## 10. Conclusão

Sim, é possível unir páginas, redimensionar elementos e juntar funções, mas a unificação correta é seletiva. As regras de negócio repetidas devem convergir para serviços/use cases compartilhados; as rotas devem ser divididas por domínio; e as páginas devem compartilhar layout e partials, sem misturar fluxos diferentes.

O backend tem uma base aproveitável: TypeScript estrito está ativado, Prisma organiza as entidades, há serviços isolados como `installmentService` e `datavalidService`, e existem transações serializáveis em pontos importantes. [4] [10] O maior ganho virá de usar esses pontos bons como padrão para o restante do sistema.

A recomendação final é executar a refatoração em pequenas etapas, mantendo o comportamento externo, adicionando testes antes de mover lógica e tratando qualquer mudança em pagamento, KYC ou contrato como alteração de alto risco. Este relatório descreve o caminho técnico; antes de implementar, ainda é necessário confirmar as regras reais da operação, os gateways de produção, o banco oficial e os requisitos regulatórios aplicáveis ao negócio de consórcios.

## Referências

[1]: https://github.com/KL17166/concorciov2/blob/master/server-consorcio/src/routes/apiRoutes.ts "Rotas da API"
[2]: https://github.com/KL17166/concorciov2/blob/master/server-consorcio/src/routes/adminRoutes.ts "Rotas administrativas"
[3]: https://github.com/KL17166/concorciov2/blob/master/server-consorcio/src/app.ts "Bootstrap do Express"
[4]: https://github.com/KL17166/concorciov2/blob/master/server-consorcio/src/services/installmentService.ts "Serviço de parcelas"
[5]: https://github.com/KL17166/concorciov2/blob/master/server-consorcio/src/views/pages/clients/form.ejs "Formulário de clientes"
[6]: https://github.com/KL17166/concorciov2/blob/master/server-consorcio/src/views/pages/users/form.ejs "Formulário de usuários"
[7]: https://github.com/KL17166/concorciov2/blob/master/server-consorcio/src/routes/webhookRoutes.ts "Webhooks de pagamento"
[8]: https://github.com/KL17166/concorciov2/blob/master/server-consorcio/scripts/test_output.txt "Saída de testes de gateways"
[9]: https://github.com/KL17166/concorciov2/blob/master/server-consorcio/jest.config.ts "Configuração do Jest"
[10]: https://github.com/KL17166/concorciov2/blob/master/server-consorcio/src/services/datavalidService.ts "Serviço Datavalid"
