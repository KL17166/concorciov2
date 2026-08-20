# Comparativo atualizado do backend — concorciov2

**Autor:** Manus AI

**Repositório analisado:** [KL17166/concorciov2][1]

**Versão anterior:** `f5741cd05b4d779e64dd70127f2475348a1bc780`

**Nova versão instalada:** `cc80b3383210caf54aac81707503ad8affca5494`

**Escopo:** atualização local, análise estática, instalação das dependências já existentes, build e testes. Nenhum servidor foi iniciado, nenhuma produção foi alterada e nenhum arquivo foi modificado no repositório local.

## 1. Resumo executivo

A nova versão representa uma segunda etapa consistente da refatoração. Ela não apenas reorganiza arquivos: corrige vários pontos apontados no comparativo anterior. Foram adicionados um alocador sequencial de grupo e cota, um caso de uso próprio para listar pagamentos, testes específicos de pagamentos e gateways, testes do alocador, um mapeador seguro de erros e um serviço separado para limpeza de contratos antigos.

A atualização foi aplicada por fast-forward de `f5741cd` para `cc80b33`, preservando a versão anterior em uma referência local chamada `snapshot-before-20260820214704`. Não houve mudança em `package.json` nem em `package-lock.json`, portanto as dependências instaladas na etapa anterior continuam válidas e não foi necessário repetir `npm ci`.

A nova versão passou pelo build TypeScript e por **42 testes automatizados**, distribuídos em **6 suítes**. O estado é significativamente melhor que o anterior, mas ainda não deve ser considerado pronto para produção financeira sem uma revisão de concorrência no alocador de cotas, adoção do error mapper em todos os controllers, conexão do serviço de limpeza a um job real e criação de uma restrição única no banco para grupo e cota.

> **Veredito:** a atualização corrige os principais itens funcionais do comparativo anterior e pode ser usada como nova base de homologação. Ainda é necessário fechar algumas garantias de produção antes de abrir o sistema para clientes reais.

## 2. Instalação e validação

| Verificação | Resultado |
|---|---|
| Commit anterior preservado | Sim, em `snapshot-before-20260820214704` |
| Atualização Git | Fast-forward concluído |
| Nova versão | `cc80b3383210caf54aac81707503ad8affca5494` |
| Mudança de dependências | Nenhuma em `package.json` ou `package-lock.json` |
| Build TypeScript | Aprovado com `npm run build` |
| Suítes de teste | 6 aprovadas |
| Testes | 42 aprovados, 0 falhas |
| Servidor iniciado | Não |
| Produção alterada | Não |
| Estado local após validação | Limpo |

A nova atualização alterou **13 arquivos**, adicionando aproximadamente **783 linhas** e removendo **137 linhas** em relação à versão anterior. O commit também inclui um arquivo Markdown de comparativo, que não participa do runtime da aplicação.

## 3. Diferenças implementadas nesta atualização

### 3.1 Alocador sequencial de grupo e cota

A versão anterior ainda utilizava `Math.random()` para gerar grupo e cota quando o admin não informava valores. A nova versão substitui esse comportamento por `allocateGroupAndQuota`, que procura o grupo mais recente, identifica cotas usadas, escolhe a próxima cota sequencial e avança para o grupo seguinte quando o limite de 999 cotas é atingido. [2]

Quando o admin fornece grupo e cota, o alocador verifica se a combinação já está ocupada por um contrato não cancelado. Essa combinação passou a ser testada em quatro cenários: valores explícitos livres, colisão, próxima cota sequencial e rollover de grupo. [3]

A integração foi feita dentro da transação de `createSubscription`, antes da criação do contrato. Isso é uma melhora clara em relação à versão anterior e elimina o risco simples de colisões aleatórias.

Existe, porém, uma ressalva importante: o schema Prisma ainda não possui `@@unique([groupNumber, quotaNumber])`. O alocador faz leituras e depois cria o registro, mas não há uma restrição de banco que funcione como última barreira contra duas transações concorrentes escolhendo a mesma cota. A transação serializável pode detectar alguns conflitos dependendo do banco e da configuração, mas a proteção correta deve ser explicitada no schema e acompanhada de retry para conflito de serialização.

A correção recomendada é adicionar uma chave única composta, definir o comportamento para contratos cancelados e tratar a exceção de unicidade com uma nova tentativa de alocação. Essa alteração exige migration e deve ser testada em uma cópia do banco antes de homologação.

### 3.2 Listagem de pagamentos foi retirada do controller

A versão anterior já centralizava a geração de PIX e boleto, mas `listSubscriptionPayments` ainda consultava Prisma e calculava `nextIndex` dentro do controller. Agora existe `application/payments/listSubscriptionPayments.ts`, que concentra busca do contrato, autorização do solicitante, carregamento das parcelas e cálculo de `valueToPay`. O controller passou a apenas chamar o caso de uso e devolver a resposta. [4] [5]

Isso elimina a duplicação mais evidente entre o fluxo de geração e o fluxo de listagem. A nova cobertura testa contrato inexistente, ownership, acesso administrativo e formato dos valores retornados. [6]

A melhoria ainda é parcial no sentido arquitetural: o novo caso de uso continua importando Prisma diretamente, em vez de usar um `InstallmentRepository` ou `SubscriptionRepository` para todas as consultas. O controller foi limpo, mas a camada de aplicação ainda conhece a infraestrutura. Essa é uma pendência de arquitetura, não uma regressão funcional imediata.

### 3.3 Tratamento seguro de erros começou a ser aplicado

Foi criado `AppError` e a função `handleApiError`, que normaliza códigos, status HTTP, mensagens públicas e logging. Em produção, erros 500 deixam de retornar automaticamente a mensagem interna e passam a usar uma mensagem genérica. O caso de gateway indisponível também recebe resposta estável, com `retryable: true`. [7]

O controller de pagamentos já utiliza esse mecanismo para listagem, PIX e boleto. Isso corrige o problema anterior em que `details: error.message` era enviado diretamente ao cliente. [5]

A adoção ainda não é global. A busca no código mostra que apenas `paymentsApiController.ts` usa `handleApiError`; controllers de contratos, KYC e lances ainda retornam `error.message`, e o controller administrativo de gateways ainda inclui `details: error.message`. Portanto, o novo utilitário foi criado e aplicado no hotspot de pagamentos, mas a política de erros ainda não é uniforme.

A próxima etapa deve trocar respostas manuais por `handleApiError` ou por um middleware global, definir uma tabela de códigos públicos e garantir que erros internos tenham um `requestId` para correlação no log.

### 3.4 Rate limits ficaram mais seguros

A versão anterior usava números muito altos fora de produção e derivava a chave de rate limit decodificando o JWT sem verificar a assinatura. A nova versão usa `jsonwebtoken.verify` com `HS256` e combina o IP com o `userId` somente quando o token é válido. Tokens inválidos ou expirados caem para a chave baseada em IP. [8]

Os limites de desenvolvimento também foram reduzidos. Por exemplo, login admin passou de 5.000 para 50 tentativas na janela definida; registro passou de 5.000 para 50; pagamentos e lances passaram para 50; e criação de contrato passou para 50. O limite de produção permanece separado.

Essa é uma melhora concreta de segurança. Ainda recomendo validar se `JWT_SECRET` está configurado antes de subir um ambiente público, confirmar o comportamento atrás de proxy e monitorar falsos positivos quando muitos usuários legítimos compartilham o mesmo IP.

### 3.5 Leitura de contratos deixou de autocancelar registros

Na versão anterior, o caso de uso de listagem podia realizar autocancelamentos como efeito colateral de uma consulta. A nova versão de `getUserSubscriptions` se comporta como uma leitura pura: consulta o repositório, filtra relações incompletas e monta o DTO sem disparar mutações. [9]

O cleanup foi deslocado para `subscriptionCleanupService.ts`, que possui métodos específicos para contratos pendentes expirados e contratos órfãos. Essa separação melhora a auditabilidade e evita que uma simples abertura da tela altere o banco.

Contudo, a busca no código não encontrou nenhum uso do `SubscriptionCleanupService`, `cancelExpiredPending` ou `cancelOrphans` fora do próprio arquivo. Portanto, o serviço foi criado, mas ainda não está conectado a um job, comando operacional ou rotina agendada. Sem essa ligação, a correção arquitetural removeu o efeito colateral, porém o cleanup pode deixar de ocorrer.

A solução é ligar o serviço a um job explícito, com lock para impedir execução duplicada, logs de quantidade processada, métricas e estratégia de retry. O job deve ser executado fora do caminho HTTP.

## 4. Comparação por área

| Área | Situação na versão anterior | Situação em `cc80b33` | Avaliação |
|---|---|---|---|
| Grupo e cota | Geração aleatória com `Math.random()` | Alocação sequencial e testes | Corrigido em grande parte; falta constraint única |
| Listagem de pagamentos | Prisma e cálculo dentro do controller | Caso de uso próprio e testes | Melhorado; ainda falta repository dedicado |
| Geração de pagamentos | Caso de uso e factory já existiam | Mantidos e cobertos por testes adicionais | Estável e melhor validado |
| Erros de API | Mensagens internas expostas em vários pontos | Mapper seguro aplicado a pagamentos | Corrigido apenas no domínio de pagamentos |
| Rate limit | JWT decodificado sem verificação e limites altos | JWT verificado, chave híbrida e limites menores | Melhoria importante |
| Leitura de contratos | Podia autocancelar registros | Leitura pura | Corrigido; cleanup ainda não conectado |
| Admin de contratos | Schema não aplicado uniformemente | `CreateAdminSubscriptionSchema` aplicado | Corrigido no POST de criação |
| Testes | 31 testes em 4 suítes | 42 testes em 6 suítes | +11 testes, com foco nos novos riscos |
| Dependências | Instaladas na etapa anterior | Nenhuma alteração de lockfile | Não foi necessário reinstalar |

## 5. Pontos que ainda merecem atenção

### 5.1 Unicidade de grupo e cota

Este é o principal risco restante da atualização. O alocador é sequencial, mas o banco não declara a combinação grupo/cota como única. Em um cenário com duas criações simultâneas, ambas podem consultar a mesma última cota e tentar criar o mesmo próximo número.

A correção deve incluir migration, `@@unique([groupNumber, quotaNumber])`, tratamento de `P2002` ou equivalente e retry transacional. Também é necessário decidir se uma cota de contrato cancelado pode ser reutilizada; essa decisão não deve ficar implícita no `status: notIn: ['CANCELLED']`.

### 5.2 Error mapper incompleto

O novo arquivo de erros existe, mas a adoção está restrita ao controller de pagamentos. A inconsistência cria dois padrões de resposta: pagamentos retornam códigos públicos e os demais módulos ainda podem devolver mensagens internas.

A prioridade é migrar controllers de contratos, KYC, lances, autenticação e gateways. Depois, o middleware global deve tratar erros não capturados e gerar uma resposta consistente para API, mantendo mensagens de flash separadas para o painel EJS.

### 5.3 Cleanup sem agendamento

O serviço de limpeza foi bem separado, mas não está sendo chamado. Não é recomendável invocá-lo dentro de controllers. O projeto precisa de um mecanismo de job já existente ou de uma rotina de execução explícita, com proteção contra duas instâncias concorrentes.

### 5.4 Tipagem ainda incompleta

A camada de aplicação continua usando `any` em vários DTOs, mappers e retornos de Prisma. A nova versão melhorou os contratos de `createSubscription` e `listSubscriptionPayments`, mas ainda há espaço para substituir `any` por tipos gerados ou DTOs próprios.

Essa pendência não bloqueia o build, mas reduz a segurança durante futuras alterações. A migração deve começar pelos casos de uso de pagamentos e contratos, que lidam com valores financeiros e dados pessoais.

### 5.5 Listagem de pagamentos ainda conhece Prisma

O controller foi limpo, porém o caso de uso novo consulta Prisma diretamente. Para completar a arquitetura, a busca da assinatura e das parcelas deve ser movida para um repository com retornos tipados. O caso de uso deve ficar responsável por autorização e regra de cálculo, não pela forma específica da consulta.

### 5.6 Código legado e arquivos de documentação no commit

A nova versão ainda preserva shims de compatibilidade dos routers antigos, o que é aceitável durante a migração. O commit também adiciona um comparativo Markdown ao repositório; isso não afeta o runtime, mas convém decidir se relatórios técnicos devem permanecer versionados junto do código ou em uma pasta de documentação separada.

## 6. Próximos passos recomendados

### Prioridade P0 — antes de produção

Primeiro, crie a restrição única de grupo e cota com migration e retry de conflito. Em seguida, confirme que o alocador funciona contra o banco real, não apenas contra mocks. Depois, migre todos os controllers de API para o error mapper seguro e configure um `requestId` de correlação.

Também é necessário conectar o `SubscriptionCleanupService` a um job real e testar idempotência, falhas e execução concorrente. Sem isso, a regra de limpeza existe no código, mas não necessariamente no sistema operacional.

### Prioridade P1 — antes de homologação ampliada

Extraia as consultas de `listSubscriptionPayments` para repository, substitua `any` nos casos de uso financeiros e adicione testes de integração para criação de contrato, alocação concorrente, gateway indisponível, webhook repetido, boleto sem endereço e ownership entre usuários.

Revise ainda os limites de rate limit em staging, a configuração de proxy e o comportamento quando `JWT_SECRET` está ausente.

### Prioridade P2 — manutenção estrutural

Depois da estabilização, migre consultas restantes do admin para repositories e presenters, remova os shims antigos quando não houver consumidores e atualize dependências depreciadas em uma mudança isolada. Corrija também os espaços finais encontrados no diff de `rateLimits.ts` e no relatório Markdown.

## 7. Conclusão

A nova versão é **melhor que a anterior em todos os pontos principais que foram alterados**. Ela substitui aleatoriedade por alocação sequencial, centraliza a listagem de pagamentos, amplia a suíte de testes de 31 para 42 casos, reduz rate limits permissivos, verifica a assinatura do JWT para rate limiting, aplica tratamento seguro de erros em pagamentos e remove mutações escondidas das leituras de contratos.

O trabalho agora está na fase de fechamento operacional. O maior cuidado é não confundir “alocação sequencial dentro de uma transação” com “unicidade garantida no banco”; essa última ainda exige constraint e tratamento de concorrência. Da mesma forma, criar um serviço de cleanup não o executa automaticamente, e criar um error mapper não protege controllers que ainda não o utilizam.

Minha recomendação é manter `cc80b33` como base de homologação, não retornar à versão anterior, e executar primeiro as correções P0 antes de abrir o sistema para clientes reais.

## Referências

[1]: https://github.com/KL17166/concorciov2/tree/cc80b3383210caf54aac81707503ad8affca5494 "Repositório na nova versão"
[2]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/src/domain/calculations/groupQuotaAllocator.ts "Alocador sequencial de grupo e cota"
[3]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/src/__tests__/groupQuotaAllocator.test.ts "Testes do alocador de grupo e cota"
[4]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/src/application/payments/listSubscriptionPayments.ts "Caso de uso de listagem de pagamentos"
[5]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/src/controllers/api/paymentsApiController.ts "Controller de pagamentos atualizado"
[6]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/src/__tests__/paymentUseCases.test.ts "Testes dos casos de uso de pagamento e gateways"
[7]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/src/utils/errors.ts "Tratamento seguro de erros"
[8]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/src/config/rateLimits.ts "Rate limits e chave JWT verificada"
[9]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/src/application/subscriptions/getUserSubscriptions.ts "Listagem pura de contratos"
[10]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/src/services/subscriptionCleanupService.ts "Serviço de limpeza de contratos"
[11]: https://github.com/KL17166/concorciov2/blob/cc80b3383210caf54aac81707503ad8affca5494/server-consorcio/prisma/schema.prisma "Schema Prisma e restrições atuais"
