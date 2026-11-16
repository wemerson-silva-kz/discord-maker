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
    frames: { w: 1312, h: 2528 }, // em volta do card: card 1200 px, 304 por cima, 212 por baixo, 56 dos lados
  };
  /* Proporção pedida a cada provedor. */
  const ASPECT = {
    nameplates: { gemini: '21:9', openai: '1536x1024' },
    decorations: { gemini: '1:1', openai: '1024x1024' },
    effects: { gemini: '9:16', openai: '1024x1536' },
    frames: { gemini: '9:16', openai: '1024x1536' },
  };

  const STYLE = 'Polished 2D game cosmetic illustration in the style of official Discord shop items: clean cel shading with 2-3 tones per color, crisp smooth edges, soft rim light, a short harmonious palette (one dominant color, one support, one accent), bright and readable at small size, a few big well-drawn shapes rather than clutter. No text, no letters, no numbers, no logos, no watermark, no UI elements, no photo realism, no 3D render look.';

  const LAYOUT = {
    decorations: 'FORMAT: square avatar decoration. The artwork is a decorative ring that wraps around an EMPTY CIRCULAR HOLE in the exact center of the image; the hole diameter is about 72% of the image width and must contain only background. Place the main ornament on the top or a top corner of the ring and smaller accents around the rest so it feels balanced. The art hugs the hole edge and stays inside the image borders.',
    nameplates: 'FORMAT: very wide horizontal banner ornament. All artwork must sit inside the central horizontal band (the middle 40% of the image height); everything above and below that band is plain background. The LEFT HALF of the image is completely empty background. The illustration grows in density toward the right end, with the main motif on the far right.',
    effects: 'FORMAT: tall vertical overlay effect for a profile card. Decorative elements run along the top quarter and down the left and right edges like a living border (e.g. flames, petals, clouds, vines, sparks). The middle of the image and the bottom third stay mostly empty background, with only a few small floating particles.',
    frames: 'FORMAT: tall ornamental frame that WRAPS AROUND a tall portrait profile card. Imagine an empty rounded rectangle (the card) occupying the middle of the image: from 4% to 96% of the width and from 12% to 92% of the height — it must stay empty background. The frame hugs the OUTSIDE of that rectangle: a rich main ornament sits on and above the TOP edge (it can overhang the card top slightly), a smaller ornament on and below the BOTTOM edge, and slim decorative borders run down the left and right edges connecting them. Nothing inside the card area except the very edge.',
  };
  /* Frame gerado = uma camada "border" em volta do card: topo e base fixos, o meio estica. */
  const FRAME_WRAP = { inner: 1200, top: 304, bottom: 212, side: 56, layers: [{ kind: 'border', order: 'front', anchor: 'center', sliceTop: 304 + 560, sliceBottom: 212 + 420, imgW: 1312 }] };
  const CAT_WORD = { nameplates: 'nameplate', decorations: 'avatar decoration', effects: 'profile effect', frames: 'profile frame' };

  /** Tira do tema pedidos de apresentação (sprite sheet, kit, mockup…) que fazem o modelo desenhar vários itens. */
  function cleanTheme(theme) {
    const t = String(theme || '')
      .replace(/\b(professional|high[- ]quality|premium)\b/gi, '')
      .replace(/\b(game\s+)?ui\s+assets?\b/gi, '')
      .replace(/\b(sprite\s*sheets?|spritesheets?|asset\s*sheets?|mock-?ups?|presentation|showcase|bundles?|kits?|sets?|collections?|several items|multiple items)\b/gi, '')
      .replace(/\b(for user profiles?|displaying( a)?( cosmetic)?|cosmetics?)\b/gi, '')
      .replace(/\b(folha de sprites?|kit|conjunto|cole[cç][aã]o|v[aá]rios itens|apresenta[cç][aã]o)\b/gi, '')
      .replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').replace(/^[\s,.;:-]+|[\s,;:-]+$/g, '').trim();
    return t || String(theme || '').trim();
  }

  function promptFor(cat, theme, provider, hasRefs) {
    theme = cleanTheme(theme).replace(/[\s.]+$/, '');
    const bg = provider === 'gemini'
      ? 'BACKGROUND: perfectly flat solid pure green (#00FF00) everywhere outside the artwork — including any empty hole in the middle — with no gradient, texture, shadow, vignette or white margin. Do not use any green-screen green inside the artwork itself (if the theme needs green, use jade, emerald or teal tones that are clearly darker or bluer).'
      : 'BACKGROUND: fully transparent.';
    return [
      `Create ONE single Discord ${CAT_WORD[cat]} with this theme: ${theme}.`,
      `Draw ONLY this one ${CAT_WORD[cat]}, centered and filling the format below. Even if the theme mentions a sprite sheet, bundle, kit, set, collection, mockup or several items, ignore that: no grid, no multiple objects side by side, no labels, no presentation board.`,
      LAYOUT[cat],
      STYLE,
      bg,
      'Also reply with one short line of text: NOME: <a creative item name in Brazilian Portuguese, 2 to 4 words>.',
      hasRefs ? 'The attached image is only an inspiration for colors and mood. Do NOT copy it and do NOT place it in the result.' : '',
      'The output must be ONE image containing ONE object. No numbers, no captions, no panels, no grid.',
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
        if (res.status === 429) {
          const det = ((data && data.error && data.error.details) || []).find((x) => x && x.retryDelay);
          const err = new Error('Limite do Gemini atingido (modelos de imagem têm cota menor). Aguarde um pouco.');
          err.retryAfter = det ? Math.min(60, parseFloat(det.retryDelay) || 20) : 20;
          throw err;
        }
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
    if (!res.ok) {
      const err = new Error('OpenAI: ' + ((data && data.error && data.error.message) || 'HTTP ' + res.status));
      if (res.status === 429) err.retryAfter = Math.min(60, +res.headers.get('retry-after') || 20);
      throw err;
    }
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

  /**
   * Remove o fundo chapado, seja qual for a cor (verde pedido, branco, cinza…):
   * descobre a cor pela borda da imagem, marca as regiões dessa cor que tocam a
   * borda OU são grandes (ex.: o furo do meio da moldura) e suaviza o contorno.
   */
  function removeBackground(img) {
    const { width: w, height: h, data: d } = img;
    // Já transparente (OpenAI): nada a remover
    let clear = 0, tot = 0;
    for (let x = 0; x < w; x += 4) { tot += 2; if (d[x * 4 + 3] < 16) clear++; if (d[((h - 1) * w + x) * 4 + 3] < 16) clear++; }
    if (clear > tot * 0.6) return;
    // Cor do fundo: amostra a borda E o centro (nos formatos o centro deve ficar vazio).
    // A arte pode encostar nas bordas (frame), então: verde-chroma se aparecer; senão a cor mais frequente.
    const bins = new Map();
    let green = 0, total = 0;
    const sample = (x, y) => {
      const i = (y * w + x) * 4;
      if (d[i + 3] < 16) return;
      total++;
      if (d[i + 1] > 150 && d[i + 1] - Math.max(d[i], d[i + 2]) > 80) green++;
      const k = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
      const e = bins.get(k) || [0, 0, 0, 0];
      e[0]++; e[1] += d[i]; e[2] += d[i + 1]; e[3] += d[i + 2];
      bins.set(k, e);
    };
    for (let x = 0; x < w; x += 2) { sample(x, 0); sample(x, h - 1); }
    for (let y = 0; y < h; y += 2) { sample(0, y); sample(w - 1, y); }
    for (let y = Math.round(h * 0.45); y < h * 0.55; y += 3) for (let x = Math.round(w * 0.4); x < w * 0.6; x += 3) sample(x, y);
    if (!total) return;
    const isGreen = green > total * 0.08;
    let best = null;
    for (const e of bins.values()) if (!best || e[0] > best[0]) best = e;
    const bg = isGreen ? [0, 255, 0] : [best[1] / best[0], best[2] / best[0], best[3] / best[0]];
    const dist = (i) => {
      if (isGreen) { const sp = d[i + 1] - Math.max(d[i], d[i + 2]); return sp > 60 ? 0 : 140 - sp; }
      return Math.hypot(d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2]);
    };
    const T = isGreen ? 70 : 34; // "é fundo" abaixo disto
    const n = w * h;
    const lab = new Int32Array(n).fill(-1); // -1 não visitado; 0 arte; >0 componente de fundo
    const sizes = [0], touches = [false];
    const stack = new Int32Array(n);
    for (let start = 0; start < n; start++) {
      if (lab[start] !== -1) continue;
      if (dist(start * 4) >= T) { lab[start] = 0; continue; }
      const id = sizes.length; sizes.push(0); touches.push(false);
      let sp = 0; stack[sp++] = start; lab[start] = id;
      while (sp) {
        const p = stack[--sp]; sizes[id]++;
        const x = p % w, y = (p / w) | 0;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touches[id] = true;
        const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
        for (const q of nb) {
          if (q < 0 || lab[q] !== -1) continue;
          if (dist(q * 4) < T) { lab[q] = id; stack[sp++] = q; }
        }
      }
    }
    const minArea = n * 0.004;
    const kill = sizes.map((sz, id) => id > 0 && (touches[id] || sz > minArea));
    // alpha: fundo some; pixels vizinhos ao fundo ganham alpha proporcional à distância de cor
    for (let p = 0; p < n; p++) {
      const i = p * 4;
      if (kill[lab[p]]) { d[i + 3] = 0; continue; }
      const x = p % w, y = (p / w) | 0;
      const nearBg = (x > 0 && kill[lab[p - 1]]) || (x < w - 1 && kill[lab[p + 1]]) || (y > 0 && kill[lab[p - w]]) || (y < h - 1 && kill[lab[p + w]]);
      if (nearBg) {
        const a = smooth(T * 0.6, T * 2.2, dist(i));
        d[i + 3] = Math.round(d[i + 3] * a);
      }
      if (isGreen) { const spill = d[i + 1] - Math.max(d[i], d[i + 2]); if (spill > 20) d[i + 1] = Math.max(d[i], d[i + 2]) + 20; }
    }
  }

  /** (legado) Remove o fundo verde (#00FF00) com borda suave. */
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
        // card em (56, 304)–(1256, 2316): o miolo fica livre; o ornamento pode invadir a borda
        // (até ~180 px no topo, sobre o banner, ~110 na base e ~90 dos lados)
        const inX = smooth(56 + 60, 56 + 110, x) * smooth(56 + 60, 56 + 110, W - x);
        const inY = smooth(304 + 130, 304 + 200, y) * smooth(212 + 60, 212 + 120, H - y);
        k = 1 - inX * inY;
        // avatar (card: centro 290,487 raio ~235)
        k = Math.min(k, smooth(225, 260, Math.hypot(x - (56 + 290), y - (304 + 487))) + (1 - inX * inY) * 0);
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
    removeBackground(raw);
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
    const enc = (c) => { const u = c.toDataURL('image/webp', 0.86); return /^data:image\/webp/.test(u) ? u : c.toDataURL('image/png'); };
    // Camada de brilhos: só as partes claras e saturadas (fogo, runas, joias, magia) — elas vão pulsar e tremeluzir
    const hl = document.createElement('canvas');
    hl.width = W; hl.height = H;
    const hctx = hl.getContext('2d');
    const src2 = ctx.getImageData(0, 0, W, H);
    const hd = hctx.createImageData(W, H);
    let lit = 0;
    for (let i = 0; i < src2.data.length; i += 4) {
      const r = src2.data[i], g = src2.data[i + 1], b = src2.data[i + 2], a = src2.data[i + 3];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const k = smooth(0.62, 0.92, mx / 255) * (0.35 + 0.65 * smooth(0.15, 0.6, mx ? (mx - mn) / mx : 0));
      if (k <= 0.02 || a < 10) continue;
      hd.data[i] = r; hd.data[i + 1] = g; hd.data[i + 2] = b; hd.data[i + 3] = Math.round(a * k);
      lit++;
    }
    hctx.putImageData(hd, 0, 0);
    return { url: enc(out), hl: lit > (W * H) * 0.002 ? enc(hl) : '', palette, W, H };
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
      else if (cat === 'frames') { const z = R(); if (z < 0.45) { x = 40 + R() * (W - 80); y = 20 + R() * 420; } else if (z < 0.65) { x = 40 + R() * (W - 80); y = H - 300 + R() * 260; } else { x = R() < 0.5 ? 10 + R() * 120 : W - 130 + R() * 120; y = 300 + R() * (H - 600); } }
      else { const side = R(); x = side < 0.35 ? 10 + R() * 60 : side < 0.7 ? W - 70 + R() * 60 : 30 + R() * (W - 60); y = side < 0.7 ? 40 + R() * (H - 140) : 20 + R() * 190; }
      if (cat === 'effects' && Math.hypot(x - 82, y - 138) < 80) continue;
      pts.push([x, y]);
    }
    return pts;
  }

  function buildSvgs(cat, art, seed, motion = {}) {
    const { url, hl, palette, W, H } = art;
    const preset = motion.preset || 'rise';
    const k = [0.6, 1, 1.6][(motion.intensity || 2) - 1] || 1;
    const R = rnd(seed || 7);
    const n = { decorations: 12, nameplates: 8, effects: 18, frames: 16 }[cat];
    const pts = sparklePoints(cat, W, H, n, R);
    const sz = { decorations: 5, nameplates: 4, effects: 7, frames: 10 }[cat];
    const sparkles = pts.map(([x, y], i) => `<path class="s s${i % 4}" d="${star(x, y, sz * (0.6 + R() * 0.8))}" fill="${palette[i % palette.length]}"/>`).join('');
    // brasas/partículas subindo a partir das áreas com arte (todas as categorias)
    const rise = { decorations: 60, nameplates: 30, effects: Math.round(H * 0.3), frames: 120 }[cat];
    const motes = sparklePoints(cat, W, H, cat === 'nameplates' ? 8 : 14, R).map(([x, y], i) => `<circle class="m m${i % 4}" cx="${f(x)}" cy="${f(y)}" r="${f((cat === 'frames' ? 3 : 1.6) + R() * (cat === 'frames' ? 4 : 2.2))}" fill="${palette[(i + 1) % palette.length]}"/>`).join('');
    const shineW = Math.round(W * 0.28);
    const sway = { decorations: 'scale(1.015)', nameplates: 'translateY(-1.5px)', effects: 'translateY(-5px)', frames: 'translateY(-2px)' }[cat];
    const dispScale = { decorations: 5, nameplates: 3, effects: 8, frames: 9 }[cat];
    const freq = { decorations: 0.035, nameplates: 0.05, effects: 0.025, frames: 0.018 }[cat];
    const defs = `<defs>
<image id="art" href="${url}" x="0" y="0" width="${W}" height="${H}"/>${hl ? `<image id="hl" href="${hl}" x="0" y="0" width="${W}" height="${H}"/>` : ''}
<filter id="blur" x="-15%" y="-15%" width="130%" height="130%"><feGaussianBlur stdDeviation="${cat === 'frames' ? 10 : 5}"/></filter>
${[1, 2, 3].map((k) => `<filter id="w${k}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="${k * 7}"/><feDisplacementMap in="SourceGraphic" scale="${dispScale}" xChannelSelector="R" yChannelSelector="G"/></filter>`).join('')}
<linearGradient id="sg" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="am" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><use href="#art"/></mask></defs>`;
    const css = `
mask{mask-type:alpha}
.art{transform-box:view-box;transform-origin:50% 50%;animation:breathe 4s ease-in-out infinite}
.glow{filter:url(#blur);mix-blend-mode:screen;opacity:.25;animation:glow 2s ease-in-out infinite}
.hl{mix-blend-mode:screen;animation:flick 1s steps(1) infinite,heat .5s steps(1) infinite}
.hlb{filter:url(#blur);mix-blend-mode:screen;opacity:.5;animation:glow 1s ease-in-out infinite}
.shine{animation:shine 4s cubic-bezier(.45,0,.25,1) infinite}
.s{transform-box:fill-box;transform-origin:center;opacity:0;animation:tw 2s ease-in-out infinite}
.s1{animation-delay:.5s}.s2{animation-delay:1s}.s3{animation-delay:1.5s}
.m{opacity:0;animation:rise 2s ease-in infinite}.m1{animation-delay:.5s}.m2{animation-delay:1s}.m3{animation-delay:1.5s}
@keyframes breathe{50%{transform:${sway}}}
@keyframes glow{0%,100%{opacity:.2}50%{opacity:.75}}
@keyframes flick{0%{opacity:.55}12%{opacity:1}25%{opacity:.7}37%{opacity:.95}50%{opacity:.6}62%{opacity:1}75%{opacity:.75}87%{opacity:.9}}
@keyframes heat{0%{filter:url(#w1)}33%{filter:url(#w2)}66%{filter:url(#w3)}}
@keyframes shine{0%{transform:translateX(-${shineW * 2}px)}55%,100%{transform:translateX(${W + shineW}px)}}
@keyframes tw{0%,100%{opacity:0;transform:scale(.3) rotate(0)}50%{opacity:1;transform:scale(1) rotate(45deg)}}
@keyframes rise{0%{opacity:0;transform:${({ rise: 'translateY(0)', fall: 'translateY(0)', drift: 'translateX(0)', orbit: 'rotate(0)', pulse: 'scale(.4)', sway: 'translate(0,0)', sweep: 'translateX(0)' })[preset]}}20%{opacity:1}100%{opacity:0;transform:${({ rise: `translateY(-${Math.round(rise * k)}px)`, fall: `translateY(${Math.round(rise * k)}px)`, drift: `translateX(${Math.round(rise * 1.4 * k)}px)`, orbit: `rotate(${Math.round(120 * k)}deg)`, pulse: `scale(${(1.6 * k).toFixed(2)})`, sway: `translate(${Math.round(12 * k)}px,-${Math.round(rise * 0.5 * k)}px)`, sweep: `translateX(${Math.round(rise * 1.4 * k)}px)` })[preset]}}}
.m{transform-box:${preset === 'orbit' ? 'view-box;transform-origin:50% 50%' : 'fill-box;transform-origin:center'}}
.glow{animation-duration:${preset === 'pulse' ? '1s' : '2s'}}
.shine{animation-duration:${preset === 'sweep' ? '2s' : '4s'}}`;
    const shine = `<g mask="url(#am)"><rect class="shine" x="0" y="0" width="${shineW}" height="${H}" fill="url(#sg)" transform="skewX(-20)"/></g>`;
    // Ondulação: a arte é fatiada em faixas horizontais que oscilam com fase defasada —
    // chamas, fumaça, tecido e energia parecem se mover de verdade.
    const N = { effects: 24, frames: 16, nameplates: 6, decorations: 14 }[cat];
    const A = { effects: 3.5, frames: 2.5, nameplates: 1.2, decorations: 1.8 }[cat] * k * (preset === 'sway' ? 1.8 : preset === 'pulse' || preset === 'sweep' ? 0.6 : 1);
    const sh = H / N;
    const clips = Array.from({ length: N }, (_, i) => `<clipPath id="c${i}"><rect x="-20" y="${f(i * sh - 0.6)}" width="${W + 40}" height="${f(sh + 1.2)}"/></clipPath>`).join('');
    const waveCss = Array.from({ length: 8 }, (_, k) => `.v${k}{animation-delay:-${f(k * 0.25)}s}`).join('');
    const body = Array.from({ length: N }, (_, i) => `<g clip-path="url(#c${i})"><use class="wv v${i % 8}" href="#full"/></g>`).join('');
    const up = { effects: 26, frames: 16, nameplates: 6, decorations: 10 }[cat] * k;
    const lick = cat === 'decorations' || preset === 'pulse' || preset === 'orbit' ? `scale(${(1 + 0.07 * k).toFixed(3)})`
      : preset === 'fall' ? `translateY(${f(up * 0.6)}px)`
        : preset === 'drift' || preset === 'sweep' ? `translateX(${f(up)}px)`
          : `translateY(-${f(up)}px)${cat === 'effects' ? ' scaleY(1.1)' : ''}`;
    const licks = hl ? `<use class="lk" href="#hl"/><use class="lk lk2" href="#hl"/><use class="hlb" href="#hl"/>` : '';
    const lights = '';
    const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">`;
    const fullDef = `<g id="full"><use href="#art"/>${hl ? '<use class="hl" href="#hl"/>' : ''}</g>`;
    const css2 = css.replace(',heat .5s steps(1) infinite', '') + `
.wv{animation:wave 2s ease-in-out infinite}${waveCss}
@keyframes wave{0%,100%{transform:translateX(-${A}px)}50%{transform:translateX(${A}px)}}
.lk{transform-box:view-box;transform-origin:50% ${cat === 'decorations' ? '50%' : '100%'};mix-blend-mode:screen;opacity:0;animation:lick 1s ease-out infinite}.lk2{animation-delay:-.5s}
@keyframes lick{0%{opacity:.7;transform:none}100%{opacity:0;transform:${lick}}}`;
    if (cat !== 'effects') {
      const loop = `${head}<style>${css2}</style>${defs.replace('</defs>', clips + fullDef + '</defs>')}<g class="art"><use class="glow" href="#art"/>${body}${licks}${shine}</g>${motes}${sparkles}</svg>`;
      return { svg: loop, loopSeconds: 4 };
    }

    /* ---- EFEITO ----
       Loop: versão leve — só topo (banner) e laterais finas, levemente translúcida, com ondulação,
       brasas e poucos brilhos. O meio do card fica livre.
       Entrada: o momento de impacto — clarão, onda de choque, a arte inteira entra com zoom e foco,
       faísca explodindo do centro, faixa de luz, e no fim o miolo some e sobra o visual do loop. */
    const edge = `<mask id="lm" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
<linearGradient id="gt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".72" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="gl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="gr" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".75" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<rect x="0" y="0" width="${W}" height="250" fill="url(#gt)"/>
<g mask="url(#lb)"><rect x="0" y="0" width="70" height="${H}" fill="url(#gl)"/><rect x="${W - 70}" y="0" width="70" height="${H}" fill="url(#gr)"/></g></mask>
<mask id="lb" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect x="0" y="0" width="${W}" height="${Math.round(H * 0.8)}" fill="url(#gb)"/></mask>`;
    const fewSparks = sparkles.split('</path>').length > 1 ? pts.filter(([x, y]) => y < 240 || x < 75 || x > W - 75).slice(0, 8).map(([x, y], i) => `<path class="s s${i % 4}" d="${star(x, y, sz * 0.8)}" fill="${palette[i % palette.length]}"/>`).join('') : '';
    const fewMotes = sparklePoints(cat, W, H, 8, R).filter(([x, y]) => y < 240 || x < 75 || x > W - 75).map(([x, y], i) => `<circle class="m m${i % 4}" cx="${f(x)}" cy="${f(y)}" r="${f(1.6 + R() * 2)}" fill="${palette[(i + 1) % palette.length]}"/>`).join('');
    const loopDefs = defs.replace('</defs>', clips + fullDef + edge + '</defs>');
    const loop = `${head}<style>${css2}
.lite{opacity:.88}</style>${loopDefs}<g class="lite" mask="url(#lm)"><g class="art"><use class="glow" href="#art"/>${body}${licks}</g></g>${fewMotes}${fewSparks}</svg>`;

    const cx = W / 2, cy = 300;
    const T = 3.6; // duração da entrada
    const burst = pts.map(([x, y], i) => {
      const dx = f(cx - x), dy = f(cy - y);
      return `@keyframes k${i}{0%{opacity:0;transform:translate(${dx}px,${dy}px) scale(.2)}15%{opacity:1}70%{opacity:1;transform:translate(0,0) scale(1.3) rotate(90deg)}100%{opacity:0;transform:translate(0,0) scale(.5) rotate(180deg)}}.b${i}{animation:k${i} 1.5s cubic-bezier(.15,.8,.3,1) ${f(0.25 + (i % 6) * 0.05)}s both}`;
    }).join('\n');
    const icss = `
mask{mask-type:alpha}
.flash{transform-box:fill-box;transform-origin:center;animation:flash .9s ease-out both}
.ring{transform-box:fill-box;transform-origin:center;fill:none;animation:ring 1.1s cubic-bezier(.1,.7,.3,1) .1s both}
.ring2{animation-delay:.35s}
.in{transform-box:view-box;transform-origin:50% 34%;animation:zoom 1.3s cubic-bezier(.16,1,.3,1) .15s both}
.full{animation:out .9s ease-in ${f(T - 1.1)}s both}
.edge{opacity:0;animation:inn .9s ease-out ${f(T - 1.1)}s both}
.fl{mix-blend-mode:screen;filter:url(#blur);opacity:0;animation:fl 1.6s ease-out .2s both}
.hl{mix-blend-mode:screen;animation:flick 1s steps(1) infinite,heat .5s steps(1) infinite}
.sw{animation:sw 1.1s cubic-bezier(.45,0,.25,1) 1.1s both}
.s{transform-box:fill-box;transform-origin:center;opacity:0}
${burst}
@keyframes flash{0%{opacity:0;transform:scale(.1)}12%{opacity:1}100%{opacity:0;transform:scale(5)}}
@keyframes ring{0%{opacity:1;stroke-width:14;transform:scale(.1)}100%{opacity:0;stroke-width:1;transform:scale(4.5)}}
@keyframes zoom{0%{opacity:0;transform:scale(1.35) rotate(-2deg);filter:blur(10px) brightness(2.2)}55%{opacity:1;filter:blur(0) brightness(1.4)}100%{opacity:1;transform:none;filter:none}}
@keyframes fl{0%{opacity:0}20%{opacity:1}100%{opacity:0}}
@keyframes out{to{opacity:0}}
@keyframes inn{to{opacity:.88}}
@keyframes sw{0%{transform:translateX(-${Math.round(W * 0.6)}px)}100%{transform:translateX(${W + 40}px)}}
@keyframes flick{0%{opacity:.55}25%{opacity:1}50%{opacity:.65}75%{opacity:.95}}
@keyframes heat{0%{filter:url(#w1)}33%{filter:url(#w2)}66%{filter:url(#w3)}}`;
    const isparks = pts.map(([x, y], i) => `<path class="s b${i}" d="${star(x, y, sz * 1.4)}" fill="${palette[i % palette.length]}"/>`).join('');
    const c0 = palette[0] || '#fff';
    const intro = `${head}<style>${icss}</style>${defs.replace('</defs>', edge + '</defs>')}
<circle class="flash" cx="${cx}" cy="${cy}" r="70" fill="${c0}" opacity="0" filter="url(#blur)"/>
<g class="in"><g class="full"><use class="fl" href="#art"/><use href="#art"/>${hl ? '<use class="hl" href="#hl"/>' : ''}<g mask="url(#am)"><rect class="sw" x="0" y="0" width="${Math.round(W * 0.35)}" height="${H}" fill="url(#sg)" transform="skewX(-20)"/></g></g>
<g class="edge" mask="url(#lm)"><use href="#art"/></g></g>
<circle class="ring" cx="${cx}" cy="${cy}" r="60" stroke="${c0}"/><circle class="ring ring2" cx="${cx}" cy="${cy}" r="60" stroke="${palette[1] || '#fff'}"/>
${isparks}</svg>`;
    return { svg: loop, loopSeconds: 4, introSvg: intro, introSeconds: T };
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
    const theme = cleanTheme(req.prompt) || 'tema livre, item premium';
    let done = 0;
    const tick = () => opts.onProgress && opts.onProgress(`Pintando as ilustrações… ${done}/${req.cats.length}`);
    tick();
    const results = [];
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    // Uma por vez: modelos de imagem têm cota por minuto baixa (em paralelo, metade voltava 429)
    for (const [i, cat] of req.cats.entries()) results.push(await (async () => {
      try {
        let gen = null;
        for (let attempt = 0; ; attempt++) {
          try {
            const detail = req.details && req.details[cat] ? cleanTheme(req.details[cat]) : '';
            const catTheme = detail ? `${detail}. General theme and art style: ${theme}` : theme;
            gen = provider === 'gemini'
              ? await geminiImage(cat, catTheme, cfg, (opts.refs && opts.refs[cat]) || [])
              : await openaiImage(cat, catTheme, cfg);
            break;
          } catch (e) {
            if (!e.retryAfter || attempt >= 2) throw e;
            for (let t = Math.ceil(e.retryAfter); t > 0; t--) {
              opts.onProgress && opts.onProgress(`Limite do provedor: tentando de novo em ${t} s… (${done}/${req.cats.length})`);
              await sleep(1000);
            }
          }
        }
        const art = await processImage(gen, cat);
        const anim = buildSvgs(cat, art, 1 + i * 97 + theme.length, (opts.motion && opts.motion[cat]) || {});
        const label = (provider === 'gemini' ? 'Gemini · ' : 'OpenAI · ') + gen.model;
        return {
          cat,
          raw: { ...metaFor(cat, (req.details && req.details[cat]) || theme),
            ...(gen.name ? { name: gen.name.slice(0, 28) } : {}), prompt: theme, engine: provider, engineLabel: label, asset: { type: 'svg', ...anim, ...(cat === 'frames' ? { wrap: FRAME_WRAP } : {}) } },
          quality: { ok: true, issues: [], summary: '✓ ilustração · zonas protegidas por máscara' },
          palette: art.palette,
        };
      } catch (e) {
        return { cat, error: e };
      } finally {
        done++; tick();
      }
    })());
    const ok = results.filter((r) => !r.error);
    if (!ok.length) throw results[0].error;
    results.filter((r) => r.error).forEach((r) => console.warn('[Ilustração]', r.cat, r.error));
    if (ok.length < results.length) ok.failed = results.filter((r) => r.error).map((r) => `${CAT_WORD[r.cat]}: ${r.error.message}`);
    return ok;
  }

  window.CosmeticIllustration = { cleanTheme, generate, processImage, buildSvgs, chromaKey, removeBackground, promptFor, geminiImageModel, openaiImageModel, CANVAS };
})();
