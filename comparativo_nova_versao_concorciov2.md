# Comparativo da nova versão do backend — concorciov2

**Autor:** Manus AI  
**Repositório:** [KL17166/concorciov2](https://github.com/KL17166/concorciov2)  
**Versão anterior analisada:** `da24c1c5ab1b5904f8ee8a40c9b0fae6d494d90a`  
**Nova versão instalada:** `f5741cd05b4d779e64dd70127f2475348a1bc780`  
**Modo:** atualização e análise local; nenhum servidor foi iniciado e nenhuma produção foi alterada.

## 1. Resultado direto

A nova versão **implementa de fato uma parte importante da refatoração recomendada**. Não foi apenas uma mudança de nomes: os dois maiores monólitos foram reduzidos a arquivos de compatibilidade, foram criadas rotas por domínio, casos de uso, repositórios, schemas, adaptadores de gateway, mappers e partials EJS.

A cópia local foi atualizada a partir do `origin/master` em modo fast-forward, depois recebeu `npm ci` usando o lockfile existente. A instalação adicionou **608 pacotes** e terminou com sucesso. O build TypeScript terminou sem erros, e a suíte automatizada passou com **4 suítes e 31 testes aprovados**.

A conclusão, porém, é de **refatoração parcialmente concluída**, não de backend totalmente limpo. O núcleo da API de cliente melhorou bastante, mas o painel administrativo ainda mantém vários controllers grandes com Prisma direto. A listagem de pagamentos também não foi completamente migrada. Antes de colocar a versão em produção, eu corrigiria as pendências de segurança, tipagem, contratos administrativos e testes de pagamento.

> **Veredito:** a nova versão é estruturalmente melhor e compilável, mas deve ser tratada como uma versão de homologação/refatoração, não como uma versão final pronta para produção financeira.

## 2. O que foi instalado e validado

| Item | Resultado |
|---|---|
| Atualização do Git | Fast-forward de `da24c1c` para `f5741cd` |
| Preservação da versão anterior | Criada a referência local `snapshot-before-update` |
| Dependências | `npm ci --no-audit --no-fund` concluído; 608 pacotes adicionados |
| Build | `npm run build` aprovado pelo TypeScript |
| Testes | 4 suítes, 31 testes aprovados em modo serial |
| Servidor | Não iniciado |
| Produção | Não alterada |
| Estado da cópia | Sem alterações não commitadas após instalação, build e testes |

A instalação exibiu avisos de pacotes depreciados, incluindo `prebuild-install`, versões antigas de `glob` e componentes da série 12 do `otplib`. Isso não impediu a instalação nem o build, mas deve entrar no backlog de atualização de dependências depois que a refatoração funcional estiver estabilizada. [1] [2]

## 3. Diferenças estruturais principais

A mudança mais clara está nos arquivos centrais. O `app.ts` caiu de aproximadamente 425 para 190 linhas. O antigo `apiRoutes.ts`, que tinha cerca de 1.237 linhas, agora possui somente 3 linhas e funciona como compatibilidade para o diretório `routes/api`. O antigo `adminRoutes.ts`, que tinha cerca de 409 linhas, também foi reduzido a 3 linhas e encaminha para `routes/admin`. [3] [4] [5]

| Área | Versão anterior | Nova versão | Avaliação |
|---|---:|---:|---|
| `app.ts` | 425 linhas | 190 linhas | Melhora relevante; configurações foram extraídas |
| `routes/apiRoutes.ts` | 1.237 linhas | 3 linhas | Monólito removido; shim de compatibilidade |
| `routes/adminRoutes.ts` | 409 linhas | 3 linhas | Monólito removido; shim de compatibilidade |
| Routers API por domínio | Não havia estrutura equivalente | 5 arquivos | Melhora de organização |
| Routers admin por domínio | Concentrados no agregador | 14 arquivos | Melhora de manutenção |
| Casos de uso | Não havia camada equivalente completa | 11 arquivos | Melhora importante, ainda parcial |
| Repositórios | Prisma espalhado | 4 repositórios novos | Melhora, mas ainda incompleta |
| Schemas | Validação mais concentrada nos handlers | 6 schemas novos | Melhora de validação na borda |
| Gateways de pagamento | Integrações acopladas às rotas | interface, factory e adaptadores | Melhora importante |
| Partial de formulários | Markup duplicado | 2 partials novos | Melhora visual e de manutenção |
| Testes | 3 suítes principais | 4 suítes, 31 testes | Melhora, mas cobertura ainda estreita |

O diff geral contém aproximadamente **76 arquivos alterados**, com cerca de **3.848 linhas adicionadas e 3.126 removidas**. A alteração líquida não é apenas crescimento: grande parte das linhas novas representa a separação de responsabilidades que antes estava escondida dentro dos monólitos.

## 4. O que melhorou concretamente

### 4.1 Rotas realmente modularizadas

A API agora é composta por routers de assinaturas, pagamentos, lances e KYC. O painel administrativo possui routers separados para autenticação, dashboard, perfil, clientes, contratos, pagamentos, lances, produtos, usuários, relatórios, segurança, gateways e KYC. O arquivo agregador monta os módulos, em vez de conter todos os handlers. [6] [7]

Os caminhos antigos ainda são preservados por shims. Essa decisão é boa para compatibilidade, desde que seja documentada e removida depois que o frontend e integrações externas confirmarem o uso dos caminhos novos.

### 4.2 Criação de contratos foi unificada

O novo `createSubscription.ts` é chamado pela API do cliente e pelo painel admin. Ele centraliza a busca e validação do plano, a validação do produto, limites de duração, cálculo financeiro, verificação de KYC, criação atômica do contrato, geração das parcelas e tokens de pagamento. A transação também revalida KYC dentro da transação, reduzindo risco de condição de corrida. [8]

Isso corrige o principal problema identificado na versão anterior: a mesma regra de criação existia em mais de um canal. A nova versão ainda mantém uma ramificação explícita por canal para o limite de contratos do cliente, mas essa diferença está documentada no input e é muito melhor do que duplicar todo o fluxo.

### 4.3 Cancelamento e contemplação passaram a usar casos de uso

O painel admin agora chama `cancelSubscription` e `contemplateSubscription`, em vez de manter toda a regra diretamente na rota. O cancelamento valida ownership e papel, impede cancelamento de contrato ativo pelo cliente, trata contrato já cancelado como idempotente e altera contrato e parcelas dentro de uma transação. [9]

Essa é uma melhora significativa. A regra ainda precisa de testes mais amplos para todos os estados possíveis, mas a fronteira de negócio está no lugar correto.

### 4.4 Pagamentos ganharam uma abstração de gateway

A nova versão criou `PaymentGateway`, `PaymentGatewayFactory`, `PixGoAdapter`, `SigiloPayAdapter` e `SandboxPaymentAdapter`. O caso de uso `generatePayment` busca a parcela por repositório, verifica ownership, valida o token HMAC, recusa parcela paga, calcula o valor, verifica endereço para boleto, seleciona o gateway e retorna uma resposta normalizada. [10] [11]

Também foi criado `settlePayment`, que reaproveita `markInstallmentAsPaid` para o admin e para os webhooks. Isso reduz o risco de o painel marcar uma parcela de maneira diferente do webhook automático.

### 4.5 Configurações de infraestrutura foram extraídas

Helmet, CORS, sessão, headers de segurança e rate limits foram retirados do `app.ts` e colocados em módulos específicos. O bootstrap ficou mais legível e agora mostra melhor a ordem de middleware, webhooks, segurança e rotas. [3] [12]

A separação melhora a manutenção, mas não significa que os valores estejam prontos para produção. A análise de risco está na seção 6.

### 4.6 Formulários passaram a compartilhar partials

Os formulários de clientes e usuários agora compartilham partials para dados pessoais e endereço. Isso atende diretamente à necessidade de “juntar páginas” sem transformar cliente e usuário administrativo em uma entidade visual confusa. [13] [14]

A solução correta foi aplicada: reutilizar markup comum e manter separados os campos específicos de acesso administrativo, senha, função e KYC.

## 5. O que ainda não foi resolvido

### 5.1 O painel admin ainda não está completamente em camadas

Embora as rotas administrativas tenham sido divididas, a maioria dos controllers admin ainda acessa Prisma diretamente. Permanecem controllers grandes, por exemplo pagamentos, KYC, clientes, relatórios e produtos. O controller de contratos já usa os novos casos de uso para criar, contemplar e cancelar, mas ainda consulta Prisma diretamente para listar contratos, abrir detalhes e carregar o formulário. [15]

Isso significa que a modularização de rotas foi concluída em boa parte, mas a separação entre controller, repository, use case e presenter ainda não foi concluída no painel. A próxima etapa deve ser migrar consultas administrativas, não recriar routers.

### 5.2 A listagem de pagamentos ainda mistura transporte, consulta e cálculo

`paymentsApiController.ts` usa o novo caso de uso para gerar PIX e boleto, mas `listSubscriptionPayments` ainda consulta Prisma diretamente, calcula `nextIndex` e monta `valueToPay` dentro do controller. [16]

Esse é um ponto importante porque a geração e a listagem podem apresentar valores diferentes se a regra de desconto ou de parcela mudar. Recomendo criar `ListSubscriptionPaymentsUseCase` e um `PaymentPresenter`, usando o mesmo serviço de cálculo de parcelas empregado na geração.

### 5.3 A criação de contrato ainda não está totalmente tipada

O novo caso de uso usa `subscription: any`, `plan: any`, `installments: any[]` e `installmentsData: any[]`. Os repositórios e mappers também mantêm alguns `any`. O build passa porque o TypeScript aceita esses tipos, mas isso reduz a proteção que a nova arquitetura deveria oferecer.

A correção é gerar tipos a partir dos retornos do Prisma ou definir DTOs explícitos. O caso de uso não deveria devolver entidades Prisma sem uma fronteira clara; deveria devolver um `CreateSubscriptionResult` tipado, e o controller deveria usar um presenter para escolher o formato JSON ou EJS.

### 5.4 O admin ainda não usa o schema de criação de forma uniforme

Existe `CreateAdminSubscriptionSchema`, mas o controller admin de contratos ainda extrai `userId`, `planId`, `groupNumber` e `quotaNumber` diretamente de `req.body`. [15] [17]

Isso cria uma inconsistência: a API do cliente usa Zod, mas o painel administrativo mantém entrada sem validação declarativa no controller. A validação do admin deve ser aplicada na rota ou no controller antes de chamar `createSubscription`.

### 5.5 Mensagens de erro ainda podem vazar detalhes internos

Os controllers de pagamento retornam `error.message` e, em alguns caminhos, `details: error.message`. O controller de gateway administrativo também possui respostas semelhantes. [16] [18]

Em produção, isso pode revelar nomes de bibliotecas, respostas de provedor, IDs internos ou detalhes de configuração. O ideal é mapear erros para códigos públicos, como `PAYMENT_GATEWAY_UNAVAILABLE`, `PAYMENT_INVALID_TOKEN` e `PAYMENT_TEMPORARY_FAILURE`, mantendo o detalhe completo apenas no logger com `requestId`.

### 5.6 Rate limits de desenvolvimento continuam permissivos

A nova configuração distingue produção e não produção, o que é melhor do que deixar “AUDIT MODE” espalhado. Entretanto, os limites de desenvolvimento continuam muito altos: por exemplo, `generalLimiter` chega a 30.000 requisições, login admin a 5.000, pagamentos a 3.000 e sessões a 120.000 dentro das respectivas janelas. [12]

Isso pode ser aceitável em uma sandbox isolada, mas é perigoso se o ambiente de homologação ficar acessível publicamente ou se `NODE_ENV` estiver configurado incorretamente. O processo deve falhar ao iniciar quando o ambiente público não for explicitamente `production` ou `staging` com limites definidos.

Além disso, `userIdFromBearer` decodifica o payload JWT para compor a chave do rate limit sem verificar a assinatura. Como a autenticação real ocorre em outro middleware, isso não substitui a autorização; porém, como mecanismo de limitação, um token forjado pode distribuir tentativas entre chaves falsas. Recomendo usar o IP como fallback confiável e somente usar o user ID após a autenticação, ou aplicar uma chave híbrida IP + identidade verificada.

### 5.7 Identificadores de grupo e cota continuam aleatórios

O caso de uso de criação ainda gera grupo e cota usando `Math.random()` quando esses valores não são fornecidos. [8] Isso pode produzir colisões e não garante unicidade operacional. Para um sistema real de consórcio, grupo e cota precisam vir de uma sequência, alocador transacional ou restrição única no banco, com tratamento de conflito.

Esse risco existia antes e não foi resolvido pela nova arquitetura. Ele deve ser priorizado antes de usar o sistema com dados reais.

### 5.8 Efeitos colaterais durante leitura

O caso de uso de listagem de contratos pode autocancelar contratos pendentes antigos enquanto responde a uma consulta. [19] Mesmo que a regra seja intencional, misturar leitura com mutação torna o comportamento surpreendente e dificulta auditoria.

O ideal é mover a rotina de autocancelamento para um job explícito, com logs, métricas e execução controlada. A listagem deve apenas consultar o estado já persistido.

### 5.9 Testes ainda não cobrem as áreas de maior risco

Os 31 testes aprovados cobrem serviço de parcelas, cancelamento, paginação e cálculo de parcelas. Isso é um bom sinal de estabilidade inicial, mas não cobre adequadamente geração de PIX, boleto, seleção de gateways, webhooks, idempotência, KYC, CSRF admin, ownership em todas as rotas e criação completa de contrato.

O novo teste de use case concentra-se em cancelamento. Antes de produção, devem ser adicionados testes de contrato para os adaptadores PixGo e SigiloPay, testes de erro e indisponibilidade, testes de `createSubscription` e testes de autorização para cada router.

## 6. Riscos encontrados na instalação e no diff

A instalação foi concluída, mas o npm exibiu avisos de depreciação. Eles não são uma falha imediata, porém indicam que a base de dependências precisa de uma atualização planejada. Não recomendo atualizar todas as dependências junto com a refatoração de domínio; primeiro estabilize o comportamento, depois atualize em uma branch separada.

A verificação de whitespace encontrou espaços finais em dois pontos do novo `users/form.ejs`. Isso é de baixa prioridade, mas pode ser corrigido em uma limpeza posterior. O estado local ficou limpo depois de `npm ci`, build e testes, portanto as validações não alteraram arquivos versionados.

O risco mais relevante não é compilação. É a possibilidade de haver **dois padrões simultâneos**: API nova em camadas e admin parcialmente antigo. Essa duplicidade pode fazer uma correção chegar à API e não chegar ao painel. A próxima fase deve reduzir essa divergência.

## 7. Plano recomendado a partir desta versão

### Etapa 1 — Fixar a nova versão como base de homologação

Mantenha `f5741cd` como baseline e preserve `snapshot-before-update` apenas como referência de comparação. Documente os caminhos antigos e novos e não os remova até confirmar o frontend e integrações externas.

### Etapa 2 — Corrigir segurança e validação antes de novas telas

Aplique `CreateAdminSubscriptionSchema` no POST administrativo, substitua respostas baseadas em `error.message` por um error mapper seguro, revise a chave do rate limit e transforme grupo/cota em alocação transacional ou sequência única.

### Etapa 3 — Completar a camada de aplicação do pagamento

Crie `listSubscriptionPayments`, mova o cálculo para um serviço comum e deixe o controller apenas adaptar a resposta HTTP. Depois adicione testes de contrato para cada gateway e testes de repetição de webhook.

### Etapa 4 — Migrar o painel admin por prioridade

A ordem recomendada é contratos, pagamentos, KYC, lances, clientes, produtos e relatórios. Para cada domínio, primeiro extraia queries para repository, depois extraia regras para use case e finalmente crie presenter/view model. Não é necessário reescrever os templates durante cada etapa.

### Etapa 5 — Remover o legado somente após observação

Quando as rotas novas estiverem em uso e testadas, remova os shims `apiRoutes.ts` e `adminRoutes.ts` ou mantenha-os como aliases documentados. Só então faça a limpeza final de controllers antigos, scripts de debug e arquivos de backup.

## 8. Critérios para considerar a nova versão pronta

| Critério | Situação atual | O que falta |
|---|---|---|
| Compilação TypeScript | Aprovado | Manter no CI |
| Testes existentes | 31/31 aprovados | Aumentar cobertura de pagamentos, KYC e rotas |
| API modularizada | Em grande parte concluída | Remover lógica restante de controllers |
| Admin modularizado | Rotas separadas, lógica parcial | Migrar consultas e regras dos controllers |
| Contratos | Criação/cancelamento/contemplação compartilhados | Tipagem, schema admin, alocação de grupo/cota |
| Pagamentos | Geração compartilhada e adapters | Listagem, erros seguros e testes de gateways |
| Views | Partial de pessoa/endereço criado | Migrar demais duplicações e corrigir whitespace |
| Segurança | Configuração extraída | Limites públicos, JWT rate-limit key e erros seguros |
| Compatibilidade | Shims preservam caminhos antigos | Monitorar e planejar remoção |

## 9. Conclusão

A nova versão representa um avanço real e merece ser usada como nova base de desenvolvimento. A redução de `apiRoutes.ts` e `adminRoutes.ts`, a criação de casos de uso, a abstração de gateways e os 31 testes aprovados mostram que a refatoração recomendada começou a ser aplicada corretamente.

A principal pendência é completar a migração do **painel administrativo** e eliminar a diferença de qualidade entre os fluxos novos e antigos. A segunda pendência é tratar segurança operacional: limites, mensagens de erro, alocação de grupo/cota e cobertura de pagamentos.

Portanto, minha recomendação é: **não voltar para a versão anterior**, manter esta nova versão instalada localmente, corrigir as pendências P0 listadas acima e só depois iniciar novas funcionalidades visuais ou abrir o sistema para clientes reais.

## Referências

[1]: https://github.com/KL17166/concorciov2/blob/f5741cd05b4d779e64dd70127f2475348a1bc780/server-consorcio/package.json "Dependências e scripts da nova versão"
[2]: https://github.com/KL17166/concorciov2/commit/f5741cd05b4d779e64dd70127f2475348a1bc780 "Commit da nova versão"
[3]: https://github.com/KL17166/concorciov2/blob/f5741cd05b4d779e64dd70127f2475348a1bc780/server-consorcio/src/app.ts "Bootstrap atualizado"
[4]: https://github.com/KL17166/concorciov2/blob/f5741cd05b4d779e64dd70127f2475348a1bc780/server-consorcio/src/routes/apiRoutes.ts "Shim de compatibilidade da API"
[5]: https://github.com/KL17166/concorciov2/blob/f5741cd05b4d779e64dd70127f2475348a1bc780/server-consorcio/src/routes/adminRoutes.ts "Shim de compatibilidade do admin"
[6]: https://github.com/KL17166/concorciov2/blob/f5741cd05b4d779e64dd70127f2475348a1bc780/server-consorcio/src/routes/api/index.ts "Composição dos routers de API"
[7]: https://github.com/KL17166/concorciov2/blob/f5741cd05b4d779e64dd70127f2475348a1bc780/server-consorcio/src/routes/admin/index.ts "Composição dos routers administrativos"
[8]: https://github.com/KL17166/concorciov2/blob/f5741cd05b4d779e64dd70127f2475348a1bc780/server-consorcio/src/application/subscriptions/createSubscription.ts "Caso de uso de criação de contrato"
[9]: https://github.com/KL17166/concorciov2/blob/f5741cd05b4d779e64dd70127f2475348a1bc780/server-consorcio/src/application/subscriptions/cancelSubscription.ts "Caso de uso de cancelamento"
[10]: https://github.com/KL17166/concorciov2/blob/f5741cd05b4d779e64dd70127f2475348a1bc780/server-consorcio/src/application/payments/generatePayment.ts "Caso de uso de geração de pagamento"
[11]: https://github.com/KL17166/concorciov2/blob/f5741cd05b4d779e64dd70127f2475348a1bc780/server-consorcio/src/integrations/payments/PaymentGatewayFactory.ts "Factory de gateways"
[12]: https://github.com/KL17166/concorciov2/blob/f5741cd05b4d779e64dd70127f2475348a1bc780/server-consorcio/src/config/rateLimits.ts "Rate limits por ambiente"
[13]: https://github.com/KL17166/concorciov2/blob/f5741cd05b4d779e64dd70127f2475348a1bc780/server-consorcio/src/views/partials/forms/person-fields.ejs "Partial de dados pessoais"
[14]: https://github.com/KL17166/concorciov2/blob/f5741cd05b4d779e64dd70127f2475348a1bc780/server-consorcio/src/views/partials/forms/address-fields.ejs "Partial de endereço"
[15]: https://github.com/KL17166/concorciov2/blob/f5741cd05b4d779e64dd70127f2475348a1bc780/server-consorcio/src/controllers/admin/contractsController.ts "Controller administrativo de contratos"
[16]: https://github.com/KL17166/concorciov2/blob/f5741cd05b4d779e64dd70127f2475348a1bc780/server-consorcio/src/controllers/api/paymentsApiController.ts "Controller de pagamentos da API"
[17]: https://github.com/KL17166/concorciov2/blob/f5741cd05b4d779e64dd70127f2475348a1bc780/server-consorcio/src/schemas/subscriptionSchema.ts "Schemas de contratos"
[18]: https://github.com/KL17166/concorciov2/blob/f5741cd05b4d779e64dd70127f2475348a1bc780/server-consorcio/src/controllers/admin/gatewayController.ts "Controller administrativo de gateways"
[19]: https://github.com/KL17166/concorciov2/blob/f5741cd05b4d779e64dd70127f2475348a1bc780/server-consorcio/src/application/subscriptions/getUserSubscriptions.ts "Caso de uso de listagem de contratos"
