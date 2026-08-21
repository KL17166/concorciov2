# Índice de importação — lote 01

Este índice é um guia operacional para o cadastro manual no painel de Produtos. Cada ficha tem front matter com os campos que o formulário administrativo suporta. **Nenhum produto foi inserido automaticamente no banco**, e nenhum item inativo deve ser publicado sem confirmação de preço, disponibilidade e imagem.

## Itens prontos para conferência

| Ordem | Ficha | Tipo | Categoria | Publicação inicial |
|---:|---|---|---|---|
| 1 | `fichas/carros/honda_hr_v_2026.md` | `CARRO` | `suv` | Bloqueado até preço/versão |
| 2 | `fichas/motos/honda_cg_160_titan_2026.md` | `MOTO` | `street` | Pode ser conferido como ativo |
| 3 | `fichas/motos/yamaha_fazer_fz25_connected.md` | `MOTO` | `street` | Bloqueado até confirmação dos campos pendentes |
| 4 | `fichas/cartas_de_credito/honda_hr_v_easyhonda_84_meses.md` | `CARTA_CREDITO` | `veiculo` | Pode ser conferido como condição datada |
| 5 | `fichas/eletronicos/dell_inspiron_15_3530.md` | `ELETRONICO` | `notebook` | Inativo: indisponível |
| 6 | `fichas/eletronicos/dell_optiplex_7020_micro.md` | `ELETRONICO` | `outros` | Inativo: configuração pendente |
| 7 | `fichas/eletronicos/lenovo_ideapad_1_15_amd_pendente.md` | `ELETRONICO` | `notebook` | Inativo: fonte exigiu confirmação |
| 8 | `fichas/carros/toyota_corolla_cross_2027.md` | `CARRO` | `suv` | Conferir preço público, versão e URL de imagem |
| 9 | `fichas/carros/toyota_corolla_cross_hybrid_2027.md` | `CARRO` | `suv` | Conferir preço público, versão e URL de imagem |
| 10 | `fichas/motos/yamaha_tenere_700.md` | `MOTO` | `trail` | Inativo: preço pendente; foto local disponível |
| 11 | `fichas/eletronicos/acer_aspire_5_a515_57_51w5.md` | `ELETRONICO` | `notebook` | Inativo: preço, disponibilidade e foto pendentes |

## Como usar cada ficha

Abra o arquivo Markdown, leia o bloco entre os primeiros `---`, confirme se `name`, `price`, `type`, `category`, `brand`, `model`, `year`, `description`, `specs` e `imageUrls` correspondem à oferta que será apresentada. No painel administrativo, copie os campos para o formulário e mantenha `active: false` quando a ficha registrar indisponibilidade ou pendência.

As URLs em `imageUrls` são as que o formulário consegue salvar. Os arquivos em `fotos/` são cópias locais para revisão visual e eventual hospedagem autorizada; não use um caminho local do Windows como URL no painel. As fichas Toyota mantêm URLs primárias remotas porque o CDN retornou HTTP 403 no download automatizado; isso deve ser conferido no navegador antes de ativar.

## Critérios antes de ativar

Confirme a versão exata, a data do preço, frete, região, disponibilidade, direitos de uso das imagens e se os valores de carta de crédito foram separados de parcelas e taxas. Para cartas de crédito, não transformar crédito em parcela sem uma simulação específica da administradora.

## Próximos lotes

Este lote é uma base verificável, não representa todos os modelos existentes de Honda, Yamaha, Toyota, Dell, Lenovo, Acer ou outras marcas. A expansão deve seguir o mesmo processo: fonte primária, ficha própria, ressalva de data e status inativo quando a configuração não puder ser confirmada. O lote inclui carros, motos, cartas de crédito e eletrônicos; cada novo modelo deve entrar em um lote identificado para facilitar revisão e importação.
