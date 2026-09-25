# 📦 CATÁLOGO MULTI-AGENTE — CONSÓRCIO

## Como funciona

6 agentes rodam em paralelo, cada um especializado em um tipo.
Todos guardam na mesma pasta: catalogo_agentes/produtos/

## Passo a passo para usar

### 1. Abra 6 chats em paralelo (Claude, GPT, Gemini...)

### 2. Para cada chat, copie o PROMPT_LOOP_UNIVERSAL.md e substitua SEU_TIPO:

| Chat | SEU_TIPO        | Arquivo de saída         |
|------|-----------------|--------------------------|
| 1    | MOTO            | produtos/MOTO.json       |
| 2    | CARRO           | produtos/CARRO.json      |
| 3    | IMOVEL          | produtos/IMOVEL.json     |
| 4    | ELETRONICO      | produtos/ELETRONICO.json |
| 5    | CARTA_CREDITO   | produtos/CARTA_CREDITO.json |
| 6    | SERVICO         | produtos/SERVICO.json    |

### 3. Deixe rodar

Cada agente vai:
- Ler o arquivo JSON do seu tipo
- Descobrir quais produtos já existem
- Pesquisar 5 novos por rodada
- Salvar e começar a próxima rodada automaticamente

### 4. Para parar um agente

Digite: PARAR (ou STOP)

### 5. Para importar no servidor

Rode o script merge.ps1 para gerar o catalogo_final.json e importar via API.

## Estrutura de arquivos

catalogo_agentes/
  PROMPT_LOOP_UNIVERSAL.md   ← prompt que você copia para cada agente
  README.md                  ← este arquivo
  produtos/
    MOTO.json                ← preenchido pelo Agente 1
    CARRO.json               ← preenchido pelo Agente 2
    IMOVEL.json              ← preenchido pelo Agente 3
    ELETRONICO.json          ← preenchido pelo Agente 4
    CARTA_CREDITO.json       ← preenchido pelo Agente 5
    SERVICO.json             ← preenchido pelo Agente 6
