/* ==========================================================================
   Modo ILUSTRAÇÃO do gerador: um modelo de IMAGEM pinta a arte
   (Gemini "…-image" ou OpenAI gpt-image), e o app:
     1. recorta o fundo (chroma key verde no Gemini; transparente no OpenAI),
     2. encaixa no canvas oficial do formato,
     3. apaga com máscara suave as zonas do avatar/nome (garantido, sem depender da IA),
     4. monta um SVG com a ilustração embutida + animação CSS (brilho, respiro,
        partículas na paleta da arte; no effect, entrada + loop).
   ========================================================================== */
(() => {
  'use strict';

  const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
  const DEFAULT_GEMINI_IMAGE = 'gemini-2.5-flash-image';
  const DEFAULT_OPENAI_IMAGE = 'gpt-image-1';

  /* Canvas final de cada formato (igual aos oficiais). */
  const CANVAS = {
    nameplates: { w: 448, h: 84 },
    decorations: { w: 288, h: 288 },
    effects: { w: 450, h: 880 },
    frames: { w: 1312, h: 716 },
  };
  /* Proporção pedida a cada provedor. */
  const ASPECT = {
    nameplates: { gemini: '21:9', openai: '1536x1024' },
    decorations: { gemini: '1:1', openai: '1024x1024' },
    effects: { gemini: '9:16', openai: '1024x1536' },
    frames: { gemini: '16:9', openai: '1536x1024' },
  };

  const STYLE = 'Polished 2D game cosmetic illustration in the style of official Discord shop items: clean cel shading with 2-3 tones per color, crisp smooth edges, soft rim light, a short harmonious palette (one dominant color, one support, one accent), bright and readable at small size, a few big well-drawn shapes rather than clutter. No text, no letters, no numbers, no logos, no watermark, no UI elements, no photo realism, no 3D render look.';

  const LAYOUT = {
    decorations: 'FORMAT: square avatar decoration. The artwork is a decorative ring that wraps around an EMPTY CIRCULAR HOLE in the exact center of the image; the hole diameter is about 72% of the image width and must contain only background. Place the main ornament on the top or a top corner of the ring and smaller accents around the rest so it feels balanced. The art hugs the hole edge and stays inside the image borders.',
    nameplates: 'FORMAT: very wide horizontal banner ornament. All artwork must sit inside the central horizontal band (the middle 40% of the image height); everything above and below that band is plain background. The LEFT HALF of the image is completely empty background. The illustration grows in density toward the right end, with the main motif on the far right.',
    effects: 'FORMAT: tall vertical overlay effect for a profile card. Decorative elements run along the top quarter and down the left and right edges like a living border (e.g. flames, petals, clouds, vines, sparks). The middle of the image and the bottom third stay mostly empty background, with only a few small floating particles.',
    frames: 'FORMAT: wide ornamental profile frame. A rich ornament spans the TOP band of the image (top 40% of the height), and slim decorative columns run down the far left and far right edges to the bottom corners. The entire center and lower middle of the image is empty background.',
  };
  const CAT_WORD = { nameplates: 'nameplate', decorations: 'avatar decoration', effects: 'profile effect', frames: 'profile frame' };

  function promptFor(cat, theme, provider, hasRefs) {
    const bg = provider === 'gemini'
      ? 'BACKGROUND: perfectly flat solid pure green (#00FF00) everywhere outside the artwork, with no gradient, texture, shadow or vignette. Do not use any green-screen green inside the artwork itself (if the theme needs green, use jade, emerald or teal tones that are clearly darker or bluer).'
      : 'BACKGROUND: fully transparent.';
    return [
      `Create a Discord ${CAT_WORD[cat]} with this theme: ${theme}.`,
      LAYOUT[cat],
      STYLE,
      bg,
      'Also reply with one short line of text: NOME: <a creative item name in Brazilian Portuguese, 2 to 4 words>.',
      hasRefs ? 'The attached images are official Discord shop items: match their level of finish and their composition, but do NOT copy their subject.' : '',
    ].filter(Boolean).join('\n\n');
  }

  /* ---------------------------------------------------------------- */
  /* Chamadas aos provedores                                           */
  /* ---------------------------------------------------------------- */
  function geminiImageModel(model) {
    const m = String(model || '').replace(/^models\//, '').trim();
    return /image/i.test(m) ? m : DEFAULT_GEMINI_IMAGE;
  }
  function openaiImageModel(model) {
    const m = String(model || '').trim();
    return /^(gpt-image|dall-e)/i.test(m) ? m : DEFAULT_OPENAI_IMAGE;
  }

  async function geminiImage(cat, theme, cfg, refs) {
    const model = geminiImageModel(cfg.model);
    const url = `${(cfg.baseUrl || GEMINI_BASE).replace(/\/+$/, '')}/models/${encodeURIComponent(model)}:generateContent`;
    const parts = [{ text: promptFor(cat, theme, 'gemini', refs.length > 0) }, ...refs.map((r) => ({ inlineData: { mimeType: r.mime, data: r.data } }))];
    for (const withAspect of [true, false]) {
      const generationConfig = { responseModalities: ['TEXT', 'IMAGE'] };
      if (withAspect) generationConfig.imageConfig = { aspectRatio: ASPECT[cat].gemini };
      let res;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.key },
          body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig }),
        });
      } catch (e) {
        throw new Error('Não foi possível conectar ao Gemini. Verifique sua internet.');
      }
      let data = null;
      try { data = await res.json(); } catch (e) { data = null; }
      if (!res.ok) {
        const msg = (data && data.error && data.error.message) || '';
        if (withAspect && res.status === 400 && /image_?config|aspect/i.test(msg)) continue;
        if (res.status === 429) throw new Error('Limite do Gemini atingido (modelos de imagem têm cota menor). Aguarde um pouco.');
        if (res.status === 404) throw new Error(`O modelo de imagem "${model}" não existe nesta chave. Use ${DEFAULT_GEMINI_IMAGE} ou outro "…-image".`);
        throw new Error('Gemini: ' + (msg || 'HTTP ' + res.status));
      }
      const cand = data && data.candidates && data.candidates[0];
      const img = ((cand && cand.content && cand.content.parts) || []).find((p) => p.inlineData && /^image\//.test(p.inlineData.mimeType || ''));
      if (!img) {
        if (data && data.promptFeedback && data.promptFeedback.blockReason) throw new Error('O Gemini bloqueou esse tema. Tente descrevê-lo de outro jeito.');
        throw new Error('O Gemini não devolveu imagem. Confira se o modelo é de imagem (ex.: ' + DEFAULT_GEMINI_IMAGE + ').');
      }
      const text = ((cand.content && cand.content.parts) || []).map((p) => p.text || '').join('\n');
      const nm = text.match(/NOME\s*:\s*([^\n*]{2,40})/i);
      return { mime: img.inlineData.mimeType, data: img.inlineData.data, model, keyed: true, name: nm ? nm[1].trim().replace(/[."“”]+$/g, '').replace(/^["“]/, '') : '' };
    }
    throw new Error('O Gemini não aceitou o pedido.');
  }

  async function openaiImage(cat, theme, cfg) {
    const model = openaiImageModel(cfg.model);
    const base = (cfg.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    let res;
    try {
      res = await fetch(base + '/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.key },
        body: JSON.stringify({ model, prompt: promptFor(cat, theme, 'openai', false), size: ASPECT[cat].openai, background: 'transparent', quality: 'high', n: 1, output_format: 'png' }),
      });
    } catch (e) {
      throw new Error('Não foi possível conectar à OpenAI.');
    }
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) throw new Error('OpenAI: ' + ((data && data.error && data.error.message) || 'HTTP ' + res.status));
    const b64 = data && data.data && data.data[0] && data.data[0].b64_json;
    if (!b64) throw new Error('A OpenAI não devolveu imagem.');
    return { mime: 'image/png', data: b64, model, keyed: false };
  }

  /* ---------------------------------------------------------------- */
  /* Pós-processamento                                                 */
  /* ---------------------------------------------------------------- */
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Imagem gerada inválida.'));
      img.src = src;
    });
  }
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  /** Remove o fundo verde (#00FF00) com borda suave e tira o reflexo verde das bordas. */
  function chromaKey(img) {
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const spill = g - Math.max(r, b);
      if (spill <= 30) continue;
      // 30 → opaco; 110+ → transparente (verde puro tem spill ~255)
      const a = 1 - smooth(30, 110, spill);
      d[i + 3] = Math.round(d[i + 3] * a);
      d[i + 1] = Math.max(r, b) + Math.round(Math.max(0, spill) * 0.15); // despill
    }
  }

  /** Recorta a área com arte (alpha) para centralizar no canvas. */
  function alphaBounds(img) {
    const { width: w, height: h, data: d } = img;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
      if (d[(y * w + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  /** Multiplica o alpha por uma máscara que protege avatar/nome em cada formato. */
  function protectZones(ctx, cat, W, H) {
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let k = 1;
      if (cat === 'decorations') {
        const r = Math.hypot(x - 144, y - 144);
        k = smooth(90, 108, r); // centro do avatar livre, borda pode ser tocada
      } else if (cat === 'nameplates') {
        k = smooth(140, 215, x); // avatar + nome à esquerda
      } else if (cat === 'effects') {
        const r = Math.hypot(x - 82, y - 138);
        k = smooth(58, 80, r);
        // texto do perfil: no máximo semitransparente
        if (x > 21 && x < 429 && y > 199 && y < 556) k = Math.min(k, 0.55 + 0.45 * smooth(0, 60, Math.min(x - 21, 429 - x)));
      } else if (cat === 'frames') {
        const inX = smooth(60, 110, x) * smooth(60, 110, W - x);
        const inY = smooth(360, 430, y);
        k = 1 - inX * inY; // centro e área do nome livres; topo e laterais ficam
      }
      if (k < 1) d[(y * W + x) * 4 + 3] = Math.round(d[(y * W + x) * 4 + 3] * k);
    }
    ctx.putImageData(img, 0, 0);
  }

  /** Cores marcantes da arte (para as partículas). */
  function paletteOf(ctx, W, H) {
    const d = ctx.getImageData(0, 0, W, H).data;
    const bins = new Map();
    const step = Math.max(1, Math.round(Math.sqrt((W * H) / 6000)));
    for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
      const i = (y * W + x) * 4;
      if (d[i + 3] < 200) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx < 90) continue;
      const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
      const e = bins.get(key) || { n: 0, r: 0, g: 0, b: 0, s: 0 };
      e.n++; e.r += r; e.g += g; e.b += b; e.s += (mx - mn) / mx + mx / 255;
      bins.set(key, e);
    }
    const hex = (v) => Math.round(v).toString(16).padStart(2, '0');
    const list = [...bins.values()].sort((a, b) => b.s - a.s).slice(0, 3).map((e) => '#' + hex(e.r / e.n) + hex(e.g / e.n) + hex(e.b / e.n));
    return list.length ? list : ['#ffffff', '#ffe08a', '#9fd4ff'];
  }

  /** Imagem gerada → canvas oficial (WebP com alpha) + paleta + cobertura. */
  async function processImage(gen, cat) {
    const src = await loadImage(`data:${gen.mime};base64,${gen.data}`);
    const { w: W, h: H } = CANVAS[cat];
    const tmp = document.createElement('canvas');
    tmp.width = src.naturalWidth; tmp.height = src.naturalHeight;
    const tctx = tmp.getContext('2d', { willReadFrequently: true });
    tctx.drawImage(src, 0, 0);
    const raw = tctx.getImageData(0, 0, tmp.width, tmp.height);
    if (gen.keyed) chromaKey(raw);
    tctx.putImageData(raw, 0, 0);
    const bb = alphaBounds(raw);
    if (!bb) throw new Error('A imagem gerada veio vazia depois de remover o fundo.');

    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const ctx = out.getContext('2d', { willReadFrequently: true });
    if (cat === 'decorations') {
      // mantém o centro da imagem no centro do avatar; escala pelo maior lado ocupado
      const cx = tmp.width / 2, cy = tmp.height / 2;
      const half = Math.max(cx - bb.x, bb.x + bb.w - cx, cy - bb.y, bb.y + bb.h - cy);
      ctx.drawImage(tmp, cx - half, cy - half, half * 2, half * 2, 0, 0, W, H);
    } else if (cat === 'nameplates') {
      // faixa central: encaixa a altura ocupada em 84 px e alinha à direita
      const s = Math.min(H / bb.h, W / bb.w);
      const dw = bb.w * s, dh = bb.h * s;
      ctx.drawImage(tmp, bb.x, bb.y, bb.w, bb.h, W - dw - 6, (H - dh) / 2, dw, dh);
    } else {
      // effect / frame: preenche o canvas inteiro (cover), centralizado
      const s = Math.max(W / tmp.width, H / tmp.height);
      const dw = tmp.width * s, dh = tmp.height * s;
      ctx.drawImage(tmp, (W - dw) / 2, cat === 'frames' ? 0 : (H - dh) / 2, dw, dh);
    }
    protectZones(ctx, cat, W, H);
    const palette = paletteOf(ctx, W, H);
    let url = out.toDataURL('image/webp', 0.86);
    if (!/^data:image\/webp/.test(url)) url = out.toDataURL('image/png');
    return { url, palette, W, H };
  }

  /* ---------------------------------------------------------------- */
  /* SVG animado com a ilustração embutida                             */
  /* ---------------------------------------------------------------- */
  const rnd = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const f = (n) => Math.round(n * 10) / 10;
  const star = (x, y, r) => `M${f(x)} ${f(y - r)}Q${f(x + r * 0.18)} ${f(y - r * 0.18)} ${f(x + r)} ${f(y)}Q${f(x + r * 0.18)} ${f(y + r * 0.18)} ${f(x)} ${f(y + r)}Q${f(x - r * 0.18)} ${f(y + r * 0.18)} ${f(x - r)} ${f(y)}Q${f(x - r * 0.18)} ${f(y - r * 0.18)} ${f(x)} ${f(y - r)}Z`;

  /** Pontos onde ficam as partículas (perto da arte, fora das zonas protegidas). */
  function sparklePoints(cat, W, H, n, R) {
    const pts = [];
    for (let i = 0; i < n * 6 && pts.length < n; i++) {
      let x, y;
      if (cat === 'decorations') { const a = R() * Math.PI * 2, r = 112 + R() * 26; x = 144 + Math.cos(a) * r; y = 144 + Math.sin(a) * r; }
      else if (cat === 'nameplates') { x = 230 + R() * 210; y = 10 + R() * 64; }
      else if (cat === 'frames') { const top = R() < 0.7; x = top ? 40 + R() * (W - 80) : (R() < 0.5 ? 20 + R() * 50 : W - 70 + R() * 50); y = top ? 20 + R() * 300 : 300 + R() * 380; }
      else { const side = R(); x = side < 0.35 ? 10 + R() * 60 : side < 0.7 ? W - 70 + R() * 60 : 30 + R() * (W - 60); y = side < 0.7 ? 40 + R() * (H - 140) : 20 + R() * 190; }
      if (cat === 'effects' && Math.hypot(x - 82, y - 138) < 80) continue;
      pts.push([x, y]);
    }
    return pts;
  }

  function buildSvgs(cat, art, seed) {
    const { url, palette, W, H } = art;
    const R = rnd(seed || 7);
    const n = { decorations: 10, nameplates: 7, effects: 16, frames: 14 }[cat];
    const pts = sparklePoints(cat, W, H, n, R);
    const sz = { decorations: 5, nameplates: 4, effects: 7, frames: 10 }[cat];
    const sparkles = pts.map(([x, y], i) => `<path class="s s${i % 4}" d="${star(x, y, sz * (0.6 + R() * 0.8))}" fill="${palette[i % palette.length]}"/>`).join('');
    const motes = cat === 'effects'
      ? pts.slice(0, 10).map(([x], i) => `<circle class="m m${i % 4}" cx="${f(x)}" cy="${f(H - 120 - R() * 200)}" r="${f(2 + R() * 3)}" fill="${palette[(i + 1) % palette.length]}"/>`).join('')
      : '';
    const shineW = Math.round(W * 0.28);
    const imgTag = (cls) => `<image class="${cls}" href="${url}" x="0" y="0" width="${W}" height="${H}"/>`;
    const sway = { decorations: 'scale(1.012)', nameplates: 'translateY(-1.5px)', effects: 'translateY(-5px)', frames: 'translateY(0)' }[cat];
    const css = `
mask{mask-type:alpha}
.art{transform-box:view-box;transform-origin:50% 50%;animation:breathe 4s ease-in-out infinite}
.glow{filter:url(#blur);opacity:0;mix-blend-mode:screen;animation:glow 4s ease-in-out infinite}
.shine{animation:shine 4s cubic-bezier(.45,0,.25,1) infinite}
.s{transform-box:fill-box;transform-origin:center;opacity:0;animation:tw 2s ease-in-out infinite}
.s1{animation-delay:.5s}.s2{animation-delay:1s}.s3{animation-delay:1.5s}
.m{opacity:0;animation:rise 4s ease-in infinite}.m1{animation-delay:1s}.m2{animation-delay:2s}.m3{animation-delay:3s}
@keyframes breathe{50%{transform:${sway}}}
@keyframes glow{50%{opacity:.45}}
@keyframes shine{0%{transform:translateX(-${shineW * 2}px)}55%,100%{transform:translateX(${W + shineW}px)}}
@keyframes tw{0%,100%{opacity:0;transform:scale(.3) rotate(0)}50%{opacity:1;transform:scale(1) rotate(45deg)}}
@keyframes rise{0%{opacity:0;transform:translateY(0)}20%{opacity:.9}100%{opacity:0;transform:translateY(-${Math.round(H * 0.35)}px)}}`;
    const defs = `<defs><filter id="blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${cat === 'frames' ? 8 : 4}"/></filter>
<linearGradient id="sg" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="am" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><image href="${url}" x="0" y="0" width="${W}" height="${H}"/></mask></defs>`;
    const shine = `<g mask="url(#am)"><rect class="shine" x="0" y="0" width="${shineW}" height="${H}" fill="url(#sg)" transform="skewX(-20)"/></g>`;
    const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">`;
    const loop = `${head}<style>${css}</style>${defs}<g class="art">${imgTag('glow')}${imgTag('')}${shine}</g>${motes}${sparkles}</svg>`;
    if (cat !== 'effects') return { svg: loop, loopSeconds: 4 };

    // Entrada (3 s): a arte surge de cima para baixo com brilho, partículas estourando
    const icss = `
mask{mask-type:alpha}
.rv{animation:rv 1.6s cubic-bezier(.2,.8,.2,1) both}
.in{transform-box:view-box;transform-origin:50% 20%;animation:pop 1.8s cubic-bezier(.2,.9,.3,1.2) both}
.fl{opacity:0;mix-blend-mode:screen;filter:url(#blur);animation:fl 3s ease-out both}
.s{transform-box:fill-box;transform-origin:center;opacity:0;animation:burst 1.4s ease-out both}
${pts.map((_, i) => `.b${i}{animation-delay:${f(0.4 + (i % 8) * 0.12)}s}`).join('')}
@keyframes rv{from{height:0}to{height:${H}px}}
@keyframes pop{from{transform:scale(1.08);opacity:0}60%{opacity:1}to{transform:scale(1);opacity:1}}
@keyframes fl{0%{opacity:0}25%{opacity:.9}100%{opacity:0}}
@keyframes burst{0%{opacity:0;transform:scale(0)}40%{opacity:1;transform:scale(1.4) rotate(45deg)}100%{opacity:0;transform:scale(.4) rotate(90deg)}}`;
    const isparks = pts.map(([x, y], i) => `<path class="s b${i}" d="${star(x, y, sz * 1.2)}" fill="${palette[i % palette.length]}"/>`).join('');
    const intro = `${head}<style>${icss}</style>${defs.replace('</defs>', `<clipPath id="rc"><rect class="rv" x="0" y="0" width="${W}" height="${H}"/></clipPath></defs>`)}<g clip-path="url(#rc)"><g class="in">${imgTag('fl')}${imgTag('')}</g></g>${isparks}</svg>`;
    return { svg: loop, loopSeconds: 4, introSvg: intro, introSeconds: 3 };
  }

  /* ---------------------------------------------------------------- */
  /* API pública                                                       */
  /* ---------------------------------------------------------------- */
  const NAME_WORD = { nameplates: 'Placa', decorations: 'Aura', effects: 'Efeito', frames: 'Moldura' };
  function metaFor(cat, theme) {
    const STOP = new Set(['com', 'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos', 'para', 'por', 'uma', 'um', 'uns', 'umas', 'que', 'and', 'the', 'with', 'of', 'sobre', 'entre', 'seu', 'sua', 'muito', 'mais']);
    const words = theme.replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w.toLowerCase()));
    const pick = words.slice(0, 3).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    return {
      name: (pick ? `${NAME_WORD[cat]} ${pick}` : NAME_WORD[cat] + ' Ilustrada').slice(0, 28),
      description: theme.slice(0, 150),
      rarity: 'Lendário',
      tags: ['ilustração', ...words.slice(0, 4).map((w) => w.toLowerCase())],
    };
  }

  /**
   * Gera uma ilustração por categoria.
   * @param {{prompt:string, cats:string[]}} req
   * @param {{provider:string, key:string, model:string, baseUrl:string}} cfg
   * @param {{refs?:Array<{mime:string,data:string}>, onProgress?:(msg:string)=>void}} opts
   * @returns {Promise<Array<{cat:string, raw:object, quality:object}>>}
   */
  async function generate(req, cfg, opts = {}) {
    const provider = cfg.provider === 'openai' ? 'openai' : cfg.provider === 'gemini' ? 'gemini' : null;
    if (!provider) throw new Error('O modo Ilustração usa modelos de imagem: escolha Google Gemini ou OpenAI.');
    const theme = req.prompt || 'tema livre, item premium';
    let done = 0;
    const tick = () => opts.onProgress && opts.onProgress(`Pintando as ilustrações… ${done}/${req.cats.length}`);
    tick();
    const results = await Promise.all(req.cats.map(async (cat, i) => {
      try {
        const gen = provider === 'gemini'
          ? await geminiImage(cat, theme, cfg, (opts.refs && opts.refs[cat]) || [])
          : await openaiImage(cat, theme, cfg);
        const art = await processImage(gen, cat);
        const anim = buildSvgs(cat, art, 1 + i * 97 + theme.length);
        const label = (provider === 'gemini' ? 'Gemini · ' : 'OpenAI · ') + gen.model;
        return {
          cat,
          raw: { ...metaFor(cat, theme), ...(gen.name ? { name: gen.name.slice(0, 28) } : {}), prompt: theme, engine: provider, engineLabel: label, asset: { type: 'svg', ...anim } },
          quality: { ok: true, issues: [], summary: '✓ ilustração · zonas protegidas por máscara' },
          palette: art.palette,
        };
      } catch (e) {
        return { cat, error: e };
      } finally {
        done++; tick();
      }
    }));
    const ok = results.filter((r) => !r.error);
    if (!ok.length) throw results[0].error;
    results.filter((r) => r.error).forEach((r) => console.warn('[Ilustração]', r.cat, r.error));
    if (ok.length < results.length) ok.failed = results.filter((r) => r.error).map((r) => `${CAT_WORD[r.cat]}: ${r.error.message}`);
    return ok;
  }

  window.CosmeticIllustration = { generate, processImage, buildSvgs, chromaKey, promptFor, geminiImageModel, openaiImageModel, CANVAS };
})();
