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
  - **OpenAI**, **Google Gemini**: saída estruturada (`json_schema`).
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

## Estrutura

```
index.html          Layout e marcação
css/app.css         Interface (botões, abas, toasts, status…)
css/cosmetics.css   Todas as animações dos cosméticos + partículas
js/data.js          CATÁLOGO DE ITENS — edite aqui
js/app.js           Renderização, estado, partículas e eventos
js/ai-generator.js  Gerador IA (vários provedores + motor local)
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
