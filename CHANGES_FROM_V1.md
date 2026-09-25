# Mudancas portadas do Consorcio para concorciov2

Documento criado em 14/09/2026 para rastrear as alteracoes feitas na sessao.
Abra este arquivo no workspace concorciov2 para continuar o trabalho a partir daqui.

---

## REGRA: Campos Bloqueados no Checkout

**Data:** 14/09/2026
**Arquivos alterados:**

### 1. zuvio-web/app/pages/checkout/index.vue

**Problema:** Os campos de Nome Completo e CPF eram editaveis pelo usuario na tela de checkout,
o que violava a regra de negocio: esses dados sao definidos no cadastro e sao IMUTAVEIS.

**Mudancas aplicadas:**

| Campo           | Antes                  | Depois                                          |
|-----------------|------------------------|-------------------------------------------------|
| Nome Completo   | v-model editavel       | disabled + readonly, exibe authStore.user.name  |
| CPF             | v-model editavel       | disabled + readonly, exibe authStore.user.cpf   |
| Telefone        | Editavel (sem label)   | Editavel com badge "Editavel"                   |
| Data Nascimento | (nao existia no v2)    | (nao aplicavel)                                 |

**Detalhes tecnicos:**
- Adicionado import { Lock } do lucide-vue-next
- Adicionados computed displayRegisteredName e displayRegisteredCpf que leem de authStore.user
- Adicionada funcao syncUserData() que sincroniza os dados do usuario autenticado nos refs
- Adicionado watch(() => authStore.user, ...) com immediate: true para reagir a login
- validateCurrentStep() no Step 0 agora SO valida o telefone (nome/CPF vem do cadastro)
- handleContinue() no Step 0 agora SO passa phone para o checkoutStore.updatePersonal()
- Removido watcher de CPF (era para mascara de input, nao faz mais sentido em campo readonly)
- Adicionados estilos CSS: .badge-locked, .badge-editable, .input-disabled, .form-input-disabled, .input-helper

---

### 2. server-consorcio/src/controllers/api/authController.ts

**Problema:** O endpoint PUT /api/profile aceitava name no body e o atualizava no banco,
o que permitia que um usuario autenticado alterasse seu proprio nome violando a regra de negocio.

**Mudancas aplicadas:**

- updateProfileSchema: Removido o campo name: z.string().min(3).optional()
- updateProfile handler: Removida a desestruturacao de name e o if (name) updateData.name = name
- Adicionado comentario explicando a regra: name e cpf sao imutaveis definidos no cadastro

**Campos permitidos via PUT /api/profile:**
- phone
- cep, street, number, neighborhood, city, state (endereco)

**Campos bloqueados (imutaveis):**
- name - definido no cadastro, apenas admin pode alterar
- cpf - definido no cadastro, apenas admin pode alterar
- birthDate - nao existe no schema do v2

---

## Diferencas principais entre os projetos

| Aspecto             | Consorcio (v1)            | concorciov2                             |
|---------------------|---------------------------|-----------------------------------------|
| App mobile          | Flutter (Dart)            | Capacitor (WebView wrapper do zuvio-web)|
| APK                 | Flutter build             | app-consorcio/consorcio.apk             |
| Backend             | Server/ (monolitico)      | server-consorcio/ (Clean Architecture)  |
| Frontend            | zuvio-web/                | zuvio-web/ (quase igual)                |
| birthDate checkout  | Sim (bloqueado)           | Nao existe no schema v2                 |

---

## Proximas tarefas sugeridas

- [ ] Verificar se o app-consorcio precisa ser rebuilt apos mudancas no zuvio-web
- [ ] Confirmar se server-consorcio tem GET /api/profile retornando name e cpf para o frontend
- [ ] Testar o fluxo completo: login > checkout > campos bloqueados exibem dados do cadastro
