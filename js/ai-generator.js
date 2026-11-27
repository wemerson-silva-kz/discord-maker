/* ==========================================================================
   COSMETIC STUDIO — Gerador de cosméticos com IA
   --------------------------------------------------------------------------
   Dois motores produzem a MESMA especificação JSON (asset.type = 'gen'),
   que o renderizador de js/app.js transforma em animação CSS/SVG:

   • IA (qualquer provedor): Anthropic via SDK oficial, ou qualquer API
     compatível com OpenAI (OpenAI, Gemini, OpenRouter, Groq, DeepSeek,
     Mistral, Ollama, LM Studio…), chamada direto do navegador com a chave do
     usuário. Pede JSON (estruturado quando o provedor suporta) com a spec.
   • Local (offline): gerador procedural por palavras-chave, sem rede.
   ========================================================================== */
(function () {
  'use strict';

  const CS = window.CosmeticStudio;
  if (!CS) return console.error('[Gerador IA] app.js não carregado');
  const { CATS, GEN } = CS;

  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.3.0/+esm';
  const AI_STORAGE = 'cosmetic-studio:ai-settings:v1';
  const ENGINE_STORAGE = 'cosmetic-studio:engine';

  /**
   * Provedores suportados. Todos, exceto Anthropic, usam o endpoint
   * /chat/completions no formato da OpenAI — então qualquer API compatível
   * funciona pelo item "Outro". `format` diz como pedir JSON:
   *   json_schema → saída estruturada estrita | json_object → modo JSON simples
   * Os modelos são só sugestões: o campo "Modelo" é editável.
   */
  const PROVIDERS = {
    anthropic: { label: 'Anthropic (Claude)', model: 'claude-opus-5-5', keyPh: 'sk-ant-...', hint: 'Usa o SDK oficial da Anthropic com saída estruturada (JSON Schema).' },
    openai: { label: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', imageModel: 'gpt-image-1', format: 'json_schema', keyPh: 'sk-...', hint: 'Usa saída estruturada estrita (json_schema).' },
    gemini: { label: 'Google Gemini', native: 'gemini', base: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.5-flash', imageModel: 'gemini-3.1-flash-image', keyPh: 'AIza...', hint: 'API nativa do Gemini com saída JSON estruturada (responseSchema). Crie a chave grátis em aistudio.google.com; ao colar a chave, os modelos disponíveis aparecem na lista.' },
    openrouter: { label: 'OpenRouter (centenas de modelos)', base: 'https://openrouter.ai/api/v1', model: 'openrouter/auto', format: 'json_object', keyPh: 'sk-or-...', hint: 'Troque o modelo por qualquer um do catálogo do OpenRouter (ex.: um modelo gratuito).' },
    groq: { label: 'Groq', base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', format: 'json_object', keyPh: 'gsk_...', hint: 'Muito rápido; tem plano gratuito.' },
    deepseek: { label: 'DeepSeek', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat', format: 'json_object', keyPh: 'sk-...' },
    mistral: { label: 'Mistral', base: 'https://api.mistral.ai/v1', model: 'mistral-large-latest', format: 'json_object', keyPh: '...' },
    ollama: { label: 'Ollama (no seu PC)', base: 'http://localhost:11434/v1', model: 'llama3.1', format: 'json_object', keyPh: 'opcional', keyOptional: true, editableBase: true, hint: 'Grátis e local. Inicie o Ollama com OLLAMA_ORIGINS=* para o navegador poder acessá-lo.' },
    custom: { label: 'Outro (compatível com OpenAI)', base: '', model: '', format: 'json_object', keyPh: 'opcional', keyOptional: true, editableBase: true, hint: 'LM Studio, Together, Fireworks, xAI, vLLM… qualquer API com /chat/completions.' },
  };
  const CAT_TO_API = { nameplates: 'nameplate', decorations: 'decoration', effects: 'effect', frames: 'frame' };
  /** Frame em volta do card: card de 1200 px, 304 por cima, 212 por baixo, 56 dos lados; topo e base fixos, o meio estica. */
  const FRAME_WRAP = { inner: 1200, top: 304, bottom: 212, side: 56, layers: [{ kind: 'border', order: 'front', anchor: 'center', sliceTop: 304 + 560, sliceBottom: 212 + 420, imgW: 1312 }] };
  const API_TO_CAT = { nameplate: 'nameplates', decoration: 'decorations', effect: 'effects', frame: 'frames' };

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
          required: ['category', 'name', 'description', 'rarity', 'tags', 'palette', 'base', 'ring', 'layers', 'intro'],
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
            intro: {
              type: 'object',
              additionalProperties: false,
              required: ['style', 'duration', 'layers'],
              properties: {
                style: { type: 'string', enum: GEN.introStyles },
                duration: { type: 'number', description: 'Segundos da entrada (0.5 a 6). Use 0 e style "none" fora de effect.' },
                layers: { type: 'array', items: LAYER_SCHEMA },
              },
            },
          },
        },
      },
    },
  };

  const SYSTEM_PROMPT = `Você é um designer de cosméticos de perfil no estilo do Discord. A partir do tema do usuário, você cria itens animados descritos por uma especificação JSON; um motor CSS/SVG transforma essa especificação em animação.

Como os cosméticos funcionam no Discord (siga estes formatos):
- Avatar decoration: APNG 288×288 desenhado em volta do avatar (1,2× o tamanho dele), com estado estático e animado (anima ao passar o mouse), em loop.
- Nameplate: APNG 448×84 atrás do nome na lista de membros, com estado estático e animado, em loop.
- Profile effect: APNG 450×880 sobre o card de perfil, em DUAS FASES: uma ENTRADA que toca uma única vez quando o perfil abre (no máximo 6 segundos; os oficiais duram cerca de 3 a 5 s) e depois um LOOP que se repete. A entrada deve ser o momento mais impactante (explosão, cortina, varredura de luz) e terminar suave, entregando para o loop, que é mais calmo e contínuo.
- Os assets oficiais rodam a cerca de 12 fps; aqui a animação é CSS e roda na taxa da tela (60 fps), então evite quantidades exageradas de partículas para manter a fluidez: prefira "some" a "many" quando houver três ou mais camadas.

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
- intro (só em effect): style = burst (explosão + onda de choque), sweep (faixa de luz atravessando), rise (onda subindo), zoom (vinheta que fecha), curtain (cortinas que se abrem), flash (clarões) ou none; duration em segundos, de 0.5 a 6 (ideal 2 a 4); layers: 1 a 3 camadas extras que só aparecem durante a entrada (ex.: warp, sparkle many, ember many). Em nameplate e decoration use style "none", duration 0 e layers vazio.
- glyphs: até 4 emojis ou símbolos Unicode do tema (ex.: "🐉🔥", "❄✦", "♪♫"); string vazia quando a camada não usa.
- count: few, some ou many. size: small, medium ou large. speed: slow, normal ou fast.
- Todas as cores em hex #RRGGBB. palette.background é o tom escuro de fundo; primary, secondary e accent são as cores do tema, com bom contraste sobre fundo escuro.

Gere exatamente um item para cada categoria pedida, na ordem pedida, formando um kit coerente com o tema. Cada item deve combinar pelo menos duas camadas (uma sutil de fundo e uma de destaque) para ter profundidade e movimento. Escreva em português do Brasil: nome curto e criativo (até 28 caracteres), descrição de uma frase (até 120 caracteres), 3 a 5 tags em minúsculas. Escolha rarity (Raro, Épico ou Lendário) conforme a complexidade visual.`;

  /* ------------------------------------------------------------------ */
  /* ZONAS PROTEGIDAS — onde ficam avatar, nome e conteúdo do perfil.     */
  /* Medidas no card de 340 px do popout e convertidas para o canvas de    */
  /* cada formato. Usadas no prompt E na verificação automática.          */
  /* avg = cobertura média máxima; peak = pior quadro permitido.          */
  /* ------------------------------------------------------------------ */
  const ZONES = {
    effects: { w: 450, h: 880, zones: [
      // Calibrado com 40 effects oficiais (catalog/style-guide.json): avatar mediana 8%,
      // nome 34% e texto 33% — o efeito atravessa o perfil, mas não fica parado no avatar.
      { id: 'avatar', label: 'avatar', shape: 'circle', cx: 82, cy: 138, r: 66, avg: 0.12, peak: 0.5 },
      { id: 'name', label: 'nome e @usuário', shape: 'rect', x: 21, y: 199, w: 323, h: 72, avg: 0.35, peak: 0.75 },
      { id: 'content', label: 'texto do perfil (Sobre mim)', shape: 'rect', x: 21, y: 283, w: 408, h: 273, avg: 0.35, peak: 0.7 },
    ] },
    // Frame em volta do card (como no Discord): canvas 1312×2528, card em (56, 304)–(1256, 2316)
    frames: { w: 1312, h: 2528, zones: [
      { id: 'avatar', label: 'avatar', shape: 'circle', cx: 346, cy: 791, r: 225, avg: 0.08, peak: 0.2 },
      { id: 'name', label: 'nome e @usuário', shape: 'rect', x: 130, y: 1006, w: 1000, h: 250, avg: 0.06, peak: 0.15 },
      { id: 'center', label: 'conteúdo do card', shape: 'rect', x: 170, y: 1300, w: 972, h: 880, avg: 0.06, peak: 0.15 },
    ] },
    decorations: { w: 288, h: 288, zones: [
      { id: 'avatar', label: 'avatar (círculo central)', shape: 'circle', cx: 144, cy: 144, r: 104, avg: 0.08, peak: 0.2 },
    ] },
    nameplates: { w: 448, h: 84, zones: [
      { id: 'name', label: 'avatar e nome (lado esquerdo)', shape: 'rect', x: 0, y: 0, w: 200, h: 84, avg: 0.35, peak: 0.55 },
    ] },
  };
  const zoneText = (z) => (z.shape === 'circle'
    ? `círculo com centro (${z.cx}, ${z.cy}) e raio ${z.r}`
    : `retângulo x ${z.x}–${z.x + z.w}, y ${z.y}–${z.y + z.h}`);
  const ZONES_PROMPT = Object.entries({ nameplates: 'nameplate', decorations: 'decoration', effects: 'effect', frames: 'frame' })
    .map(([cat, api]) => `- ${api} (canvas ${ZONES[cat].w}×${ZONES[cat].h}): ` + ZONES[cat].zones.map((z) => `${z.label} = ${zoneText(z)}, no máximo ${Math.round(z.avg * 100)}% coberto em média`).join('; '))
    .join('\n');

  /* ------------------------------------------------------------------ */
  /* Guia de estilo do Discord, medido em itens oficiais da loja           */
  /* (tools/analyze_discord_style.py → catalog/style-guide.json).          */
  /* Os valores abaixo são o padrão; o JSON, se carregar, os atualiza.     */
  /* ------------------------------------------------------------------ */
  const STYLE = {
    n: 160,
    effects: { intro: 4.2, introLo: 3, introHi: 5, loop: 4.1, loopDelay: 2.4, coverage: 0.14, colors: 22, sat: 0.38, bright: 0.78, outline: 0.02 },
    decorations: { coverage: 0.11, colors: 18, bright: 0.88 },
    nameplates: { right: 0.66, nameSide: 0.01, colors: 10, coverage: 0.15 },
    frames: { colors: 16, outline: 0.01 },
    examples: {},
  };
  const pct = (v) => Math.round(v * 100) + '%';
  function loadStyleGuide() {
    return fetch('catalog/style-guide.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!d) return;
      const m = (o) => (o && typeof o.mediana === 'number' ? o.mediana : undefined);
      const set = (obj, k, v) => { if (typeof v === 'number' && isFinite(v)) obj[k] = v; };
      STYLE.n = Object.values(d.amostra || {}).reduce((a, b) => a + b, 0) || STYLE.n;
      const e = d.effects || {}, t = e.tempos || {}, es = e.estilo || {};
      set(STYLE.effects, 'intro', m(t.introMs) / 1000); set(STYLE.effects, 'loop', m(t.loopMs) / 1000);
      set(STYLE.effects, 'introLo', (t.introMs || {}).p25 / 1000); set(STYLE.effects, 'introHi', (t.introMs || {}).p75 / 1000);
      set(STYLE.effects, 'loopDelay', m(t.loopDelayMs) / 1000);
      set(STYLE.effects, 'coverage', m(es.coverage)); set(STYLE.effects, 'colors', m(es.colors90));
      set(STYLE.effects, 'sat', m(es.saturation)); set(STYLE.effects, 'bright', m(es.brightness)); set(STYLE.effects, 'outline', m(es.darkOutline));
      const dc = d.decorations || {};
      set(STYLE.decorations, 'coverage', m(dc.coberturaAvatar)); set(STYLE.decorations, 'colors', m((dc.estilo || {}).colors90)); set(STYLE.decorations, 'bright', m((dc.estilo || {}).brightness));
      const np = d.nameplates || {};
      if (Array.isArray(np.perfilHorizontal8)) set(STYLE.nameplates, 'right', np.perfilHorizontal8[7]);
      set(STYLE.nameplates, 'nameSide', m(np.coberturaLadoDoNome)); set(STYLE.nameplates, 'colors', m((np.estilo || {}).colors90)); set(STYLE.nameplates, 'coverage', m((np.estilo || {}).coverage));
      const fr = d.frames || {};
      set(STYLE.frames, 'colors', m((fr.estilo || {}).colors90)); set(STYLE.frames, 'outline', m((fr.estilo || {}).darkOutline));
      STYLE.examples = d.exemplos || {};
    }).catch(() => { /* fica com os padrões */ });
  }

  function styleGuidePrompt() {
    const e = STYLE.effects, dc = STYLE.decorations, np = STYLE.nameplates, fr = STYLE.frames;
    const f1 = (v) => (Math.round(v * 10) / 10).toString();
    return `

GUIA DE ESTILO DO DISCORD (medido em ${STYLE.n} itens oficiais da loja — siga para o resultado parecer um item PROFISSIONAL da loja, não um rascunho):
Acabamento
- Ilustração estilo cartoon/cel-shading limpo, como os itens da loja: cada forma com 2–3 tons da mesma cor (base, sombra, luz) em vez de gradientes lamacentos; um brilho/realce forte nas bordas viradas para a luz; leve glow (feGaussianBlur, stdDeviation 2–6) só nos elementos mágicos (fogo, energia, estrelas).
- Paleta CURTA e harmônica: 1 cor dominante, 1 de apoio e 1 de destaque (as cores principais somam ~${Math.round(np.colors)}–${Math.round(e.colors)} tons contando as variações). Cores vivas, mas não neon: saturação média (~${f1(e.sat)}) e brilho alto (~${f1(e.bright)}). Nada de áreas grandes pretas ou marrom-escuras.
- Contorno: ou nenhum, ou fino e escuro da própria cor (ex.: verde-escuro em volta do verde). Contorno preto grosso só em ~${pct(e.outline)} dos pixels dos oficiais — evite.
- Silhuetas legíveis em tamanho pequeno: poucos elementos grandes e bem desenhados valem mais que dezenas de detalhes miúdos. Formas orgânicas com curvas (path com C/Q), nunca só retângulos e círculos soltos.
- Profundidade: 3 planos (fundo suave e translúcido, plano principal nítido, partículas/brilhos na frente).
Movimento
- Movimento com intenção e easing (ease-in-out, cubic-bezier), nunca linear em tudo; partes que balançam a partir de um ponto de apoio (transform-origin no ponto preso). Sobreponha ritmos (ex.: 4 s respiração, 2 s brilho, 1 s cintilar) sempre divisores do loop.
Composição por formato
- effect: entrada ≈ ${f1(e.intro)} s (oficiais entre ${f1(e.introLo)} e ${f1(e.introHi)} s) e loop ≈ ${f1(e.loop)} s; no Discord o loop repete com ~${f1(e.loopDelay)} s de pausa, então o loop deve começar e terminar calmo. Use pouca área: os oficiais ocupam só ~${pct(e.coverage)} do canvas, concentrados nos 60% de cima (banner e laterais), base quase vazia. Elementos podem PASSAR sobre o nome e o texto (rajadas, pétalas, faíscas), mas nunca ficar parados sobre o avatar.
- decoration: o centro é VAZIO; a arte é um anel colado ao avatar, mais denso entre 70% e 90% do raio do canvas, espalhada pelos 4 lados (um ornamento principal em cima ou em um canto e elementos menores equilibrando do outro lado). Cobre o avatar só ~${pct(dc.coverage)} (bordinha). Brilho alto (~${f1(dc.bright)}), sem contorno preto.
- nameplate: densidade crescente da esquerda para a direita — vazio até x≈150, a ilustração principal nos 40% da direita (até ~${pct(np.right)} preenchido na ponta direita); o lado do nome fica quase limpo (~${pct(np.nameSide)}). Total ~${pct(np.coverage)} do retângulo, ~${Math.round(np.colors)} cores. A paleta do Discord faz o fundo: a arte não precisa de fundo.
- frame: em volta do card — ornamento principal no topo, passando por cima da borda do card (os oficiais sobem ~300 px num card de 1200), peça menor na base e laterais finas; o card fica 0% coberto. ~${Math.round(fr.colors)} cores; contorno fino.`;
  }

  /** Exemplos oficiais da mesma categoria, para anexar como referência de estilo. */
  const API_TO_STYLE = { nameplates: 'nameplates', decorations: 'decorations', effects: 'effects', frames: 'frames' };
  function styleExamples(cats, prompt, perCat = 1) {
    const words = (prompt || '').toLowerCase().split(/[^a-zà-ú0-9]+/).filter((w) => w.length > 3);
    const out = [];
    cats.forEach((cat) => {
      const list = (STYLE.examples[API_TO_STYLE[cat]] || []).filter((x) => x && x.img);
      if (!list.length) return;
      const scored = list.map((x, i) => ({ x, i, s: words.filter((w) => (x.nome || '').toLowerCase().includes(w)).length }));
      const seed = [...(prompt || 'x')].reduce((a, c) => a + c.charCodeAt(0), 0);
      scored.sort((a, b) => b.s - a.s || ((a.i + seed) % list.length) - ((b.i + seed) % list.length));
      scored.slice(0, perCat).forEach(({ x }) => out.push({ cat, name: x.nome, url: x.img }));
    });
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Modo ARTE: a IA desenha SVG animado (CSS @keyframes)                 */
  /* ------------------------------------------------------------------ */
  const SVG_OUTPUT_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['items'],
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['category', 'name', 'description', 'rarity', 'tags', 'loopSeconds', 'svg', 'introSeconds', 'introSvg', 'discordPalette'],
          properties: {
            category: { type: 'string', enum: ['nameplate', 'decoration', 'effect', 'frame'] },
            name: { type: 'string' },
            description: { type: 'string' },
            rarity: { type: 'string', enum: GEN.rarities },
            tags: { type: 'array', items: { type: 'string' } },
            loopSeconds: { type: 'number', description: 'Duração do loop em segundos (2 a 6).' },
            svg: { type: 'string', description: 'SVG completo do LOOP, animado só com CSS @keyframes.' },
            discordPalette: { type: 'string', enum: [...Object.keys(CS.DATA.discordPalettes || {}), 'none'], description: 'Só nameplate: paleta do Discord pintada por baixo da arte. Nos outros, "none".' },
            introSeconds: { type: 'number', description: 'Só effect: duração da entrada (1 a 6). Nos outros, 0.' },
            introSvg: { type: 'string', description: 'Só effect: SVG da ENTRADA (toca uma vez). Nos outros, string vazia.' },
          },
        },
      },
    },
  };

  const SVG_SYSTEM_PROMPT = `Você é um ilustrador e animador de cosméticos de perfil do Discord. Para cada pedido você desenha ARTE VETORIAL ANIMADA em SVG, no tamanho exato do formato, e devolve JSON.

O que importa acima de tudo: a arte precisa representar de forma reconhecível o tema pedido. Se o tema fala de um dragão, desenhe um dragão (silhueta com cabeça, chifres, corpo serpenteante, escamas sugeridas por gradientes); templo = telhados curvos em camadas, colunas; nuvens escuras e sombrias = massas de nuvem em cinza-azulado escuro com gradientes, céu carregado; fogo verde = chamas com gradiente verde-jade e brilho. Componha em camadas (fundo, plano médio, destaque), use gradientes e filtros de brilho (feGaussianBlur) para dar acabamento de item premium. Nunca use letras, ideogramas ou emojis para representar objetos.

Formatos (use exatamente estes viewBox):
- nameplate: viewBox="0 0 448 84", FUNDO TRANSPARENTE, como as nameplates oficiais: o Discord pinta por baixo uma PALETA (campo discordPalette), um degradê da cor escura (à esquerda) para a clara (à direita). Escolha a paleta que combina com o tema: ${Object.entries(CS.DATA.discordPalettes || {}).map(([k, v]) => `${k} (${v.label})`).join(', ')}. Desenhe só a ilustração, concentrada à direita (x > 200); o avatar e o nome (texto branco) ficam à esquerda, então deixe essa área vazia ou com detalhes leves.
- decoration: viewBox="0 0 288 288", fundo transparente. O avatar circular fica no centro (cx 144, cy 144, raio 120) e NÃO pode ser coberto: desenhe em volta, na faixa entre o raio 112 e as bordas (pode invadir levemente a borda do avatar, como uma moldura). Ex.: um dragão enrolado em volta do círculo, chamas saindo das bordas.
- effect: viewBox="0 0 450 880", fundo transparente, sobreposto ao card de perfil. Como os oficiais, a cena fica na METADE DE CIMA: mais densa no topo (área do banner, y < 230) e descendo até y ~480, cada vez mais leve; a base (y > 560) fica vazia, no máximo umas partículas. Nada de colunas grossas nas laterais. O conteúdo do perfil (x 40–410, y 260–720) só recebe elementos translúcidos e de passagem. A entrada é a cena cheia; o loop é a versão leve e esparsa dela, também no topo.
- frame (profile frame): viewBox="0 0 1312 2528", fundo transparente. Como no Discord, o frame fica EM VOLTA do card de perfil, por fora: o card é um retângulo de cantos arredondados (raio ~40) de x 56 a 1256 e y 304 a 2316. Desenhe:
  • TOPO (y 0–500): o ornamento principal, apoiado na borda de cima do card e passando para fora dele (ex.: o dragão deitado sobre o card, telhados do templo, chifres, nuvens); pode descer até y ~480, sobre o banner.
  • BASE (y 2200–2528): um ornamento menor apoiado na borda de baixo, passando para fora.
  • LATERAIS (x 0–100 e 1212–1312, y 300–2330): bordas FINAS (~70 px de espessura) que ligam o topo à base, contornando o card; entram no máximo ~40 px no card (os oficiais entram 30 px).
  Todo o interior do card (x 100–1212, y 500–2230) fica VAZIO: é o conteúdo do perfil. O meio das laterais (y ~860–1900) estica conforme a altura do perfil, então ali use um padrão contínuo e uniforme, sem elementos únicos. Pode ter animação sutil em loop (brilho, chamas, nuvens), mas precisa ficar bonito parado também. introSeconds 0 e introSvg "".
  O efeito tem DUAS FASES, como no Discord: introSvg é a ENTRADA, que toca uma única vez ao abrir o perfil (introSeconds entre 1 e 6, ideal 2 a 4): o momento mais impactante (ex.: o dragão surge e cospe uma rajada de fogo que atravessa o card), terminando suave. svg é o LOOP contínuo e mais calmo que vem depois (ex.: o dragão respirando, brasas subindo, nuvens passando).

ZONAS PROTEGIDAS (obrigatório; o app mede isso automaticamente e devolve a arte para correção se invadir). Nelas não pode haver formas opacas — no máximo partículas pequenas e translúcidas de passagem:
${ZONES_PROMPT}
Para respeitar as zonas, posicione os elementos grandes (personagens, chifres, totens, prédios, molduras) nas bordas e no topo do banner, nunca atravessando o avatar ou o nome; elementos animados que se movem (ex.: rajadas) devem passar acima (y menor) ou abaixo dessas zonas.

Regras técnicas do SVG (obrigatórias):
- Comece com <svg xmlns="http://www.w3.org/2000/svg" viewBox="...">. Nada de <script>, <foreignObject>, <image>, links externos, fontes externas ou atributos de evento.
- Animação SOMENTE com CSS dentro de <style> (@keyframes + animation). Não use SMIL (<animate>, <animateTransform>).
- Para girar ou escalar formas, use transform-box: fill-box; transform-origin: center (ou um ponto em px).
- LOOP perfeito: todas as animações do svg do loop são infinite e com duração que divide loopSeconds exatamente (ex.: loop 4 s → 1 s, 2 s ou 4 s; delays também em frações desse ciclo).
- ENTRADA: animações com animation-iteration-count 1 e animation-fill-mode both, terminando até introSeconds.
- Cores em hex; prefira gradientes. Qualidade alta, mas cada SVG com no máximo cerca de 14 mil caracteres e 150 elementos.
- Em nameplate, decoration e frame: introSeconds 0 e introSvg "".

Gere exatamente um item por categoria pedida, na ordem pedida, formando um kit coerente. Escreva em português do Brasil: nome curto e criativo (até 28 caracteres), descrição de uma frase, 3 a 5 tags em minúsculas, rarity conforme a complexidade.`;

  const SVG_JSON_EXAMPLE = JSON.stringify({ items: [{
    category: 'nameplate', name: 'Rajada de Jade', description: 'Chamas verdes correndo à direita da faixa.', rarity: 'Épico', tags: ['fogo', 'jade'],
    loopSeconds: 4,
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 84"><style>.f{transform-box:fill-box;transform-origin:50% 100%;animation:fl 1s ease-in-out infinite}@keyframes fl{50%{transform:scaleY(1.2)}}</style><path class="f" d="M380 84c-20-30 10-40 0-70 30 25 40 50 20 70z" fill="#2be38b"/></svg>',
    introSeconds: 0, introSvg: '', discordPalette: 'teal',
  }] });

  /* ------------------------------------------------------------------ */
  /* Prompt por formato: "tema geral" + linhas "nameplate: …", "moldura: …" */
  /* ------------------------------------------------------------------ */
  const FORMAT_LINES = [
    ['frames', /^\s*(?:profile\s*frame|frame|moldura\s+(?:de|do)\s+perfil|moldura\s+do\s+card)\s*[:=-]\s*/i],
    ['decorations', /^\s*(?:avatar\s*decoration|decoration|decora[cç][aã]o|moldura(?:\s+de\s+avatar)?|avatar)\s*[:=-]\s*/i],
    ['effects', /^\s*(?:profile\s*effect|effect|efeito(?:\s+de\s+perfil)?|aura)\s*[:=-]\s*/i],
    ['nameplates', /^\s*(?:nameplate|name\s*plate|placa(?:\s+de\s+nome)?|plate)\s*[:=-]\s*/i],
  ];
  const FORMAT_LABEL = { nameplates: 'nameplate', decorations: 'moldura', effects: 'efeito', frames: 'frame' };
  /** Separa o tema geral das linhas de detalhe por formato. */
  function parsePrompt(text) {
    const details = {};
    const theme = [];
    String(text || '').split(/\r?\n/).forEach((line) => {
      for (const [cat, re] of FORMAT_LINES) {
        if (re.test(line)) { const v = line.replace(re, '').trim(); if (v) details[cat] = (details[cat] ? details[cat] + ' ' : '') + v; return; }
      }
      if (line.trim()) theme.push(line.trim());
    });
    return { theme: theme.join(' '), details };
  }
  const hasFormatLines = (text) => Object.keys(parsePrompt(text).details).length > 0;
  /** Texto "tema + linhas por formato" que vai de volta para a caixa do prompt. */
  function formatPrompt(theme, details) {
    return [theme, ...['nameplates', 'decorations', 'effects', 'frames'].filter((c) => details[c]).map((c) => `${FORMAT_LABEL[c]}: ${details[c]}`)].filter(Boolean).join('\n');
  }

  const REWRITE_SYSTEM = `Você ajusta prompts para um gerador de cosméticos de perfil do Discord. O gerador cria UM item por formato, cada um numa imagem separada, e já cuida sozinho do tamanho, da composição, do fundo transparente e das áreas livres do avatar e do nome.

Formatos do sistema:
- nameplate: faixa horizontal atrás do nome na lista de membros; a arte fica à direita.
- moldura (avatar decoration): enfeite REDONDO em volta do avatar, com o centro vazio. Toda "moldura de avatar", "frame circular", "borda do avatar" ou "avatar frame" (mesmo quadrada) é isto.
- efeito (profile effect): animação sobre o card de perfil inteiro (partículas, chamas, auras, fumaça, pétalas), passando pelas bordas e pelo topo.
- frame (profile frame): moldura do CARD de perfil inteiro: ornamento no topo e colunas finas nas laterais.

Reescreva o pedido do usuário assim:
- "tema": 1 a 2 frases com o assunto, o clima, a paleta e o estilo de arte que valem para todos os itens.
- um campo por formato com 1 frase descrevendo SÓ o que aparece naquele item (materiais, criatura, elementos, cores de destaque). Se o usuário não falou de um formato, invente algo coerente com o tema.
- Remova tudo que é de apresentação ou de técnica: interface, UI, asset, sprite sheet, bundle, kit, conjunto, mockup, "alinhados", numeração, cor ou tipo de fundo (fundo preto, fundo branco), resolução, "ideal para…".
- Não descreva layout, tamanho nem posição (o sistema já faz). Nada de texto, letras ou logos na arte.
- Escreva em português do Brasil, frases curtas e visuais (no máximo 220 caracteres por campo).

Responda SOMENTE com JSON: {"tema": "...", "nameplate": "...", "moldura": "...", "efeito": "...", "frame": "..."}`;

  /** Modelo de TEXTO para a reescrita (o escolhido pode ser de imagem). */
  function textModelFor(cfg) {
    const preset = PROVIDERS[cfg.provider] || {};
    const isImg = /(^|[-/])image|gpt-image|dall-e|imagen/i.test(cfg.model || '');
    if (!isImg && cfg.model) return cfg.model;
    if (preset.native === 'gemini') {
      const cached = geminiModelsCache.get(cfg.key);
      return (cached && pickGeminiModel(cached)) || preset.model;
    }
    return preset.model;
  }

  /** Pede ao modelo de texto do provedor a versão do prompt separada por formato. */
  async function rewritePrompt(text, cfg) {
    const model = textModelFor(cfg);
    const user = `Pedido do usuário:\n${text}`;
    let out = '';
    if (cfg.provider === 'anthropic') {
      const mod = await loadSdk();
      const client = new mod.default({ apiKey: cfg.key, dangerouslyAllowBrowser: true });
      const res = await client.messages.create({ model, max_tokens: 2000, system: REWRITE_SYSTEM, messages: [{ role: 'user', content: user }] });
      out = (res.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    } else if (PROVIDERS[cfg.provider].native === 'gemini') {
      const res = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(geminiModelName(model))}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: REWRITE_SYSTEM }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.7 } }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw geminiError(res.status, data, model);
      const cand = data && data.candidates && data.candidates[0];
      out = ((cand && cand.content && cand.content.parts) || []).filter((pt) => !pt.thought).map((pt) => pt.text || '').join('');
    } else {
      const base = (cfg.baseUrl || PROVIDERS[cfg.provider].base || '').replace(/\/+$/, '');
      const headers = { 'Content-Type': 'application/json' };
      if (cfg.key) headers.Authorization = 'Bearer ' + cfg.key;
      const body = { model, messages: [{ role: 'system', content: REWRITE_SYSTEM }, { role: 'user', content: user }], response_format: { type: 'json_object' } };
      let res = await fetch(base + '/chat/completions', { method: 'POST', headers, body: JSON.stringify(body) });
      if (res.status === 400) { delete body.response_format; res = await fetch(base + '/chat/completions', { method: 'POST', headers, body: JSON.stringify(body) }); }
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error && (data.error.message || data.error)) || 'HTTP ' + res.status);
      out = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    }
    const j = parseJsonLoose(out);
    const clip = (v) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, 400);
    const details = { nameplates: clip(j.nameplate), decorations: clip(j.moldura || j.decoration), effects: clip(j.efeito || j.effect), frames: clip(j.frame) };
    Object.keys(details).forEach((k) => { if (!details[k]) delete details[k]; });
    const theme = clip(j.tema || j.theme);
    if (!theme && !Object.keys(details).length) throw new Error('A IA não devolveu o prompt ajustado.');
    return { theme, details };
  }

  /* ------------------------------------------------------------------ */
  /* Análise das referências quadro a quadro (IA de visão)                 */
  /* ------------------------------------------------------------------ */
  const MOTIONS = ['rise', 'fall', 'drift', 'orbit', 'pulse', 'sway', 'sweep'];
  const ANALYZE_SYSTEM = `Você é diretor de arte de cosméticos de perfil do Discord. Vai receber referências da biblioteca do usuário, agrupadas por formato (nameplate, moldura/decoration, efeito/effect, frame). Cada imagem é uma TIRA DE QUADROS: os quadros numerados vão da esquerda para a direita no tempo, então compare-os para entender o MOVIMENTO (o que se mexe, para onde, em que ritmo). Se só houver 1 quadro, a referência é estática.

Para CADA formato que tiver referências, estude todas as referências daquele formato juntas e devolva:
- "visual": o que elas têm em comum e que deve ser mantido — assunto, elementos, composição, traço/sombreamento, acabamento (1 a 2 frases).
- "movimento": como as coisas se movem nos quadros (1 frase).
- "preset": o movimento que mais combina, um de: rise (partículas/chamas sobem), fall (caem: chuva, pétalas, neve), drift (passam na horizontal: peixes, nuvens, vento), orbit (giram em volta), pulse (pulsam/brilham), sway (ondulam/balançam), sweep (faixa de brilho passando).
- "intensidade": 1 (sutil), 2 (médio) ou 3 (forte).
- "cores": 3 a 5 cores em hex que dominam as referências.
- "efeitos": quais efeitos de animação combinam com o que se vê nos quadros (true/false para cada): ondular (a arte toda balança em faixas, como água/bandeira; só se a própria referência ondula), calor (distorção tremida), respirar (leve zoom/sobe-desce), brilho (brilho pulsando), faixa (faixa de luz passando), brilhos (estrelinhas piscando), particulas (pontinhos subindo/caindo), chamas (chamas lambendo). Na dúvida, false para ondular e calor. Se o usuário pediu para tirar ou colocar um efeito, obedeça.
- "pedido": 1 frase descrevendo um NOVO item daquele formato, no mesmo sentido das referências, mas com o TEMA do usuário (não copie as referências; traga algo novo que pareça da mesma família). Se o usuário deu um detalhe para o formato, respeite-o.
Quando a referência for a MÍDIA DO USUÁRIO (uma cena de vídeo/imagem), NÃO peça para copiar a cena: identifique os elementos marcantes (símbolos e acessórios do personagem, arma, padrão da roupa, criaturas como corvos, fenômenos como fogo, raios, penas, folhas, fumaça) e, no "pedido", descreva ornamentos NOVOS feitos desses elementos no padrão oficial do Discord — moldura: 2 a 4 objetos grandes colados à borda do avatar, centro vazio; frame: coroa no topo e base embaixo com esses elementos e borda fina; efeito: esses elementos passando em camadas, deixando o perfil legível.
Escreva em português do Brasil. Responda SOMENTE com JSON: {"formatos": [{"formato": "nameplate|decoration|effect|frame", "visual": "...", "movimento": "...", "preset": "...", "intensidade": 2, "cores": ["#..."], "efeitos": {"ondular": false, "calor": false, "respirar": true, "brilho": true, "faixa": true, "brilhos": true, "particulas": true, "chamas": false}, "pedido": "..."}]}`;

  /* ---------- Efeitos de movimento (ondular, calor, brilhos…) ---------- */
  const FX_STORAGE = 'cosmetic-studio:gen-fx';
  const FX_AI_STORAGE = 'cosmetic-studio:gen-fx-ai';
  const FX_AI_KEYS = { ondular: 'wave', calor: 'heat', respirar: 'breathe', brilho: 'glow', faixa: 'shine', brilhos: 'sparkles', particulas: 'motes', chamas: 'licks' };
  function fxFromAi(e) {
    const out = {};
    if (e && typeof e === 'object') Object.entries(FX_AI_KEYS).forEach(([pt, key]) => { if (typeof e[pt] === 'boolean') out[key] = e[pt]; });
    return out;
  }
  function fxState() {
    if (!ui.fx) {
      try { ui.fx = JSON.parse(store.get(FX_STORAGE) || '{}') || {}; } catch (e) { ui.fx = {}; }
      ui.fxAi = store.get(FX_AI_STORAGE) !== '0';
    }
    return ui.fx;
  }
  /** Efeitos finais: escolhas na tela → sugestão da IA (se "IA escolhe") → o que o texto pede. */
  function fxFor(text, aiFx) {
    const I = window.CosmeticIllustration;
    if (!I) return {};
    return { ...I.FX_DEFAULT, ...fxState(), ...(ui.fxAi ? aiFx || {} : {}), ...I.fxFromText(text) };
  }
  function renderFx() {
    const box = $('#gen-fx');
    const I = window.CosmeticIllustration;
    if (!box || !I) return;
    const st = fxState();
    box.innerHTML = '';
    Object.entries(I.FX_LABELS).forEach(([key, label]) => {
      const l = document.createElement('label');
      l.className = 'gen-check';
      const i = document.createElement('input');
      i.type = 'checkbox';
      i.checked = { ...I.FX_DEFAULT, ...st }[key];
      i.addEventListener('change', () => { ui.fx[key] = i.checked; store.set(FX_STORAGE, JSON.stringify(ui.fx)); });
      const sp = document.createElement('span');
      sp.textContent = label;
      l.append(i, sp);
      box.appendChild(l);
    });
    const ai = $('#gen-fx-ai');
    if (ai) ai.checked = ui.fxAi;
  }

  /* ---------- Forma de cada formato (escolhida pelo usuário) ---------- */
  const SHAPES_STORAGE = 'cosmetic-studio:gen-shapes';
  const CAT_NAMES = { nameplates: 'Nameplate', decorations: 'Moldura', effects: 'Efeito (loop)', frames: 'Profile Frame' };
  async function renderShapes() {
    const I = window.CosmeticIllustration;
    if (!I || !I.shapeOptions) return;
    if (!ui.shapes) { try { ui.shapes = JSON.parse(store.get(SHAPES_STORAGE) || '{}') || {}; } catch (e) { ui.shapes = {}; } }
    const opts = await I.shapeOptions();
    Object.keys(CAT_NAMES).forEach((cat) => {
      const list = document.getElementById('gen-shapes-' + cat);
      if (!list) return;
      list.innerHTML = '';
      const cur = ui.shapes[cat] ?? opts[cat][0].v;
      opts[cat].forEach((o) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'shape-opt' + (o.v === 'auto' ? ' is-auto' : '') + (String(o.v) === String(cur) ? ' is-active' : '');
        b.title = o.label;
        if (o.v !== 'auto') {
          const im = document.createElement('img');
          im.alt = '';
          im.src = I.shapePreview(cat, o.v, 56);
          b.appendChild(im);
        }
        const sp = document.createElement('span');
        sp.textContent = o.label;
        b.appendChild(sp);
        b.addEventListener('click', () => {
          ui.shapes[cat] = o.v;
          store.set(SHAPES_STORAGE, JSON.stringify(ui.shapes));
          list.querySelectorAll('.shape-opt').forEach((x) => x.classList.toggle('is-active', x === b));
        });
        list.appendChild(b);
      });
    });
  }

  /* ---------- Elementos animados (efeito e moldura) ---------- */
  const EL_STORAGE = 'cosmetic-studio:gen-elements';
  function loadElements() {
    if (ui.elements) return;
    try { ui.elements = JSON.parse(store.get(EL_STORAGE) || 'null'); } catch (e) { ui.elements = null; }
    if (!ui.elements || typeof ui.elements !== 'object') ui.elements = {};
    ['effects', 'decorations'].forEach((c) => { if (!Array.isArray(ui.elements[c])) ui.elements[c] = []; });
    if (!ui.elements.transition) ui.elements.transition = 'nenhuma';
    if (ui.elements.ai === undefined) ui.elements.ai = true;
  }
  const saveElements = () => store.set(EL_STORAGE, JSON.stringify(ui.elements));
  function renderElements() {
    const I = window.CosmeticIllustration;
    if (!I || !I.PARTS) return;
    loadElements();
    const chip = (label, on, fn, cls = '') => { const b = document.createElement('button'); b.type = 'button'; b.className = 'gen-chip ' + cls + (on ? ' is-active' : ''); b.textContent = label; b.addEventListener('click', fn); return b; };
    ['effects', 'decorations'].forEach((cat) => {
      const box = document.getElementById('gen-elements-' + cat);
      if (!box) return;
      const list = ui.elements[cat];
      const draw = () => {
        box.innerHTML = '';
        const kinds = document.createElement('div'); kinds.className = 'flex flex-wrap gap-1.5';
        Object.entries(I.PARTS).forEach(([k, p]) => {
          if (cat === 'decorations' && (k === 'luz')) return;
          const on = list.some((l) => l.kind === k);
          kinds.appendChild(chip(p.label, on, () => {
            const i = list.findIndex((l) => l.kind === k);
            if (i >= 0) list.splice(i, 1); else if (list.length < 5) list.push({ kind: k, amount: 1, region: 'tudo' });
            saveElements(); draw();
          }));
        });
        box.appendChild(kinds);
        list.forEach((l) => {
          const row = document.createElement('div'); row.className = 'el-row';
          const name = document.createElement('b'); name.textContent = I.PARTS[l.kind].label; row.appendChild(name);
          const P = I.PARTS[l.kind];
          if (!P.grass && !P.rays && !P.bolt) {
            const cur = l.wind || P.wind;
            Object.entries(I.PART_WINDS).forEach(([w, lb]) => row.appendChild(chip(lb, cur === w, () => { l.wind = w; saveElements(); draw(); }, 'gen-chip-sm')));
          }
          if (cat === 'effects' && !P.grass && !P.rays) {
            const sel = document.createElement('select'); sel.className = 'dc-input !h-7 !py-0 text-xs w-auto';
            Object.entries(I.PART_REGIONS).forEach(([v, lb]) => { const o = document.createElement('option'); o.value = v; o.textContent = lb; if ((l.region || 'tudo') === v) o.selected = true; sel.appendChild(o); });
            sel.addEventListener('change', () => { l.region = sel.value; saveElements(); prev(); });
            row.appendChild(sel);
          }
          const rg = document.createElement('input'); rg.type = 'range'; rg.min = '0.3'; rg.max = '2.5'; rg.step = '0.1'; rg.value = l.amount || 1; rg.className = 'accent-[#5865F2] w-24'; rg.title = 'Quantidade';
          rg.addEventListener('input', () => { l.amount = +rg.value; saveElements(); prev(); });
          row.appendChild(rg);
          const col = document.createElement('input'); col.type = 'color'; col.value = l.color || '#ffffff'; col.title = 'Cor (deixe branco para usar as cores da mídia)'; col.className = 'el-color';
          col.addEventListener('input', () => { l.color = col.value === '#ffffff' ? '' : col.value; saveElements(); prev(); });
          row.appendChild(col);
          box.appendChild(row);
        });
        const pv = document.createElement('div'); pv.className = 'part-prev mt-2' + (cat === 'decorations' ? ' is-deco' : ''); box.appendChild(pv);
        const prev = () => {
          if (!list.length) { pv.innerHTML = ''; return; }
          const W = cat === 'decorations' ? 288 : 450, H = cat === 'decorations' ? 288 : 880;
          const bg = cat === 'decorations' ? `<rect width="288" height="288" fill="#2b2d31"/><circle cx="144" cy="144" r="118" fill="#5865F2"/>` : `<rect width="450" height="880" fill="#2b2d31"/><rect width="450" height="160" fill="#5865F2" opacity=".35"/><circle cx="82" cy="160" r="60" fill="#5865F2"/>`;
          pv.innerHTML = I.withParticles(`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><style></style>${bg}</svg>`, cat, list, null, 7);
        };
        prev();
      };
      draw();
    });
    const dm = document.getElementById('gen-deco-mode');
    if (dm) {
      const drawM = () => {
        dm.innerHTML = '';
        [['objetos', '✂️ Objetos recortados da mídia'], ['anel', '⭕ Anel recortado (forma)']].forEach(([v, lb]) => dm.appendChild(chip(lb, (ui.elements.decoMode || 'objetos') === v, () => { ui.elements.decoMode = v; saveElements(); drawM(); })));
      };
      drawM();
    }
    const cr = document.getElementById('gen-create');
    if (cr) { cr.checked = ui.elements.create !== false; cr.onchange = () => { ui.elements.create = cr.checked; saveElements(); }; }
    const fm = document.getElementById('gen-frame-mode');
    if (fm) {
      const drawF = () => {
        fm.innerHTML = '';
        [['objetos', '✂️ Borda + objetos recortados'], ['recorte', '🖼 Recorte da cena']].forEach(([v, lb]) => fm.appendChild(chip(lb, (ui.elements.frameMode || 'objetos') === v, () => { ui.elements.frameMode = v; saveElements(); drawF(); })));
      };
      drawF();
    }
    const tb = document.getElementById('gen-transition');
    if (tb) {
      const drawT = () => {
        tb.innerHTML = '';
        [['nenhuma', 'Nenhuma'], ['flash', '💥 Flash de luz'], ['corte', '✂️ Corte seco'], ['dissolver', '🌫 Dissolver']].forEach(([v, lb]) => tb.appendChild(chip(lb, ui.elements.transition === v, () => { ui.elements.transition = v; saveElements(); drawT(); })));
      };
      drawT();
    }
    const ai = document.getElementById('gen-el-ai');
    if (ai) { ai.checked = !!ui.elements.ai; ai.onchange = () => { ui.elements.ai = ai.checked; saveElements(); }; }
  }

  /* ---------- IA identifica os elementos animados da mídia, quadro a quadro ---------- */
  const IDENTIFY_SYSTEM = `Você é um diretor de animação. Recebe QUADROS em sequência de um vídeo/GIF (ou uma imagem) e identifica os ELEMENTOS ANIMADOS que se repetem e podem virar camadas de um efeito de perfil do Discord e de uma moldura de avatar.
Elementos possíveis (use só estes nomes): folhas, petalas, penas, corvos (qualquer pássaro), grama, neve, brilhos, brasas (faíscas, fogo em partículas), raios (eletricidade), luz (raios de luz/feixes), fragmentos (algo se desfazendo em pedaços), fumaca, bolhas.
Compare os quadros: o que se MOVE entre eles? Direção: vento (atravessa de lado), cair, subir. Região onde aparece: topo, baixo, lados, tudo. Quantidade 0.3 a 2.5 (1 = normal). Cor dominante em hex.
Transição da entrada: flash (estouro de luz), corte (troca seca de cena), dissolver, nenhuma.
Responda SÓ JSON: {"efeito":[{"elemento":"corvos","direcao":"vento","regiao":"topo","quantidade":1.2,"cor":"#111111"}],"moldura":[{"elemento":"brasas","direcao":"subir","quantidade":1,"cor":"#ffaa33"}],"transicao":"flash","resumo":"frase curta do que você viu"}
No máximo 3 elementos por formato, só os que realmente aparecem. Para a moldura, escolha 1–2 que fiquem bonitos em volta do avatar.
Também aponte os OBJETOS principais (personagem, bicho, flor, arma, criatura) que ficariam bonitos recortados em volta do avatar: "objetos":[{"nome":"corvo","caixa":[x0,y0,x1,y1]}], caixa em frações 0–1 da imagem (quadro do meio), justa no objeto, no máximo 3, o mais importante primeiro.`;
  async function visionJson(system, blocks, cfg) {
    const model = textModelFor(cfg);
    let out = '';
    if (cfg.provider === 'anthropic') {
      const mod = await loadSdk();
      const client = new mod.default({ apiKey: cfg.key, dangerouslyAllowBrowser: true });
      const content = blocks.map((b) => (b.image ? { type: 'image', source: { type: 'base64', media_type: b.image.mime, data: b.image.data } } : { type: 'text', text: b.text }));
      const res = await client.messages.create({ model, max_tokens: 1500, system, messages: [{ role: 'user', content }] });
      out = (res.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    } else if (PROVIDERS[cfg.provider].native === 'gemini') {
      const parts = blocks.map((b) => (b.image ? { inlineData: { mimeType: b.image.mime, data: b.image.data } } : { text: b.text }));
      const res = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(geminiModelName(model))}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.4 } }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw geminiError(res.status, data, model);
      const cand = data && data.candidates && data.candidates[0];
      out = ((cand && cand.content && cand.content.parts) || []).filter((pt) => !pt.thought).map((pt) => pt.text || '').join('');
    } else {
      const base = (cfg.baseUrl || PROVIDERS[cfg.provider].base || '').replace(/\/+$/, '');
      const headers = { 'Content-Type': 'application/json' };
      if (cfg.key) headers.Authorization = 'Bearer ' + cfg.key;
      const content = blocks.map((b) => (b.image ? { type: 'image_url', image_url: { url: `data:${b.image.mime};base64,${b.image.data}` } } : { type: 'text', text: b.text }));
      const res = await fetch(base + '/chat/completions', { method: 'POST', headers, body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content }], response_format: { type: 'json_object' } }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error && (data.error.message || data.error)) || 'HTTP ' + res.status);
      out = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    }
    return parseJsonLoose(out);
  }
  async function identifyElements(media, cfg) {
    const I = window.CosmeticIllustration;
    const fr = (media.frames || []).slice(0, 8);
    const blocks = [{ text: `${fr.length} quadro(s) em ordem${media.animated ? ' (animado)' : ' (imagem parada: deduza o movimento que combina)'}:` }];
    fr.forEach((c, i) => {
      const s = document.createElement('canvas'); const k = Math.min(1, 384 / Math.max(c.width, c.height));
      s.width = Math.round(c.width * k); s.height = Math.round(c.height * k); s.getContext('2d').drawImage(c, 0, 0, s.width, s.height);
      blocks.push({ text: `Quadro ${i + 1}` }, { image: { mime: 'image/jpeg', data: s.toDataURL('image/jpeg', 0.7).split(',')[1] } });
    });
    const j = await visionJson(IDENTIFY_SYSTEM, blocks, cfg);
    const norm = (arr) => (Array.isArray(arr) ? arr : []).map((e) => {
      const kind = String((e && (e.elemento || e.tipo)) || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace('passaros', 'corvos').replace('fogo', 'brasas').replace('faiscas', 'brasas').replace('fumaça', 'fumaca');
      if (!I.PARTS[kind]) return null;
      return { kind, wind: ['vento', 'cair', 'subir'].includes(e.direcao) ? e.direcao : '', region: ['topo', 'baixo', 'lados', 'tudo'].includes(e.regiao) ? e.regiao : 'tudo', amount: Math.max(0.3, Math.min(2.5, +e.quantidade || 1)), color: /^#[0-9a-f]{6}$/i.test(e.cor || '') ? e.cor : '' };
    }).filter(Boolean).slice(0, 3);
    const boxes = (Array.isArray(j.objetos) ? j.objetos : []).map((o) => o && Array.isArray(o.caixa) && o.caixa.length === 4 ? o.caixa.map(Number) : null)
      .filter((b) => b && b.every((v) => v >= 0 && v <= 1) && b[2] - b[0] > 0.04 && b[3] - b[1] > 0.04)
      .slice(0, 3).map(([x0, y0, x1, y1]) => ({ x0, y0, x1, y1 }));
    return { boxes, effects: norm(j.efeito), decorations: norm(j.moldura).slice(0, 2), transition: ['flash', 'corte', 'dissolver', 'nenhuma'].includes(j.transicao) ? j.transicao : '', summary: String(j.resumo || '').slice(0, 160) };
  }

  /* ---------- Mídia colada (Pinterest, imagem, GIF, vídeo) ---------- */
  async function loadMedia(getter) {
    if (!window.CosmeticMediaRef) return CS.toast('Módulo de mídia não carregou. Atualize a página.', 'danger');
    const st = $('#gen-media-status');
    st.textContent = 'Lendo a mídia…';
    try {
      const m = await getter();
      if (!m.frames.length) throw new Error('Não achei nenhum quadro.');
      ui.media = m;
      renderMedia();
      CS.toast(`Mídia carregada (${m.kind}, ${m.frames.length} quadro(s)). A IA vai usá-la para gerar os formatos marcados.`, 'success');
      if (m.note) CS.toast(m.note, 'info');
    } catch (e) {
      console.warn('[Mídia]', e);
      st.textContent = '';
      CS.toast(e.message || 'Não deu para ler a mídia.', 'danger');
    }
  }
  function renderMedia() {
    const box = $('#gen-media-preview');
    const st = $('#gen-media-status');
    box.innerHTML = '';
    const m = ui.media;
    $('#gen-prompt').required = !m && !refsResolved().length;
    if (!m) { st.textContent = ''; box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    m.frames.forEach((f) => {
      const img = document.createElement('img');
      img.src = f.toDataURL('image/jpeg', 0.7);
      img.alt = '';
      img.className = 'h-16 rounded-md border border-white/10';
      box.appendChild(img);
    });
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'btn btn-sm btn-secondary self-center';
    x.textContent = '✕ Remover';
    x.addEventListener('click', () => { ui.media = null; renderMedia(); });
    box.appendChild(x);
    st.textContent = `${m.kind} · ${m.frames.length} quadro(s)${m.animated ? ' ao longo do tempo' : ''} · ${m.name} `;
    if (m.videoUrl) {
      const a = document.createElement('a');
      a.href = m.videoUrl; a.target = '_blank'; a.rel = 'noopener';
      a.className = 'text-[#00A8FC] hover:underline';
      a.textContent = '(abrir o vídeo para baixar)';
      st.appendChild(a);
    }
  }
  /** A mídia vira uma referência para CADA formato pedido. */
  function mediaGroups(cats) {
    if (!ui.media || !window.CosmeticMediaRef) return {};
    const out = {};
    cats.forEach((cat) => { out[cat] = [{ name: `Mídia do usuário (${ui.media.kind})`, ...window.CosmeticMediaRef.stripOf(ui.media, cat) }]; });
    return out;
  }

  /** Monta as tiras de quadros das referências, agrupadas por formato. */
  async function refStrips(refs, cats, limit = 10) {
    const out = {};
    let n = 0;
    for (const r of refs) {
      if (!cats.includes(r.cat) || n >= limit || !window.CosmeticRefFrames) continue;
      const st = await window.CosmeticRefFrames.stripOf(r.item, r.cat, 4);
      if (!st) continue;
      (out[r.cat] = out[r.cat] || []).push({ name: r.item.name, ...st });
      n++;
    }
    return out;
  }

  /** IA de visão estuda as tiras e devolve, por formato, visual + movimento + pedido novo. */
  async function analyzeRefs(groups, theme, details, cfg) {
    const cats = Object.keys(groups);
    if (!cats.length) return {};
    const model = textModelFor(cfg);
    const blocks = [{ text: `TEMA do usuário: ${theme || '(sem tema: siga as referências)'}${Object.keys(details || {}).length ? '\nDetalhes do usuário por formato: ' + Object.entries(details).map(([c, v]) => `${CAT_TO_API[c]}: ${v}`).join(' | ') : ''}` }];
    cats.forEach((cat) => {
      blocks.push({ text: `\n=== Referências de ${CAT_TO_API[cat]} (${groups[cat].length}) ===` });
      groups[cat].forEach((g, i) => {
        blocks.push({ text: `${CAT_TO_API[cat]} ${i + 1}: "${g.name}" — ${g.frames} quadro(s)${g.animated ? ', ANIMADA' : ', estática'}` });
        blocks.push({ image: g });
      });
    });
    let out = '';
    if (cfg.provider === 'anthropic') {
      const mod = await loadSdk();
      const client = new mod.default({ apiKey: cfg.key, dangerouslyAllowBrowser: true });
      const content = blocks.map((b) => (b.image ? { type: 'image', source: { type: 'base64', media_type: b.image.mime, data: b.image.data } } : { type: 'text', text: b.text }));
      const res = await client.messages.create({ model, max_tokens: 3000, system: ANALYZE_SYSTEM, messages: [{ role: 'user', content }] });
      out = (res.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    } else if (PROVIDERS[cfg.provider].native === 'gemini') {
      const parts = blocks.map((b) => (b.image ? { inlineData: { mimeType: b.image.mime, data: b.image.data } } : { text: b.text }));
      const res = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(geminiModelName(model))}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: ANALYZE_SYSTEM }] }, contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.6 } }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw geminiError(res.status, data, model);
      const cand = data && data.candidates && data.candidates[0];
      out = ((cand && cand.content && cand.content.parts) || []).filter((pt) => !pt.thought).map((pt) => pt.text || '').join('');
    } else {
      const base = (cfg.baseUrl || PROVIDERS[cfg.provider].base || '').replace(/\/+$/, '');
      const headers = { 'Content-Type': 'application/json' };
      if (cfg.key) headers.Authorization = 'Bearer ' + cfg.key;
      const content = blocks.map((b) => (b.image ? { type: 'image_url', image_url: { url: `data:${b.image.mime};base64,${b.image.data}` } } : { type: 'text', text: b.text }));
      const res = await fetch(base + '/chat/completions', { method: 'POST', headers, body: JSON.stringify({ model, messages: [{ role: 'system', content: ANALYZE_SYSTEM }, { role: 'user', content }], response_format: { type: 'json_object' } }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error && (data.error.message || data.error)) || 'HTTP ' + res.status);
      out = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    }
    const j = parseJsonLoose(out);
    const res = {};
    (Array.isArray(j.formatos) ? j.formatos : []).forEach((f) => {
      const cat = API_TO_CAT[f && f.formato] || ({ moldura: 'decorations', efeito: 'effects' })[f && f.formato];
      if (!cat || !groups[cat]) return;
      const clip = (v, n = 300) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);
      res[cat] = {
        visual: clip(f.visual), movimento: clip(f.movimento), pedido: clip(f.pedido),
        preset: MOTIONS.includes(f.preset) ? f.preset : 'rise',
        intensidade: Math.min(3, Math.max(1, Math.round(+f.intensidade || 2))),
        cores: (Array.isArray(f.cores) ? f.cores : []).filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 5),
        fx: fxFromAi(f.efeitos),
      };
    });
    return res;
  }

  /** Monta o texto do pedido com tema, categorias e referências da biblioteca. */
  function userTextFor(req) {
    if (req.feedback) return req.feedback;
    let t = `Tema: ${req.prompt || '(sem tema: crie variações das referências)'}\nCategorias, nesta ordem: ${req.cats.map((c) => CAT_TO_API[c]).join(', ')}`;
    const det = req.cats.filter((c) => req.details && req.details[c]);
    if (det.length) t += '\n\nDETALHES POR FORMATO (siga à risca; valem só para aquele item):\n' + det.map((c) => `- ${CAT_TO_API[c]}: ${req.details[c]}`).join('\n');
    if (req.refs.length) {
      t += '\n\nREFERÊNCIAS da biblioteca. Cada referência vale SÓ para o item do MESMO formato (referências de nameplate guiam a nameplate, de efeito guiam o efeito…); formatos sem referência seguem só o tema. Crie VARIAÇÕES inspiradas nelas: mantenha a essência (paleta, estilo, tipo de movimento, clima), mas traga algo novo e aplique o tema, se houver. As imagens anexas são TIRAS DE QUADROS: os quadros numerados vão da esquerda para a direita no tempo — compare-os e reproduza o tipo de movimento na sua animação.';
      req.refs.forEach((r, i) => {
        const a = r.item.asset || {};
        t += `\n\nReferência ${i + 1} (${CAT_TO_API[r.cat]}): "${r.item.name}"${r.item.collection ? ' — coleção ' + r.item.collection : ''}. ${r.item.description || ''}${(r.item.tags || []).length ? ' Tags: ' + r.item.tags.join(', ') + '.' : ''}`;
        if (a.type === 'svg') t += `\nSVG do loop da referência:\n${a.svg}`;
        else if (a.type === 'gen') t += `\nSpec da referência (partículas): ${JSON.stringify({ palette: a.palette, base: a.base, ring: a.ring, layers: a.layers, intro: a.intro })}`;
        else if (a.type === 'image') t += r.hasImage ? `\n(tira de ${r.frames || 1} quadro(s) anexada${r.animated ? ', ANIMADA: observe o movimento quadro a quadro' : ''})` : '\n(item oficial do Discord; imagem indisponível)';
        else if (a.className) t += `\n(efeito CSS da coleção ${r.item.collection})`;
      });
    }
    const st = (req.styleRefs || []).filter((x) => x.hasImage);
    if (st.length) {
      t += `\n\nEXEMPLOS DE ESTILO OFICIAL (imagens anexas${req.refs.some((r) => r.hasImage) ? ', depois das referências' : ''}): ${st.map((x) => `${CAT_TO_API[x.cat]} "${x.name}"`).join(', ')}. Copie o NÍVEL DE ACABAMENTO, a composição e a paleta enxuta desses itens da loja — não o tema nem o desenho.`;
    }
    return t;
  }
  const schemaFor = (req) => (req.mode === 'svg' ? SVG_OUTPUT_SCHEMA : OUTPUT_SCHEMA);
  const systemFor = (req, withExample) => {
    const base = req.mode === 'svg' ? SVG_SYSTEM_PROMPT + styleGuidePrompt() : SYSTEM_PROMPT;
    if (!withExample) return base;
    return base + '\n\nResponda SOMENTE com um objeto JSON válido, sem markdown, neste formato (o exemplo mostra um item; gere um por categoria pedida, com todos os campos):\n' + (req.mode === 'svg' ? SVG_JSON_EXAMPLE : JSON_EXAMPLE);
  };

  /* ---------- Imagens das referências (para modelos com visão) ---------- */
  /** URL estática que o navegador consegue ler (CORS) — o proxy de mídia do Discord libera. */
  function corsFriendly(url) {
    return url.replace(/^https:\/\/cdn\.discordapp\.com\/media\/v1\/collectibles-shop\//, 'https://media.discordapp.net/media/v1/collectibles-shop/');
  }
  function refImageUrl(item) {
    const a = item.asset || {};
    if (a.type !== 'image') return '';
    return a.staticSrc || a.loop || a.src || a.intro || '';
  }
  async function toBase64(url) {
    const res = await fetch(corsFriendly(url));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve({ mime: blob.type || 'image/png', data: String(fr.result).split(',')[1] });
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

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

  /* Formato de exemplo enviado aos provedores sem JSON Schema estrito */
  const JSON_EXAMPLE = JSON.stringify({ items: [{
    category: 'decoration', name: 'Coroa do Dragão', description: 'Chamas verdes orbitando o avatar.', rarity: 'Lendário', tags: ['dragão', 'fogo'],
    palette: { primary: '#2BE38B', secondary: '#9BFF6B', accent: '#E8FFF4', background: '#04170F' },
    base: { style: 'none', animation: 'none', speed: 'normal' }, ring: { style: 'conic' },
    layers: [{ kind: 'ring', color: '#2BE38B', count: 'some', size: 'medium', speed: 'normal', shape: 'flame', motion: 'fall', glyphs: '' }],
    intro: { style: 'none', duration: 0, layers: [] },
  }, {
    category: 'effect', name: 'Sopro de Jade', description: 'Explosão de brasas verdes que vira uma chuva suave.', rarity: 'Épico', tags: ['fogo'],
    palette: { primary: '#2BE38B', secondary: '#9BFF6B', accent: '#E8FFF4', background: '#04170F' },
    base: { style: 'none', animation: 'none', speed: 'normal' }, ring: { style: 'none' },
    layers: [{ kind: 'ember', color: '#9BFF6B', count: 'some', size: 'medium', speed: 'normal', shape: 'none', motion: 'fall', glyphs: '' }],
    intro: { style: 'burst', duration: 3, layers: [{ kind: 'warp', color: '#E8FFF4', count: 'many', size: 'large', speed: 'fast', shape: 'none', motion: 'fall', glyphs: '' }] },
  }] });

  async function generateWithOpenAICompat(req, cfg) {
    const preset = PROVIDERS[cfg.provider];
    const base = (cfg.baseUrl || preset.base || '').replace(/\/+$/, '');
    if (!/^https?:\/\//.test(base)) throw new Error('Informe a URL base da API (ex.: https://api.exemplo.com/v1).');
    if (!cfg.model) throw new Error('Informe o nome do modelo.');
    const system = systemFor(req, true);
    const user = userTextFor(req);
    const images = req.images.filter((i) => i.url || i.data).map((i) => (i.url ? i : { url: `data:${i.mime || 'image/png'};base64,${i.data}` }));
    const userContent = images.length
      ? [{ type: 'text', text: user }, ...images.map((i) => ({ type: 'image_url', image_url: { url: i.url } }))]
      : user;
    const headers = { 'Content-Type': 'application/json' };
    if (cfg.key) headers.Authorization = 'Bearer ' + cfg.key;
    if (cfg.provider === 'openrouter') {
      headers['HTTP-Referer'] = location.origin;
      headers['X-Title'] = 'Cosmetic Studio';
    }
    const formats = { json_schema: ['json_schema', 'json_object', 'none'], json_object: ['json_object', 'none'] }[preset.format] || ['none'];

    let lastErr;
    for (const fmt of formats) {
      const body = { model: cfg.model, messages: [{ role: 'system', content: system }, { role: 'user', content: userContent }] };
      if (fmt === 'json_schema') body.response_format = { type: 'json_schema', json_schema: { name: 'cosmeticos', strict: true, schema: schemaFor(req) } };
      if (fmt === 'json_object') body.response_format = { type: 'json_object' };
      let res;
      try {
        res = await fetch(base + '/chat/completions', { method: 'POST', headers, body: JSON.stringify(body) });
      } catch (e) {
        throw new Error(`Não foi possível conectar a ${preset.label} (rede ou CORS). ${cfg.provider === 'ollama' ? 'O Ollama está rodando com OLLAMA_ORIGINS=*?' : 'Esse endereço pode não aceitar chamadas direto do navegador.'}`);
      }
      const raw = await res.text();
      let data = null;
      try { data = JSON.parse(raw); } catch (e) { data = null; }
      if (!res.ok) {
        const msg = (data && (data.error?.message || data.message || (typeof data.error === 'string' && data.error))) || raw.slice(0, 160);
        // O provedor não suporta esse modo de JSON? tenta o próximo, mais simples
        if (res.status === 400 && fmt !== 'none' && /response_format|json_schema|json_object|structured|schema/i.test(msg)) {
          lastErr = new Error(msg);
          continue;
        }
        throw httpError(res.status, msg, preset.label);
      }
      const choice = data && data.choices && data.choices[0];
      if (!choice) throw new Error('Resposta vazia do provedor.');
      if (choice.message && choice.message.refusal) throw new Error('A IA recusou esse tema. Tente descrevê-lo de outro jeito.');
      if (choice.finish_reason === 'length') throw new Error('A resposta da IA veio incompleta. Tente gerar menos categorias de uma vez.');
      let content = choice.message && choice.message.content;
      if (Array.isArray(content)) content = content.map((part) => part.text || '').join('');
      return itemsFromText(content, req, { id: cfg.provider, label: preset.label.replace(/\s*\(.*\)$/, '') + (cfg.model ? ' · ' + cfg.model : '') });
    }
    throw lastErr || new Error('O provedor não aceitou o pedido.');
  }

  function httpError(status, msg, label) {
    if (status === 401 || status === 403) return new Error(`Chave inválida ou sem permissão em ${label}.`);
    if (status === 404) return new Error(`Modelo ou endereço não encontrado em ${label}. Confira o nome do modelo.`);
    if (status === 429) return new Error(`Limite de uso atingido em ${label}. Aguarde um pouco e tente de novo.`);
    if (status >= 500) return new Error(`${label} está instável agora. Tente novamente em instantes.`);
    return new Error(`${label} recusou o pedido: ${msg || 'erro ' + status}`);
  }

  /* ------------------------------------------------------------------ */
  /* Motor: Google Gemini (API nativa generateContent)                    */
  /* ------------------------------------------------------------------ */
  const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

  /** Converte o JSON Schema do app para o subconjunto OpenAPI aceito pelo Gemini. */
  function toGeminiSchema(node) {
    if (!node || typeof node !== 'object') return node;
    const out = { type: String(node.type || 'string').toUpperCase() };
    if (node.description) out.description = node.description;
    if (node.enum) out.enum = node.enum;
    if (node.properties) {
      out.properties = {};
      for (const k in node.properties) out.properties[k] = toGeminiSchema(node.properties[k]);
      out.propertyOrdering = Object.keys(node.properties);
    }
    if (node.required) out.required = node.required;
    if (node.items) out.items = toGeminiSchema(node.items);
    return out;
  }

  const geminiModelName = (m) => String(m || '').trim().replace(/^models\//, '');

  function geminiError(status, body, model) {
    const err = body && body.error;
    const msg = (err && err.message) || '';
    const st = (err && err.status) || '';
    if (/API key not valid|API_KEY_INVALID/i.test(msg) || status === 401) return new Error('Chave do Gemini inválida. Gere uma em aistudio.google.com.');
    if (status === 403 || st === 'PERMISSION_DENIED') return new Error('Essa chave não tem acesso à API do Gemini (ative a "Generative Language API" no projeto da chave).');
    if (status === 404 || st === 'NOT_FOUND') return new Error(`Modelo "${model}" não encontrado no Gemini. Escolha outro na lista de modelos.`);
    if (status === 429 || st === 'RESOURCE_EXHAUSTED') return new Error('Limite de uso do Gemini atingido. Aguarde um pouco ou troque de modelo.');
    if (status >= 500) return new Error('O Gemini está instável agora. Tente novamente em instantes.');
    return new Error('O Gemini recusou o pedido: ' + (msg || 'erro ' + status));
  }

  async function generateWithGemini(req, cfg) {
    const model = geminiModelName(cfg.model);
    if (!model) throw new Error('Informe o modelo do Gemini.');
    const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`;
    const user = userTextFor(req);
    const system = systemFor(req, true);
    const parts = [{ text: user }, ...req.images.filter((i) => i.data).map((i) => ({ inlineData: { mimeType: i.mime, data: i.data } }))];

    // 1ª tentativa: JSON com schema; se o modelo recusar o schema, só modo JSON.
    for (const withSchema of [true, false]) {
      const generationConfig = { responseMimeType: 'application/json', temperature: 1, maxOutputTokens: req.mode === 'svg' ? 32768 : 8192 };
      if (withSchema) generationConfig.responseSchema = toGeminiSchema(schemaFor(req));
      let res;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts }],
            generationConfig,
          }),
        });
      } catch (e) {
        throw new Error('Não foi possível conectar ao Gemini. Verifique sua internet.');
      }
      let data = null;
      try { data = await res.json(); } catch (e) { data = null; }
      if (!res.ok) {
        const msg = (data && data.error && data.error.message) || '';
        if (withSchema && res.status === 400 && /schema|response_schema|responseSchema|generation_config|max_output_tokens|maxOutputTokens|Invalid JSON payload/i.test(msg)) continue;
        throw geminiError(res.status, data, model);
      }
      if (data && data.promptFeedback && data.promptFeedback.blockReason) {
        throw new Error('O Gemini bloqueou esse tema. Tente descrevê-lo de outro jeito.');
      }
      const cand = data && data.candidates && data.candidates[0];
      if (!cand) throw new Error('O Gemini não retornou resposta. Tente novamente.');
      if (cand.finishReason === 'MAX_TOKENS') throw new Error('A resposta do Gemini veio incompleta. Tente gerar menos categorias de uma vez.');
      if (/SAFETY|PROHIBITED_CONTENT|BLOCKLIST|SPII|RECITATION/.test(cand.finishReason || '')) {
        throw new Error('O Gemini recusou esse tema. Tente descrevê-lo de outro jeito.');
      }
      const text = ((cand.content && cand.content.parts) || []).filter((pt) => !pt.thought).map((pt) => pt.text || '').join('');
      return itemsFromText(text, req, { id: 'gemini', label: 'Gemini · ' + model });
    }
    throw new Error('O Gemini não aceitou o pedido.');
  }

  /** Lista os modelos Gemini da chave que suportam generateContent (mais novos primeiro). */
  const geminiModelsCache = new Map();
  async function listGeminiModels(key) {
    if (geminiModelsCache.has(key)) return geminiModelsCache.get(key);
    const res = await fetch(`${GEMINI_BASE}/models?pageSize=1000`, { headers: { 'x-goog-api-key': key } });
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) throw geminiError(res.status, data, '');
    const ver = (n) => (n.match(/(\d+(?:\.\d+)?)/) || [0, '0'])[1] * 1;
    const models = ((data && data.models) || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent') && /gemini/i.test(m.name) && !/embedding|aqa|tts|vision-only|live|audio/i.test(m.name))
      .map((m) => ({ id: geminiModelName(m.name), label: m.displayName || geminiModelName(m.name) }))
      .sort((a, b) => ver(b.id) - ver(a.id) || a.id.localeCompare(b.id));
    geminiModelsCache.set(key, models);
    return models;
  }
  /** Sugere um modelo: o "flash" estável mais novo; senão o primeiro da lista. */
  function pickGeminiModel(models) {
    const stable = models.filter((m) => !/preview|exp|lite|thinking|image/i.test(m.id));
    return (stable.find((m) => /flash/i.test(m.id)) || stable[0] || models[0] || {}).id;
  }

  /** Modelo de imagem: o "flash-image" estável mais novo; senão qualquer "…-image". */
  function pickGeminiImageModel(models) {
    const img = models.filter((m) => /image/i.test(m.id));
    const stable = img.filter((m) => !/preview|exp|lite/i.test(m.id));
    return (stable.find((m) => /flash-image$/i.test(m.id)) || stable[0] || img[0] || {}).id;
  }

  async function generateWithClaude(req, apiKey, model) {
    const mod = await loadSdk();
    const Anthropic = mod.default;
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    const content = [
      ...req.images.filter((i) => i.url || i.data).map((i) => (i.url
        ? { type: 'image', source: { type: 'url', url: i.url } }
        : { type: 'image', source: { type: 'base64', media_type: i.mime || 'image/png', data: i.data } })),
      { type: 'text', text: userTextFor(req) },
    ];
    let response;
    try {
      // Streaming: a arte SVG gera respostas longas
      response = await client.beta.messages.stream({
        model: model || PROVIDERS.anthropic.model,
        max_tokens: req.mode === 'svg' ? 64000 : 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: req.mode === 'svg' ? 'high' : 'medium', format: { type: 'json_schema', schema: schemaFor(req) } },
        system: systemFor(req, false),
        messages: [{ role: 'user', content }],
      }).finalMessage();
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
    return itemsFromText(text, req, { id: 'anthropic', label: 'Claude' });
  }

  /** Extrai o JSON da resposta (aceita blocos ```json e texto em volta). */
  function parseJsonLoose(text) {
    const t = String(text || '').replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
    try { return JSON.parse(t); } catch (e) { /* tenta recortar */ }
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) {
      try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { /* cai no erro abaixo */ }
    }
    throw new Error('A IA respondeu em um formato inesperado. Tente novamente ou use outro modelo.');
  }

  function itemsFromText(text, req, provider) {
    const { prompt, cats } = req;
    const data = parseJsonLoose(text);
    const items = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : [];
    const out = [];
    for (const [i, raw] of items.entries()) {
      if (!raw || typeof raw !== 'object') continue;
      const cat = API_TO_CAT[raw.category] || (!raw.category ? cats[i] : null);
      if (!cat || !cats.includes(cat)) continue;
      out.push({
        cat,
        raw: {
          name: raw.name,
          description: raw.description,
          rarity: raw.rarity,
          tags: raw.tags,
          prompt,
          engine: provider.id,
          engineLabel: provider.label,
          asset: raw.svg
            ? { type: 'svg', svg: raw.svg, loopSeconds: raw.loopSeconds, introSvg: cat === 'effects' ? raw.introSvg : '', introSeconds: raw.introSeconds, discordPalette: cat === 'nameplates' ? raw.discordPalette : undefined, ...(cat === 'frames' && /viewBox=["']\s*0\s+0\s+1312\s+2528/.test(raw.svg) ? { wrap: FRAME_WRAP } : {}) }
            : { palette: raw.palette, base: raw.base, ring: raw.ring, layers: raw.layers, intro: raw.intro },
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
    frames: ['Moldura', 'Arco', 'Portal', 'Brasão'],
  };

  /**
   * Frame procedural (motor local): SVG 1312×716 com faixa ornamental no topo,
   * laterais que descem e somem, motivos do tema e brilhos animados.
   */
  function localFrameSvg(palette, theme) {
    // Em volta do card (1312×2528; card em 56,304–1256,2316): coroa no topo, peça na base, laterais
    const g = Array.from(theme.glyphs || '✦');
    const glyphs = Array.from({ length: 7 }, (_, i) => {
      const x = 130 + i * 175;
      const y = 150 + (i % 2) * 40;
      return `<text class="tw" x="${x}" y="${y}" font-size="72" text-anchor="middle" style="animation-delay:-${(i * 0.3).toFixed(1)}s">${g[i % g.length]}</text>`;
    }).join('');
    const sparks = Array.from({ length: 14 }, (_, i) => {
      const x = i % 2 ? 22 + rnd(0, 18) : 1272 + rnd(0, 18);
      const y = 420 + i * 130;
      return `<circle class="tw" cx="${x.toFixed(0)}" cy="${y}" r="${(rnd(5, 10)).toFixed(1)}" fill="${palette.accent}" style="animation-delay:-${rnd(0, 2).toFixed(2)}s"/>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1312 2528">
<defs>
<linearGradient id="fb" x1="0" x2="1"><stop offset="0" stop-color="${palette.primary}"/><stop offset=".5" stop-color="${palette.secondary}"/><stop offset="1" stop-color="${palette.primary}"/></linearGradient>
<linearGradient id="fs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${palette.primary}"/><stop offset=".5" stop-color="${palette.secondary}"/><stop offset="1" stop-color="${palette.primary}"/></linearGradient>
<filter id="gl" x="-10%" y="-10%" width="120%" height="140%"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<style>
.tw{transform-box:fill-box;transform-origin:center;animation:tw 2s ease-in-out infinite}
@keyframes tw{50%{transform:scale(.7);opacity:.45}}
.edge{stroke-dasharray:60 40;animation:run 2s linear infinite}
@keyframes run{to{stroke-dashoffset:-100}}
</style>
<path d="M90 240Q300 60 656 90Q1012 60 1222 240Q1300 300 1290 380L1240 400Q1150 330 1000 330Q820 360 656 350Q492 360 312 330Q162 330 72 400L22 380Q12 300 90 240Z" fill="url(#fb)" filter="url(#gl)"/>
<rect x="8" y="330" width="62" height="1990" rx="28" fill="url(#fs)" opacity=".95"/>
<rect x="1242" y="330" width="62" height="1990" rx="28" fill="url(#fs)" opacity=".95"/>
<path d="M60 2290Q360 2440 656 2420Q952 2440 1252 2290L1290 2340Q1000 2520 656 2500Q312 2520 22 2340Z" fill="url(#fb)" filter="url(#gl)"/>
<rect class="edge" x="40" y="290" width="1232" height="2060" rx="60" fill="none" stroke="${palette.accent}" stroke-width="6" opacity=".9"/>
<g fill="${palette.accent}" filter="url(#gl)">${glyphs}</g>
${sparks}
</svg>`;
  }

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
      let intro = { style: 'none', duration: 0, layers: [] };
      let npPalette;
      if (cat === 'nameplates') {
        base = { ...base, style: main.np, animation: main.anim };
        npPalette = nearestDiscordPalette(palette.primary);
        base = { ...base, style: 'none' }; // o fundo vem da paleta do Discord
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
        // Fase de ENTRADA (toca 1×): mais intensa que o loop, até 6 s
        const introStyle = { fire: 'burst', ice: 'zoom', sakura: 'sweep', space: 'burst', neon: 'curtain', storm: 'flash', ocean: 'rise', forest: 'rise', spooky: 'zoom', love: 'burst', gold: 'sweep', candy: 'curtain', music: 'sweep', pixel: 'flash' }[main.id] || choice(['burst', 'sweep', 'rise', 'zoom']);
        const introLayers = [makeLayer(main.fx[0], palette, main)];
        introLayers[0].count = 'many';
        introLayers[0].speed = 'fast';
        if (introStyle === 'burst' || main.id === 'space') introLayers.push({ kind: 'warp', count: 'many', color: palette.accent, size: 'large', speed: 'fast', shape: 'none', motion: 'fall', glyphs: '' });
        intro = { style: introStyle, duration: Math.round(rnd(2.2, 4.2) * 10) / 10, layers: introLayers };
      }
      const noun = choice(NOUNS[cat]);
      if (cat === 'frames') {
        return {
          cat,
          raw: {
            name: `${noun} ${main.id === 'proc' ? 'de ' + subject : main.word}`.slice(0, 40),
            description: `Frame procedural a partir de “${prompt.slice(0, 70)}”.`,
            rarity,
            tags: [...new Set([...themes.map((t) => t.id), 'frame', 'local'])].slice(0, 5),
            prompt,
            engine: 'local',
            asset: { type: 'svg', svg: localFrameSvg(palette, main), loopSeconds: 2, wrap: FRAME_WRAP },
          },
        };
      }
      return {
        cat,
        raw: {
          name: `${noun} ${main.id === 'proc' ? 'de ' + subject : main.word}`.slice(0, 40),
          description: `Criação procedural a partir de “${prompt.slice(0, 70)}”.`,
          rarity,
          tags: [...new Set([...themes.map((t) => t.id), 'gerado', 'local'])].slice(0, 5),
          prompt,
          engine: 'local',
          asset: { palette, base, ring, layers, intro, ...(npPalette ? { discordPalette: npPalette } : {}) },
        },
      };
    });
  }

  /** Paleta do Discord mais próxima de uma cor (por matiz e luminosidade). */
  function nearestDiscordPalette(hex) {
    const toRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [r, g, b] = toRgb(hex);
    let best = null, bestD = Infinity;
    for (const [name, p] of Object.entries(CS.DATA.discordPalettes || {})) {
      const [r2, g2, b2] = toRgb(p.light);
      const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
      if (d < bestD) { bestD = d; best = name; }
    }
    return best;
  }

  /** Variação rápida de um item: gira a paleta e embaralha velocidades/quantidades. */
  /** Variação local de arte SVG: gira o matiz (a IA pode criar variações reais via Referência). */
  function hueSvg(svg, deg) {
    return svg ? svg.replace(/<svg\b([^>]*)>/, (m, attrs) => `<svg${attrs.replace(/\sstyle="[^"]*"/, '')} style="filter:hue-rotate(${Math.round(deg)}deg)">`) : svg;
  }
  function varyItem(item) {
    if (item.asset && item.asset.type === 'svg') {
      const deg = choice([-1, 1]) * rnd(30, 150);
      const a = item.asset;
      return {
        name: item.name.replace(/( · v\d+)?$/, '') + ' · v' + Math.floor(rnd(2, 99)),
        description: item.description, rarity: item.rarity, tags: item.tags, prompt: item.prompt, engine: item.engine, engineLabel: item.engineLabel,
        asset: { type: 'svg', svg: hueSvg(a.svg, deg), loopSeconds: a.loopSeconds, introSvg: hueSvg(a.introSvg, deg), introSeconds: a.introSeconds },
      };
    }
    const a = JSON.parse(JSON.stringify(item.asset));
    const deg = choice([-1, 1]) * rnd(25, 70);
    for (const k of ['primary', 'secondary', 'accent']) a.palette[k] = shiftHex(a.palette[k], deg);
    a.base.speed = choice(Object.keys(GEN.speeds));
    (a.intro && a.intro.layers || []).forEach((l) => { l.color = shiftHex(l.color, deg); });
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
  const MODE_STORAGE = 'cosmetic-studio:gen-mode';
  const REVIEW_KEY = 'cosmetic-studio:gen-review';
  const STYLE_KEY = 'cosmetic-studio:gen-style-refs';
  const REWRITE_KEY = 'cosmetic-studio:gen-rewrite';
  const ui = { engine: store.get(ENGINE_STORAGE) === 'local' ? 'local' : 'ai', mode: ['svg', 'particles', 'raster'].includes(store.get(MODE_STORAGE)) ? store.get(MODE_STORAGE) : 'raster', busy: false, results: [], refs: [],
    review: (() => { try { return localStorage.getItem(REVIEW_KEY) !== '0'; } catch (e) { return true; } })(), quality: new Map(),
    styleRefs: (() => { try { return localStorage.getItem(STYLE_KEY) !== '0'; } catch (e) { return true; } })(),
    autoRewrite: (() => { try { return localStorage.getItem(REWRITE_KEY) !== '0'; } catch (e) { return true; } })() };

  /* ---------- Verificação automática + correção pela IA ---------- */
  const MAX_ROUNDS = 2;

  /** Cobertura (alfa médio 0–1) de cada zona em cada quadro. */
  function coverage(frame, cat) {
    const Z = ZONES[cat];
    const sx = frame.w / Z.w, sy = frame.h / Z.h;
    return Z.zones.map((z) => {
      let sum = 0, n = 0;
      const step = Math.max(1, Math.round(Math.min(frame.w, frame.h) / 120));
      const x0 = Math.floor((z.shape === 'circle' ? z.cx - z.r : z.x) * sx), x1 = Math.ceil((z.shape === 'circle' ? z.cx + z.r : z.x + z.w) * sx);
      const y0 = Math.floor((z.shape === 'circle' ? z.cy - z.r : z.y) * sy), y1 = Math.ceil((z.shape === 'circle' ? z.cy + z.r : z.y + z.h) * sy);
      for (let y = Math.max(0, y0); y < Math.min(frame.h, y1); y += step) {
        for (let x = Math.max(0, x0); x < Math.min(frame.w, x1); x += step) {
          if (z.shape === 'circle' && ((x / sx - z.cx) ** 2 + (y / sy - z.cy) ** 2) > z.r * z.r) continue;
          sum += frame.data[(y * frame.w + x) * 4 + 3] / 255;
          n++;
        }
      }
      return n ? sum / n : 0;
    });
  }

  /** Imagem PNG (base64) do quadro com as zonas proibidas marcadas em vermelho. */
  function overlayPng(frame, cat, failing) {
    const Z = ZONES[cat];
    const c = document.createElement('canvas');
    c.width = frame.w;
    c.height = frame.h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2B2D31';
    ctx.fillRect(0, 0, c.width, c.height);
    const tmp = document.createElement('canvas');
    tmp.width = frame.w;
    tmp.height = frame.h;
    tmp.getContext('2d').putImageData(new ImageData(frame.data, frame.w, frame.h), 0, 0);
    ctx.drawImage(tmp, 0, 0);
    const sx = frame.w / Z.w, sy = frame.h / Z.h;
    Z.zones.forEach((z, i) => {
      const bad = failing.includes(z.id);
      ctx.strokeStyle = bad ? '#FF3B3B' : '#57F287';
      ctx.fillStyle = bad ? 'rgba(255,59,59,.22)' : 'rgba(87,242,135,.10)';
      ctx.lineWidth = Math.max(2, frame.w / 150);
      ctx.beginPath();
      if (z.shape === 'circle') ctx.ellipse(z.cx * sx, z.cy * sy, z.r * sx, z.r * sy, 0, 0, Math.PI * 2);
      else ctx.rect(z.x * sx, z.y * sy, z.w * sx, z.h * sy);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = `bold ${Math.max(11, Math.round(frame.w / 28))}px sans-serif`;
      ctx.fillText((bad ? 'PROIBIDO: ' : 'livre: ') + z.label, (z.shape === 'circle' ? (z.cx - z.r) : z.x) * sx + 4, (z.shape === 'circle' ? z.cy - z.r : z.y) * sy + Math.max(12, frame.w / 26));
    });
    return c.toDataURL('image/png').split(',')[1];
  }

  /* Ocupação mínima do canvas (média dos quadros); os oficiais ficam em 11–15%. */
  const MIN_FILL = { effects: 0.03, decorations: 0.06, nameplates: 0.05, frames: 0.05 };

  /** Mede as zonas protegidas de uma arte SVG (loop + entrada). */
  async function checkArt(cat, raw) {
    const a = raw.asset || {};
    const Z = ZONES[cat];
    if (!Z || !a.svg) return null;
    const clean = CS.sanitizeSvg(a.svg, cat);
    if (!clean) return { ok: false, invalid: true, issues: [], summary: 'SVG inválido' };
    const half = cat === 'frames' || cat === 'effects' ? { w: Math.round(Z.w / 2), h: Math.round(Z.h / 2) } : { w: Z.w, h: Z.h };
    const jobs = [[clean, Math.min(8, Math.max(1, +a.loopSeconds || 4)), 6]];
    if (cat === 'effects' && a.introSvg) {
      const ci = CS.sanitizeSvg(a.introSvg, cat);
      if (ci) jobs.push([ci, Math.min(6, Math.max(0.5, +a.introSeconds || 3)), 8]);
    }
    const stats = Z.zones.map(() => ({ sum: 0, n: 0, peak: 0 }));
    let worst = null, worstScore = -1, total = 0, totalN = 0;
    for (const [svg, secs, count] of jobs) {
      const frames = await window.CosmeticExport.sampleSvg(svg, cat, secs, count, half);
      frames.forEach((f) => {
        const step = Math.max(1, Math.round(Math.min(f.w, f.h) / 90));
        let a = 0, n = 0;
        for (let y = 0; y < f.h; y += step) for (let x = 0; x < f.w; x += step) { a += f.data[(y * f.w + x) * 4 + 3] / 255; n++; }
        total += n ? a / n : 0; totalN++;
        const cov = coverage(f, cat);
        let score = 0;
        cov.forEach((v, i) => {
          stats[i].sum += v; stats[i].n++; stats[i].peak = Math.max(stats[i].peak, v);
          score += v / Z.zones[i].avg;
        });
        if (score > worstScore) { worstScore = score; worst = f; }
      });
    }
    const issues = Z.zones.map((z, i) => {
      const avg = stats[i].n ? stats[i].sum / stats[i].n : 0;
      return { id: z.id, label: z.label, avg, peak: stats[i].peak, zone: z, bad: avg > z.avg || stats[i].peak > z.peak };
    });
    // Arte quase vazia também reprova (os oficiais ocupam 11–15% do canvas)
    const fill = totalN ? total / totalN : 0;
    const minFill = MIN_FILL[cat] || 0;
    if (fill < minFill) issues.push({ id: 'empty', label: 'arte quase vazia', avg: fill, peak: fill, empty: true, min: minFill, bad: true });
    const failing = issues.filter((i) => i.bad);
    return {
      ok: !failing.length,
      issues,
      summary: failing.length
        ? '⚠ ' + failing.map((i) => (i.empty ? `arte quase vazia (${Math.round(i.avg * 100)}% do canvas)` : `cobre ${i.label} ${Math.round(i.avg * 100)}%`)).join(', ')
        : '✓ ' + issues.map((i) => i.label.split(' (')[0]).join(', ') + ' livres',
      overlay: failing.some((i) => !i.empty) && worst ? overlayPng(worst, cat, failing.map((i) => i.id)) : null,
    };
  }

  /** Revisa as artes; as que invadem zonas voltam para a IA com números e imagem marcada. */
  async function reviewLoop(list, req, call) {
    let current = list;
    for (let round = 1; round <= MAX_ROUNDS + 1; round++) {
      setBusy(true, `Verificando se a arte deixa avatar e nome livres${round > 1 ? ` (rodada ${round})` : ''}…`);
      const checks = [];
      for (const it of current) checks.push(await checkArt(it.cat, it.raw).catch((e) => (console.warn('[revisão]', e), null)));
      current.forEach((it, i) => { if (checks[i]) it.quality = checks[i]; });
      const failing = current.map((it, i) => ({ it, chk: checks[i] })).filter((x) => x.chk && !x.chk.ok);
      if (!failing.length || round > MAX_ROUNDS) break;

      setBusy(true, `${failing.length === 1 ? 'Uma arte foi reprovada' : failing.length + ' artes foram reprovadas'} na verificação (zonas ou arte vazia): pedindo correção à IA (${round}/${MAX_ROUNDS})…`);
      const lines = failing.map(({ it, chk }) => {
        const bad = chk.issues.filter((i) => i.bad).map((i) => (i.empty
          ? `a arte está QUASE VAZIA: ocupa só ${Math.round(i.avg * 100)}% do canvas (mínimo ${Math.round(i.min * 100)}%; os itens oficiais ocupam 11–15%). Desenhe a ilustração completa e rica do tema, com formas grandes e bem acabadas nas áreas permitidas`
          : `${i.label} (${zoneText(i.zone)}): ${Math.round(i.avg * 100)}% coberto em média e ${Math.round(i.peak * 100)}% no pior quadro — limite ${Math.round(i.zone.avg * 100)}%`)).join('; ');
        return `• ${CAT_TO_API[it.cat]} "${it.raw.name}": ${bad}.\nSVG atual (loop):\n${it.raw.asset.svg}${it.raw.asset.introSvg ? `\nSVG atual (entrada):\n${it.raw.asset.introSvg}` : ''}`;
      });
      const feedback = `CORREÇÃO. Estas artes foram reprovadas na verificação automática (invadiram as zonas protegidas do perfil ou ficaram quase vazias). Quando houver imagem anexa, ela mostra o pior quadro com as zonas proibidas marcadas em VERMELHO. Refaça cada uma mantendo o tema, o estilo, a paleta e a qualidade, mas tirando todas as formas opacas dessas zonas (mova os elementos grandes para as bordas/topo ou encolha-os). Devolva o mesmo formato JSON, um item por categoria abaixo, na mesma ordem.

Tema original: ${req.prompt || '(variações das referências)'}

${lines.join('\n\n')}`;
      const fixReq = {
        ...req,
        cats: failing.map((x) => x.it.cat),
        refs: [],
        feedback,
        images: failing.filter((x) => x.chk.overlay).map((x) => ({ mime: 'image/png', data: x.chk.overlay })),
      };
      let fixed;
      try {
        fixed = await call(fixReq);
      } catch (e) {
        if (!fixReq.images.length) { console.warn('[revisão] correção falhou:', e.message); break; }
        try { fixed = await call({ ...fixReq, images: [] }); } catch (e2) { console.warn('[revisão] correção falhou:', e2.message); break; }
      }
      // Troca cada arte reprovada pela versão corrigida da mesma categoria
      const next = current.slice();
      failing.forEach(({ it }) => {
        const k = fixed.findIndex((f) => f.cat === it.cat);
        if (k < 0) return;
        const repl = fixed.splice(k, 1)[0];
        repl.raw.name = repl.raw.name || it.raw.name;
        next[current.indexOf(it)] = repl;
      });
      current = next;
    }
    return current;
  }

  /* ---------- Referências da biblioteca ---------- */
  const MAX_REFS = 12;
  function refsResolved() {
    return ui.refs.map((r) => ({ cat: r.cat, item: CS.findItem(r.cat, r.id) })).filter((r) => r.item);
  }
  function addRef(cat, id) {
    if (ui.refs.some((r) => r.cat === cat && r.id === id)) return CS.toast('Essa referência já foi escolhida.', 'info');
    if (ui.refs.length >= MAX_REFS) return CS.toast(`Use no máximo ${MAX_REFS} referências.`, 'danger');
    ui.refs.push({ cat, id });
    if (!$$('#gen-cats input:checked').some((i) => i.value === cat)) {
      const box = $(`#gen-cats input[value="${cat}"]`);
      if (box) box.checked = true;
    }
    renderRefs();
    const it = CS.findItem(cat, id);
    CS.toast(`“${it ? it.name : 'Item'}” adicionado como referência.`, 'success');
  }
  function renderRefs() {
    const box = $('#gen-refs');
    box.innerHTML = '';
    const list = refsResolved();
    $('#gen-refs-empty').classList.toggle('hidden', list.length > 0);
    list.forEach(({ cat, item }) => {
      const chip = document.createElement('span');
      chip.className = 'ref-chip';
      const thumb = refThumb(cat, item, 28);
      const name = document.createElement('span');
      name.className = 'truncate max-w-[160px]';
      name.textContent = item.name;
      const kind = document.createElement('span');
      kind.className = 'text-[10px] text-dc-faint';
      kind.textContent = CATS[cat].singular;
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'ref-x';
      x.setAttribute('aria-label', 'Remover referência ' + item.name);
      x.textContent = '✕';
      x.addEventListener('click', () => {
        ui.refs = ui.refs.filter((r) => !(r.cat === cat && r.id === item.id));
        renderRefs();
      });
      chip.append(thumb, name, kind, x);
      box.appendChild(chip);
    });
    $('#gen-prompt').placeholder = list.length
      ? 'Opcional: descreva o que mudar (ex.: versão sombria, com nuvens escuras)'
      : 'Ex.: dragão de jade cuspindo fogo verde em um templo nas nuvens';
    $('#gen-prompt').required = !list.length && !ui.media;
  }
  /** Miniatura de um item para chips e para o seletor. */
  function refThumb(cat, item, size) {
    const wrap = document.createElement('span');
    wrap.className = 'ref-thumb';
    wrap.style.width = wrap.style.height = size + 'px';
    const a = item.asset || {};
    if (a.type === 'image') {
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = '';
      img.src = a.staticSrc || a.loop || a.src || a.intro;
      wrap.appendChild(img);
    } else {
      const inner = document.createElement('span');
      inner.className = 'ref-thumb-inner';
      inner.appendChild(CS.buildAsset(item, cat, { paused: true, phase: 'loop' }));
      wrap.appendChild(inner);
    }
    return wrap;
  }

  let picker;
  function openPicker() {
    if (!picker) {
      document.body.insertAdjacentHTML('beforeend', `
        <dialog id="ref-picker" class="json-modal w-[min(94vw,720px)] rounded-xl bg-dc-side text-dc-text p-0 border border-white/10 shadow-2xl">
          <div class="flex items-center justify-between px-4 py-3 border-b border-black/30">
            <h3 class="font-bold">Escolher referências da biblioteca</h3>
            <button type="button" class="btn btn-ghost btn-sm" data-close aria-label="Fechar">✕</button>
          </div>
          <div class="p-4 space-y-3">
            <div class="flex flex-wrap gap-2 items-center">
              <input id="ref-search" type="search" class="dc-input text-sm flex-1 min-w-[200px]" placeholder="Buscar por nome, coleção ou tag…" />
              <div class="seg" id="ref-cat">
                <button type="button" data-cat="effects" class="is-active">Efeitos</button>
                <button type="button" data-cat="decorations">Molduras</button>
                <button type="button" data-cat="nameplates">Nameplates</button>
                <button type="button" data-cat="frames">Frames</button>
              </div>
            </div>
            <p class="text-[11px] text-dc-faint">Escolha até ${MAX_REFS}. Cada referência vale para o item do mesmo formato. As animadas são lidas quadro a quadro (tira de quadros) para a IA enxergar o movimento (Claude, Gemini e OpenAI enxergam imagens).</p>
            <div id="ref-list" class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[52vh] overflow-y-auto pr-1"></div>
          </div>
          <div class="flex justify-end gap-2 px-4 py-3 border-t border-black/30">
            <button type="button" class="btn btn-primary btn-sm" data-close>Concluir</button>
          </div>
        </dialog>`);
      picker = $('#ref-picker');
      picker._cat = 'effects';
      picker.addEventListener('click', (e) => {
        if (e.target === picker || e.target.closest('[data-close]')) picker.close();
        const c = e.target.closest('#ref-cat [data-cat]');
        if (c) {
          picker._cat = c.dataset.cat;
          $$('#ref-cat button').forEach((b) => b.classList.toggle('is-active', b === c));
          renderPicker();
        }
        const row = e.target.closest('[data-ref-id]');
        if (row) {
          const exists = ui.refs.some((r) => r.cat === row.dataset.refCat && r.id === row.dataset.refId);
          if (exists) {
            ui.refs = ui.refs.filter((r) => !(r.cat === row.dataset.refCat && r.id === row.dataset.refId));
            renderRefs();
          } else addRef(row.dataset.refCat, row.dataset.refId);
          renderPicker();
        }
      });
      let t;
      $('#ref-search').addEventListener('input', () => { clearTimeout(t); t = setTimeout(renderPicker, 150); });
    }
    renderPicker();
    picker.showModal();
  }
  function renderPicker() {
    const cat = picker._cat;
    const q = $('#ref-search').value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const items = CS.DATA[cat].filter((it) => {
      if (!q) return true;
      const hay = [it.name, it.collection, it.description, ...(it.tags || [])].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      return q.split(/\s+/).every((w) => hay.includes(w));
    });
    const list = $('#ref-list');
    list.innerHTML = '';
    items.slice(0, 80).forEach((it) => {
      const on = ui.refs.some((r) => r.cat === cat && r.id === it.id);
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'ref-row hover-host' + (on ? ' is-on' : '');
      row.dataset.refId = it.id;
      row.dataset.refCat = cat;
      const meta = document.createElement('span');
      meta.className = 'min-w-0 text-left';
      meta.innerHTML = '<span class="block text-sm font-semibold truncate"></span><span class="block text-[11px] text-dc-faint truncate"></span>';
      meta.firstChild.textContent = it.name;
      meta.lastChild.textContent = [it.collection, it.source === 'shop' ? 'loja' : it._custom ? 'criação' : ''].filter(Boolean).join(' · ');
      const mark = document.createElement('span');
      mark.className = 'ml-auto text-lg';
      mark.textContent = on ? '✓' : '+';
      row.append(refThumb(cat, it, 48), meta, mark);
      list.appendChild(row);
    });
    if (!items.length) list.innerHTML = '<p class="text-sm text-dc-faint p-4">Nada encontrado.</p>';
    else if (items.length > 80) list.insertAdjacentHTML('beforeend', `<p class="text-[11px] text-dc-faint p-2 col-span-full">Mostrando 80 de ${items.length}. Refine a busca.</p>`);
    CS.syncUserBits(list);
  }

  /** Motor local com referências: varia as specs e usa nome/tags das demais como tema. */
  function generateLocalFromRefs(prompt, cats, refs) {
    const out = [];
    for (const cat of cats) {
      const same = refs.find((r) => r.cat === cat && (r.item.asset.type === 'gen' || r.item.asset.type === 'svg'));
      if (same) {
        out.push({ cat, raw: { ...varyItem(same.item), engine: 'local', prompt: prompt || same.item.name } });
        continue;
      }
      const theme = [prompt, ...refs.map((r) => [r.item.name, r.item.collection, ...(r.item.tags || [])].join(' '))].filter(Boolean).join(' ');
      out.push(...generateLocal(theme, [cat]));
    }
    return out;
  }

  /* Configuração por provedor: { provider, models: {}, baseUrls: {}, keys: {} } */
  function loadAiSettings() {
    let cfg = {};
    try { cfg = JSON.parse(store.get(AI_STORAGE) || '{}') || {}; } catch (e) { cfg = {}; }
    return {
      provider: PROVIDERS[cfg.provider] ? cfg.provider : 'gemini',
      models: cfg.models || {},
      imageModels: cfg.imageModels || {},
      baseUrls: cfg.baseUrls || {},
      keys: cfg.keys || {},
      remember: !!cfg.remember,
    };
  }
  const ai = loadAiSettings();
  function persistAiSettings() {
    store.set(AI_STORAGE, JSON.stringify({
      provider: ai.provider, models: ai.models, imageModels: ai.imageModels, baseUrls: ai.baseUrls, remember: ai.remember,
      keys: ai.remember ? ai.keys : {},
    }));
  }

  /** Modelo de texto/visão sugerido do provedor. */
  function defaultModel(provider) {
    return PROVIDERS[provider].model;
  }
  const isImageModel = (m) => /(^|[-/._])image|gpt-image|dall-e|imagen|^wan\d|flux|stable-diffusion|sdxl|seedream|recraft/i.test(String(m || ''));
  /** Modelo de imagem sugerido (Alibaba: qwen-image). */
  function defaultImageModel(provider) {
    const p = PROVIDERS[provider];
    if (p.imageModel) return p.imageModel;
    const base = ai.baseUrls[provider] ?? p.base ?? '';
    if (/aliyuncs|dashscope/i.test(base)) return 'qwen-image-3.0';
    return '';
  }
  function imageModelValue() {
    const v = ($('#gen-image-model') && $('#gen-image-model').value.trim()) || '';
    const txt = $('#gen-model').value.trim();
    return v || (isImageModel(txt) ? txt : '') || defaultImageModel(ai.provider);
  }

  function renderProvider() {
    const p = PROVIDERS[ai.provider];
    $('#gen-provider').value = ai.provider;
    $('#gen-model').value = ai.models[ai.provider] ?? defaultModel(ai.provider);
    $('#gen-model').placeholder = defaultModel(ai.provider) || 'nome-do-modelo';
    $('#gen-image-model').value = ai.imageModels[ai.provider] ?? defaultImageModel(ai.provider);
    $('#gen-image-model').placeholder = defaultImageModel(ai.provider) || 'sem modelo de imagem';
    $('#gen-baseurl').value = ai.baseUrls[ai.provider] ?? p.base ?? '';
    $('#gen-baseurl-box').classList.toggle('hidden', !p.editableBase);
    $('#gen-key').value = ai.keys[ai.provider] || '';
    $('#gen-key').placeholder = p.keyPh || '';
    $('#gen-key-label').textContent = `Chave da API — ${p.label}${p.keyOptional ? ' (opcional)' : ''}`;
    $('#gen-key-remember').checked = ai.remember;
    $('#gen-provider-hint').textContent = p.hint || '';
    refreshModelList();
  }

  /** Preenche a lista de modelos (hoje: Gemini) a partir da chave informada. */
  let modelListSeq = 0;
  function fillList(dl, ids) {
    dl.innerHTML = '';
    ids.forEach((m) => { const o = document.createElement('option'); o.value = m.id || m; if (m.label) o.label = m.label; dl.appendChild(o); });
  }
  async function refreshModelList() {
    const dl = $('#gen-models');
    const il = $('#gen-image-models');
    dl.innerHTML = '';
    il.innerHTML = '';
    const p = PROVIDERS[ai.provider];
    const key = $('#gen-key').value.trim();
    const info = $('#gen-models-info');
    info.textContent = '';
    if (p.native !== 'gemini' && ai.provider !== 'anthropic') {
      const base = ($('#gen-baseurl').value.trim() || p.base || '').replace(/\/+$/, '');
      if (!/^https?:\/\//.test(base) || (!key && !p.keyOptional)) return;
      const seq = ++modelListSeq;
      try {
        const res = await fetch(base + '/models', { headers: key ? { Authorization: 'Bearer ' + key } : {} });
        const j = await res.json().catch(() => null);
        if (seq !== modelListSeq) return;
        if (!res.ok) throw new Error((j && j.error && (j.error.message || j.error)) || 'HTTP ' + res.status);
        const ids = ((j && j.data) || []).map((m) => m.id).filter(Boolean).sort();
        const imgs = ids.filter(isImageModel);
        const txt = ids.filter((m) => !isImageModel(m));
        fillList(dl, txt);
        fillList(il, imgs);
        const vision = txt.filter((m) => /vl|vision|omni|4o|gemini|claude|pixtral|llava|qwen3\.[5-9]|qwen4|kimi-k[23]/i.test(m));
        info.textContent = `${ids.length} modelos na sua conta: ${txt.length} de texto${vision.length ? ` (com visão, para ler vídeo/imagem: ${vision.slice(0, 4).join(', ')}${vision.length > 4 ? '…' : ''})` : ''} e ${imgs.length} de imagem${imgs.length ? ` (${imgs.slice(0, 4).join(', ')}${imgs.length > 4 ? '…' : ''})` : ''}. Clique no campo para ver a lista.`;
        const cur = $('#gen-model').value.trim();
        if (ids.length && cur && !ids.includes(cur)) info.textContent = `⚠ "${cur}" não existe nesta conta. ` + info.textContent;
        if (!ai.imageModels[ai.provider] && imgs.length && !imgs.includes($('#gen-image-model').value.trim())) {
          $('#gen-image-model').value = imgs.find((m) => /qwen-image|gpt-image|image/i.test(m) && !/edit|pro/i.test(m)) || imgs[0];
        }
      } catch (e) {
        if (seq === modelListSeq) info.textContent = `Não deu para listar os modelos (${e.message}). Você pode digitar o nome.`;
      }
      return;
    }
    if (p.native !== 'gemini' || !key) return;
    const seq = ++modelListSeq;
    try {
      const models = await listGeminiModels(key);
      if (seq !== modelListSeq) return;
      fillList(dl, models.filter((m) => !isImageModel(m.id)));
      fillList(il, models.filter((m) => isImageModel(m.id)));
      if (!ai.imageModels[ai.provider]) { const bi = pickGeminiImageModel(models); if (bi) $('#gen-image-model').value = bi; }
      const current = geminiModelName($('#gen-model').value);
      if (models.length && !models.some((m) => m.id === current) && !ai.models[ai.provider]) {
        const best = pickGeminiModel(models);
        if (best) {
          $('#gen-model').value = best;
          $('#gen-provider-hint').textContent = `${p.hint} Modelo escolhido automaticamente: ${best} (${models.length} disponíveis).`;
        }
      } else if (models.length) {
        $('#gen-provider-hint').textContent = `${p.hint} ${models.length} modelos disponíveis nesta chave.`;
      }
    } catch (e) {
      if (seq === modelListSeq) $('#gen-provider-hint').textContent = `${p.hint} ⚠ ${e.message}`;
    }
  }

  function selectedCats() {
    return $$('#gen-cats input:checked').map((i) => i.value);
  }

  function renderEngine() {
    $$('#gen-engine button').forEach((b) => b.classList.toggle('is-active', b.dataset.engine === ui.engine));
    $('#gen-key-box').classList.toggle('hidden', ui.engine !== 'ai');
    $('#gen-engine-hint').textContent = ui.engine === 'ai'
      ? 'Use a IA que preferir: Claude, GPT, Gemini, Llama, DeepSeek, Mistral, Ollama… Cada geração usa a sua conta no provedor.'
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
      const q = ui.quality.get(id);
      if (q) {
        const qb = document.createElement('span');
        qb.className = 'quality-badge ' + (q.ok ? 'is-ok' : 'is-bad');
        qb.textContent = q.summary;
        qb.title = q.issues.map((i) => `${i.label}: ${Math.round(i.avg * 100)}% em média, ${Math.round(i.peak * 100)}% no pior quadro (limite ${Math.round(i.zone.avg * 100)}%)`).join('\n');
        prev.appendChild(qb);
      }
      const badge = document.createElement('span');
      badge.className = 'engine-badge';
      badge.textContent = `${item.engine === 'local' ? '⚡ Local' : '✨ ' + (item.engineLabel || 'IA')} · ${CATS[cat].singular}`;
      prev.appendChild(badge);
      frag.appendChild(card);
    });
    box.appendChild(frag);
    if (CS.observeCards) CS.observeCards(box);
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
      const item = CS.sanitizeCustomItem(cat, raw);
      if (!item) return null;
      CS.registerCustom(cat, item, { saved: false });
      return { cat, id: item.id };
    }).filter(Boolean);
    if (added.length < list.length) CS.toast(`${list.length - added.length} item(ns) vieram com arte inválida e foram descartados.`, 'info');
    ui.results = [...added, ...ui.results].slice(0, 24);
    renderResults();
    return added;
  }

  /** Mídia como arte: os formatos saem da própria mídia, animados com os quadros reais. */
  async function generateFromMedia(cats, prompt) {
    loadElements();
    const cfg = ui.engine === 'ai' ? aiConfig() : null;
    const canCreate = cfg && cfg.imageModel && (cfg.key || PROVIDERS[cfg.provider].keyOptional);
    const create = ui.elements.create !== false && canCreate ? cats.filter((c) => c === 'decorations' || c === 'frames') : [];
    const rest = cats.filter((c) => !create.includes(c));
    if (rest.length) await mediaArtOnly(rest, prompt);
    if (create.length) {
      CS.toast('Criando moldura/frame novos a partir dos elementos da cena…', 'info');
      await generateIllustrations(prompt, create, [], cfg, {});
    } else if (ui.elements.create !== false && !canCreate && cats.some((c) => c === 'decorations' || c === 'frames')) {
      CS.toast('Para CRIAR moldura e frame a partir da cena, escolha um "Modelo de imagem" na etapa 4. Por enquanto saíram montados com recortes.', 'info');
    }
  }
  async function mediaArtOnly(cats, prompt) {
    if (!window.CosmeticIllustration || !window.CosmeticMediaRef) return CS.toast('Módulos não carregaram. Atualize a página.', 'danger');
    setBusy(true, 'Recortando a sua mídia em cada formato…');
    showSkeletons(cats.length);
    try {
      const hi = await window.CosmeticMediaRef.artFrames(ui.media);
      const motion = {};
      cats.forEach((cat) => { motion[cat] = { fx: fxFor(prompt || '') }; });
      loadElements();
      const elements = { effects: ui.elements.effects.slice(), decorations: ui.elements.decorations.slice() };
      let transition = ui.elements.transition !== 'nenhuma' ? ui.elements.transition : '';
      let boxes = null;
      // A IA assiste os quadros e identifica os elementos que se movem (corvos, folhas, brasas…)
      const cfg = ui.engine === 'ai' ? aiConfig() : null;
      if (ui.elements.ai && cfg && (cfg.key || cfg.provider === 'ollama') && (cats.includes('effects') || cats.includes('decorations'))) {
        try {
          setBusy(true, 'A IA está assistindo os quadros e identificando os elementos animados…');
          const id = await identifyElements(ui.media, cfg);
          if (!elements.effects.length) elements.effects = id.effects;
          if (!elements.decorations.length) elements.decorations = id.decorations;
          if (!transition && id.transition && id.transition !== 'nenhuma') transition = id.transition;
          if (id.boxes.length) boxes = id.boxes;
          const names = [...new Set([...id.effects, ...id.decorations].map((l) => window.CosmeticIllustration.PARTS[l.kind].label))];
          if (names.length || id.summary) CS.toast(`IA identificou: ${names.join(', ') || 'nada que se repita'}${id.summary ? ' — ' + id.summary : ''}`, 'info');
          setBusy(true, 'Recortando a sua mídia em cada formato…');
        } catch (err) {
          console.warn('[Identificar elementos]', err);
          CS.toast('A IA não conseguiu identificar os elementos (' + (err.message || 'erro') + '). Usando o que você escolheu.', 'info');
        }
      }
      const list = await window.CosmeticIllustration.fromMedia(cats, { ...hi, name: ui.media.name, kind: ui.media.kind }, motion, { ...(ui.shapes || {}), elements, transition, boxes, decoMode: ui.elements.decoMode || 'objetos', frameMode: ui.elements.frameMode || 'objetos' });
      list.forEach((it) => {
        if (it.cat === 'nameplates' && it.palette && it.palette[0]) it.raw.asset.discordPalette = nearestDiscordPalette(it.palette[0]);
      });
      $$('#gen-results .gen-skeleton').forEach((n) => n.remove());
      const added = addResults(list);
      added.forEach((a, i) => { if (list[i] && list[i].quality) ui.quality.set(a.id, list[i].quality); });
      renderResults();
      CS.toast(`${list.length} item(ns) feitos com a sua mídia${hi.frames.length > 1 ? `, animados com ${hi.frames.length} quadros reais` : ''}.`, 'success');
    } catch (err) {
      console.error('[Mídia como arte]', err);
      $$('#gen-results .gen-skeleton').forEach((n) => n.remove());
      renderResults();
      CS.toast(err.message || 'Falha ao usar a mídia.', 'danger');
    } finally {
      setBusy(false);
    }
  }

  /** Modo Ilustração: o modelo de imagem pinta, o app recorta, protege as zonas e anima. */
  async function generateIllustrations(prompt, cats, refs, cfg, details = {}) {
    const native = PROVIDERS[cfg.provider] && PROVIDERS[cfg.provider].native === 'gemini' ? 'gemini' : cfg.provider;
    if (!window.CosmeticIllustration) return CS.toast('Módulo de ilustração não carregou. Atualize a página.', 'danger');
    setBusy(true, 'Pintando as ilustrações… isso leva de 10 a 40 s por item.');
    showSkeletons(cats.length);
    const dropSkeletons = () => document.querySelectorAll('#gen-results .gen-skeleton').forEach((n) => n.remove());
    try {
      // Referências: cada uma vale SÓ para o seu formato. As animadas são lidas quadro a quadro,
      // uma IA de visão descreve visual + movimento por formato, e o modelo de imagem recebe essa
      // descrição + 1 quadro de referência (mais que isso ele cola as referências lado a lado).
      const refsByCat = {}, motion = {}, perCat = { ...details };
      const mine = refs.filter((r) => cats.includes(r.cat));
      if (mine.length || ui.media) {
        setBusy(true, ui.media ? 'Assistindo a mídia quadro a quadro…' : `Lendo ${mine.length} referência(s) quadro a quadro…`);
        const groups = await refStrips(mine, cats, 12);
        Object.entries(mediaGroups(cats)).forEach(([cat, list]) => { groups[cat] = [...list, ...(groups[cat] || [])]; });
        if (Object.keys(groups).length) {
          setBusy(true, 'Estudando as referências (visual e movimento)…');
          let an = {};
          try { an = await analyzeRefs(groups, prompt, details, cfg); } catch (e) {
            console.warn('[Análise de referências]', e);
            CS.toast('Não deu para analisar as referências (' + (e.message || 'erro') + '); usando só os nomes.', 'info');
          }
          Object.entries(an).forEach(([cat, a]) => {
            perCat[cat] = [details[cat], a.pedido, a.visual && `Keep the look of the user's references: ${a.visual}`, a.movimento && `Their motion: ${a.movimento}`].filter(Boolean).join('. ');
            motion[cat] = { preset: a.preset, intensity: a.intensidade, fx: fxFor([prompt, details[cat]].join(' '), a.fx) };
          });
          if (native !== 'openai') Object.entries(groups).forEach(([cat, list]) => { refsByCat[cat] = [{ mime: 'image/png', data: list[0].first }]; });
        }
        cats.forEach((cat) => {
          if (perCat[cat]) return;
          const names = mine.filter((r) => r.cat === cat).map((r) => r.item.name);
          if (names.length) perCat[cat] = 'In the spirit of: ' + names.join(', ');
        });
      }
      cats.forEach((cat) => { if (!motion[cat]) motion[cat] = { fx: fxFor([prompt, details[cat]].join(' ')) }; });
      const theme = prompt || (ui.media ? 'o mesmo tema e visual da mídia de referência' : 'tema livre, item premium');
      const list = await window.CosmeticIllustration.generate({ prompt: theme, cats, details: perCat }, { ...cfg, model: cfg.imageModel, provider: native, baseUrl: native === 'gemini' ? '' : cfg.baseUrl }, {
        refs: refsByCat,
        fromMedia: !!ui.media,
        shapes: ui.shapes || {},
        motion,
        onProgress: (msg) => setBusy(true, msg + ' (10 a 40 s por item)'),
      });
      list.forEach((it) => {
        if (it.cat === 'nameplates' && it.palette && it.palette[0]) it.raw.asset.discordPalette = nearestDiscordPalette(it.palette[0]);
        loadElements();
        const el = ui.elements[it.cat];
        if (el && el.length && it.raw && it.raw.asset && it.raw.asset.svg) {
          it.raw.asset.svg = window.CosmeticIllustration.withParticles(it.raw.asset.svg, it.cat, el, it.palette, 7);
          if (it.raw.asset.introSvg) it.raw.asset.introSvg = window.CosmeticIllustration.withParticles(it.raw.asset.introSvg, it.cat, el, it.palette, 7);
        }
      });
      dropSkeletons();
      const added = addResults(list);
      added.forEach((a, i) => { if (list[i] && list[i].quality) ui.quality.set(a.id, list[i].quality); });
      renderResults();
      CS.toast(`${list.length} ${list.length === 1 ? 'ilustração gerada' : 'ilustrações geradas'}!`, 'success');
      if (list.failed) CS.toast('Falhou: ' + list.failed.join(' · '), 'danger');
    } catch (err) {
      console.error('[Ilustração]', err);
      dropSkeletons();
      renderResults();
      CS.toast(err.message || 'Falha ao gerar.', 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function onGenerate(e) {
    e.preventDefault();
    if (ui.busy) return;
    let prompt = $('#gen-prompt').value.trim();
    let details = {};
    const cats = selectedCats();
    const refs = refsResolved();
    if (!prompt && !refs.length && !ui.media) {
      $('#gen-prompt').focus();
      return CS.toast('Descreva um tema ou escolha referências da biblioteca.', 'danger');
    }
    if (!cats.length) return CS.toast('Escolha pelo menos uma categoria.', 'danger');

    // Mídia do usuário como arte: recorta, protege as zonas e anima com os quadros reais (sem IA)
    if (ui.media && ui.mediaArt) return generateFromMedia(cats, prompt);

    if (ui.engine === 'ai') {
      const preset = PROVIDERS[ai.provider];
      const cfg = {
        provider: ai.provider,
        key: $('#gen-key').value.trim(),
        model: $('#gen-model').value.trim() || preset.model,
        imageModel: imageModelValue(),
        baseUrl: $('#gen-baseurl').value.trim() || preset.base,
      };
      if (isImageModel(cfg.model)) cfg.model = textModelFor(cfg);
      if (!cfg.key && !preset.keyOptional) {
        $('#gen-key').focus();
        return CS.toast(`Cole sua chave da ${preset.label} ou troque para o motor Local.`, 'danger');
      }
      ai.keys[ai.provider] = cfg.key;
      persistAiSettings();
      // Prompt livre → a IA reescreve no formato "tema + uma linha por formato"
      if (ui.autoRewrite && prompt && !hasFormatLines(prompt)) {
        setBusy(true, 'Ajustando o prompt para os formatos do Discord…');
        try {
          const r = await rewritePrompt(prompt, cfg);
          const txt = formatPrompt(r.theme, r.details);
          $('#gen-prompt').value = txt;
          $('#gen-prompt').dispatchEvent(new Event('input'));
          prompt = txt;
        } catch (err) {
          console.warn('[Ajuste de prompt]', err);
          CS.toast('Não deu para ajustar o prompt (' + (err.message || 'erro') + '); usando como está.', 'info');
        } finally {
          setBusy(false);
        }
      }
      ({ theme: prompt, details } = parsePrompt(prompt));
      // campos próprios de cada formato têm prioridade sobre as linhas do prompt
      ['nameplates', 'decorations', 'effects', 'frames'].forEach((c) => { const el = document.getElementById('gen-pp-' + c); const v = el && el.value.trim(); if (v) details[c] = v; });
      let mode = cats.includes('frames') && ui.mode === 'particles' ? 'svg' : ui.mode;
      if (mode !== ui.mode) CS.toast('Profile frames são desenhados no estilo Arte (SVG).', 'info');
      // Ilustração precisa de um modelo de IMAGEM; sem ele, desenha em SVG
      if (mode === 'raster' && !cfg.imageModel) {
        mode = 'svg';
        CS.toast('Escolha um "Modelo de imagem" para o modo Ilustração. Sem ele, usando o estilo Arte (SVG).', 'info');
      }
      if (mode === 'raster') return generateIllustrations(prompt, cats, refs, cfg, details);
      setBusy(true, `${preset.label.replace(/\s*\(.*\)$/, '')} está ${mode === 'svg' ? 'desenhando a arte' : 'montando'} do seu kit… ${mode === 'svg' ? 'isso pode levar até 1–2 minutos.' : 'isso leva alguns segundos.'}`);
      showSkeletons(cats.length);
      const req = { prompt, details, cats, mode, refs: refs.map((r) => ({ ...r })), images: [] };
      // Referências oficiais viram TIRAS DE QUADROS (a IA vê o movimento); as SVG já vão como código
      if (req.refs.some((r) => r.item.asset && r.item.asset.type === 'image')) setBusy(true, 'Lendo as referências quadro a quadro…');
      let nImg = 0;
      for (const r of req.refs) {
        if (!(r.item.asset && r.item.asset.type === 'image') || nImg >= 8) continue;
        const st = window.CosmeticRefFrames ? await window.CosmeticRefFrames.stripOf(r.item, r.cat, 4) : null;
        if (st) { req.images.push({ mime: st.mime, data: st.data }); Object.assign(r, { hasImage: true, frames: st.frames, animated: st.animated }); nImg++; continue; }
        const url = refImageUrl(r.item);
        if (!url) continue;
        if (ai.provider === 'anthropic' || ai.provider === 'openai') { req.images.push({ url }); r.hasImage = true; nImg++; }
        else if (PROVIDERS[ai.provider].native === 'gemini') {
          try { req.images.push(await toBase64(url)); r.hasImage = true; nImg++; } catch (e) { /* segue sem a imagem */ }
        }
      }
      setBusy(true, `${preset.label.replace(/\s*\(.*\)$/, '')} está ${mode === 'svg' ? 'desenhando a arte' : 'montando'} do seu kit…`);
      if (ui.media && window.CosmeticMediaRef) {
        const st = window.CosmeticMediaRef.stripOf(ui.media, cats[0]);
        req.images.unshift({ mime: st.mime, data: st.data });
        req.refs.unshift({ cat: cats[0], item: { name: `Mídia do usuário (${ui.media.kind})`, description: 'Vale para TODOS os formatos pedidos: reproduza o tema, as cores, os elementos e o movimento que aparecem nos quadros.', asset: { type: 'image' } }, hasImage: true, frames: st.frames, animated: st.animated });
      }
      if (mode === 'svg' && ui.styleRefs) {
        req.styleRefs = styleExamples(cats, prompt, cats.length > 2 ? 1 : 2).slice(0, Math.max(0, 4 - req.images.length));
        for (const x of req.styleRefs) {
          if (ai.provider === 'anthropic' || ai.provider === 'openai') { req.images.push({ url: x.url }); x.hasImage = true; }
          else if (PROVIDERS[ai.provider].native === 'gemini') {
            try { req.images.push(await toBase64(x.url)); x.hasImage = true; } catch (e) { /* segue sem */ }
          }
        }
      }
      const call = (rq) => (ai.provider === 'anthropic'
        ? generateWithClaude(rq, cfg.key, cfg.model)
        : PROVIDERS[ai.provider].native === 'gemini'
          ? generateWithGemini(rq, cfg)
          : generateWithOpenAICompat(rq, cfg));
      try {
        let list;
        try {
          list = await call(req);
        } catch (err) {
          if (!req.images.length) throw err;
          // O modelo pode não aceitar imagens: tenta de novo só com texto
          console.warn('[Gerador IA] tentando sem imagens:', err.message);
          req.images = [];
          req.refs.forEach((r) => { r.hasImage = false; });
          (req.styleRefs || []).forEach((x) => { x.hasImage = false; });
          list = await call(req);
        }
        if (mode === 'svg' && ui.review && window.CosmeticExport && window.CosmeticExport.sampleSvg) {
          list = await reviewLoop(list, req, call);
        }
        $$('#gen-results .gen-skeleton').forEach((n) => n.remove());
        const added = addResults(list);
        added.forEach((a, i) => { if (list[i] && list[i].quality) ui.quality.set(a.id, list[i].quality); });
        renderResults();
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
        const pp = parsePrompt(prompt);
        const flat = [pp.theme, ...Object.values(pp.details)].filter(Boolean).join(' ');
        const list = refs.length ? generateLocalFromRefs(flat, cats, refs) : generateLocal(flat, cats);
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
    } else if (btn.classList.contains('gen-redo')) {
      toggleRedo(card, cat, item);
    } else if (btn.classList.contains('gen-redo-go')) {
      const input = card.querySelector('.gen-redo-input');
      const text = (input && input.value.trim()) || '';
      if (!text) { input && input.focus(); return CS.toast('Diga o que mudar (ex.: "deixa o fogo azul e tira as nuvens").', 'info'); }
      redoItem(cat, item, text, card);
    } else if (btn.classList.contains('gen-vary')) {
      const added = addResults([{ cat, raw: varyItem(item) }]);
      CS.toast('Variação criada!', 'success');
      const first = $(`#gen-results [data-id="${added[0].id}"]`);
      first?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (btn.classList.contains('gen-json')) {
      openJson(item);
    } else if (btn.classList.contains('gen-ref')) {
      addRef(cat, item.id);
      $('#gen-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (btn.classList.contains('btn-apng')) {
      window.CosmeticExport && window.CosmeticExport.open(cat, item.id);
    }
  }

  /* ---------------------------------------------------------------- */
  /* ✏️ Refazer: o usuário diz o que mudar e a IA refaz aquele item     */
  /* ---------------------------------------------------------------- */
  function toggleRedo(card, cat, item) {
    const open = card.querySelector('.gen-redo-box');
    if (open) { open.remove(); return; }
    const box = document.createElement('div');
    box.className = 'gen-redo-box mt-2 flex flex-col gap-2';
    box.innerHTML = `
      <textarea class="gen-redo-input dc-input h-auto py-2 text-sm min-h-[64px] resize-y" maxlength="600" placeholder="O que mudar? Ex.: deixa as chamas azuis, tira o dragão da esquerda, mais brilho nas runas"></textarea>
      <div class="flex items-center gap-2">
        <button type="button" class="btn btn-sm btn-primary gen-redo-go">✏️ Refazer este item</button>
        <span class="text-[11px] text-dc-faint">A versão nova aparece ao lado; a atual fica.</span>
      </div>`;
    const actions = card.querySelector('.gen-vary') && card.querySelector('.gen-vary').parentElement;
    (actions || card).insertAdjacentElement('afterend', box);
    const ta = box.querySelector('textarea');
    ta.focus();
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) box.querySelector('.gen-redo-go').click(); });
  }

  /** Configuração do provedor atual (ou null, com aviso). */
  function aiConfig() {
    const preset = PROVIDERS[ai.provider];
    const cfg = { provider: ai.provider, key: $('#gen-key').value.trim(), model: $('#gen-model').value.trim() || preset.model, imageModel: imageModelValue(), baseUrl: $('#gen-baseurl').value.trim() || preset.base };
    if (!cfg.key && !preset.keyOptional) { $('#gen-key').focus(); CS.toast(`Para refazer, cole sua chave da ${preset.label}.`, 'danger'); return null; }
    return cfg;
  }
  const callFor = (cfg) => (rq) => (cfg.provider === 'anthropic'
    ? generateWithClaude(rq, cfg.key, cfg.model)
    : PROVIDERS[cfg.provider].native === 'gemini' ? generateWithGemini(rq, cfg) : generateWithOpenAICompat(rq, cfg));

  async function redoItem(cat, item, instruction, card) {
    if (ui.busy) return;
    if (ui.engine !== 'ai') return CS.toast('Refazer usa a IA: troque o motor para "IA (sua chave)".', 'info');
    const cfg = aiConfig();
    if (!cfg) return;
    const a = item.asset || {};
    const isIllustration = a.type === 'svg' && /<image[\s>]/.test(a.svg || '');
    const name = (item.name || 'Item').replace(/\s*✎\d*$/, '');
    setBusy(true, `Refazendo “${name}”: ${instruction.slice(0, 60)}${instruction.length > 60 ? '…' : ''}`);
    card.classList.add('is-redoing');
    try {
      let raw, quality;
      if (isIllustration) {
        const native = PROVIDERS[cfg.provider].native === 'gemini' ? 'gemini' : cfg.provider;
        if (!cfg.imageModel) throw new Error('Escolha um "Modelo de imagem" para refazer ilustrações.');
        const r = await window.CosmeticIllustration.remake(cat, item, instruction, { ...cfg, model: cfg.imageModel, provider: native, baseUrl: native === 'gemini' ? '' : cfg.baseUrl }, { fx: fxFor(instruction) });
        if (cat === 'nameplates' && r.palette && r.palette[0]) r.asset.discordPalette = nearestDiscordPalette(r.palette[0]);
        raw = { name: name + ' ✎', description: instruction.slice(0, 150), rarity: item.rarity, tags: item.tags, prompt: [item.prompt, instruction].filter(Boolean).join(' — ').slice(0, 2000), engine: native, engineLabel: r.label, asset: r.asset };
        quality = { ok: true, issues: [], summary: '✓ refeito · zonas protegidas' };
      } else {
        if (/(^|[-/])image|gpt-image|dall-e|imagen/i.test(cfg.model)) cfg.model = textModelFor(cfg);
        const mode = a.type === 'svg' ? 'svg' : 'particles';
        const current = a.type === 'svg'
          ? `SVG atual (loop):\n${a.svg}${a.introSvg ? `\nSVG atual (entrada, ${a.introSeconds}s):\n${a.introSvg}` : ''}`
          : `Spec atual: ${JSON.stringify({ palette: a.palette, base: a.base, ring: a.ring, layers: a.layers, intro: a.intro })}`;
        const feedback = `REFAZER. O usuário quer mudar este ${CAT_TO_API[cat]} "${name}". Pedido: ${instruction}

Mude SÓ o que o pedido diz; mantenha formato, tamanho, composição, estilo, paleta e animação no resto. Devolva o mesmo formato JSON com exatamente 1 item da categoria ${CAT_TO_API[cat]}.

${current}`;
        const req = { prompt: item.prompt || name, details: {}, cats: [cat], mode, refs: [], images: [], feedback };
        let list = await callFor(cfg)(req);
        if (mode === 'svg' && ui.review && window.CosmeticExport && window.CosmeticExport.sampleSvg) list = await reviewLoop(list, req, callFor(cfg));
        const got = list.find((x) => x.cat === cat) || list[0];
        if (!got) throw new Error('A IA não devolveu o item refeito.');
        raw = { ...got.raw, name: name + ' ✎', description: got.raw.description || instruction.slice(0, 150) };
        quality = got.quality;
      }
      const added = addResults([{ cat, raw }]);
      if (added[0] && quality) ui.quality.set(added[0].id, quality);
      renderResults();
      CS.toast('Versão refeita pronta!', 'success');
      const el = added[0] && $(`#gen-results [data-id="${added[0].id}"]`);
      el && el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      console.error('[Refazer]', err);
      CS.toast(err.message || 'Não deu para refazer.', 'danger');
    } finally {
      card.classList.remove('is-redoing');
      setBusy(false);
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
      $('#gen-prompt-count').textContent = `${e.target.value.length}/2000`;
      // A caixa cresce com o texto (até 60% da tela; depois rola)
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight + 2, window.innerHeight * 0.6) + 'px';
    });
    $('#gen-prompt').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#gen-form').requestSubmit();
    });

    const sel = $('#gen-provider');
    for (const id in PROVIDERS) {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = PROVIDERS[id].label;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => {
      ai.provider = sel.value;
      persistAiSettings();
      renderProvider();
      if (ai.provider === 'anthropic') loadSdk().catch(() => {});
    });
    $('#gen-model').addEventListener('change', (e) => {
      ai.models[ai.provider] = e.target.value.trim();
      persistAiSettings();
    });
    $('#gen-image-model').addEventListener('change', (e) => {
      ai.imageModels[ai.provider] = e.target.value.trim();
      persistAiSettings();
    });
    const mart = $('#gen-media-art');
    ui.mediaArt = store.get('cosmetic-studio:gen-media-art') !== '0';
    mart.checked = ui.mediaArt;
    mart.addEventListener('change', () => { ui.mediaArt = mart.checked; store.set('cosmetic-studio:gen-media-art', ui.mediaArt ? '1' : '0'); });
    $('#gen-baseurl').addEventListener('change', (e) => {
      ai.baseUrls[ai.provider] = e.target.value.trim();
      persistAiSettings();
      if (!ai.imageModels[ai.provider]) $('#gen-image-model').value = defaultImageModel(ai.provider);
      refreshModelList();
    });
    $('#gen-key').addEventListener('change', (e) => {
      ai.keys[ai.provider] = e.target.value.trim();
      persistAiSettings();
      refreshModelList();
    });
    $('#gen-key-remember').addEventListener('change', (e) => {
      ai.remember = e.target.checked;
      persistAiSettings();
    });
    renderProvider();
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
      if (ui.engine === 'ai' && ai.provider === 'anthropic') loadSdk().catch(() => {});
    });

    $('#gen-form').addEventListener('submit', onGenerate);
    $('#gen-refs-add').addEventListener('click', openPicker);
    renderFx();
    renderShapes();
    renderElements();
    // abas de formato (a caixinha marca se gera; o clique no resto abre o painel)
    $$('#gen-cats .fmt-tab').forEach((tab) => {
      const open = () => {
        $$('#gen-cats .fmt-tab').forEach((x) => x.classList.toggle('is-active', x === tab));
        $$('.fmt-panel').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== tab.dataset.tab));
      };
      tab.addEventListener('click', (e) => { if (e.target.tagName !== 'INPUT') open(); });
      tab.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
    // abas da ideia: texto / mídia / biblioteca
    $$('.gen-src-tabs [data-src]').forEach((btn) => btn.addEventListener('click', () => {
      $$('.gen-src-tabs [data-src]').forEach((x) => x.classList.toggle('is-active', x === btn));
      $$('[data-src-panel]').forEach((p) => p.classList.toggle('hidden', p.dataset.srcPanel !== btn.dataset.src));
    }));
    const dots = () => {
      const m = $('#gen-media-dot'), r = $('#gen-refs-dot');
      if (m) m.classList.toggle('hidden', !ui.media);
      if (r) r.classList.toggle('hidden', !$$('#gen-refs > *').length);
    };
    setInterval(dots, 800);
    // sem chave salva: abre a etapa do provedor
    if (!$('#gen-key').value) $('#gen-ai-fold').open = true;
    ['nameplates', 'decorations', 'effects', 'frames'].forEach((c) => {
      const el = document.getElementById('gen-pp-' + c); if (!el) return;
      const k = 'cosmetic-studio:gen-pp-' + c;
      el.value = store.get(k) || '';
      el.addEventListener('input', () => store.set(k, el.value));
    });
    const fxAi = $('#gen-fx-ai');
    if (fxAi) fxAi.addEventListener('change', () => { ui.fxAi = fxAi.checked; store.set(FX_AI_STORAGE, ui.fxAi ? '1' : '0'); });
    const mUrl = $('#gen-media-url');
    const loadUrl = () => { const v = mUrl.value.trim(); if (v) loadMedia(() => window.CosmeticMediaRef.fromUrl(v)); };
    $('#gen-media-load').addEventListener('click', loadUrl);
    mUrl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); loadUrl(); } });
    mUrl.addEventListener('paste', () => setTimeout(loadUrl, 0));
    $('#gen-media-file').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (file) loadMedia(() => window.CosmeticMediaRef.fromFile(file));
    });
    const drop = $('#gen-media-box');
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('ring-2', 'ring-[#5865F2]'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('ring-2', 'ring-[#5865F2]'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('ring-2', 'ring-[#5865F2]');
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      const txt = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
      if (file) loadMedia(() => window.CosmeticMediaRef.fromFile(file));
      else if (txt) { mUrl.value = txt.trim(); loadUrl(); }
    });
    // Colar uma imagem/vídeo (Ctrl+V) em qualquer lugar do gerador
    $('#gen-form').addEventListener('paste', (e) => {
      const file = [...((e.clipboardData && e.clipboardData.files) || [])].find((f) => /^(image|video)\//.test(f.type));
      if (file) { e.preventDefault(); loadMedia(() => window.CosmeticMediaRef.fromFile(file)); }
    });
    const rv = $('#gen-review');
    const sr = $('#gen-style');
    if (sr) {
      sr.checked = ui.styleRefs;
      sr.addEventListener('change', () => {
        ui.styleRefs = sr.checked;
        try { localStorage.setItem(STYLE_KEY, ui.styleRefs ? '1' : '0'); } catch (e) { /* ok */ }
      });
    }
    loadStyleGuide();
    const aw = $('#gen-rewrite');
    if (aw) {
      aw.checked = ui.autoRewrite;
      aw.addEventListener('change', () => {
        ui.autoRewrite = aw.checked;
        try { localStorage.setItem(REWRITE_KEY, ui.autoRewrite ? '1' : '0'); } catch (e) { /* ok */ }
      });
    }
    const rb = $('#gen-rewrite-now');
    if (rb) rb.addEventListener('click', async () => {
      const text = $('#gen-prompt').value.trim();
      if (!text) { $('#gen-prompt').focus(); return CS.toast('Escreva um tema primeiro.', 'info'); }
      if (ui.engine !== 'ai') return CS.toast('O ajuste com IA usa o motor IA (sua chave).', 'info');
      const preset = PROVIDERS[ai.provider];
      const cfg = { provider: ai.provider, key: $('#gen-key').value.trim(), model: $('#gen-model').value.trim() || preset.model, baseUrl: $('#gen-baseurl').value.trim() || preset.base };
      if (!cfg.key && !preset.keyOptional) { $('#gen-key').focus(); return CS.toast(`Cole sua chave da ${preset.label}.`, 'danger'); }
      if (ui.busy) return;
      setBusy(true, 'Ajustando o prompt para os formatos do Discord…');
      try {
        const base = parsePrompt(text);
        const r = await rewritePrompt(text, cfg);
        $('#gen-prompt').value = formatPrompt(r.theme, { ...r.details, ...base.details });
        $('#gen-prompt').dispatchEvent(new Event('input'));
        CS.toast('Prompt ajustado: confira e edite as linhas se quiser.', 'success');
      } catch (err) {
        CS.toast('Não deu para ajustar: ' + (err.message || 'erro'), 'danger');
      } finally {
        setBusy(false);
      }
    });
    rv.checked = ui.review;
    rv.addEventListener('change', () => {
      ui.review = rv.checked;
      try { localStorage.setItem(REVIEW_KEY, ui.review ? '1' : '0'); } catch (e) { /* ok */ }
    });
    $$('#gen-mode button').forEach((b) => b.classList.toggle('is-active', b.dataset.mode === ui.mode));
    $('#gen-mode').addEventListener('click', (e) => {
      const b = e.target.closest('[data-mode]');
      if (!b) return;
      ui.mode = b.dataset.mode;
      store.set(MODE_STORAGE, ui.mode);
      $$('#gen-mode button').forEach((x) => x.classList.toggle('is-active', x === b));
    });
    renderRefs();
    $('#gen-results').addEventListener('click', onResultsClick);
    $('#gen-clear').addEventListener('click', () => {
      ui.results = [];
      renderResults();
    });

    document.addEventListener('cs:generator-open', () => {
      if (ui.engine === 'ai' && ai.provider === 'anthropic') loadSdk().catch(() => {});
      renderResults();
    });

    renderEngine();
    renderResults();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Exposto para testes / depuração
  window.CosmeticGenerator = { analyzeRefs, refStrips, ANALYZE_SYSTEM, parsePrompt, formatPrompt, rewritePrompt, REWRITE_SYSTEM, STYLE, styleGuidePrompt, styleExamples, generateLocal, varyItem, addRef, checkArt, ZONES, OUTPUT_SCHEMA, SYSTEM_PROMPT, SVG_OUTPUT_SCHEMA, SVG_SYSTEM_PROMPT, userTextFor };
})();
