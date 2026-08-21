# Caderno de fontes — catálogo real

## Escopo e regra de uso

Este caderno registra apenas informações observadas em páginas públicas de fabricantes ou em fontes primárias. As descrições que serão entregues no catálogo devem ser redigidas de forma própria, sem copiar texto promocional integral. As imagens de fabricantes serão mantidas com a URL de origem e uma observação de direitos autorais; antes de publicar comercialmente, o responsável deverá confirmar a autorização de uso ou substituir a imagem por material licenciado.

## Fontes primárias consultadas

| ID | Categoria | Fonte | Informações observadas |
|---|---|---|---|
| F01 | Motos | [Honda Motos — modelos 0 km](https://www.honda.com.br/motos/) | A página lista modelos e preços iniciais, incluindo Honda Biz Kuromi, CB300F Twister, CB1000 Hornet, Gold Wing, XRE300 Sahara, XR300L Tornado, Pop110i ES, X-ADV, CBR1000RR-R Fireblade SP, Elite125, CG 50 anos, CRF1100L Africa Twin, XL750 Transalp, CB750 Hornet, CB650R E-Clutch e CB500 Hornet. Também informa a existência de serviço financeiro com consórcio, financiamento e seguro. |
| F02 | Motos | [Yamaha Motor Brasil](https://www.yamaha-motor.com.br/) | O catálogo apresenta filtros por Scooter, Street, Trail, Esportiva, MT-Series, Sport Touring e Racing. Foram observados modelos como NEO'S Connected, Fluo ABS Hybrid Connected, Aerox ABS Connected, NMAX, Factor, Fazer FZ15, Fazer FZ25, Crosser 150, Lander, Ténéré 700, R15, R3, MT-03, MT-07 e Tracer 7, com ano, garantia e preço inicial exibidos em vários cards. |
| F03 | Carros | [Honda Automóveis Brasil](https://www.honda.com.br/automoveis/) | A página lista WR-V, HR-V, Civic Advanced Hybrid, City Hatchback, City Sedan, ZR-V, Accord Advanced Hybrid, Civic Type R e CR-V Advanced Hybrid, com filtros de Hatchback, Sedan e SUV. A página também informa garantia de 6 anos sem limite de quilometragem para automóveis Honda. |

## Dados candidatos para o primeiro lote

| Categoria | Fabricante | Modelos candidatos | Campos a confirmar na página individual |
|---|---|---|---|
| Motos | Honda | CB300F Twister, XRE300 Sahara, CG 160, Pop110i ES, CB500 Hornet | preço inicial, cilindrada, potência, torque, câmbio, freios, peso, capacidade do tanque, garantia e imagens |
| Motos | Yamaha | Factor, Fazer FZ25 Connected, Crosser 150, Lander Connected, R15 ABS, MT-03 Connected | preço inicial, ano, garantia, cilindrada, potência, torque, câmbio, freios, peso, tanque e imagens |
| Carros | Honda | WR-V, HR-V, City Sedan, City Hatchback, Civic Advanced Hybrid, ZR-V | versão de referência, preço, motorização, potência, câmbio, consumo, dimensões, porta-malas, segurança e imagens |
| Carros | Toyota | Corolla Cross, Corolla, Yaris Cross, Hilux | página oficial brasileira, versão e dados técnicos devem ser confirmados antes da redação |

## Critérios de coleta

Cada produto será gravado com `name`, `type`, `category`, `price`, `brand`, `model`, `year`, `description`, `specs`, `imageUrl` e `imageUrls`, que correspondem ao formulário e ao controller atuais do backend. O preço será registrado como preço público inicial ou como valor indicativo, sempre com a data de consulta e a ressalva de que pode variar por versão, localidade, tributos e condições comerciais. Cartas de crédito não devem receber um preço inventado: o valor da carta será tratado como valor de crédito e separado de eventual taxa, plano ou parcela do consórcio.

As imagens serão nomeadas no padrão `categoria_marca_modelo_ano_01.ext`, com letras minúsculas, sem acentos e usando hífens ou sublinhados de forma consistente. Cada arquivo terá uma linha correspondente em `imageUrls` e a ficha Markdown apontará para o caminho relativo local.

## Referências

[1]: https://www.honda.com.br/motos/ "Honda Motos — modelos 0 km"
[2]: https://www.yamaha-motor.com.br/ "Yamaha Motor Brasil — motos, scooters, peças e ofertas"
[3]: https://www.honda.com.br/automoveis/ "Honda Automóveis Brasil — modelos e versões"


## Fontes adicionais consultadas

| ID | Categoria | Fonte | Informações observadas |
|---|---|---|---|
| F04 | Cartas de crédito | [Consórcio BB — imóvel, carro, moto e mais](https://www.bb.com.br/site/pra-voce/consorcios/) | O BB apresenta opções para carros, motos, trator e caminhão, imóveis, sustentáveis, eletro e eletrônicos, gamer e serviços. A página explica que a carta de crédito é o documento recebido após a contemplação e que ela permite realizar a compra à vista; também descreve sorteio, lance, grupo, assembleia e a composição do consórcio. |
| F05 | PCs e notebooks | [Loja oficial Dell Brasil](https://www.dell.com/pt-br) | A página oficial separa Notebooks, Computadores, PCs e Notebooks Gamer, Acessórios e Monitores. Foram observados preços iniciais gerais de notebooks, computadores e gamer na página de ofertas, mas o valor deve ser confirmado na página individual e na configuração exata antes de entrar no catálogo. |
| F06 | PCs e notebooks | [Lenovo Brasil](https://www.lenovo.com/br/pt/) | A página oficial apresenta as áreas de PCs e Tablets, Desktops, Workstations, Notebooks e Gaming, além de links de catálogo, suporte e promoções. A página inicial não foi usada para inventar preços ou especificações; os modelos serão coletados em páginas individuais. |
| F07 | Motos | [Honda Motos — página de modelos](https://www.honda.com.br/motos/) | A fonte primária confirma os modelos e preços iniciais observados no primeiro lote, além da seção de serviços financeiros Honda. |
| F08 | Carros | [Honda Automóveis — modelos e versões](https://www.honda.com.br/automoveis/) | A fonte primária confirma os modelos WR-V, HR-V, Civic Advanced Hybrid, City Hatchback, City Sedan, ZR-V, Accord Advanced Hybrid, Civic Type R e CR-V Advanced Hybrid, organizados por carroceria. |

## Regra específica para cartas de crédito

As páginas de instituições de consórcio serão usadas para descrever o funcionamento e as finalidades permitidas. O catálogo do ConcorcioV2 deverá representar cada carta com `type: CARTA_CREDITO`, `category` como `veiculo`, `imovel`, `servico`, `eletro-eletronico` ou `livre`, e `price` como valor de crédito. Não serão atribuídas taxas, prazos, parcelas ou promessas de contemplação sem fonte específica e data de consulta.

## Referências adicionais

[4]: https://www.bb.com.br/site/pra-voce/consorcios/ "Consórcio BB — imóvel, carro, moto e mais"
[5]: https://www.dell.com/pt-br "Loja Oficial Dell Brasil"
[6]: https://www.lenovo.com/br/pt/ "Site oficial da Lenovo Brasil"


## Fontes específicas do primeiro lote

| ID | Produto | Fonte | Dados confirmados |
|---|---|---|---|
| F09 | Honda City Sedan | [Página oficial do City Sedan](https://www.honda.com.br/automoveis/citysedan) | Modelo/ano 2026/2026; versões Touring, EXL, EX e LX; motor 1.5 L DOHC VTEC com injeção direta; Honda SENSING, myHonda Connect, multimídia de 8 polegadas em versão Touring e freio de estacionamento eletrônico com Brake Hold. O preço público sugerido é exibido de forma dependente de região/versão e não foi inventado quando a página não o mostrou no texto extraído. |
| F10 | Honda City Sedan | [Catálogo técnico HTML do City Sedan](https://www.honda.com.br/automoveis/sites/hab/files/catalogos/city_sedan/index.html) | Confirma a descrição técnica do motor 1.5 L DOHC VTEC com injeção direta, o pacote Honda SENSING e a existência de especificações por versão; dados de potência e torque não foram preenchidos sem leitura inequívoca da tabela técnica. |
| F11 | Yamaha Fazer FZ25 Connected | [Página oficial Yamaha](https://www.yamaha-motor.com.br/product/fazer-fz25-connected-155370) | A fonte confirma a existência do modelo e informa sistema ABS nas duas rodas; demais números serão preenchidos somente após a leitura da ficha individual. |

## Imagens localizadas no levantamento visual

| Arquivo temporário | Resultado | Origem exibida | Uso previsto |
|---|---|---|---|
| `/home/ubuntu/upload/search_images/jTs2YY1ngz8K.webp` | Fazer FZ25 Connected | Yamaha, `www.yamaha-motor.com.br` | Candidato para `02-motos/fotos/yamaha_fazer_fz25_connected_2026_01.webp`, sujeito à verificação da URL e dos direitos de uso |
| `/home/ubuntu/upload/search_images/9GmQT5Mxh7MJ.webp` | Honda Motos | Origem não exibida no resultado resumido | Não usar até confirmar URL primária |
| `/home/ubuntu/upload/search_images/iYNklAJXCgaH.jpg` | Honda City | Origem não exibida no resultado resumido | Não usar até confirmar URL primária |
| `/home/ubuntu/upload/search_images/SZ0lLKh4jQIv.jpg` | Honda City | Honda Middle East | Não usar como imagem do catálogo brasileiro sem confirmar versão e autorização |

Imagens de resultados sem fonte clara não serão incorporadas ao pacote. O arquivo da Yamaha só será copiado depois de validar que corresponde ao produto e de registrar sua URL primária.


## Ficha técnica confirmada — Yamaha FZ25 Connected

A página [FAZER FZ25 CONNECTED](https://www.yamaha-motor.com.br/product/fazer-fz25-connected-155370) informa motor de 250 cilindradas, ABS nas duas rodas, farol com projetor, DRL e lanterna, conectividade Yamaha Motorcycle Connect via Yamaha Motor On, painel LCD digital, tomada 12 V, suspensão traseira ajustável e garantia de 4 anos. A página identifica o modelo como ano 2026 e mostra preço público sugerido de R$ 25.290,00 à vista, sem frete, além de R$ 1.632,00 de frete e seguro de frete; o próprio texto informa que condições e preços estão sujeitos a alteração e que a oferta de financiamento tem validade temporal e limites de unidades. O catálogo usará o preço público sem frete como `price` e registrará frete e data em `specs`, evitando misturar financiamento com preço do produto.

A imagem principal observada na página individual da Yamaha corresponde visualmente ao modelo Fazer FZ25 Connected. A cópia local será feita somente a partir de uma URL primária identificada no HTML, não do thumbnail de busca.


## URLs primárias de imagens encontradas no HTML da Yamaha FZ25

O HTML salvo da página oficial contém as seguintes imagens associadas ao produto: `https://stgmkpeus.blob.core.windows.net/yamaha-motor-strapi/uploads/fz25_mobile_00d1548af2.webp` e `https://stgmkpeus.blob.core.windows.net/yamaha-motor-strapi/uploads/fz25_desktop_d9ce77ec1c.webp`. A versão desktop foi visualmente compatível com a página oficial. Os arquivos serão copiados para `02-motos/fotos/` com nomes locais padronizados somente após validar o download e manter a URL de origem na ficha do produto.


## Fichas confirmadas — Honda HR-V e Honda CG160 Titan

### Honda HR-V 2026

A [página oficial do Novo HR-V 2026](https://www.honda.com.br/automoveis/hrv) apresenta as versões Touring, Advance, EXL e EX, com rodas de liga leve aro 18 polegadas, porta-malas automático com função Hands Free, Honda SENSING e myHonda Connect. Para a versão Touring, a página informa motor 1.5 L VTEC Turbo Flex com injeção direta e 177 cv. O texto legal identifica ano/modelo 2026/2027 e registra garantia de 6 anos para veículos Honda fabricados a partir de 2026, sem limite de quilometragem, sob as condições da rede autorizada. A página também exibe condição de Consórcio Honda para HR-V EX: plano #EasyHonda de 84 meses, crédito de R$ 110.126,00, taxa de administração de 15,5%, fundo de reserva de 4,5% e seguro prestamista de 1,68% quando contratado; essa condição deve ser tratada como informação de referência datada, não como parcela fixa universal. O preço público sugerido não apareceu no texto extraído e não será inventado.

### Honda CG160 Titan 2026

A [página oficial da Honda CG160 Titan 2026](https://www.honda.com.br/motos/street/city/cg-160-titan) descreve a motocicleta como modelo urbano com freio ABS, farol e lanterna em LED. A ficha exibida informa motor OHC monocilíndrico de quatro tempos, arrefecido a ar, cilindrada de 162,7 cc, potência máxima de 10,6 kW/14,4 cv a 8.000 rpm na gasolina e 10,8 kW/14,7 cv a 8.000 rpm no etanol, torque máximo de 13,8 N.m/1,41 kgf.m a 6.750 rpm na gasolina e 14,0 N.m/1,43 kgf.m a 6.750 rpm no etanol. A página informa preço público sugerido de R$ 20.590,00, sem frete, com tabela em vigor a partir de 06/01/2026 e base no Distrito Federal; o valor pode variar por região e frete. Também informa três anos de garantia sem limite de quilometragem e óleo grátis em sete revisões, conforme regras da Honda.


## Fichas confirmadas — Dell Inspiron 15 e Lenovo IdeaPad 1

### Dell Inspiron 15

A [página oficial do Dell Inspiron 15](https://www.dell.com/pt-br/shop/notebooks-dell/notebook-inspiron-15/spd/inspiron-15-3530-laptop) aparece como produto indisponível na captura atual, mas mantém especificações técnicas históricas e uma imagem do modelo. Entre as configurações publicadas estão processadores Intel Core i3-1305U, i5-1335U e i7-1355U de 13ª geração, além de Intel U300, N100 e i3-N305; memória DDR4 de 4 GB a 16 GB conforme configuração; SSDs de 128 GB a 2 TB, algumas combinações com HDD de 1 TB; telas de 15,6 polegadas HD ou FHD; baterias integradas de 41 Wh ou 54 Wh. O produto não será cadastrado como oferta ativa se a indisponibilidade persistir; poderá ser incluído em um lote histórico/referência com essa condição explícita.

A página mostra produtos semelhantes, como o Novo Notebook Dell 15 a partir de R$ 3.929,00 e o Notebook Dell 14 a partir de R$ 4.899,00, mas esses valores pertencem a produtos diferentes e não serão atribuídos ao Inspiron 15.

### Lenovo IdeaPad 1 (15", AMD)

A [página oficial do Lenovo IdeaPad 1 (15", AMD)](https://www.lenovo.com/br/pt/p/laptops/ideapad/ideapad-100/88ips101778/88ips101778) informa preço inicial de R$ 2.904,99, processador até AMD Ryzen 5 7520U, Windows 11 Home ou Linux, até 8 GB de memória, SSD QLC M.2 PCIe de até 256 GB, gráficos AMD Radeon integrados, tela de 15,6 polegadas HD TN 1366x768 a 220 nits, bateria de 42 Wh, peso aproximado de 1,6 kg, webcam HD 720p, Wi-Fi 6 e Bluetooth 5.0. A fonte alerta que as especificações podem variar por modelo e região; o registro do produto manterá esse aviso.


## Fontes institucionais — cartas de crédito

| ID | Fonte | Informação aproveitável |
|---|---|---|
| F12 | [Consórcio Honda](https://www.consorciohonda.com.br/) | Administradora/fonte oficial para simulação online de consórcio de motos e carros; a página deve ser usada para explicar que planos e valores precisam ser simulados, sem inventar parcela. |
| F13 | [Consórcio BB](https://www.bb.com.br/site/pra-voce/consorcios/) | Fonte institucional para consórcios de carro, casa, moto e serviços; descreve contratação sem juros remuneratórios, sujeita às taxas e regras do grupo, e oferece simulação. |
| F14 | [Consórcio de Carros BB](https://www.bb.com.br/site/pra-voce/consorcios/consorcio-de-carros/) | Confirma carta de crédito para carros novos ou usados; valores e parcelas dependem da simulação. |
| F15 | [Consórcio de Imóveis BB](https://www.bb.com.br/site/pra-voce/consorcios/consorcio-de-imoveis/) | Confirma uso da carta para comprar, construir ou reformar imóvel; não cadastrar valor sem simulação. |
| F16 | [Consórcios de Serviços BB](https://bb.com.br/site/pra-voce/consorcios/consorcios-de-servicos/) | Confirma que, após contemplação, o valor contratado é disponibilizado por meio de carta de crédito; não cadastrar parcela universal. |
| F17 | [Consórcio BB — outros bens móveis](https://www.bb.com.br/site/pra-voce/consorcios/consorcio-de-outros-bens-moveis/) | Confirma carta para outros bens móveis, aplicável como fonte conceitual para equipamentos de informática; valor e condições exigem simulação. |
| F18 | [BB — notícia sobre consórcio de serviços](https://www.bb.com.br/pbb/pagina-inicial/imprensa/n/26913/BB%20%C3%A9%20o%201%C2%BA%20banco%20a%20oferecer%20todas%20as%20op%C3%A7%C3%B5es%20de%20cons%C3%B3rcio) | Resultado de busca informa faixa histórica de R$ 1.500,00 a R$ 30.000,00 e parcela a partir de R$ 60,87; por ser notícia antiga, não será usada como preço atual, apenas como referência histórica não importável. |

Regra do pacote: cartas de crédito sem valor público atual serão geradas como fichas de simulação, com `price` nulo/indicativo e aviso de que a oferta precisa ser simulada. Não serão inventadas parcelas, taxa total ou contemplação.


### Yamaha FZ25 Connected

A [página oficial da Yamaha FZ25 Connected](https://www.yamaha-motor.com.br/product/fazer-fz25-connected-155370) descreve motor de 250 cilindradas, desempenho e eficiência para uso urbano e viagens, manutenção simples e quatro anos de garantia Yamaha. O conteúdo textual extraído da página não exibiu uma ficha numérica completa nem preço público na sessão consultada; portanto o item deve ser registrado com especificações confirmadas apenas como `250 cc`, garantia de quatro anos e aviso para consulta da concessionária. Não serão inventados potência, torque, consumo ou preço.

### Dell OptiPlex 7020 Micro

A [página oficial do Dell OptiPlex 7020 Micro](https://www.dell.com/pt-br/shop/computadores-all-in-ones-e-workstations/desktop-optiplex-micro/spd/optiplex-7020-micro) marca o modelo como indisponível, mas publica ficha técnica detalhada. As opções incluem Intel Core 300T, i3-14100T, i3-14400T, i5-14500T, i5-14600T, i7-14700T de 14ª geração e algumas opções de 12ª geração; memória DDR5 de 8 GB a 64 GB; SSD NVMe de 256 GB a 2 TB; Windows 11 Home/Pro, Windows 11 Pro National Education ou Ubuntu Linux 22.04 LTS; Wi-Fi 6/6E e Bluetooth 5.3; dimensões de 18,2 cm de altura, 3,6 cm de largura e 17,8 cm de profundidade; peso entre 1,09 kg e 1,34 kg. A página também informa portas USB, DisplayPort, HDMI, Ethernet, slots M.2 e adaptadores de 65 W ou 90 W. O preço do OptiPlex indisponível não será inventado. A página apresenta como produtos semelhantes o Dell Pro Slim Plus a partir de R$ 7.599,00 e o Dell Pro Slim a partir de R$ 5.599,00; esses valores pertencem aos modelos semelhantes e não ao OptiPlex.


### Dell Inspiron 15 3530

A [página oficial do Dell Inspiron 15 3530](https://www.dell.com/pt-br/shop/notebooks-dell/notebook-inspiron-15/spd/inspiron-15-3530-laptop) informa que o modelo está indisponível e apresenta as configurações publicadas: processadores Intel Core i3-1305U, i5-1335U e i7-1355U de 13ª geração, além de Intel U300, N100 e i3-N305; gráficos Intel UHD/Iris Xe ou NVIDIA GeForce MX550 de 2 GB; telas de 15,6 polegadas HD ou FHD em diferentes frequências; memórias DDR4 de 4 GB a 16 GB conforme a configuração; armazenamento SSD NVMe de 128 GB a 2 TB e opções eMMC de 128 GB. O conteúdo oficial marca a oferta do modelo como fora de estoque/indisponível, portanto o preço não deve ser inventado. A página oferece modelos sucessores, incluindo o Novo Notebook Dell 15 (DC15250) a partir de R$ 3.929,00, mas esse valor não pertence ao Inspiron 15 3530.

### Lenovo IdeaPad 1 15 AMD

A [URL oficial do Lenovo IdeaPad 1 15 AMD](https://www.lenovo.com/br/pt/p/laptops/ideapad/ideapad-100/88ips101778/88ips101778) foi registrada como fonte pretendida para o segundo notebook. A extração pública retornou apenas conteúdo de autenticação/redirecionamento da Lenovo e não permitiu confirmar configuração, preço ou disponibilidade. O item deve permanecer pendente ou inativo até a ficha ser confirmada diretamente na página sem login.

### Controle de imagens

Imagens são tratadas como assets de origem externa. O pacote registra URL da fonte junto de cada ficha e inclui aviso de verificação de licença. Não se presume que uma imagem de fabricante ou revendedor possa ser publicada comercialmente sem autorização; antes de publicar, confirmar os termos do fabricante, usar mídia licenciada ou substituir por fotos próprias/licenciadas.


## Fontes adicionais e itens coletados — consulta de 21/08/2026

### Toyota

- Corolla Cross: https://www.toyota.com.br/modelos/corolla-cross. A página exibiu Corolla Cross 2027, preço público sugerido a partir de R$ 197.120,00, frete incluso e base Brasília. Também informou motor 2.0 L Dual VVT-iE 16 V DOHC Flex, 175 cv com etanol, 21,3 kgf.m, transmissão automática CVT de 10 velocidades, Toyota Safety Sense, sete airbags, Toyota Play 2.0 de 10,1 polegadas e painel digital de 12,3 polegadas. Imagens primárias observadas: https://media.toyota.com.br/7bbdd3d4-a44e-4bfc-bb92-52cb1af4ef2a.jpeg e https://media.toyota.com.br/9d1546c4-734e-4793-9c61-1bf1e74648bc.webp.
- Corolla Cross Hybrid: https://www.toyota.com.br/modelos/corolla-cross-hybrid. A página exibiu Corolla Cross Hybrid 2027, preço público sugerido a partir de R$ 226.120,00, frete incluso e base Brasília. Informou sistema híbrido flex, 101 cv no motor a combustão com etanol, 72 cv no motor elétrico, potência combinada de 122 cv, torque de 14,5 kgf.m e 16,6 kgf.m, transmissão Transaxle CVT, Toyota Safety Sense e sete airbags. Imagens primárias observadas: https://media.toyota.com.br/c78bcfd0-45ba-4b1d-8bab-8a8daede895b.png e https://media.toyota.com.br/4d8fc4a5-1808-4bb7-907a-78fab83b79d0.png. O CDN Toyota retornou HTTP 403 no download automatizado; as URLs permanecem como referências remotas na ficha, sem cópia local forçada.

### Yamaha

- Ténéré 700: https://www.yamaha-motor.com.br/product/tenere-700-156320. A página informou motor CP2 bicilíndrico de 689 cc, 68,9 cv, 6,6 kgf.m, acelerador eletrônico YCC-T, suspensão dianteira invertida de 43 mm com curso de 210 mm, distância ao solo de 240 mm, rodas 21/18, pneus Michelin Anakee Adventure, painel TFT de 6,3 polegadas, Bluetooth/Y-Connect, ABS de três modos, TCS ajustável e garantia de 4 anos. Imagem local: `fotos/motos/yamaha_tenere_700_01.webp`, resultado identificado como Yamaha em `www.yamaha-motor.com.br`; conferir termos comerciais antes da publicação.

### Acer

- Aspire 5 A515-57-51W5, peça NX.KNFAL.006: https://www.acer.com/br-pt/laptops/aspire/aspire-5-intel/pdp/NX.KNFAL.006. A página informou Linux, Intel Core i5-12450H de 12ª geração, 8 GB DDR4, SSD de 256 GB, tela 15,6 polegadas 1920 x 1080 sem touchscreen, gráficos Intel compartilhados, Wi-Fi IEEE 802.11ax, bateria de 50 Wh, fonte de 90 W e cor Steel Gray/Preto. Não exibiu preço acessível; a ficha permanece inativa e sem foto local do SKU.

### Inventário local conferido

- `fotos/carros/honda_city_sedan_2026_01.webp` — 150464 bytes; origem identificada como parceiro Honda Hit, não declarar como asset oficial Honda.
- `fotos/carros/honda_hr_v_2026_01.webp` — 43096 bytes; origem identificada como Honda Hit, não declarar como asset oficial Honda.
- `fotos/cartas_de_credito/honda_hr_v_easyhonda_01.webp` — 43096 bytes; cópia visual do HR-V, uso sujeito a autorização.
- `fotos/eletronicos/dell_inspiron_15_3530_01.png` — 150388 bytes; asset associado à página Dell.
- `fotos/eletronicos/dell_optiplex_7020_micro_01.jpg` — 10108 bytes; asset associado à página Dell.
- `fotos/eletronicos/lenovo_ideapad_1_15_amd_01.png` — 531915 bytes; asset associado à página Lenovo.
- `fotos/motos/honda_cg_160_titan_2026_01.jpg` e `_02.jpg` — 63285 bytes cada; resultados de car.blog, não declarar como oficiais Honda.
- `fotos/motos/yamaha_fazer_fz25_connected_01.png` — 387412 bytes; asset associado à página Yamaha, conferir termos de uso.
- `fotos/motos/yamaha_tenere_700_01.webp` — 168702 bytes; resultado identificado como Yamaha, conferir termos de uso.

A ausência de cópia local Toyota não é uma falha silenciosa: os assets foram observados no catálogo oficial, mas o CDN bloqueou o download automatizado. Não substituir por imagem de terceiro sem registrar a origem e a limitação.


## Verificação visual adicional — Toyota Corolla Cross

A URL primária `https://media.toyota.com.br/7bbdd3d4-a44e-4bfc-bb92-52cb1af4ef2a.jpeg` foi aberta no navegador conectado em 21/08/2026 e carregou como imagem de 1920×1274. A fotografia mostra um Toyota Corolla Cross vermelho em via pavimentada, compatível visualmente com o modelo da ficha. O navegador conectado conseguiu acessar o asset, embora o download automatizado pelo ambiente de pesquisa tenha retornado HTTP 403. A ficha mantém a URL remota e o pacote não cria cópia local não autorizada.
