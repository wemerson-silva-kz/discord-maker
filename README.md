# Cosmetic Studio — Galeria e Simulador de Cosméticos (estilo Discord)

Aplicação web estática (HTML + Tailwind CSS + JavaScript puro) para navegar e testar **Nameplates**, **Molduras de Avatar** e **Efeitos de Perfil** com pré-visualização ao vivo, no visual dark do Discord.

> Projeto de fã, não oficial e sem afiliação com o Discord. Todos os itens são fictícios.

## Como rodar

Não há build. Basta servir a pasta:

```bash
python3 -m http.server 8080
# abra http://localhost:8080
```

## Publicar no GitHub Pages

O repositório já tem o workflow `.github/workflows/pages.yml`, que publica o site a cada push na branch `main`.

1. No GitHub, abra **Settings → Pages** e, em **Build and deployment → Source**, escolha **GitHub Actions** (só na primeira vez).
2. Faça merge deste PR na `main` (ou rode o workflow em **Actions → Deploy no GitHub Pages → Run workflow**).
3. O site fica em `https://<seu-usuario>.github.io/discord-maker/`.

Como o site é 100% estático e cada visitante usa a própria chave de IA (que fica só no navegador dele), ele funciona no Pages sem servidor nenhum.

## Funcionalidades

- **Galeria** com busca (nome, coleção ou tags — atalho `Ctrl K`), abas por categoria com contadores e filtros por coleção (Cyberpunk, Anime, Galaxy, Fantasia, Pixel, Elemental).
- **Cards** com prévia personalizada (seu nome e avatar), raridade, tag de coleção e botão **Testar no Perfil**. As animações ficam pausadas e rodam ao passar o mouse (em telas touch elas rodam sempre).
- **Painel ao vivo** (fixo no desktop):
  - Nome de exibição, 3 avatares padrão ou upload de foto (recortada para 256 px), status (Online, Ausente, Não perturbe, Invisível) e banner: cor, ou imagem/GIF enviado (imagens são cortadas em 680×240, a proporção 17:6 do Discord; GIF continua animado).
  - **Simulador de lista** (Membros / DMs) com a nameplate ao fundo, animada ao passar o mouse (ou "Sempre animar").
  - **Popout de perfil** com banner, avatar + moldura, status, e o efeito de perfil rodando por cima do card (botão para repetir).
- **Limpar Tudo**, **Copiar Link da Combinação** (estado codificado no `#hash` da URL) e **Salvar Print** (simulado, com flash e toast).
- O estado fica salvo no `localStorage`.

## Gerador de cosméticos com IA ✨

A aba **Gerador IA** cria nameplates, molduras e efeitos de perfil **animados** a partir de uma descrição ("dragão de jade cuspindo fogo verde", "café lo-fi numa tarde chuvosa"…).

- **Motor IA (qualquer provedor):** escolha o provedor, o modelo e cole a sua chave (fica só no seu navegador; o site não tem servidor). Provedores prontos:
  - **Google Gemini** é o provedor padrão (veja abaixo).
  - **Anthropic (Claude)**: SDK oficial `@anthropic-ai/sdk` no navegador, modelo padrão `claude-opus-5-5`, saída estruturada por JSON Schema.
  - **Google Gemini**: API nativa (`generateContent`) com `responseMimeType: application/json` e `responseSchema`. Ao colar a chave (grátis em aistudio.google.com), o app lista os modelos Gemini disponíveis na conta e escolhe sozinho o "flash" estável mais novo; dá para trocar pelo campo **Modelo**. Se um modelo recusar o schema, o app tenta de novo só em modo JSON.
  - **OpenAI**: saída estruturada (`json_schema`).
  - **OpenRouter** (centenas de modelos, inclusive gratuitos), **Groq**, **DeepSeek**, **Mistral**: modo JSON.
  - **Ollama (no seu PC)**: grátis e local; rode com `OLLAMA_ORIGINS=*` para o navegador conseguir acessar.
  - **Outro (compatível com OpenAI)**: qualquer API com `/chat/completions` (LM Studio, Together, Fireworks, xAI, vLLM…), informando a URL base.

  O campo **Modelo** é editável (os nomes sugeridos são só um ponto de partida). Se o provedor não aceitar o modo de JSON pedido, o app tenta automaticamente um modo mais simples. Cada geração usa a sua conta no provedor.
- **Motor Local (offline):** gerador procedural por palavras-chave (fogo, gelo, galáxia, neon, Halloween, oceano…), instantâneo e sem internet. Temas desconhecidos ganham uma paleta derivada do texto.

Nos resultados você pode **Testar no Perfil**, **Salvar** (entra na galeria, coleção *Criações IA*), **Variar** (nova paleta/ritmo) e ver o **JSON** para colar em `js/data.js`. O "Copiar Link" inclui as criações equipadas, então quem abrir o link vê exatamente o mesmo kit.

> A chave é usada direto do navegador de quem está gerando. Não salve chaves em computadores compartilhados e prefira chaves com limite de gastos.

### Spec gerativa (`asset.type: 'gen'`)

```js
asset: {
  type: 'gen',
  palette: { primary: '#2BE38B', secondary: '#9BFF6B', accent: '#E8FFF4', background: '#04170F' },
  base: { style: 'pixelfire', animation: 'sweep', speed: 'normal' }, // gradient | radial | nebula | aurora | scanlines | storm | pixelfire | solid | none
  ring: { style: 'conic' },                                         // molduras: conic | dashed | double | glow | pixel | hud | none
  layers: [
    { kind: 'ember', color: '#9BFF6B', count: 'many', size: 'medium', speed: 'fast', shape: 'none', motion: 'fall', glyphs: '' },
    { kind: 'glyph', color: '#2BE38B', count: 'few', size: 'small', speed: 'normal', shape: 'none', motion: 'float', glyphs: '🐉' },
  ],
}
```

Toda spec (da IA, do gerador local ou de um link) passa por validação: cores só em hex, valores só das listas permitidas e textos limpos, sem HTML.

## Gerador IA: arte desenhada, referências e APNG

- **Arte desenhada (SVG)**: a IA desenha ilustração vetorial animada no tamanho de cada formato do Discord (nameplate 448×84, moldura 288×288 com o centro livre para o avatar, efeito 450×880), animada só com CSS. O tema vira desenho de verdade: dragão, templo, nuvens etc. O SVG passa por um sanitizador (sem scripts, eventos, `foreignObject`, imagens ou links externos) e é exibido como imagem. O estilo **Partículas** continua disponível.
- **Revisão automática (zonas protegidas)**: as áreas do avatar, do nome e do texto do perfil têm coordenadas exatas em cada formato (`ZONES` em `js/ai-generator.js`), e o prompt manda a IA deixá-las livres. Depois da resposta, o app renderiza a arte em vários quadros e mede quanto de cada zona fica coberto. Se passar do limite, devolve à IA o SVG, os números (ex.: "avatar 95% coberto, limite 12%") e uma imagem do pior quadro com as zonas proibidas marcadas em vermelho, para ela corrigir em até 2 rodadas. Cada resultado ganha um selo (✓ livres / ⚠ cobre…). Dá para desligar no gerador, porque usa mais tokens.
  A revisão também reprova arte **quase vazia** (abaixo de 3–6% do canvas; os oficiais ocupam 11–15%).
- **Referências quadro a quadro** (até 12): cada referência guia só o item do mesmo formato. As animadas (APNG/WebP do Discord, entrada + loop dos efeitos, SVG gerado) viram uma tira de 4–5 quadros (`js/ref-frames.js`, via `ImageDecoder`). No modo Ilustração, uma IA de visão estuda as tiras de cada formato e devolve visual, movimento, um preset de animação (subir, cair, deslizar, orbitar, pulsar, ondular, faixa de luz), intensidade e um pedido novo no mesmo sentido com o seu tema; o modelo de imagem recebe esse pedido + 1 quadro, e a animação usa o preset. Nos modos Arte e Partículas as tiras vão direto para o modelo.
- **Profile frame em volta do card (como no Discord)**: a API de produtos descreve o frame como camadas presas ao topo/base (`staple`), laterais que esticam (`border`, `rail`), na frente ou atrás do card, e quanto ele passa do card (`overflow_top`, `overflow_bottom`, `overflow_horizontal`, num card de 1200 px). O app busca essas camadas para os frames da loja e monta tudo por fora do popout e das miniaturas. Os frames gerados (Ilustração, Arte SVG e motor Local) são uma arte 1312×2528 em volta do card — card em (56, 304)–(1256, 2316), topo e base fixos, o meio das laterais estica; a revisão automática mede avatar, nome e conteúdo do card nesse canvas. Frames antigos (1312×716, presos no topo) continuam funcionando.
- **Efeito de perfil (Ilustração)**: como os oficiais da loja, a cena fica na **metade de cima** (banner e começo do card) e a base fica vazia: o prompt pede isso e uma máscara suave apaga a base e deixa o avatar quase livre (~8% coberto, a mediana medida). A entrada (3,6 s) é o momento de impacto — clarão, onda de choque, faíscas explodindo, a arte entra com zoom e foco e uma faixa de luz passa. O loop é a versão leve e esparsa da mesma cena, só no topo e translúcida, com as partes claras (brasas, runas) tremeluzindo; nome e texto ficam legíveis.
- **Profile frame (Ilustração)**: fica **por fora** do card, como no Discord (ex.: "Deadpool Mask": borda lateral de 74 px que entra só 30 px no card, olhos da máscara no staple de cima, acima do card). O prompt pede laterais finas e o ornamento principal coroando o topo; a máscara só deixa a arte entrar ~30–48 px nas laterais do card.
- **✏️ Refazer**: em cada item gerado, escreva o que mudar ("chamas azuis", "tira o dragão da esquerda") e a IA refaz só aquele item — a versão nova aparece ao lado, com ✎ no nome, e a anterior fica. Ilustrações são editadas pelo modelo de imagem a partir da própria arte (Gemini recebe a arte sobre fundo verde; OpenAI usa `/images/edits`) e passam de novo pelo recorte, máscaras e animação; artes SVG e de partículas voltam para a IA com o pedido e o SVG/spec atual (com revisão automática no SVG).
- **Prompt por formato**: depois do tema geral, cada linha `nameplate:`, `moldura:`, `efeito:` ou `frame:` vai só para aquele item (também aceita `placa:`, `aura:`, `moldura de perfil:`, `avatar decoration:`, `profile frame:`). Se o prompt não tiver essas linhas, a IA (modelo de texto do mesmo provedor; com um modelo de imagem escolhido, o app usa o modelo de texto padrão) o reescreve antes de gerar: tira termos de apresentação (interface, sprite sheet, bundle, cor de fundo, "ideal para…"), traduz itens para os formatos do Discord e escreve o resultado na caixa para você editar. O botão **🪄 Ajustar com IA** faz isso sem gerar; dá para desligar o ajuste automático.
- **Ilustração (modelo de imagem)** (padrão para IA, com o Google Gemini e `gemini-3.1-flash-image`): um modelo de imagem (Gemini `…-image` ou OpenAI `gpt-image-1`) pinta a arte de verdade em vez de escrever código. O app pede fundo verde chapado (Gemini) ou transparente (OpenAI), recorta o fundo, encaixa no canvas oficial, **apaga com máscara suave as áreas do avatar e do nome** (fica garantido, sem depender da IA) e monta um SVG com a ilustração embutida (WebP em `data:`) e animação CSS por cima: respiro, brilho que passa, cintilar nas cores da arte e, no efeito, entrada de 3 s + loop de 4 s. Se você escolher um modelo de imagem em outro modo, o app troca para este sozinho; enquanto você não escolhe um modelo, o campo **Modelo** acompanha o modo (modelo de imagem na Ilustração, de texto na Arte/Partículas). Com um provedor que não gera imagens (Claude, Groq…), a Ilustração vira Arte (SVG) automaticamente. No Gemini, os exemplos oficiais da mesma categoria vão como referência de acabamento.
- **Entrada e loop separados**: nos resultados, os efeitos mostram os dois painéis lado a lado (a entrada se repete para dar para ver).
- **Referências da biblioteca**: em **🧬 Escolher da biblioteca**, selecione até 3 itens (temáticos, gerados, catálogo ou loja do Discord) para a IA criar variações. Ela recebe a arte/spec dos itens gerados e a **imagem** dos oficiais (Claude, Gemini e OpenAI). Se o modelo não aceitar imagens, o app tenta de novo só com texto. O botão **🧬 Referência** nos resultados faz o mesmo.
- **Profile frames**: marque **Profile Frame** no gerador. A IA desenha o frame em SVG (1312×716, preso ao topo do card, com o centro livre para o conteúdo do perfil); frames sempre usam o estilo Arte. O motor local gera um frame procedural com a paleta do tema. O download sai como **PNG estático 1312×716** (o formato do Discord) e também um APNG animado em meia resolução.
- **⬇ Baixar APNG**: exporta no tamanho oficial, com 12/24/30 fps e 256 cores ou sem perdas. Efeitos saem em dois arquivos: `-entrada.png` (toca 1×) e `-loop.png` (infinito). Cada quadro é renderizado controlando o tempo das animações; no loop, toda animação fecha um número inteiro de ciclos, então não há "pulo" na emenda. A arte SVG é renderizada num iframe isolado (sem scripts). Também vale para os itens temáticos da galeria.

## Cosméticos oficiais do Discord

A galeria também mostra itens reais carregados direto do CDN do Discord (coleção **Discord**), no mesmo formato do app:

| Tipo | Arquivo | Estados / fases |
|---|---|---|
| Moldura (avatar decoration) | APNG 288×288, desenhado em 1,2× o avatar | `…/collectibles-shop/<sku>/static` e `/animated` |
| Nameplate | APNG 448×84 | `…/static` e `/animated` (anima no hover) |
| Efeito de perfil | APNG 450×880 | **entrada** (toca 1×, até 6 s) → **loop** (infinito) |

- **Importar do Discord** (botão na galeria): cole o ID/URL de uma moldura ou nameplate, ou os hashes de entrada e loop de um efeito. O item entra na galeria e já é equipado.
- **Métricas**: cada card mostra duração, FPS e repetições. Quando o host libera CORS (ex.: `avatar-decoration-presets`), o app lê o APNG direto. O `cdn.discordapp.com/media/v1/collectibles-shop/` não libera, então o app mede pelo **proxy de mídia do próprio Discord** (`media.discordapp.net/…?format=webp&animated=true`, WebP animado com CORS): mesma duração e repetições, mas quadros idênticos seguidos são unidos, então o FPS aparece como aproximado (≈). Para gravar métricas exatas no catálogo, use:

  ```bash
  node tools/measure-apng.mjs intro=<url-da-entrada> loop=<url-do-loop>
  ```
- **Animação na galeria**: molduras, nameplates e itens temáticos animam sozinhos quando o card está visível na tela e param ao sair; o APNG animado só é baixado nessa hora. O botão **⏸ Animação automática / ▶ Animar na galeria** liga ou desliga (aí anima só no hover). No celular, vale sempre só para os cards visíveis.
- **Paletas de nameplate**: as artes de nameplate do Discord têm fundo transparente, e o Discord pinta uma paleta por baixo. O nome da paleta de cada nameplate da loja (`teal`, `crimson`, `violet`, `lemon`…, 12 no total) vem do endpoint oficial do produto, buscado quando o card aparece. As cores estão em `discordPalettes` (`js/data.js`) e são aproximadas, porque o Discord não as publica. As nameplates do Gerador IA também escolhem uma dessas paletas e são desenhadas com fundo transparente.
- **Pacotes (bundles)**: cole o ID de um pacote da loja (ex.: `1476292494755889153`) no importador para ver o que ele contém e usar **Testar pacote completo**, que equipa a moldura, a nameplate e o efeito de uma vez.
- **Efeitos da loja animados (config oficial)**: a API pública do Discord `GET discord.com/api/v9/collectibles-products/<sku>` responde sem login e com CORS, e traz a configuração completa do efeito: camadas de entrada e loop com `start`, `duration`, `loop`, `loopDelay` e `zIndex`, a versão de movimento reduzido e a miniatura. Ao passar o mouse no card ou equipar um efeito da loja, o app busca essa config (só sob demanda, com cache de 7 dias) e toca as camadas como o app do Discord. Se o sistema pede movimento reduzido, mostra a versão estática oficial. O mesmo endpoint dá o conteúdo exato dos **pacotes**.
- Atenção: atrasos de quadro de 10 ms ou menos são exibidos como 100 ms pelos navegadores. O card avisa quando isso acontece (FPS nominal × efetivo).
- **Medidor de FPS**: o botão **FPS** no popout mostra a taxa real de quadros e a fase atual (entrada/loop). Ao equipar um efeito, o app mede 1,5 s e avisa se ficar abaixo de 40 fps.
- **Gerador IA**: os efeitos gerados também têm entrada (até 6 s: burst, sweep, rise, zoom, curtain ou flash) seguida do loop.

## Loja do Discord ao vivo (itemshop.gg)

A galeria carrega a loja do dia pela API pública do [itemshop.gg](https://itemshop.gg/discord/api) (`GET /api/v1/shop/discord`, sem chave). Os itens aparecem no filtro **🛒 Loja do Discord** e na busca (nome ou coleção):

| Tipo na API | Na galeria | Animação |
|---|---|---|
| Avatar Decoration | Moldura | estático → `passthrough=true` no hover (dá para medir FPS no navegador) |
| Nameplate | Nameplate | `/static` → `/animated` no hover |
| Profile Effect | Efeito de perfil | só miniatura estática: a API não fornece entrada e loop |
| Profile Frame | Profile Frame (4ª aba) | arte estática (o CDN não tem versão animada), presa ao topo do card de perfil na largura dele |

### Integração com a API (`js/itemshop.js`, `tools/itemshop.mjs`, `types/itemshop.d.ts`)

**No navegador** (`js/itemshop.js`), só endpoints sem chave, seguindo as boas práticas da API:
- consulta `/rotations` e só baixa a loja quando o **fingerprint** do Discord muda;
- reenvia o **ETag** em `If-None-Match` (304 = sem mudança) e guarda as respostas por 2 minutos;
- em **429**, espera o `Retry-After` e usa o último cache, como em 503 ou sem rede;
- trata erros `{ error: { code, message } }`;
- mostra o link **"Data from itemshop.gg"** (para `meta.attribution.url`), com a data da loja e o link dos termos no título.

**No servidor** (`tools/itemshop.mjs`, Node 18+), com a chave **só** pela variável de ambiente `ITEMSHOP_API_KEY` (nunca no código, no repositório ou no navegador):

```bash
cp .env.example .env        # e coloque sua chave (crie em https://itemshop.gg/account#api)
node --env-file=.env tools/itemshop.mjs shop discord
node --env-file=.env tools/itemshop.mjs rotations
node --env-file=.env tools/itemshop.mjs history discord              # exige chave
node --env-file=.env tools/itemshop.mjs history discord 2026-11-01   # exige chave
node --env-file=.env tools/itemshop.mjs item <jogo> <itemKey>        # exige chave
```

Sem a chave, `games`, `shop` e `rotations` funcionam; `history` e `item` falham com uma mensagem explicando como criar a chave. O cliente define `User-Agent`, faz cache de 2 min com ETag, tenta de novo após `Retry-After` em 429/503 e explica erros 401 (`key_required`/`invalid_key`) e 404 (`unknown_game`, `not_recorded`, `unknown_item`, `no_items`). Também pode ser importado: `import { ItemShopClient } from './tools/itemshop.mjs'`.

Os tipos de todas as respostas estão em `types/itemshop.d.ts`. No Discord, `/games` informa `itemHistory: false` e os itens vêm com `itemKey: null`, então `/items` não se aplica a ele.

## Catálogo próprio (`catalog/discord.json`)

Para fixar itens (por exemplo, efeitos com entrada e loop), adicione-os em `catalog/discord.json`:

```json
{ "type": "decoration", "name": "Minha moldura", "collection": "Discord", "sku": "1476286689528774717" }
{ "type": "nameplate",  "name": "Minha nameplate", "sku": "1476288619277979648" }
{ "type": "effect",     "name": "Meu efeito", "intro": "<hash da entrada>", "loop": "<hash do loop>" }
```

Depois rode `node tools/build-catalog.mjs`: ele valida cada item, mede os APNGs, grava o `meta` (quadros, duração, FPS) e avisa sobre entradas acima de 6 s. No importador da galeria, o botão **{ } Copiar para o catálogo** gera a entrada pronta para colar.

## Estrutura

```
index.html          Layout e marcação
css/app.css         Interface (botões, abas, toasts, status…)
css/cosmetics.css   Todas as animações dos cosméticos + partículas
js/data.js          CATÁLOGO DE ITENS — edite aqui
js/app.js           Renderização, estado, partículas e eventos
js/ai-generator.js  Gerador IA (vários provedores + motor local)
js/discord-import.js Importador de IDs/URLs do CDN do Discord
js/apng-export.js   Exportação de APNG animado (entrada + loop)
tools/measure-apng.mjs Mede quadros/duração/FPS de APNGs (gera o `meta`)
tools/build-catalog.mjs Valida e mede o catalog/discord.json
catalog/discord.json Catálogo de itens oficiais (IDs/hashes do Discord)
js/itemshop.js      Cliente da API itemshop.gg no navegador (sem chave)
tools/itemshop.mjs  Cliente/CLI da API itemshop.gg no servidor (ITEMSHOP_API_KEY)
types/itemshop.d.ts Tipos das respostas da API
.env.example        Modelo do .env (ITEMSHOP_API_KEY)
.github/workflows/  Deploy automático no GitHub Pages
```

## Trocando os efeitos CSS por imagens reais

Cada item em `js/data.js` tem um objeto `asset`. Para usar arquivos reais, troque o `type`:

```js
// Antes (CSS + partículas)
asset: { type: 'css', className: 'np-neon', particles: [{ kind: 'streak', count: 6, color: '#00F0FF' }] }

// Depois (imagem .png / .gif / .webp / .apng)
asset: {
  type: 'image',
  src: 'https://cdn.exemplo.com/nameplate-animada.webp',
  staticSrc: 'https://cdn.exemplo.com/nameplate-estatica.png', // opcional: mostrado até o hover
}

// Ou vídeo (.webm / .mp4)
asset: { type: 'video', src: 'https://cdn.exemplo.com/efeito.webm' }
```

As molduras usam uma camada de 124% do tamanho do avatar (igual ao padrão das decorações), então imagens quadradas com o avatar centralizado se encaixam direto.

### Partículas disponíveis

`petal`, `star`, `ember`, `streak`, `bolt`, `sparkle` (`rise: true` para flutuar), `warp`, `rain`, `orb`, `drop`, `ring` (`shape`: `petal`, `blossom`, `flame`, `bolt`, `crystal`, `planet`, `star`, `pixel`) e `svgring`.
Opções comuns: `count`, `color`, `size` e `speed` (multiplicadores).
