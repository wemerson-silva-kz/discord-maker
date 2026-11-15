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
  - Nome de exibição, 3 avatares padrão ou upload de foto (recortada para 256 px), status (Online, Ausente, Não perturbe, Invisível) e cor do banner.
  - **Simulador de lista** (Membros / DMs) com a nameplate ao fundo, animada ao passar o mouse (ou "Sempre animar").
  - **Popout de perfil** com banner, avatar + moldura, status, e o efeito de perfil rodando por cima do card (botão para repetir).
- **Limpar Tudo**, **Copiar Link da Combinação** (estado codificado no `#hash` da URL) e **Salvar Print** (simulado, com flash e toast).
- O estado fica salvo no `localStorage`.

## Gerador de cosméticos com IA ✨

A aba **Gerador IA** cria nameplates, molduras e efeitos de perfil **animados** a partir de uma descrição ("dragão de jade cuspindo fogo verde", "café lo-fi numa tarde chuvosa"…).

- **Motor IA (qualquer provedor):** escolha o provedor, o modelo e cole a sua chave (fica só no seu navegador; o site não tem servidor). Provedores prontos:
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

- **Arte desenhada (SVG)** (padrão para IA): a IA desenha ilustração vetorial animada no tamanho de cada formato do Discord (nameplate 448×84, moldura 288×288 com o centro livre para o avatar, efeito 450×880), animada só com CSS. O tema vira desenho de verdade: dragão, templo, nuvens etc. O SVG passa por um sanitizador (sem scripts, eventos, `foreignObject`, imagens ou links externos) e é exibido como imagem. O estilo **Partículas** continua disponível.
- **Entrada e loop separados**: nos resultados, os efeitos mostram os dois painéis lado a lado (a entrada se repete para dar para ver).
- **Referências da biblioteca**: em **🧬 Escolher da biblioteca**, selecione até 3 itens (temáticos, gerados, catálogo ou loja do Discord) para a IA criar variações. Ela recebe a arte/spec dos itens gerados e a **imagem** dos oficiais (Claude, Gemini e OpenAI). Se o modelo não aceitar imagens, o app tenta de novo só com texto. O botão **🧬 Referência** nos resultados faz o mesmo.
- **⬇ Baixar APNG**: exporta no tamanho oficial, com 12/24/30 fps e 256 cores ou sem perdas. Efeitos saem em dois arquivos: `-entrada.png` (toca 1×) e `-loop.png` (infinito). Cada quadro é renderizado controlando o tempo das animações; no loop, toda animação fecha um número inteiro de ciclos, então não há "pulo" na emenda. A arte SVG é renderizada num iframe isolado (sem scripts). Também vale para os itens temáticos da galeria.

## Cosméticos oficiais do Discord

A galeria também mostra itens reais carregados direto do CDN do Discord (coleção **Discord**), no mesmo formato do app:

| Tipo | Arquivo | Estados / fases |
|---|---|---|
| Moldura (avatar decoration) | APNG 288×288, desenhado em 1,2× o avatar | `…/collectibles-shop/<sku>/static` e `/animated` |
| Nameplate | APNG 448×84 | `…/static` e `/animated` (anima no hover) |
| Efeito de perfil | APNG 450×880 | **entrada** (toca 1×, até 6 s) → **loop** (infinito) |

- **Importar do Discord** (botão na galeria): cole o ID/URL de uma moldura ou nameplate, ou os hashes de entrada e loop de um efeito. O item entra na galeria e já é equipado.
- **Métricas**: cada card mostra quadros, duração, FPS e repetições. O app lê o APNG quando o host libera CORS (ex.: `avatar-decoration-presets`). O caminho `cdn.discordapp.com/media/v1/collectibles-shop/` **não** libera, então nesses itens as métricas vêm do campo `meta`, gerado com:

  ```bash
  node tools/measure-apng.mjs intro=<url-da-entrada> loop=<url-do-loop>
  ```
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
