# Catálogo real — lote 01

Este pacote reúne fichas de catálogo em Markdown, URLs de imagem compatíveis com o formulário administrativo e cópias locais das imagens para revisão ou upload posterior. Ele foi criado exclusivamente dentro do projeto ConcorcioV2.

## Formato aceito pelo painel

O cadastro administrativo de Produtos aceita os campos `name`, `price`, `type`, `category`, `brand`, `model`, `year`, `description`, `specs`, `imageUrls`, `active`, `isFeatured`, `isPopular`, `minDuration`, `maxDuration` e `adminFeeRate`. As fichas usam exatamente esses nomes no front matter YAML.

Os tipos e categorias usados neste lote são:

| Item | `type` | `category` | Status inicial |
|---|---|---|---|
| Honda HR-V 2026/2027 | `CARRO` | `suv` | Inativo: preço público não foi confirmado |
| Honda City Sedan 2026 | `CARRO` | `sedan` | Inativo: preço regional não foi confirmado |
| Honda CG160 Titan 2026 | `MOTO` | `street` | Ativo: preço público exibido pela Honda |
| Yamaha Fazer FZ25 Connected | `MOTO` | `street` | Inativo: preço e ficha numérica incompletos |
| Carta Honda HR-V EX EasyHonda | `CARTA_CREDITO` | `veiculo` | Ativo: crédito e condição publicados na página Honda |
| Dell Inspiron 15 3530 | `ELETRONICO` | `notebook` | Inativo: modelo indisponível |
| Dell OptiPlex 7020 Micro | `ELETRONICO` | `outros` | Inativo: configuração comercial não selecionada |
| Lenovo IdeaPad 1 15 AMD | `ELETRONICO` | `notebook` | Inativo: página exigiu redirecionamento/autenticação |
| Toyota Corolla Cross 2027 | `CARRO` | `suv` | Ativo para conferência: preço público exibido pela Toyota |
| Toyota Corolla Cross Hybrid 2027 | `CARRO` | `suv` | Ativo para conferência: preço público exibido pela Toyota |
| Yamaha Ténéré 700 | `MOTO` | `trail` | Inativo: preço não exibido na página consultada |
| Acer Aspire 5 A515-57-51W5 | `ELETRONICO` | `notebook` | Inativo: preço e disponibilidade não confirmados |

## Estrutura

```text
catalogo_real/
├── README.md
├── caderno_de_fontes.md
├── fichas/
│   ├── carros/
│   ├── motos/
│   ├── cartas_de_credito/
│   └── eletronicos/
├── fotos/
│   ├── carros/
│   ├── motos/
│   ├── cartas_de_credito/
│   └── eletronicos/
└── importacao/
```

## Convenção de nomes das imagens

O padrão é `marca_modelo_ano_numero.extensão`, em minúsculas, sem acentos e com sublinhados. Exemplos: `honda_cg_160_titan_2026_01.jpg` e `dell_inspiron_15_3530_01.png`.

As URLs remotas estão no campo `imageUrls` de cada ficha porque o formulário atual usa entradas do tipo URL. As cópias locais na pasta `fotos/` servem para conferência, tratamento e eventual hospedagem autorizada; o painel não consegue exibir um caminho local do Windows como URL pública. Quando um CDN oficial bloqueia a cópia automatizada, a ficha registra a URL e a limitação, sem substituir silenciosamente a foto por material de terceiro.

## Inventário das fotos locais

| Arquivo local | Ficha | Origem registrada | Observação |
|---|---|---|---|
| `fotos/carros/honda_hr_v_2026_01.webp` | Honda HR-V | Resultado associado à Honda Hit | Não tratar como imagem oficial Honda; a ficha usa URL oficial de referência e requer validação de licença |
| `fotos/carros/honda_city_sedan_2026_01.webp` | Honda City Sedan | Resultado associado à Honda Hit | Não tratar como imagem oficial Honda; a ficha usa `og:image` oficial como URL de cadastro e requer validação de licença |
| `fotos/cartas_de_credito/honda_hr_v_easyhonda_01.webp` | Carta Honda HR-V | Cópia do mesmo asset visual do HR-V | Uso sujeito a autorização; carta pode ser cadastrada sem imagem até confirmação |
| `fotos/motos/honda_cg_160_titan_2026_01.jpg` | Honda CG160 Titan | Resultado de car.blog | Não tratar como imagem oficial; a ficha usa URL oficial Honda para cadastro |
| `fotos/motos/honda_cg_160_titan_2026_02.jpg` | Honda CG160 Titan | Resultado de car.blog | Cópia repetida para segunda posição visual; substituir por asset distinto/licenciado antes da publicação |
| `fotos/motos/yamaha_fazer_fz25_connected_01.png` | Yamaha FZ25 | Resultado da página oficial Yamaha | Asset associado ao catálogo Yamaha; ainda deve ser conferido quanto aos termos de uso comercial |
| `fotos/eletronicos/dell_inspiron_15_3530_01.png` | Dell Inspiron 15 3530 | CDN Dell, campo `og:image` da página oficial | Produto indisponível; manter inativo |
| `fotos/eletronicos/dell_optiplex_7020_micro_01.jpg` | Dell OptiPlex 7020 Micro | CDN Dell, campo `og:image` da página oficial | Configuração comercial precisa ser confirmada |
| `fotos/eletronicos/lenovo_ideapad_1_15_amd_01.png` | Lenovo IdeaPad 1 | Resultado de página Lenovo | Não usar no cadastro atual: a configuração exata do produto não foi confirmada |
| `fotos/motos/yamaha_tenere_700_01.webp` | Yamaha Ténéré 700 | Resultado identificado como Yamaha | Conferir termos de uso comercial antes da publicação |
| `fotos/carros/toyota_corolla_cross_2027_01.jpeg` | Toyota Corolla Cross 2027 | Não copiada: CDN Toyota retornou HTTP 403 | Usar a URL remota da ficha apenas após confirmar carregamento e autorização |
| `fotos/carros/toyota_corolla_cross_hybrid_2027_01.png` | Toyota Corolla Cross Hybrid 2027 | Não copiada: CDN Toyota retornou HTTP 403 | Usar a URL remota da ficha apenas após confirmar carregamento e autorização |
| `fotos/eletronicos/acer_aspire_5_a515_57_51w5_01.*` | Acer Aspire 5 A515-57-51W5 | Nenhum asset local confirmado | Manter sem imagem até localizar asset do SKU com uso permitido |

## Regras de segurança comercial

Preço público sugerido não é parcela de consórcio. A ficha da Honda CG160 usa preço público sugerido da fábrica, sem frete e com referência regional. A ficha da carta de crédito usa o valor do crédito publicado na condição Honda; não calcula parcela e não substitui contrato ou proposta.

Itens com `price: 0` ou `active: false` não devem ser publicados. Eles representam modelos encontrados em catálogos reais, mas com preço, configuração ou disponibilidade não confirmados na coleta.

Descrições foram redigidas de forma própria a partir das fontes. Não foi feita cópia integral de textos promocionais. Antes de disponibilizar fotos em produção, confirmar autorização, licença ou substituir por imagens próprias/licenciadas. O caderno de fontes preserva as URLs consultadas e as ressalvas de cada item.

## Importação manual sugerida

Abra cada Markdown, confirme preço, configuração, disponibilidade e autorização de imagem. No painel, selecione o `type` e a `category` indicados, copie `description` e o objeto `specs` para o formulário, use as URLs do campo `imageUrls` e deixe inativos os itens marcados como pendentes. Salvar um produto gera automaticamente os planos anuais conforme `minDuration` e `maxDuration`.
