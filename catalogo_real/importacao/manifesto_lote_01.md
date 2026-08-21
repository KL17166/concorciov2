# Manifesto do lote 01 — catálogo real

Este manifesto lista os arquivos preparados para conferência manual no painel administrativo. O lote contém **16 fichas Markdown**, sendo cinco cartas de crédito institucionais, e **10 fotos locais não vazias**. Nenhum produto foi inserido automaticamente no banco.

## Fichas por categoria

| Categoria | Fichas | Condição inicial |
|---|---:|---|
| Carros | 4 | Honda HR-V e City com preço pendente; Toyota Corolla Cross e Hybrid com preço público observado e URL de imagem remota |
| Motos | 3 | Honda CG160 com preço observado; Yamaha FZ25 com campos pendentes; Yamaha Ténéré 700 sem preço numérico |
| Cartas de crédito | 5 | Honda HR-V com condição publicada; BB carro, moto, imóvel e serviços sem valor/parcela inventados |
| PCs e notebooks | 4 | Dell Inspiron, Dell OptiPlex, Lenovo IdeaPad e Acer Aspire; itens inativos quando preço/configuração não foram confirmados |

## Arquivos de ficha

| Arquivo | Produto | Tipo | Status inicial |
|---|---|---|---|
| `fichas/carros/honda_hr_v_2026.md` | Honda HR-V 2026/2027 | `CARRO` | Inativo até preço/versão |
| `fichas/carros/honda_city_sedan_2026.md` | Honda City Sedan 2026 | `CARRO` | Inativo até preço regional |
| `fichas/carros/toyota_corolla_cross_2027.md` | Toyota Corolla Cross 2027 | `CARRO` | Conferir preço, versão e imagem antes de ativar |
| `fichas/carros/toyota_corolla_cross_hybrid_2027.md` | Toyota Corolla Cross Hybrid 2027 | `CARRO` | Conferir preço, versão e imagem antes de ativar |
| `fichas/motos/honda_cg_160_titan_2026.md` | Honda CG160 Titan 2026 | `MOTO` | Pode ser conferida como ativa, após direitos da imagem |
| `fichas/motos/yamaha_fazer_fz25_connected.md` | Yamaha Fazer FZ25 Connected | `MOTO` | Inativo até confirmação dos campos pendentes |
| `fichas/motos/yamaha_tenere_700.md` | Yamaha Ténéré 700 | `MOTO` | Inativo até confirmação do preço |
| `fichas/cartas_de_credito/honda_hr_v_easyhonda_84_meses.md` | Honda HR-V EX EasyHonda, 84 meses | `CARTA_CREDITO` | Condição datada; confirmar simulação |
| `fichas/cartas_de_credito/bb_carta_de_credito_carro_pendente.md` | Carta BB para carro | `CARTA_CREDITO` | Pendente de valor e simulação |
| `fichas/cartas_de_credito/bb_carta_de_credito_moto_pendente.md` | Carta BB para moto | `CARTA_CREDITO` | Pendente de valor e simulação |
| `fichas/cartas_de_credito/bb_carta_de_credito_imovel_pendente.md` | Carta BB para imóvel | `CARTA_CREDITO` | Pendente de valor e simulação |
| `fichas/cartas_de_credito/bb_carta_de_credito_servicos_pendente.md` | Carta BB para serviços | `CARTA_CREDITO` | Pendente de valor e simulação |
| `fichas/eletronicos/dell_inspiron_15_3530.md` | Dell Inspiron 15 3530 | `ELETRONICO` | Inativo: indisponível |
| `fichas/eletronicos/dell_optiplex_7020_micro.md` | Dell OptiPlex 7020 Micro | `ELETRONICO` | Inativo: configuração comercial pendente |
| `fichas/eletronicos/lenovo_ideapad_1_15_amd_pendente.md` | Lenovo IdeaPad 1 15 AMD | `ELETRONICO` | Inativo: confirmação comercial pendente |
| `fichas/eletronicos/acer_aspire_5_a515_57_51w5.md` | Acer Aspire 5 A515-57-51W5 | `ELETRONICO` | Inativo: preço, disponibilidade e foto pendentes |

## Fotos locais

| Arquivo | Produto relacionado | Origem registrada | Uso recomendado |
|---|---|---|---|
| `fotos/carros/honda_hr_v_2026_01.webp` | Honda HR-V | Parceiro Honda Hit | Apenas referência até licença confirmada |
| `fotos/carros/honda_city_sedan_2026_01.webp` | Honda City Sedan | Parceiro Honda Hit | Apenas referência até licença confirmada |
| `fotos/cartas_de_credito/honda_hr_v_easyhonda_01.webp` | Carta Honda HR-V | Cópia do asset do HR-V | Não publicar sem autorização |
| `fotos/motos/honda_cg_160_titan_2026_01.jpg` | Honda CG160 Titan | car.blog | Não declarar como oficial Honda |
| `fotos/motos/honda_cg_160_titan_2026_02.jpg` | Honda CG160 Titan | car.blog | Cópia repetida; substituir por asset distinto/licenciado |
| `fotos/motos/yamaha_fazer_fz25_connected_01.png` | Yamaha FZ25 Connected | Asset associado à página Yamaha | Conferir termos comerciais |
| `fotos/motos/yamaha_tenere_700_01.webp` | Yamaha Ténéré 700 | Resultado identificado como Yamaha | Conferir termos comerciais |
| `fotos/eletronicos/dell_inspiron_15_3530_01.png` | Dell Inspiron 15 3530 | CDN Dell / `og:image` | Uso sujeito aos termos Dell |
| `fotos/eletronicos/dell_optiplex_7020_micro_01.jpg` | Dell OptiPlex 7020 Micro | CDN Dell / `og:image` | Uso sujeito aos termos Dell |
| `fotos/eletronicos/lenovo_ideapad_1_15_amd_01.png` | Lenovo IdeaPad 1 | Asset associado à página Lenovo | Não usar até configuração/licença confirmadas |

## Itens sem cópia local

O Toyota Corolla Cross e o Toyota Corolla Cross Hybrid possuem URLs de mídia primárias no front matter das fichas. O navegador conectado conseguiu abrir a imagem primária do Corolla Cross, mas o CDN Toyota retornou HTTP 403 para o download automatizado. Por isso não foi criado arquivo local com material alternativo. O Acer Aspire 5 também permanece sem foto local porque ainda não foi identificado um asset do SKU com origem e uso comercial verificáveis.

## Regra de ativação

Ativar um item somente depois de confirmar a versão, preço, disponibilidade, região, frete, data de consulta e autorização de uso das imagens. Para cartas de crédito, o valor de crédito, prazo, taxa e parcela devem permanecer separados e só podem ser preenchidos a partir de uma simulação ou condição específica da administradora.
