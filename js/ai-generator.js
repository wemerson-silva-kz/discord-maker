/* ==========================================================================
   COSMETIC STUDIO — Gerador de cosméticos com IA
   --------------------------------------------------------------------------
   Dois motores produzem a MESMA especificação JSON (asset.type = 'gen'),
   que o renderizador de js/app.js transforma em animação CSS/SVG:

   • Claude (IA): chama a API da Anthropic direto do navegador com a chave do
     usuário e usa saída estruturada (JSON Schema) para receber a spec.
   • Local (offline): gerador procedural por palavras-chave, sem rede.
   ========================================================================== */
(function () {
  'use strict';

  const CS = window.CosmeticStudio;
  if (!CS) return console.error('[Gerador IA] app.js não carregado');
  const { CATS, GEN } = CS;

  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.3.0/+esm';
  const MODEL = 'claude-opus-5-5';
  const KEY_STORAGE = 'cosmetic-studio:anthropic-key';
  const ENGINE_STORAGE = 'cosmetic-studio:engine';
  const CAT_TO_API = { nameplates: 'nameplate', decorations: 'decoration', effects: 'effect' };
  const API_TO_CAT = { nameplate: 'nameplates', decoration: 'decorations', effect: 'effects' };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignora */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignora */ } },
  };

  const EXAMPLES = [
    'dragão de jade cuspindo fogo verde',
    'pôr do sol vaporwave com palmeiras',
    'oceano bioluminescente à meia-noite',
    'noite de Halloween com morcegos',
    'reino de gelo e cristais',
    'café lo-fi numa tarde chuvosa',
    'galáxia de doces kawaii',
    'samurai cyberpunk sob chuva neon',
  ];

  /* ------------------------------------------------------------------ */
  /* Motor 1: Claude (saída estruturada)                                 */
  /* ------------------------------------------------------------------ */
  const LAYER_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['kind', 'color', 'count', 'size', 'speed', 'shape', 'motion', 'glyphs'],
    properties: {
      kind: { type: 'string', enum: GEN.kinds },
      color: { type: 'string', description: 'Cor hex #RRGGBB' },
      count: { type: 'string', enum: ['few', 'some', 'many'] },
      size: { type: 'string', enum: Object.keys(GEN.sizes) },
      speed: { type: 'string', enum: Object.keys(GEN.speeds) },
      shape: { type: 'string', enum: GEN.shapes },
      motion: { type: 'string', enum: GEN.motions },
      glyphs: { type: 'string', description: 'Até 4 emojis/símbolos, ou vazio' },
    },
  };
  const HEX = { type: 'string', description: 'Cor hex #RRGGBB' };
  const OUTPUT_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['items'],
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['category', 'name', 'description', 'rarity', 'tags', 'palette', 'base', 'ring', 'layers'],
          properties: {
            category: { type: 'string', enum: ['nameplate', 'decoration', 'effect'] },
            name: { type: 'string' },
            description: { type: 'string' },
            rarity: { type: 'string', enum: GEN.rarities },
            tags: { type: 'array', items: { type: 'string' } },
            palette: {
              type: 'object',
              additionalProperties: false,
              required: ['primary', 'secondary', 'accent', 'background'],
              properties: { primary: HEX, secondary: HEX, accent: HEX, background: HEX },
            },
            base: {
              type: 'object',
              additionalProperties: false,
              required: ['style', 'animation', 'speed'],
              properties: {
                style: { type: 'string', enum: GEN.styles },
                animation: { type: 'string', enum: GEN.anims },
                speed: { type: 'string', enum: Object.keys(GEN.speeds) },
              },
            },
            ring: {
              type: 'object',
              additionalProperties: false,
              required: ['style'],
              properties: { style: { type: 'string', enum: GEN.rings } },
            },
            layers: { type: 'array', items: LAYER_SCHEMA },
          },
        },
      },
    },
  };

  const SYSTEM_PROMPT = `Você é um designer de cosméticos de perfil no estilo do Discord. A partir do tema do usuário, você cria itens animados descritos por uma especificação JSON; um motor CSS/SVG transforma essa especificação em animação.

Categorias:
- nameplate: faixa de cerca de 300×44 px atrás do nome do usuário na lista de membros. O avatar e o nome (texto branco) ficam à esquerda, então mantenha o lado esquerdo escuro o bastante para leitura e concentre os detalhes intensos à direita.
- decoration: moldura sobreposta ao avatar circular (124% do tamanho do avatar). Use ring.style para o anel principal e camadas kind "ring" (com shape) para objetos orbitando. Partículas soltas aparecem ao redor do avatar.
- effect: animação que cobre o card de perfil inteiro (cerca de 340×500 px) por cima do conteúdo. O centro precisa continuar legível: use base.style "none" ou um estilo sutil e conte com as partículas (count "some" ou "many").

Vocabulário da especificação:
- base.style (ignorado em decoration): gradient (degradê de 3 cores), radial (brilho), nebula (nuvens cósmicas), aurora (véus de luz), scanlines (néon/CRT), storm (céu escuro com clarões), pixelfire (chamas pixeladas no matiz da cor primária), solid, none.
- base.animation: none, shift (o degradê desliza), pulse, sweep (faixa de brilho passando), flash (clarões).
- ring.style: só para decoration (nas outras categorias use "none"): conic (anel multicolor giratório), dashed, double, glow (halo pulsante), pixel (anel 8-bit), hud (mira futurista), none.
- layers, de 1 a 4 camadas. kind: petal (pétalas caindo), star (estrelas piscando), ember (brasas quadradas subindo), streak (riscos de luz horizontais), bolt (raios), sparkle (brilhos de quatro pontas), sparkle-rise (brilhos subindo), warp (linhas de hiperespaço saindo do centro; só effect), rain (colunas de caracteres caindo; só effect), orb (bolhas ou bokeh), drop (chuva), ring (objetos orbitando o avatar; só decoration, defina shape), glyph (emojis ou símbolos de "glyphs" com o movimento "motion").
- shape (para kind ring): petal, blossom, flame, bolt, crystal, planet, star, pixel, glyph (usa glyphs). Nas demais camadas use "none".
- motion (para kind glyph): fall, rise, float, twinkle. Nas demais camadas use "fall".
- glyphs: até 4 emojis ou símbolos Unicode do tema (ex.: "🐉🔥", "❄✦", "♪♫"); string vazia quando a camada não usa.
- count: few, some ou many. size: small, medium ou large. speed: slow, normal ou fast.
- Todas as cores em hex #RRGGBB. palette.background é o tom escuro de fundo; primary, secondary e accent são as cores do tema, com bom contraste sobre fundo escuro.

Gere exatamente um item para cada categoria pedida, na ordem pedida, formando um kit coerente com o tema. Cada item deve combinar pelo menos duas camadas (uma sutil de fundo e uma de destaque) para ter profundidade e movimento. Escreva em português do Brasil: nome curto e criativo (até 28 caracteres), descrição de uma frase (até 120 caracteres), 3 a 5 tags em minúsculas. Escolha rarity (Raro, Épico ou Lendário) conforme a complexidade visual.`;

  let sdkPromise = null;
  function loadSdk() {
    if (!sdkPromise) {
      sdkPromise = import(SDK_URL).catch((e) => {
        sdkPromise = null;
        throw e;
      });
    }
    return sdkPromise;
  }

  async function generateWithClaude(prompt, cats, apiKey) {
    const mod = await loadSdk();
    const Anthropic = mod.default;
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    let response;
    try {
      response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `Tema: ${prompt}\nCategorias, nesta ordem: ${cats.map((c) => CAT_TO_API[c]).join(', ')}`,
        }],
      });
    } catch (err) {
      throw friendlyApiError(err, Anthropic);
    }

    if (response.stop_reason === 'refusal') {
      throw new Error('A IA recusou esse tema. Tente descrevê-lo de outro jeito.');
    }
    if (response.stop_reason === 'max_tokens') {
      throw new Error('A resposta da IA veio incompleta. Tente gerar menos categorias de uma vez.');
    }
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('A IA respondeu em um formato inesperado. Tente novamente.');
    }
    const items = Array.isArray(data.items) ? data.items : [];
    const out = [];
    for (const raw of items) {
      const cat = API_TO_CAT[raw.category];
      if (!cat || !cats.includes(cat)) continue;
      out.push({
        cat,
        raw: {
          name: raw.name,
          description: raw.description,
          rarity: raw.rarity,
          tags: raw.tags,
          prompt,
          engine: 'claude',
          asset: { palette: raw.palette, base: raw.base, ring: raw.ring, layers: raw.layers },
        },
      });
    }
    if (!out.length) throw new Error('A IA não retornou nenhum item válido. Tente novamente.');
    return out;
  }

  function friendlyApiError(err, Anthropic) {
    if (Anthropic && err instanceof Anthropic.AuthenticationError) return new Error('Chave da API inválida. Confira e tente de novo.');
    if (Anthropic && err instanceof Anthropic.PermissionDeniedError) return new Error('Essa chave não tem permissão para usar o modelo.');
    if (Anthropic && err instanceof Anthropic.RateLimitError) return new Error('Limite de uso atingido. Aguarde um pouco e tente novamente.');
    if (Anthropic && err instanceof Anthropic.BadRequestError) return new Error('A API recusou o pedido: ' + (err.message || 'requisição inválida') + '.');
    if (Anthropic && err instanceof Anthropic.InternalServerError) return new Error('A API está instável agora. Tente novamente em instantes.');
    if (Anthropic && err instanceof Anthropic.APIConnectionError) return new Error('Sem conexão com a API da Anthropic. Verifique sua internet ou use o motor Local.');
    return err instanceof Error ? err : new Error(String(err));
  }

  /* ------------------------------------------------------------------ */
  /* Motor 2: Local (procedural, offline)                                */
  /* ------------------------------------------------------------------ */
  const THEMES = [
    {
      id: 'fire', keys: ['fogo', 'fire', 'chama', 'inferno', 'lava', 'vulcão', 'vulcao', 'brasa', 'fênix', 'fenix', 'phoenix', 'dragão', 'dragao', 'dragon'],
      word: 'das Chamas', palette: ['#FF5A00', '#FFC400', '#FF2D2D', '#1A0503'], np: 'pixelfire', anim: 'pulse',
      layers: [['ember', 'many'], ['sparkle', 'few']], glyphs: '🔥', ringStyle: 'pixel', ringShape: 'flame', fx: [['ember', 'many'], ['glyph', 'few', 'rise']],
    },
    {
      id: 'ice', keys: ['gelo', 'ice', 'neve', 'snow', 'inverno', 'winter', 'frozen', 'congelad', 'cristal', 'crystal', 'glacial'],
      word: 'do Gelo Eterno', palette: ['#7FE7FF', '#B8C9FF', '#FFFFFF', '#06142A'], np: 'aurora', anim: 'shift',
      layers: [['sparkle', 'some'], ['glyph', 'few', 'fall']], glyphs: '❄✦', ringStyle: 'conic', ringShape: 'crystal', fx: [['glyph', 'many', 'fall'], ['sparkle', 'some']],
    },
    {
      id: 'sakura', keys: ['sakura', 'cerejeira', 'flor', 'flores', 'primavera', 'spring', 'pétala', 'petala', 'jardim', 'garden', 'anime'],
      word: 'de Sakura', palette: ['#FF8FC7', '#FFC2DC', '#FFE07A', '#2A1D2B'], np: 'radial', anim: 'pulse',
      layers: [['petal', 'some']], glyphs: '🌸', ringStyle: 'glow', ringShape: 'blossom', fx: [['petal', 'many'], ['sparkle', 'few']],
    },
    {
      id: 'space', keys: ['galáxia', 'galaxia', 'galaxy', 'espaço', 'espaco', 'space', 'estrela', 'star', 'cosmos', 'cósmic', 'cosmic', 'nebulosa', 'planeta', 'lua', 'moon', 'astronauta'],
      word: 'Estelar', palette: ['#8C52FF', '#00AAFF', '#FF46C8', '#0A0820'], np: 'nebula', anim: 'shift',
      layers: [['star', 'many'], ['sparkle', 'few']], glyphs: '✦★', ringStyle: 'double', ringShape: 'planet', fx: [['warp', 'many'], ['star', 'some']],
    },
    {
      id: 'neon', keys: ['neon', 'néon', 'cyber', 'cyberpunk', 'synthwave', 'vaporwave', 'retrowave', 'hacker', 'matrix', 'futur', 'samurai', 'tóquio', 'toquio', 'tokyo'],
      word: 'Neon', palette: ['#FF2BD6', '#00F0FF', '#7A5CFF', '#120327'], np: 'scanlines', anim: 'sweep',
      layers: [['streak', 'some'], ['star', 'few']], glyphs: '◢◤', ringStyle: 'hud', ringShape: 'star', fx: [['rain', 'some'], ['streak', 'few']],
    },
    {
      id: 'storm', keys: ['tempestade', 'storm', 'raio', 'trovão', 'trovao', 'thunder', 'elétric', 'eletric', 'electric', 'relâmpago', 'relampago', 'chuva', 'rain'],
      word: 'do Trovão', palette: ['#4AA3FF', '#9FD4FF', '#E8F6FF', '#050A1F'], np: 'storm', anim: 'flash',
      layers: [['bolt', 'few'], ['drop', 'some']], glyphs: '⚡', ringStyle: 'dashed', ringShape: 'bolt', fx: [['drop', 'many'], ['bolt', 'few']],
    },
    {
      id: 'ocean', keys: ['oceano', 'ocean', 'mar', 'sea', 'água', 'agua', 'water', 'bolha', 'bubble', 'sereia', 'mermaid', 'praia', 'beach', 'aquátic', 'aquatic', 'biolumin'],
      word: 'Abissal', palette: ['#00D2C8', '#2F7BFF', '#B4FFF4', '#03142A'], np: 'gradient', anim: 'shift',
      layers: [['orb', 'some'], ['sparkle', 'few']], glyphs: '🫧🐚', ringStyle: 'glow', ringShape: 'glyph', fx: [['orb', 'many'], ['sparkle-rise', 'some']],
    },
    {
      id: 'forest', keys: ['floresta', 'forest', 'natureza', 'nature', 'folha', 'leaf', 'elfo', 'elf', 'fada', 'fairy', 'magia', 'magic', 'druida', 'musgo', 'jade', 'verde'],
      word: 'da Floresta', palette: ['#3EE6B0', '#9BFF6B', '#FFF3B0', '#061A14'], np: 'aurora', anim: 'shift',
      layers: [['sparkle-rise', 'some'], ['glyph', 'few', 'fall']], glyphs: '🍃✨', ringStyle: 'conic', ringShape: 'crystal', fx: [['orb', 'some'], ['sparkle-rise', 'many']],
    },
    {
      id: 'spooky', keys: ['halloween', 'abóbora', 'abobora', 'fantasma', 'ghost', 'terror', 'spooky', 'bruxa', 'witch', 'morcego', 'bat', 'vampir', 'caveira', 'skull', 'zumbi'],
      word: 'do Além', palette: ['#FF7A00', '#9B4DFF', '#B6FF3B', '#140A1F'], np: 'radial', anim: 'pulse',
      layers: [['glyph', 'few', 'float'], ['orb', 'few']], glyphs: '🎃👻🦇', ringStyle: 'glow', ringShape: 'glyph', fx: [['glyph', 'some', 'float'], ['orb', 'some']],
    },
    {
      id: 'love', keys: ['amor', 'love', 'coração', 'coracao', 'heart', 'valentine', 'namorad', 'romance', 'paixão', 'paixao', 'fofo', 'cute'],
      word: 'do Coração', palette: ['#FF4D8D', '#FF9EC4', '#FFFFFF', '#2A0A1A'], np: 'gradient', anim: 'pulse',
      layers: [['glyph', 'some', 'rise'], ['sparkle', 'few']], glyphs: '💖💕', ringStyle: 'glow', ringShape: 'glyph', fx: [['glyph', 'many', 'rise'], ['sparkle', 'some']],
    },
    {
      id: 'gold', keys: ['ouro', 'dourado', 'gold', 'golden', 'rei', 'rainha', 'king', 'queen', 'realeza', 'royal', 'luxo', 'luxury', 'tesouro', 'coroa', 'crown'],
      word: 'Real', palette: ['#F0B232', '#FFE58A', '#FFFFFF', '#1A1206'], np: 'gradient', anim: 'sweep',
      layers: [['sparkle', 'some'], ['star', 'some']], glyphs: '👑✦', ringStyle: 'conic', ringShape: 'star', fx: [['sparkle', 'many'], ['star', 'some']],
    },
    {
      id: 'candy', keys: ['doce', 'candy', 'kawaii', 'pastel', 'arco-íris', 'arco-iris', 'rainbow', 'unicórnio', 'unicornio', 'unicorn', 'sorvete', 'bolo', 'açúcar', 'acucar'],
      word: 'de Açúcar', palette: ['#FF9FF3', '#7FE7FF', '#FEE75C', '#2B1838'], np: 'gradient', anim: 'shift',
      layers: [['glyph', 'few', 'float'], ['sparkle', 'some']], glyphs: '🍬🌈⭐', ringStyle: 'conic', ringShape: 'glyph', fx: [['glyph', 'some', 'fall'], ['sparkle', 'some']],
    },
    {
      id: 'music', keys: ['música', 'musica', 'music', 'lofi', 'lo-fi', 'som', 'beat', 'dj', 'rock', 'jazz', 'café', 'cafe', 'coffee'],
      word: 'Lo-fi', palette: ['#C59BFF', '#FFB86B', '#FFFFFF', '#1A1424'], np: 'radial', anim: 'pulse',
      layers: [['glyph', 'some', 'rise'], ['orb', 'few']], glyphs: '♪♫☕', ringStyle: 'dashed', ringShape: 'glyph', fx: [['glyph', 'some', 'rise'], ['drop', 'some']],
    },
    {
      id: 'pixel', keys: ['pixel', '8-bit', '8 bit', 'retro', 'retrô', 'arcade', 'game', 'jogo', 'fliperama'],
      word: '8-Bit', palette: ['#57F287', '#FEE75C', '#EB459E', '#0E1A12'], np: 'scanlines', anim: 'shift',
      layers: [['ember', 'some'], ['star', 'few']], glyphs: '👾', ringStyle: 'pixel', ringShape: 'pixel', fx: [['ember', 'many'], ['glyph', 'few', 'float']],
    },
  ];

  const NOUNS = {
    nameplates: ['Placa', 'Faixa', 'Letreiro', 'Brasão'],
    decorations: ['Halo', 'Coroa', 'Anel', 'Aura'],
    effects: ['Chuva', 'Aura', 'Brilho', 'Explosão'],
  };

  function hashStr(s) {
    let h = 2166136261;
    for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
    return h >>> 0;
  }
  function hsl(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  function shiftHex(hex, deg) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return hsl((h + deg + 360) % 360, s * 100, l * 100);
  }

  function titleCase(text) {
    const small = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'com', 'na', 'no', 'a', 'o', 'à', 'sob', 'por']);
    return text.split(/\s+/).filter(Boolean).map((w, i) => (i && small.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join(' ');
  }

  function matchThemes(prompt) {
    const p = prompt.toLowerCase();
    return THEMES.filter((t) => t.keys.some((k) => p.includes(k)));
  }

  function proceduralTheme(prompt) {
    const h = hashStr(prompt.toLowerCase());
    const hue = h % 360;
    const glyphPool = ['✦', '★', '◆', '❖', '✧', '☾', '❀', '✿', '⚝'];
    return {
      id: 'proc',
      word: 'Arcana',
      palette: [hsl(hue, 90, 62), hsl((hue + 45) % 360, 85, 68), hsl((hue + 180) % 360, 80, 82), hsl(hue, 45, 9)],
      np: choice(['gradient', 'radial', 'nebula', 'aurora']),
      anim: choice(['shift', 'pulse', 'sweep']),
      layers: [[choice(['sparkle', 'star', 'orb']), 'some'], [choice(['streak', 'sparkle-rise', 'ember']), 'few']],
      glyphs: choice(glyphPool) + choice(glyphPool),
      ringStyle: choice(['conic', 'glow', 'double', 'dashed']),
      ringShape: choice(['star', 'crystal', 'planet', 'glyph']),
      fx: [[choice(['sparkle-rise', 'orb', 'star']), 'many'], [choice(['sparkle', 'glyph']), 'some', 'float']],
    };
  }

  function makeLayer(def, palette, theme) {
    const [kind, count, motion] = def;
    return {
      kind,
      count,
      color: choice([palette.accent, palette.primary, palette.secondary]),
      size: choice(['small', 'medium', 'medium', 'large']),
      speed: choice(['slow', 'normal', 'normal', 'fast']),
      shape: 'none',
      motion: motion || 'fall',
      glyphs: kind === 'glyph' ? theme.glyphs : '',
    };
  }

  function generateLocal(prompt, cats) {
    const themes = matchThemes(prompt);
    const main = themes[0] || proceduralTheme(prompt);
    const second = themes[1] || null;
    const jitter = rnd(-14, 14);
    const [p1, p2, p3, bg] = main.palette;
    const palette = {
      primary: shiftHex(p1, jitter),
      secondary: shiftHex(second ? second.palette[0] : p2, jitter),
      accent: p3,
      background: bg,
    };
    const subject = titleCase(prompt.replace(/[^\p{L}\p{N}\s'-]/gu, ' ').trim().split(/\s+/).slice(0, 3).join(' ')) || main.word;
    const rarity = choice(['Raro', 'Épico', 'Épico', 'Lendário']);

    return cats.map((cat) => {
      let layers;
      let base = { style: 'none', animation: 'none', speed: choice(['slow', 'normal', 'normal', 'fast']) };
      let ring = { style: 'none' };
      if (cat === 'nameplates') {
        base = { ...base, style: main.np, animation: main.anim };
        layers = main.layers.map((d) => makeLayer(d, palette, main));
        if (second) layers.push(makeLayer(second.layers[0], palette, second));
      } else if (cat === 'decorations') {
        ring = { style: main.ringStyle };
        layers = [{
          kind: 'ring', count: choice(['some', 'many']), color: palette.accent, size: 'medium', speed: choice(['slow', 'normal']),
          shape: main.ringShape, motion: 'fall', glyphs: main.ringShape === 'glyph' ? main.glyphs : '',
        }];
        layers.push({ kind: 'ring', count: 'few', color: palette.secondary, size: 'small', speed: 'normal', shape: 'star', motion: 'fall', glyphs: '' });
        if (second) layers.push({ kind: 'ring', count: 'few', color: palette.secondary, size: 'medium', speed: 'fast', shape: second.ringShape, motion: 'fall', glyphs: second.glyphs });
      } else {
        base = { ...base, style: Math.random() < 0.5 ? 'none' : main.np === 'pixelfire' ? 'pixelfire' : 'radial', animation: 'pulse' };
        layers = main.fx.map((d) => makeLayer(d, palette, main));
        if (second) layers.push(makeLayer(second.fx[0], palette, second));
      }
      const noun = choice(NOUNS[cat]);
      return {
        cat,
        raw: {
          name: `${noun} ${main.id === 'proc' ? 'de ' + subject : main.word}`.slice(0, 40),
          description: `Criação procedural a partir de “${prompt.slice(0, 70)}”.`,
          rarity,
          tags: [...new Set([...themes.map((t) => t.id), 'gerado', 'local'])].slice(0, 5),
          prompt,
          engine: 'local',
          asset: { palette, base, ring, layers },
        },
      };
    });
  }

  /** Variação rápida de um item: gira a paleta e embaralha velocidades/quantidades. */
  function varyItem(item) {
    const a = JSON.parse(JSON.stringify(item.asset));
    const deg = choice([-1, 1]) * rnd(25, 70);
    for (const k of ['primary', 'secondary', 'accent']) a.palette[k] = shiftHex(a.palette[k], deg);
    a.base.speed = choice(Object.keys(GEN.speeds));
    a.layers.forEach((l) => {
      l.count = choice(['few', 'some', 'many']);
      l.color = shiftHex(l.color, deg);
      l.speed = choice(Object.keys(GEN.speeds));
    });
    return {
      name: item.name.replace(/( · v\d+)?$/, '') + ' · v' + Math.floor(rnd(2, 99)),
      description: item.description,
      rarity: item.rarity,
      tags: item.tags,
      prompt: item.prompt,
      engine: item.engine,
      asset: a,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Interface                                                           */
  /* ------------------------------------------------------------------ */
  const ui = { engine: store.get(ENGINE_STORAGE) || 'claude', busy: false, results: [] };

  function selectedCats() {
    return $$('#gen-cats input:checked').map((i) => i.value);
  }

  function renderEngine() {
    $$('#gen-engine button').forEach((b) => b.classList.toggle('is-active', b.dataset.engine === ui.engine));
    $('#gen-key-box').classList.toggle('hidden', ui.engine !== 'claude');
    $('#gen-engine-hint').textContent = ui.engine === 'claude'
      ? 'Usa o modelo Claude Opus 5.5 com sua chave da API. Cada geração consome créditos da sua conta.'
      : 'Gerador procedural por palavras-chave: instantâneo, grátis e sem internet.';
  }

  function setBusy(busy, text) {
    ui.busy = busy;
    const btn = $('#gen-submit');
    btn.disabled = busy;
    btn.classList.toggle('is-loading', busy);
    btn.querySelector('.gen-btn-label').innerHTML = busy ? '<span class="spinner"></span> Gerando…' : '✨ Gerar cosméticos';
    $('#gen-status').textContent = text || '';
  }

  function renderResults() {
    const box = $('#gen-results');
    box.innerHTML = '';
    const frag = document.createDocumentFragment();
    ui.results.forEach(({ cat, id }, i) => {
      const item = CS.findItem(cat, id);
      if (!item) return;
      const card = CS.buildCard(cat, item, { variant: 'gen' });
      card.style.animationDelay = i * 60 + 'ms';
      const prev = card.querySelector('.card-preview');
      prev.insertAdjacentHTML('beforeend', `<span class="engine-badge">${item.engine === 'claude' ? '✨ Claude' : '⚡ Local'} · ${CATS[cat].singular}</span>`);
      frag.appendChild(card);
    });
    box.appendChild(frag);
    $('#gen-empty').classList.toggle('hidden', ui.results.length > 0);
    $('#gen-clear').classList.toggle('hidden', ui.results.length === 0);
    $('#gen-results-label').textContent = ui.results.length ? `Resultados — ${ui.results.length} ${ui.results.length === 1 ? 'item' : 'itens'}` : 'Resultados';
    CS.syncUserBits(box);
    CS.updateCardStates();
  }

  function showSkeletons(n) {
    const box = $('#gen-results');
    $('#gen-empty').classList.add('hidden');
    const sk = Array.from({ length: n }, () => '<div class="gen-skeleton"></div>').join('');
    box.insertAdjacentHTML('afterbegin', sk);
  }

  function addResults(list) {
    const added = list.map(({ cat, raw }) => {
      const item = CS.sanitizeGenItem(cat, raw);
      CS.registerCustom(cat, item, { saved: false });
      return { cat, id: item.id };
    });
    ui.results = [...added, ...ui.results].slice(0, 24);
    renderResults();
    return added;
  }

  async function onGenerate(e) {
    e.preventDefault();
    if (ui.busy) return;
    const prompt = $('#gen-prompt').value.trim();
    const cats = selectedCats();
    if (!prompt) {
      $('#gen-prompt').focus();
      return CS.toast('Descreva um tema para gerar.', 'danger');
    }
    if (!cats.length) return CS.toast('Escolha pelo menos uma categoria.', 'danger');

    if (ui.engine === 'claude') {
      const key = $('#gen-key').value.trim();
      if (!key) {
        $('#gen-key').focus();
        return CS.toast('Cole sua chave da API ou troque para o motor Local.', 'danger');
      }
      if ($('#gen-key-remember').checked) store.set(KEY_STORAGE, key);
      else store.del(KEY_STORAGE);
      setBusy(true, 'A IA está desenhando o seu kit… isso leva alguns segundos.');
      showSkeletons(cats.length);
      try {
        const list = await generateWithClaude(prompt, cats, key);
        $$('#gen-results .gen-skeleton').forEach((n) => n.remove());
        addResults(list);
        CS.toast(`${list.length} ${list.length === 1 ? 'cosmético gerado' : 'cosméticos gerados'} pela IA!`, 'success');
      } catch (err) {
        console.error('[Gerador IA]', err);
        $$('#gen-results .gen-skeleton').forEach((n) => n.remove());
        renderResults();
        CS.toast(err.message || 'Falha ao gerar.', 'danger');
      } finally {
        setBusy(false);
      }
    } else {
      setBusy(true, 'Gerando…');
      showSkeletons(cats.length);
      setTimeout(() => {
        $$('#gen-results .gen-skeleton').forEach((n) => n.remove());
        const list = generateLocal(prompt, cats);
        addResults(list);
        setBusy(false);
        CS.toast(`${list.length} ${list.length === 1 ? 'cosmético gerado' : 'cosméticos gerados'} localmente!`, 'success');
      }, 450);
    }
  }

  function openJson(item) {
    let dlg = $('#gen-json-dialog');
    if (!dlg) {
      document.body.insertAdjacentHTML('beforeend', `
        <dialog id="gen-json-dialog" class="json-modal w-[min(92vw,640px)] rounded-xl bg-dc-side text-dc-text p-0 border border-white/10 shadow-2xl">
          <div class="flex items-center justify-between px-4 py-3 border-b border-black/30">
            <h3 class="font-bold">JSON do item</h3>
            <button type="button" class="btn btn-ghost btn-sm" data-close aria-label="Fechar">✕</button>
          </div>
          <p class="px-4 pt-3 text-xs text-dc-muted">Cole este objeto no array da categoria em <code class="text-dc-text">js/data.js</code> para fixá-lo no catálogo.</p>
          <pre class="m-4 p-3 rounded-lg bg-dc-dark text-xs overflow-auto max-h-[55vh]"><code></code></pre>
          <div class="flex justify-end gap-2 px-4 pb-4">
            <button type="button" class="btn btn-primary btn-sm" data-copy>Copiar JSON</button>
          </div>
        </dialog>`);
      dlg = $('#gen-json-dialog');
      dlg.addEventListener('click', async (e) => {
        if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
        if (e.target.closest('[data-copy]')) {
          try {
            await navigator.clipboard.writeText(dlg.querySelector('code').textContent);
            CS.toast('JSON copiado!', 'success');
          } catch (err) {
            CS.toast('Não foi possível copiar — selecione o texto manualmente.', 'danger');
          }
        }
      });
    }
    const { prompt, engine, ...pub } = CS.publicItem(item);
    pub.collection = 'Criações IA';
    dlg.querySelector('code').textContent = JSON.stringify(pub, null, 2);
    dlg.showModal();
  }

  function onResultsClick(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    const card = btn.closest('.cosmetic-card');
    if (!card) return;
    const cat = card.dataset.cat;
    const item = CS.findItem(cat, card.dataset.id);
    if (!item) return;

    if (btn.classList.contains('btn-try')) {
      CS.equip(cat, item.id);
    } else if (btn.classList.contains('gen-save')) {
      CS.setSaved(cat, item.id, !item._saved);
      btn.textContent = item._saved ? '★ Salvo' : '☆ Salvar';
      CS.toast(item._saved ? `“${item.name}” salva na coleção Criações IA.` : `“${item.name}” removida da coleção.`, item._saved ? 'success' : 'info');
    } else if (btn.classList.contains('gen-vary')) {
      const added = addResults([{ cat, raw: varyItem(item) }]);
      CS.toast('Variação criada!', 'success');
      const first = $(`#gen-results [data-id="${added[0].id}"]`);
      first?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (btn.classList.contains('gen-json')) {
      openJson(item);
    }
  }

  function init() {
    const ex = $('#gen-examples');
    EXAMPLES.forEach((t) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'gen-chip';
      b.textContent = t;
      ex.appendChild(b);
    });
    ex.addEventListener('click', (e) => {
      const b = e.target.closest('.gen-chip');
      if (!b) return;
      $('#gen-prompt').value = b.textContent;
      $('#gen-prompt').dispatchEvent(new Event('input'));
      $('#gen-prompt').focus();
    });

    $('#gen-prompt').addEventListener('input', (e) => {
      $('#gen-prompt-count').textContent = `${e.target.value.length}/300`;
    });
    $('#gen-prompt').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#gen-form').requestSubmit();
    });

    const savedKey = store.get(KEY_STORAGE);
    if (savedKey) {
      $('#gen-key').value = savedKey;
      $('#gen-key-remember').checked = true;
    }
    $('#gen-key-toggle').addEventListener('click', () => {
      const i = $('#gen-key');
      i.type = i.type === 'password' ? 'text' : 'password';
    });

    $('#gen-engine').addEventListener('click', (e) => {
      const b = e.target.closest('[data-engine]');
      if (!b) return;
      ui.engine = b.dataset.engine;
      store.set(ENGINE_STORAGE, ui.engine);
      renderEngine();
      if (ui.engine === 'claude') loadSdk().catch(() => {});
    });

    $('#gen-form').addEventListener('submit', onGenerate);
    $('#gen-results').addEventListener('click', onResultsClick);
    $('#gen-clear').addEventListener('click', () => {
      ui.results = [];
      renderResults();
    });

    document.addEventListener('cs:generator-open', () => {
      if (ui.engine === 'claude') loadSdk().catch(() => {});
      renderResults();
    });

    renderEngine();
    renderResults();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Exposto para testes / depuração
  window.CosmeticGenerator = { generateLocal, varyItem, OUTPUT_SCHEMA, SYSTEM_PROMPT };
})();
