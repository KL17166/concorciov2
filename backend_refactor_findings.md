# Achados técnicos preliminares — backend do concorciov2

## Escopo

Repositório local: `/home/ubuntu/concorciov2_repo`. A análise é estática e somente leitura; o projeto não foi executado e nenhuma dependência foi instalada.

## Estrutura observada

O backend fica em `server-consorcio`, usa TypeScript, Express 5, Prisma 5, PostgreSQL, EJS, sessões Express/Redis, JWT, Zod, gateways PIX/Boleto e vários middlewares de segurança. O package.json tem scripts de build, dev, start, produção, testes Jest e job de inadimplência.

O backend contém 111 arquivos sob `src`, com 12 controladores administrativos, múltiplas rotas, middlewares, serviços, scripts de manutenção/teste e 30 templates EJS. Há cópias `.bak` versionadas de páginas e controllers.

## Hotspots comprovados

### 1. `src/routes/apiRoutes.ts`

Arquivo de aproximadamente 1.238 linhas. Mistura rotas, validação, autenticação/ownership, queries Prisma, regras de negócio, cálculos, transações, geração de parcelas, KYC, integração com gateways, normalização de resposta e tratamento de erros.

Seções observadas:

- contratos: listagem, detalhe, cancelamento e criação;
- criação de contrato com validação de termos, KYC, limite de contratos, plano/produto, cálculo financeiro, geração de grupo/cota provisórios e parcelas;
- lances: criação, validação, ownership, transação e listagem;
- pagamentos: listagem, geração de PIX e boleto, seleção de gateway, modo sandbox e normalização de respostas;
- KYC do cliente.

Duplicações visíveis dentro do próprio arquivo: cálculo da próxima parcela e `calculateInstallmentValue` aparecem em vários endpoints; montagem de produto/plano/parcelas/lances é repetida entre lista e detalhe; PIX e boleto repetem busca de parcela, ownership, token, status, próxima parcela, gateway, sandbox e resposta.

### 2. `src/routes/adminRoutes.ts`

Arquivo de aproximadamente 409 linhas que centraliza autenticação administrativa, CSRF global, sessão, refresh de JWT, login, 2FA, logout, dashboard, clientes, contratos, pagamentos, lances, produtos, usuários, relatórios, segurança, gateways e KYC.

Há dois handlers inline de mutação que deveriam delegar a controller/use case: marcar parcela como paga para cliente e pagamento, além de resetar senha de cliente. O mesmo `markInstallmentAsPaid` é chamado de dois pontos diferentes com redirecionamentos específicos.

A divisão por domínio já existe parcialmente nos controllers, mas o roteador ainda concentra autenticação e todos os agrupamentos. A recomendação é separar routers por contexto e manter `adminRoutes.ts` apenas como composição.

### 3. `src/controllers/admin/contractsController.ts`

O controller de contratos monta consultas Prisma e view models e também contém criação/cancelamento de contrato, cálculo de crédito/parcela, geração de tokens, criação de installments e alteração de status. Essas regras se sobrepõem ao fluxo de criação de contrato em `apiRoutes.ts`, indicando duplicação de domínio entre API de cliente e painel admin.

### 4. `src/services/installmentService.ts`

É um bom padrão existente. Centraliza `markInstallmentAsPaid`, validação sequencial, transação, atualização de saldo/parcelas, ativação após adesão, bloqueio por KYC e conclusão. Outras transições de contrato/pagamento deveriam seguir esse modelo, em vez de alterar estados diretamente nas rotas/controllers.

### 5. Formulários EJS duplicados

`views/pages/clients/form.ejs` e `views/pages/users/form.ejs` repetem campos de pessoa e endereço: nome, e-mail, CPF, telefone, CEP, rua, número, complemento, bairro, cidade e estado. Ambos armazenam o endereço como JSON string e fazem parsing/fallback no template.

Recomendação: extrair partials compartilhados para dados pessoais, endereço, alertas, botões e campos de auditoria; manter apenas os campos específicos de cliente ou administrador nos templates próprios.

### 6. CRUD de produtos

`adminProductController.ts` repete lógica entre create/update: parse/default de `imageUrls` e `specs`, validação, atualização de campos e geração de planos. Deve haver schema/input mapper compartilhado e use cases `createProduct`/`updateProduct` ou um serviço de catálogo.

### 7. Schema Prisma

Entidades centrais: User, Product, ConsortiumPlan, Subscription, Installment, Bid, AuditLog, SecurityThreat, BlockedDevice, GatewayConfig e WebhookLog.

As fronteiras naturais são: identidade/KYC, catálogo e planos, contratos/consórcios, cobrança/pagamentos, lances/contemplação, administração/relatórios, segurança e gateways.

O schema usa muitos `String` para estados/enums e armazena `User.address`, `Product.imageUrls` e `Product.specs` como JSON stringificado. Isso aumenta parsing manual e risco de inconsistência; considerar tipos JSON/enum no Prisma com migração gradual e validação Zod.

## Riscos e pontos de atenção

- Rate limits estão marcados como `AUDIT MODE` e com valores muito altos (por exemplo, 30.000, 10.000 e 5.000 em vez dos limites comentados), o que precisa ser separado por ambiente/configuração antes de produção.
- WAF, anti-scraping, JS challenge, assinatura HMAC e obfuscação de payload aparecem importados, mas desativados no bootstrap por comentários de auditoria.
- Há múltiplos arquivos de teste/debug/manutenção no repositório principal e scripts com nomes sensíveis; devem ser isolados em ferramentas internas ou removidos do artefato de produção.
- O código usa `any` em vários fluxos e faz parsing manual de endereço/imagens/specs.
- Respostas de erro de gateways incluem `details: gwError.message`, potencialmente expondo informação interna ao cliente.
- Há credenciais/segredos referenciados em código/configuração/testes; valores não foram incluídos neste arquivo. Recomenda-se revisão do histórico e rotação de qualquer segredo real exposto.
- O frontend envia token de autenticação também no corpo da criação de contrato; isso deve ser revisado como contrato de API e removido se não houver justificativa forte.
- Os endpoints de PIX e boleto repetem regras críticas e devem compartilhar um caso de uso de geração de cobrança com adaptadores de gateway.

## Arquitetura-alvo sugerida

`routes` deve conter apenas transporte e composição. `controllers` devem traduzir HTTP para comandos e respostas. `application`/`use-cases` deve orquestrar casos de uso. `domain` deve concentrar regras e transições. `repositories` deve encapsular Prisma. `integrations` deve conter PixGo/SigiloPay e outros provedores. `presenters`/`mappers` devem normalizar respostas. `views` deve conter templates e partials.

Módulos sugeridos: `identity`, `catalog`, `subscriptions`, `installments`, `bids`, `payments`, `kyc`, `admin`, `security`, `gateways`, `reports`.

## Plano de refatoração em alto nível

1. Congelar comportamento com testes de caracterização e contrato de API.
2. Criar configuração por ambiente e retirar limites de auditoria do código de produção.
3. Extrair schemas Zod e DTOs para entradas/saídas.
4. Criar `subscriptionService`/use cases compartilhados para criar, cancelar, ativar e contemplar contratos.
5. Criar `installmentService` ampliado para cálculo, geração e transições de parcelas.
6. Criar `paymentService` com um fluxo comum e adaptadores `PixGoAdapter`, `SigiloPayAdapter` e `SandboxAdapter`.
7. Separar `apiRoutes.ts` em routers de subscriptions, bids, payments e KYC.
8. Separar `adminRoutes.ts` em auth, dashboard, clients, contracts, payments, bids, products, users, reports, security, gateways e KYC.
9. Extrair repositórios/queries Prisma e presenters.
10. Extrair partials EJS e unificar forms de clientes/usuários.
11. Migrar strings JSON para `Json`/tipos estruturados e enums, com migrações compatíveis.
12. Remover `.bak`, dados locais, logs e scripts de teste perigosos do caminho de produção.
13. Rodar testes, lint/typecheck, migrações em staging e validação manual por fluxo antes do rollout.

## Perguntas em aberto para validar no relatório final

- PostgreSQL é o único banco de produção? O schema aponta PostgreSQL, mas existe `prisma/dev.db` no repositório.
- O painel admin EJS e o frontend Nuxt/Flutter precisam continuar no mesmo processo Express?
- A operação comercial usa realmente todos os tipos do catálogo?
- Quais gateways são oficiais em produção e quais são apenas sandbox?
- O objetivo é somente organizar código ou também corrigir regras financeiras/segurança?

## Métricas estáticas

- `apiRoutes.ts`: 1.237 linhas, 12 declarações de rota detectadas, mas cada handler é extenso e concentra vários casos de uso.
- `adminRoutes.ts`: 409 linhas e 65 declarações de rota, cobrindo autenticação e todos os domínios administrativos.
- `app.ts`: 425 linhas, com segurança, CORS, rate limiting, body parsing, sessões, views, webhooks, roteamento e health check.
- `webhookRoutes.ts`: 238 linhas.
- Controllers admin entre 228 e 393 linhas; `kycController.ts`, `reportsController.ts`, `paymentsController.ts`, `clientsController.ts` e `contractsController.ts` são os maiores.
- Templates grandes incluem `clients/details.ejs` (61.557 bytes), `gateways/index.ejs` (49.229), `reports/index.ejs` (43.342), `payments/index.ejs` (43.250), `contracts/index.ejs` (34.411) e `contracts/details.ejs` (34.215).
- Foram encontrados `prisma/dev.db`, `tunnel.log`, `scripts/test_output.txt`, arquivos `.bak` de controllers/templates e scripts de debug, reset e segurança versionados.
- Jest está configurado com `ts-jest`, duas suítes aparentes em `src/__tests__`, coleta de cobertura de `src/**/*.ts` (excluindo apenas `server.ts` e `app.ts`). Não há evidência, nesta leitura estática, de cobertura mínima obrigatória.
- `scripts/test_output.txt` registra falhas em testes de integração de gateways: PixGo retornou `undefined` e falhou ao ler `substring`; SigiloPay falhou ao criar depósito PIX. Isso recomenda mocks/contratos de gateway e testes de adaptadores antes de uma refatoração ampla.

## Precisão da recomendação

A recomendação não é simplesmente apagar arquivos e juntar tudo em um único módulo. O objetivo deve ser o inverso: unificar regras duplicadas em serviços/use cases compartilhados e dividir os arquivos de transporte e apresentação por contexto. As páginas podem compartilhar shell e partials, mas não devem ser fundidas quando representam fluxos de negócio diferentes.
