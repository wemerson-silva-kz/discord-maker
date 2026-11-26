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
  const DEFAULT_GEMINI_IMAGE = 'gemini-3.1-flash-image';
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
    decorations: 'FORMAT: square avatar decoration. The avatar is a circle in the exact center whose diameter is 83% of the image width; the artwork sits AROUND it, hugging its edge from the outside, and only small parts (a paw, a leaf, a horn tip) may overlap the avatar edge — the avatar itself stays clear background. The ring is NOT a solid band: leave about a quarter of the way around empty, with a few big well-drawn elements instead of a continuous wreath. Put the main ornament on the top or a top corner, more weight on the top and the sides than on the bottom. Everything stays inside the image borders.',
    nameplates: 'FORMAT: very wide horizontal banner ornament. All artwork must sit inside the central horizontal band (the middle 40% of the image height); everything above and below that band is plain background. The LEFT HALF of the image is completely empty background. The illustration grows in density toward the right end, with the main motif on the far right.',
    effects: 'FORMAT: tall vertical overlay effect for a profile card, like the official Discord profile effects. The scene lives in the TOP HALF: it is densest across the very top (the banner area, top 25% of the height) and spills down to about 55% of the height, getting lighter as it goes down (e.g. garlands, bunting, fireworks, flames, petals, clouds hanging from the top). The bottom 40% of the image is empty background, with at most a few tiny floating particles. Keep the small circle near the top-left corner (centered at about 18% of the width and 16% of the height, the avatar) mostly clear. Do not draw any circle, frame or dark shape behind the avatar area. No thick columns down the sides.',
    frames: 'FORMAT: tall ornamental frame that WRAPS AROUND a tall portrait profile card, like the official Discord profile frames. Imagine an empty rounded rectangle (the card) from 4.3% to 95.7% of the width and from 12% to 91.5% of the height — it must stay empty background. The frame lives OUTSIDE that rectangle: (1) a rich CROWN spans the whole width above the card, filling the top 12% of the image, and dips only slightly (about 2% of the height) over the card top edge; (2) a smaller BASE ornament sits along the bottom edge and rises only slightly over the card; (3) the left and right sides are either empty or a SLIM border about 4% of the image width thick, half of it outside the card; elements may spill partway down the sides from the crown. Proven layouts of the official frames: a creature or character peeking over the top with paws, legs or a tail along the bottom; flowers, leaves, crystals, clouds or flames clustered along the top and bottom edges; a thin elegant border with a main ornament centered at the top. Nothing inside the card area except the very edge. No thick columns or pillars.',
  };
  /* Acima disto (fração do canvas coberta) a arte é uma cena cheia, não elementos soltos. */
  const FULL_LIMIT = { effects: 0.42, decorations: 0.6, nameplates: 0.75, frames: 0.5 };
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

  const STRICT = 'IMPORTANT: the previous attempt painted a full scene that filled the whole image. Draw ONLY the isolated decorative elements described above, with NO scenery, NO texture and NO backdrop behind them; most of the image must be plain flat background.';
  function promptFor(cat, theme, provider, hasRefs, strict, fromMedia) {
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
      strict ? STRICT : '',
      fromMedia ? 'The attached image is the SOURCE ARTWORK chosen by the user. Recreate it as this format: keep exactly its art style, line work, shading, colors, subject and elements (e.g. the same moon, the same waves, the same clouds), only re-composed to fit the format above. It must clearly look like the same artwork.'
        : hasRefs ? 'The attached image is only an inspiration for colors and mood. Do NOT copy it and do NOT place it in the result.' : '',
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

  async function geminiImage(cat, theme, cfg, refs, strict, fromMedia) {
    const model = geminiImageModel(cfg.model);
    const url = `${(cfg.baseUrl || GEMINI_BASE).replace(/\/+$/, '')}/models/${encodeURIComponent(model)}:generateContent`;
    const parts = [{ text: promptFor(cat, theme, 'gemini', refs.length > 0, strict, fromMedia && refs.length > 0) }, ...refs.map((r) => ({ inlineData: { mimeType: r.mime, data: r.data } }))];
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

  async function openaiImage(cat, theme, cfg, strict) {
    const model = openaiImageModel(cfg.model);
    const base = (cfg.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    let res;
    try {
      res = await fetch(base + '/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.key },
        body: JSON.stringify({ model, prompt: promptFor(cat, theme, 'openai', false, strict), size: ASPECT[cat].openai, background: 'transparent', quality: 'high', n: 1, output_format: 'png' }),
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

  /* ---- Outras IAs com modelo de imagem ---- */
  const IMG_PROXY = (u) => `https://wsrv.nl/?url=${encodeURIComponent(u)}&output=png`;
  /** URL de imagem → base64 (tenta direto; sem CORS, usa um proxy de imagens). */
  async function urlToB64(u) {
    if (/^data:/.test(u)) { const [h, d] = u.split(','); return { mime: (h.match(/data:([^;]+)/) || [])[1] || 'image/png', data: d }; }
    let blob = null;
    try { const r = await fetch(u); if (r.ok) blob = await r.blob(); } catch (e) { /* sem CORS */ }
    if (!blob) { const r = await fetch(IMG_PROXY(u)); if (!r.ok) throw new Error('Não deu para baixar a imagem gerada.'); blob = await r.blob(); }
    const data = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
    return { mime: blob.type || 'image/png', data };
  }
  /** Qual API de imagem usar para esta configuração. */
  function imageApi(cfg) {
    if (cfg.provider === 'gemini') return 'gemini';
    if (cfg.provider === 'openai') return 'openai';
    if (/aliyuncs\.com|dashscope/i.test(cfg.baseUrl || '')) return 'dashscope';
    if (cfg.provider === 'openrouter' || /openrouter\.ai/i.test(cfg.baseUrl || '')) return 'chat-image';
    return 'images-api';
  }
  const API_LABEL = { gemini: 'Gemini', openai: 'OpenAI', dashscope: 'Alibaba', 'chat-image': 'OpenRouter', 'images-api': 'IA' };
  const DASH_SIZE = { nameplates: '1664*928', decorations: '1328*1328', effects: '928*1664', frames: '928*1664' };
  /** Alibaba Model Studio (qwen-image, wan…): API nativa multimodal-generation. */
  async function dashscopeImage(cat, prompt, cfg, images = []) {
    const origin = new URL(cfg.baseUrl).origin;
    const url = origin + '/api/v1/services/aigc/multimodal-generation/generation';
    const tries = images.length ? [images, []] : [[]];
    let lastErr;
    for (const imgs of tries) {
      for (const withSize of [true, false]) {
        const parameters = { watermark: false, n: 1, prompt_extend: false };
        if (withSize) parameters.size = DASH_SIZE[cat];
        const content = [...imgs.map((i) => ({ image: `data:${i.mime};base64,${i.data}` })), { text: prompt }];
        let res;
        try {
          res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.key }, body: JSON.stringify({ model: cfg.model, input: { messages: [{ role: 'user', content }] }, parameters }) });
        } catch (e) { throw new Error('Não foi possível conectar à Alibaba.'); }
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = (data && (data.message || data.code)) || 'HTTP ' + res.status;
          lastErr = new Error(`Alibaba (${cfg.model}): ${msg}`);
          if (res.status === 429) { lastErr.retryAfter = 20; throw lastErr; }
          if (res.status === 401 || res.status === 404) throw lastErr;
          continue;
        }
        const parts = (((data.output || {}).choices || [])[0] || {}).message;
        const found = ((parts && parts.content) || []).find((c) => c.image);
        if (!found) { lastErr = new Error('A Alibaba não devolveu imagem.'); continue; }
        return { ...(await urlToB64(found.image)), model: cfg.model, keyed: true };
      }
    }
    throw lastErr || new Error('A Alibaba não aceitou o pedido.');
  }
  /** OpenRouter e afins: chat com saída de imagem (modalities). */
  async function chatImage(cat, prompt, cfg, images = []) {
    const base = (cfg.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
    const content = [{ type: 'text', text: prompt }, ...images.map((i) => ({ type: 'image_url', image_url: { url: `data:${i.mime};base64,${i.data}` } }))];
    const res = await fetch(base + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.key }, body: JSON.stringify({ model: cfg.model, modalities: ['image', 'text'], messages: [{ role: 'user', content }] }) });
    const data = await res.json().catch(() => null);
    if (!res.ok) { const e = new Error(`${cfg.model}: ` + ((data && data.error && data.error.message) || 'HTTP ' + res.status)); if (res.status === 429) e.retryAfter = 20; throw e; }
    const msg = data && data.choices && data.choices[0] && data.choices[0].message;
    const img = msg && msg.images && msg.images[0];
    const u = img && (img.image_url ? img.image_url.url : img.url);
    if (!u) throw new Error(`"${cfg.model}" não devolveu imagem: escolha um modelo que gere imagens.`);
    return { ...(await urlToB64(u)), model: cfg.model, keyed: true };
  }
  /** Qualquer API com /images/generations (Together, xAI, Fireworks…). */
  async function imagesApi(cat, prompt, cfg) {
    const base = (cfg.baseUrl || '').replace(/\/+$/, '');
    let res;
    try {
      res = await fetch(base + '/images/generations', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cfg.key ? { Authorization: 'Bearer ' + cfg.key } : {}) }, body: JSON.stringify({ model: cfg.model, prompt, n: 1, response_format: 'b64_json' }) });
    } catch (e) { throw new Error('Não foi possível conectar à API de imagens.'); }
    const data = await res.json().catch(() => null);
    if (!res.ok) { const e = new Error(`${cfg.model}: ` + ((data && data.error && (data.error.message || data.error)) || 'HTTP ' + res.status)); if (res.status === 429) e.retryAfter = 20; throw e; }
    const d = data && data.data && data.data[0];
    if (d && d.b64_json) return { mime: 'image/png', data: d.b64_json, model: cfg.model, keyed: true };
    if (d && d.url) return { ...(await urlToB64(d.url)), model: cfg.model, keyed: true };
    throw new Error('A API não devolveu imagem.');
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
        k = smooth(104, 116, r); // avatar (r=120) livre; a arte só encosta na borda
      } else if (cat === 'nameplates') {
        k = smooth(140, 215, x); // avatar + nome à esquerda
      } else if (cat === 'effects') {
        // Como os oficiais (guia medido): arte nos ~60% de cima, base quase vazia e avatar
        // ≈ 8% coberto — a base some num degradê e o avatar fica bem translúcido.
        k = 1 - smooth(H * 0.52, H * 0.74, y);
        k = Math.min(k, 0.2 + 0.8 * smooth(52, 84, Math.hypot(x - 82, y - 138)));
      } else if (cat === 'frames') {
        // card em (56, 304)–(1256, 2316): o miolo fica livre; o ornamento pode invadir a borda
        // (até ~180 px no topo, sobre o banner, ~110 na base e só ~30–48 px dos lados, como os
        // oficiais: no "Deadpool Mask" a borda lateral tem 74 px e entra 30 px no card)
        const inX = smooth(56 + 10, 56 + 22, x) * smooth(56 + 10, 56 + 22, W - x);
        const inY = smooth(304 + 50, 304 + 90, y) * smooth(212 + 24, 212 + 50, H - y);
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
  async function processImage(gen, cat, opts = {}) {
    const { w: W, h: H } = CANVAS[cat];
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const ctx = out.getContext('2d', { willReadFrequently: true });
    if (opts.canvas) {
      // Mídia do usuário: mantém o cenário, recorta no formato e só protege as zonas
      coverInto(ctx, opts.canvas, cat, opts.focus);
      applyMask(ctx, cat, opts.variant);
      return finishArt(ctx, out, cat, W, H);
    }
    const src = await loadImage(`data:${gen.mime};base64,${gen.data}`);
    const tmp = document.createElement('canvas');
    tmp.width = src.naturalWidth; tmp.height = src.naturalHeight;
    const tctx = tmp.getContext('2d', { willReadFrequently: true });
    tctx.drawImage(src, 0, 0);
    const raw = tctx.getImageData(0, 0, tmp.width, tmp.height);
    removeBackground(raw);
    tctx.putImageData(raw, 0, 0);
    const bb = alphaBounds(raw);
    if (!bb) throw new Error('A imagem gerada veio vazia depois de remover o fundo.');

    if (cat === 'decorations') {
      // mantém o centro da imagem no centro do avatar; escala pelo maior lado ocupado
      const cx = tmp.width / 2, cy = tmp.height / 2;
      const half = Math.max(cx - bb.x, bb.x + bb.w - cx, cy - bb.y, bb.y + bb.h - cy);
      ctx.drawImage(tmp, cx - half, cy - half, half * 2, half * 2, 0, 0, W, H);
    } else if (cat === 'nameplates') {
      // faixa: ocupa a altura toda e encosta na ponta direita (como as oficiais, a arte vai até o fim)
      let s = H / bb.h;
      if (bb.w * s > W) s = W / bb.w;
      const dw = bb.w * s, dh = bb.h * s;
      ctx.drawImage(tmp, bb.x, bb.y, bb.w, bb.h, W - dw, (H - dh) / 2, dw, dh);
    } else {
      // effect / frame: preenche o canvas inteiro (cover), centralizado
      const s = Math.max(W / tmp.width, H / tmp.height);
      const dw = tmp.width * s, dh = tmp.height * s;
      ctx.drawImage(tmp, (W - dw) / 2, cat === 'frames' ? 0 : (H - dh) / 2, dw, dh);
    }
    protectZones(ctx, cat, W, H);
    return finishArt(ctx, out, cat, W, H);
  }

  /** Onde fica o "miolo" interessante de uma imagem (para recortar a faixa/quadrado certo). */
  function focusOf(canvas) {
    const w = 48, h = Math.max(1, Math.round((canvas.height / canvas.width) * 48));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(canvas, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data;
    const row = new Array(h).fill(0), col = new Array(w).fill(0);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const i = (yy * w + xx) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const v = (mx / 255) * (0.4 + (mx ? (mx - mn) / mx : 0)); // claro e saturado = chama atenção
      row[yy] += v; col[xx] += v;
    }
    return { row, col };
  }
  /** Desenha a mídia cobrindo o canvas do formato, com o recorte no trecho mais marcante. */
  function coverInto(ctx, src, cat, focus) {
    const { w: W, h: H } = CANVAS[cat];
    const s = Math.max(W / src.width, H / src.height);
    const cw = W / s, ch = H / s; // tamanho do recorte na mídia
    const best = (arr, win, total) => {
      const n = arr.length, k = Math.max(1, Math.round((win / total) * n));
      let bi = 0, bv = -1;
      for (let i = 0; i + k <= n; i++) { let v = 0; for (let j = i; j < i + k; j++) v += arr[j]; if (v > bv) { bv = v; bi = i; } }
      return (bi / n) * total;
    };
    let sx = (src.width - cw) / 2, sy = (src.height - ch) / 2;
    if ((cat === 'nameplates' || cat === 'decorations') && focus) {
      if (ch < src.height - 1) sy = best(focus.row, ch, src.height);
      if (cw < src.width - 1) sx = best(focus.col, cw, src.width);
    }
    if (cat === 'frames') sy = 0;
    ctx.drawImage(src, sx, sy, cw, ch, 0, 0, W, H);
  }

  /* ---- Estudo dos oficiais (catalog/effect-shape-study.json): mapas dos efeitos e formas das molduras ---- */
  let STUDY = null;
  async function loadStudy() {
    if (STUDY) return STUDY;
    try {
      const j = await (await fetch('catalog/media-study.json')).json();
      STUDY = { loop: j.efeitos.loop_mapa_16x9, intro: j.efeitos.entrada_mapa_16x9, shapes: (j.molduras_formas.tipos || []).filter((t) => t.n >= 8) };
    } catch (e) { STUDY = { loop: null, intro: null, shapes: [] }; }
    return STUDY;
  }
  /** Mapa 16×9 (linhas × colunas) → valor suave em (x, y) do canvas 450×880. */
  function sampleMap(map, x, y) {
    const gx = Math.min(8, Math.max(0, x / 50 - 0.5)), gy = Math.min(15, Math.max(0, y / 55 - 0.5));
    const x0 = Math.floor(gx), y0 = Math.floor(gy), x1 = Math.min(8, x0 + 1), y1 = Math.min(15, y0 + 1), fx = gx - x0, fy = gy - y0;
    return (map[y0][x0] * (1 - fx) + map[y0][x1] * fx) * (1 - fy) + (map[y1][x0] * (1 - fx) + map[y1][x1] * fx) * fy;
  }
  /** Interpola um perfil de 36 setores (0° = topo, sentido horário) no ângulo th (graus). */
  const ang36 = (arr, th) => { const g = (((th % 360) + 360) % 360) / 10 - 0.5; const i0 = (Math.floor(g) + 36) % 36, i1 = (i0 + 1) % 36, t = g - Math.floor(g); return arr[i0] * (1 - t) + arr[i1] * t; };

  /* ---- Máscaras da mídia: contorno orgânico (nada de quadrado), como os oficiais ---- */
  /** Ruído suave 1D determinístico (soma de senos), em [-1, 1]. */
  function wobble(seed, scale) {
    const R = rnd(seed);
    const w = [0, 1, 2, 3].map((i) => ({ f: (1 + i * 1.7 + R()) / scale, p: R() * 6.283, a: 1 / (i + 1) }));
    const tot = w.reduce((s0, x) => s0 + x.a, 0);
    return (t) => w.reduce((s0, x) => s0 + x.a * Math.sin(t * x.f + x.p), 0) / tot;
  }
  /**
   * Máscara (canvas branco com alpha) de cada formato para a mídia do usuário.
   * Moldura: anel POR FORA do avatar (avatar r=120 no canvas de 288; a arte entra ~6 px),
   *   mais grosso em cima, borda externa irregular.
   * Frame: coroa no topo + base + laterais finas; entra ~18 px nos lados do card, ~56 px
   *   sobre o banner e ~36 px na base; contorno externo irregular; miolo transparente.
   * Nameplate / efeito: as zonas protegidas de sempre.
   */
  function mediaMask(cat, variant) {
    const { w: W, h: H } = CANVAS[cat];
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x2 = c.getContext('2d', { willReadFrequently: true });
    x2.fillStyle = '#fff'; x2.fillRect(0, 0, W, H);
    const EFX = {
      'loop:topo': (x, y) => 1 - smooth(130, 280, y),
      'loop:laterais': (x, y) => Math.max(1 - smooth(45, 120, x), smooth(330, 405, x)) * (1 - smooth(560, 760, y)),
      'loop:base': (x, y) => smooth(560, 740, y),
      'loop:cantos': (x, y) => Math.max(...[[0, 0], [450, 0], [0, 880], [450, 880]].map(([cx, cy]) => 1 - smooth(70, 190, Math.hypot(x - cx, y - cy)))),
      'loop:cheio': () => 0.55,
    };
    if (cat === 'effects' && (EFX[variant] || (STUDY && STUDY[variant || 'intro']))) {
      // Onde os efeitos oficiais têm arte (mapa médio medido quadro a quadro) ou a forma escolhida.
      const map = EFX[variant] ? null : STUDY[variant || 'intro'];
      let mx = 0; if (map) map.forEach((row) => row.forEach((v) => { mx = Math.max(mx, v); }));
      const img = x2.getImageData(0, 0, W, H), d = img.data;
      const nE = wobble(41, 1);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const v = map ? sampleMap(map, x, y) / (mx || 1) : EFX[variant](x, y);
        let k = map ? smooth(0.22 + 0.06 * nE((x + y) / 60), 0.75, v) : Math.min(1, v * (0.9 + 0.2 * nE((x + y) / 60)));
        k = Math.min(k, 0.15 + 0.85 * smooth(56, 88, Math.hypot(x - 82, y - 138))); // avatar quase livre
        d[(y * W + x) * 4 + 3] = Math.round(255 * k);
      }
      x2.putImageData(img, 0, 0);
      return c;
    }
    if (cat === 'nameplates' && variant === 'inteira') {
      // arte na faixa toda; só um véu suave atrás do avatar e do nome para continuar legível
      const img = x2.getImageData(0, 0, W, H), d = img.data;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) d[(y * W + x) * 4 + 3] = Math.round(255 * (0.45 + 0.55 * smooth(40, 230, x)));
      x2.putImageData(img, 0, 0);
      return c;
    }
    if (cat !== 'decorations' && cat !== 'frames') { protectZones(x2, cat, W, H); return c; }
    const img = x2.getImageData(0, 0, W, H), d = img.data;
    const shape = cat === 'decorations' && STUDY && STUDY.shapes.length && typeof variant === 'number' ? STUDY.shapes[variant % STUDY.shapes.length] : null;
    if (shape) {
      // Forma medida nas molduras oficiais: massa, alcance e borda interna por ângulo.
      const mm = Math.max(...shape.massa_36) || 1;
      const nO = wobble(43 + (variant || 0), 0.35);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const dx = x - 144, dy = y - 144, rr = Math.hypot(dx, dy);
        const th = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
        const m = ang36(shape.massa_36, th) / mm;
        const rOut = Math.min(205, Math.max(128, 112 + (ang36(shape.alcance_36, th) - 112) * 1.25 + 4 * nO(th / 20)));
        const rIn = Math.max(112, Math.min(rOut - 8, ang36(shape.interno_36, th)));
        const k = smooth(rIn - 3, rIn + 3, rr) * (1 - smooth(rOut - 4, rOut + 1, rr)) * smooth(0.18, 0.5, m);
        d[(y * W + x) * 4 + 3] = Math.round(255 * k);
      }
    } else if (cat === 'decorations') {
      const nOut = wobble(3, 0.35), nIn = wobble(9, 0.25);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const dx = x - 144, dy = y - 144, rr = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
        const top = Math.max(0, -Math.sin(th)); // 1 no topo
        const rOut = 126 + 14 * top + 5 * nOut(th * 6);
        const rIn = 114 + 2 * nIn(th * 5);
        const k = smooth(rIn - 3, rIn + 3, rr) * (1 - smooth(rOut - 4, rOut + 1, rr));
        d[(y * W + x) * 4 + 3] = Math.round(255 * k);
      }
    } else {
      const L = 56, Rr = 1256, T = 304, B = 2316;
      const nT = wobble(5, 1), nB = wobble(7, 1), nL = wobble(11, 1), nR = wobble(13, 1);
      const nTi = wobble(17, 1), nBi = wobble(19, 1), nLi = wobble(23, 1), nRi = wobble(29, 1);
      // Medidas do estudo de 40 frames oficiais (docs/frame-deco-study.md): coroa ~300 px acima
      // do card e desce ~41 px; base sobe ~30 px; laterais ~36 px fora e ~22 px dentro, e em
      // metade dos frames as laterais nem existem — aqui elas descem da coroa/sobem da base e
      // somem no meio ("escorrem pelas laterais"). Miolo 0%.
      const nG = wobble(31, 1);
      for (let y = 0; y < H; y++) {
        const outL = L - 36 + 12 * nL(y / 140), outR = Rr + 36 - 12 * nR(y / 150);
        const inL = L + 22 + 6 * nLi(y / 90), inR = Rr - 22 - 6 * nRi(y / 95);
        const gap = 90 * nG(y / 300);
        const sideOn = 1 - smooth(T + 380 + gap, T + 760 + gap, y) * (1 - smooth(B - 640 - gap, B - 300 - gap, y));
        for (let x = 0; x < W; x++) {
          const yTop = 20 + 120 * (0.5 + 0.5 * nT(x / 120)); // borda de cima da coroa (irregular)
          const yBot = H - 20 - 90 * (0.5 + 0.5 * nB(x / 110));
          const inT = T + 41 + 18 * nTi(x / 80), inB = B - 30 - 12 * nBi(x / 85);
          // fora da silhueta externa
          let k = smooth(yTop - 6, yTop + 6, y) * (1 - smooth(yBot - 6, yBot + 6, y)) * smooth(outL - 4, outL + 4, x) * (1 - smooth(outR - 4, outR + 4, x));
          // miolo do card vazio
          const inside = smooth(inL - 5, inL + 5, x) * (1 - smooth(inR - 5, inR + 5, x)) * smooth(inT - 8, inT + 8, y) * (1 - smooth(inB - 8, inB + 8, y));
          k *= 1 - inside;
          // laterais conforme o estilo: escorrendo (padrão), nenhuma, completas; "coroa" tira a base
          const band = smooth(inT - 10, inT + 30, y) * (1 - smooth(inB - 30, inB + 10, y));
          const fs = variant || 'coroa-laterais';
          const side = fs === 'borda' ? 1 : fs === 'coroa-base' ? 0 : fs === 'coroa' ? 1 - smooth(T + 300, T + 600, y) : sideOn;
          k *= 1 - band * (1 - side);
          if (fs === 'coroa') k *= 1 - smooth(inB - 400, inB - 100, y);
          d[(y * W + x) * 4 + 3] = Math.round(255 * k);
        }
      }
    }
    x2.putImageData(img, 0, 0);
    return c;
  }
  /** Rótulo automático de uma forma de moldura, pela distribuição de massa medida. */
  function shapeLabel(t) {
    const m = t.massa_36, mx = Math.max(...m) || 1;
    const on = m.filter((v) => v / mx > 0.35).length / 36;
    const part = (a, b) => m.slice(a, b).reduce((s0, v) => s0 + v, 0);
    const top = part(0, 5) + part(31, 36), bot = part(13, 23), right = part(5, 13), left = part(23, 31);
    const tot = top + bot + right + left || 1;
    const reach = Math.max(...t.alcance_36);
    if (on > 0.8) return reach > 150 ? { k: 'anel-orelhas', label: 'Anel com orelhas' } : { k: 'anel', label: 'Anel cheio' };
    if (top / tot > 0.4) return reach > 150 ? { k: 'orelhas', label: 'Orelhas / chifres' } : { k: 'topo', label: 'Ornamento no topo' };
    if (bot / tot > 0.38) return { k: 'base', label: 'Peso embaixo' };
    if (Math.abs(left - right) / tot > 0.15) return { k: 'lateral', label: 'Lua de lado' };
    if (on < 0.45) return { k: 'soltos', label: 'Elementos soltos' };
    return { k: 'arco', label: 'Arcos laterais' };
  }
  /** Formas que o usuário pode escolher em cada formato. */
  async function shapeOptions() {
    await loadStudy();
    return {
      decorations: [{ v: 'auto', label: '3 sorteadas' }, ...(STUDY.shapes || []).map((t, i) => ({ v: i, label: shapeLabel(t).label }))],
      effects: [{ v: 'loop', label: 'Como os oficiais' }, { v: 'loop:topo', label: 'Só no topo' }, { v: 'loop:laterais', label: 'Laterais' }, { v: 'loop:cantos', label: 'Cantos' }, { v: 'loop:base', label: 'Base' }, { v: 'loop:cheio', label: 'Cena inteira, leve' }],
      frames: [{ v: 'coroa-laterais', label: 'Coroa + laterais escorrendo' }, { v: 'coroa-base', label: 'Coroa + base' }, { v: 'borda', label: 'Borda completa' }, { v: 'coroa', label: 'Só coroa' }],
      nameplates: [{ v: 'direita', label: 'Arte à direita' }, { v: 'inteira', label: 'Faixa inteira' }],
    };
  }
  /** Prévia pequena da forma: card/avatar em azul e a área da arte em branco. */
  function shapePreview(cat, v, h = 64) {
    const m = maskOf(cat, cat === 'effects' && v === 'loop' ? 'loop' : v === 'auto' ? undefined : v);
    const { w: W, h: H } = CANVAS[cat];
    const s = h / H, w = Math.max(1, Math.round(W * s));
    const c = document.createElement('canvas'); c.width = cat === 'nameplates' ? 160 : w; c.height = cat === 'nameplates' ? 30 : h;
    const x = c.getContext('2d');
    const sx = c.width / W, sy = c.height / H;
    x.fillStyle = '#1e1f22'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#5865F2';
    if (cat === 'decorations') { x.beginPath(); x.arc(144 * sx, 144 * sy, 120 * sx, 0, 7); x.fill(); }
    else if (cat === 'frames') { x.fillRect(56 * sx, 304 * sy, 1200 * sx, 2012 * sy); }
    else if (cat === 'effects') { x.globalAlpha = 0.5; x.fillRect(0, 0, c.width, 120 * sy); x.globalAlpha = 1; x.beginPath(); x.arc(82 * sx, 138 * sy, 66 * sx, 0, 7); x.fill(); }
    else { x.beginPath(); x.arc(20, 15, 10, 0, 7); x.fill(); }
    const t = document.createElement('canvas'); t.width = c.width; t.height = c.height;
    const tx = t.getContext('2d'); tx.drawImage(m, 0, 0, c.width, c.height);
    tx.globalCompositeOperation = 'source-in'; tx.fillStyle = 'rgba(255,255,255,.9)'; tx.fillRect(0, 0, c.width, c.height);
    x.drawImage(t, 0, 0);
    return c.toDataURL('image/png');
  }
  /** Frase para o modelo de imagem seguir a forma escolhida. */
  function shapeHint(cat, v) {
    if (v === undefined || v === null || v === 'auto') return '';
    if (cat === 'decorations') {
      const t = STUDY && STUDY.shapes && STUDY.shapes[v];
      const k = t ? shapeLabel(t).k : '';
      return ({ anel: 'SHAPE: a full ring all around the avatar.', 'anel-orelhas': 'SHAPE: a ring around the avatar with ears or horns poking out past the circle at the top corners.', orelhas: 'SHAPE: only ears or horns on the top; the rest of the circle is empty.', topo: 'SHAPE: only one ornament sitting on top of the avatar (like a hat, hair, crown or creature); the sides and bottom are empty.', base: 'SHAPE: the art is mostly at the bottom of the avatar (like flames, plants or a creature below); the top is mostly empty.', lateral: 'SHAPE: a crescent on one side of the avatar; the other side is empty.', soltos: 'SHAPE: a few separate small elements scattered around the avatar edge, with gaps between them.', arco: 'SHAPE: two arcs or wings on the left and right of the avatar; top and bottom mostly empty.' })[k] || '';
    }
    if (cat === 'frames') return ({ 'coroa-base': 'SHAPE: no side borders at all: only the crown on top and a base ornament at the bottom.', borda: 'SHAPE: a complete slim border on all four sides plus the crown on top and a base.', coroa: 'SHAPE: only the crown on top; nothing on the sides or bottom.', 'coroa-laterais': 'SHAPE: crown on top and base at the bottom, with elements spilling partway down the sides from the top and up from the bottom; the middle of the sides is empty.' })[v] || '';
    if (cat === 'effects') return ({ 'loop:topo': 'SHAPE: keep the art in the top 30% of the image only.', 'loop:laterais': 'SHAPE: keep the art along the left and right edges only.', 'loop:base': 'SHAPE: keep the art in the bottom part only.', 'loop:cantos': 'SHAPE: put the art in the four corners only.', 'loop:cheio': 'SHAPE: a light scene over the whole image.' })[v] || '';
    if (cat === 'nameplates') return v === 'inteira' ? 'SHAPE: the art may span the whole width, lighter and calmer on the left.' : '';
    return '';
  }

  const maskCache = {};
  const maskOf = (cat, v) => { const key = cat + ':' + (v ?? ''); return (maskCache[key] = maskCache[key] || mediaMask(cat, v)); };
  function applyMask(ctx, cat, v) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskOf(cat, v), 0, 0);
    ctx.restore();
  }

  function finishArt(ctx, out, cat, W, H) {
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
    let solid = 0;
    for (let i = 3; i < src2.data.length; i += 16) if (src2.data[i] > 128) solid++;
    const coverage = solid / (src2.data.length / 16);
    return { url: enc(out), hl: lit > (W * H) * 0.002 ? enc(hl) : '', palette, W, H, coverage };
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
      else if (cat === 'frames') { const z = R(); if (z < 0.45) { x = 40 + R() * (W - 80); y = 20 + R() * 420; } else if (z < 0.65) { x = 40 + R() * (W - 80); y = H - 300 + R() * 260; } else { x = R() < 0.5 ? 14 + R() * 80 : W - 94 + R() * 80; y = 300 + R() * (H - 600); } }
      else { x = 20 + R() * (W - 40); y = 15 + Math.pow(R(), 1.4) * H * 0.55; } // efeito: topo, mais denso em cima
      if (cat === 'effects' && Math.hypot(x - 82, y - 138) < 80) continue;
      pts.push([x, y]);
    }
    return pts;
  }

  /** Efeitos de movimento da animação (o usuário liga/desliga; a IA pode sugerir). */
  const FX_DEFAULT = { wave: false, heat: false, breathe: true, glow: true, shine: true, sparkles: true, motes: true, licks: true };
  const FX_LABELS = { wave: 'Ondular', heat: 'Distorção de calor', breathe: 'Respirar', glow: 'Brilho pulsando', shine: 'Faixa de luz', sparkles: 'Brilhos ✦', motes: 'Partículas', licks: 'Chamas lambendo' };
  /** Lê pedidos do texto: "sem ondular", "com ondulação", "sem partículas"… */
  function fxFromText(text) {
    const t = String(text || '').toLowerCase().normalize('NFD').replace(/[^\x00-\x7f]/g, '');
    const words = { wave: 'ondul|onda|wave|balanc', heat: 'distorc|calor|heat|tremul', breathe: 'respir|breath', glow: 'brilho pulsa|pulsar|glow', shine: 'faixa de luz|reflexo|shine|brilho passa', sparkles: 'brilhos|estrel|sparkle|cintil', motes: 'particula|brasa|poeira|particle', licks: 'chama|lambe|flame' };
    const art = '(?:(?:o|a|os|as|esse|essa|esses|essas|aquele|efeitos? de|movimentos? de|animacao de) +)*';
    const out = {};
    Object.entries(words).forEach(([key, re]) => {
      if (new RegExp('(?:sem|tira[a-z]*|remov[a-z]*|desliga[a-z]*|nao (?:quero|use|usa|usar|coloca)[a-z]*|without) +' + art + '(?:' + re + ')').test(t)) out[key] = false;
      else if (new RegExp('(?:com|quero|liga[a-z]*|adiciona[a-z]*|coloca[a-z]*|with) +' + art + '(?:' + re + ')').test(t)) out[key] = true;
    });
    return out;
  }

  function buildSvgs(cat, art, seed, motion = {}) {
    const { url, hl, palette, W, H } = art;
    const preset = motion.preset || 'rise';
    // Efeitos de movimento: ondular e distorção de calor ficam DESLIGADOS por padrão.
    const fx = { ...FX_DEFAULT, ...(motion.fx || {}) };
    const k = [0.6, 1, 1.6][(motion.intensity || 2) - 1] || 1;
    const R = rnd(seed || 7);
    const n = { decorations: 12, nameplates: 8, effects: 18, frames: 16 }[cat];
    const pts = sparklePoints(cat, W, H, n, R);
    const sz = { decorations: 5, nameplates: 4, effects: 7, frames: 10 }[cat];
    const sparkles = !fx.sparkles ? '' : pts.map(([x, y], i) => `<path class="s s${i % 4}" d="${star(x, y, sz * (0.6 + R() * 0.8))}" fill="${palette[i % palette.length]}"/>`).join('');
    // brasas/partículas subindo a partir das áreas com arte (todas as categorias)
    const rise = { decorations: 60, nameplates: 30, effects: Math.round(H * 0.3), frames: 120 }[cat];
    const motes = !fx.motes ? '' : sparklePoints(cat, W, H, cat === 'nameplates' ? 8 : 14, R).map(([x, y], i) => `<circle class="m m${i % 4}" cx="${f(x)}" cy="${f(y)}" r="${f((cat === 'frames' ? 3 : 1.6) + R() * (cat === 'frames' ? 4 : 2.2))}" fill="${palette[(i + 1) % palette.length]}"/>`).join('');
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
    const body = !fx.wave ? '<use href="#full"/>' : Array.from({ length: N }, (_, i) => `<g clip-path="url(#c${i})"><use class="wv v${i % 8}" href="#full"/></g>`).join('');
    const up = { effects: 26, frames: 16, nameplates: 6, decorations: 10 }[cat] * k;
    const lick = cat === 'decorations' || preset === 'pulse' || preset === 'orbit' ? `scale(${(1 + 0.07 * k).toFixed(3)})`
      : preset === 'fall' ? `translateY(${f(up * 0.6)}px)`
        : preset === 'drift' || preset === 'sweep' ? `translateX(${f(up)}px)`
          : `translateY(-${f(up)}px)${cat === 'effects' ? ' scaleY(1.1)' : ''}`;
    const licks = hl && fx.licks ? `<use class="lk" href="#hl"/><use class="lk lk2" href="#hl"/><use class="hlb" href="#hl"/>` : '';
    const lights = '';
    const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">`;
    const fullDef = `<g id="full"><use href="#art"/>${hl ? '<use class="hl" href="#hl"/>' : ''}</g>`;
    const css2 = (fx.heat ? css : css.replace(',heat .5s steps(1) infinite', '')) + `
.wv{animation:wave 2s ease-in-out infinite}${waveCss}
@keyframes wave{0%,100%{transform:translateX(-${A}px)}50%{transform:translateX(${A}px)}}
.lk{transform-box:view-box;transform-origin:50% ${cat === 'decorations' ? '50%' : '100%'};mix-blend-mode:screen;opacity:0;animation:lick 1s ease-out infinite}.lk2{animation-delay:-.5s}
@keyframes lick{0%{opacity:.7;transform:none}100%{opacity:0;transform:${lick}}}${fx.breathe ? '' : ' .art{animation:none}'}${fx.glow ? '' : ' .glow{display:none}'}`;
    if (cat !== 'effects') {
      const loop = `${head}<style>${css2}</style>${defs.replace('</defs>', clips + fullDef + '</defs>')}<g class="art"><use class="glow" href="#art"/>${body}${licks}${fx.shine ? shine : ''}</g>${motes}${sparkles}</svg>`;
      return { svg: loop, loopSeconds: 4 };
    }

    /* ---- EFEITO ----
       Loop: versão leve da mesma cena, só no TOPO (banner e começo do card), translúcida, com
       ondulação, brasas e poucos brilhos — como os loops oficiais. O resto do card fica livre.
       Entrada: o momento de impacto — clarão, onda de choque, a arte inteira entra com zoom e foco,
       faísca explodindo do centro, faixa de luz, e no fim o miolo some e sobra o visual do loop. */
    // Loop leve: só o TOPO (banner e começo do card), sumindo para baixo e com o avatar livre.
    const TOP = Math.round(H * 0.22), FADE = Math.round(H * 0.4);
    const edge = `<linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="${f(TOP / H)}" stop-color="#fff"/><stop offset="${f(FADE / H)}" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="ga"><stop offset=".55" stop-color="#000"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<mask id="lm" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect x="0" y="0" width="${W}" height="${H}" fill="url(#gv)"/><circle cx="82" cy="138" r="92" fill="url(#ga)"/></mask>`;
    const onSide = ([x, y]) => y < FADE && Math.hypot(x - 82, y - 138) > 90;
    const fewSparks = fx.sparkles && sparkles.split('</path>').length > 1 ? pts.filter(onSide).slice(0, 8).map(([x, y], i) => `<path class="s s${i % 4}" d="${star(x, y, sz * 0.8)}" fill="${palette[i % palette.length]}"/>`).join('') : '';
    const fewMotes = !fx.motes ? '' : sparklePoints(cat, W, H, 16, R).filter(onSide).slice(0, 8).map(([x, y], i) => `<circle class="m m${i % 4}" cx="${f(x)}" cy="${f(y)}" r="${f(1.6 + R() * 2)}" fill="${palette[(i + 1) % palette.length]}"/>`).join('');
    const loopDefs = defs.replace('</defs>', clips + fullDef + edge + '</defs>');
    const loop = `${head}<style>${css2}
.lite{opacity:.5}
.lhl{mix-blend-mode:screen;animation:flick 1s steps(1) infinite}</style>${loopDefs}<g class="lite" mask="url(#lm)"><g class="art"><use class="glow" href="#art"/>${body}${licks}</g></g>${hl ? '<g mask="url(#lm)"><use class="lhl" href="#hl"/></g>' : ''}${fewMotes}${fewSparks}</svg>`;

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
.hl{mix-blend-mode:screen;animation:flick 1s steps(1) infinite${fx.heat ? ',heat .5s steps(1) infinite' : ''}}
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
  /* MÍDIA COMO ARTE: usa o vídeo/GIF/imagem do usuário direto          */
  /* ---------------------------------------------------------------- */
  /** Máscara das zonas protegidas (alpha) para aplicar UMA vez sobre todos os quadros. */
  function zoneMask(cat, v) {
    return maskOf(cat, v).toDataURL('image/png');
  }
  /** Vários quadros → SVG que troca de quadro com fusão suave e emenda sem pulo. */
  function flipbookSvgs(cat, urls, seconds, variant, introUrls, introSeconds) {
    const { w: W, h: H } = CANVAS[cat];
    const n = urls.length, T = Math.max(1.5, seconds), d = T / n;
    const pct = (t) => f((t / T) * 100);
    const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">`;
    const defs = `<defs>${urls.map((u, i) => `<image id="q${i}" href="${u}" x="0" y="0" width="${W}" height="${H}"/>`).join('')}<image id="zm" href="${zoneMask(cat, variant ?? (cat === 'effects' ? 'loop' : undefined))}" x="0" y="0" width="${W}" height="${H}"/><mask id="pm" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><use href="#zm"/></mask></defs>`;
    // quadro i entra em fusão no fim do quadro anterior e fica até o fim; por cima de tudo, o 1º volta (emenda)
    const kf = [];
    const layers = ['<use href="#q0"/>'];
    for (let i = 1; i <= n; i++) {
      const a = (i - 0.5) * d, b = i * d - 0.001;
      kf.push(`@keyframes p${i}{0%,${pct(a)}%{opacity:0}${pct(b)}%,100%{opacity:1}}.p${i}{animation:p${i} ${f(T)}s linear infinite}`);
      layers.push(`<use class="p${i}" href="#q${i % n}"/>`);
    }
    const body = `<g mask="url(#pm)">${layers.join('')}</g>`;
    const loop = `${head}<style>mask{mask-type:alpha}${kf.join('')}</style>${defs}${body}</svg>`;
    if (cat !== 'effects') return { svg: loop, loopSeconds: f(T) };
    // ENTRADA (como os oficiais): os quadros do começo tocam uma vez com a cena cheia (mapa da
    // entrada) e, no fim, a cena se funde no loop, onde só ficam as partes do mapa do loop.
    const iu = introUrls && introUrls.length ? introUrls : urls;
    const ni = iu.length, TI = Math.min(6, Math.max(2.5, introSeconds || ni * 0.35)), di = TI / ni, XF = Math.min(1, TI * 0.25);
    const ipct = (t) => f((t / TI) * 100);
    const ikf = [], ilayers = ['<use href="#i0"/>'];
    for (let i = 1; i < ni; i++) {
      const a = (i - 0.5) * di, b = i * di - 0.001;
      ikf.push(`@keyframes e${i}{0%,${ipct(a)}%{opacity:0}${ipct(b)}%,100%{opacity:1}}.e${i}{animation:e${i} ${f(TI)}s linear 1 both}`);
      ilayers.push(`<use class="e${i}" href="#i${i}"/>`);
    }
    const idefs = `<defs>${iu.map((u, i) => `<image id="i${i}" href="${u}" x="0" y="0" width="${W}" height="${H}"/>`).join('')}${urls.map((u, i) => `<image id="q${i}" href="${u}" x="0" y="0" width="${W}" height="${H}"/>`).join('')}<image id="zi" href="${zoneMask(cat, 'intro')}" x="0" y="0" width="${W}" height="${H}"/><image id="zm" href="${zoneMask(cat, variant ?? 'loop')}" x="0" y="0" width="${W}" height="${H}"/><mask id="mi" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><use href="#zi"/></mask><mask id="pm" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><use href="#zm"/></mask></defs>`;
    const intro = `${head}<style>mask{mask-type:alpha}${ikf.join('')}
.in{transform-box:view-box;transform-origin:50% 30%;animation:zin 1.2s cubic-bezier(.16,1,.3,1) both,iout ${f(XF)}s ease-in ${f(TI - XF)}s both}
.to{opacity:0;animation:ion ${f(XF)}s ease-out ${f(TI - XF)}s both}
@keyframes zin{0%{opacity:0;transform:scale(1.08);filter:blur(6px) brightness(1.6)}70%{opacity:1;filter:none}100%{opacity:1;transform:none}}
@keyframes iout{to{opacity:0}}@keyframes ion{to{opacity:1}}</style>${idefs}<g class="in" mask="url(#mi)">${ilayers.join('')}</g><g class="to" mask="url(#pm)"><use href="#q0"/></g></svg>`;
    return { svg: loop, loopSeconds: f(T), introSvg: intro, introSeconds: f(TI) };
  }
  /**
   * Gera os formatos direto da mídia do usuário (sem IA).
   * @param {{frames:HTMLCanvasElement[], seconds?:number, name?:string}} media
   */
  async function fromMedia(cats, media, motion = {}, shapes = {}) {
    await loadStudy();
    const out = [];
    // Formas escolhidas na tela; molduras em "3 sorteadas" saem em três formas medidas
    const nShapes = Math.min(3, (STUDY.shapes || []).length);
    const jobs = [];
    cats.forEach((cat) => {
      const sv = shapes[cat];
      if (cat === 'decorations' && typeof sv === 'number') jobs.push({ cat, variant: sv });
      else if (cat === 'decorations' && nShapes) {
        const off = Math.floor(Math.random() * STUDY.shapes.length);
        for (let k = 0; k < nShapes; k++) jobs.push({ cat, variant: (off + k) % STUDY.shapes.length });
      } else if (cat === 'effects') jobs.push({ cat, variant: sv || 'loop' });
      else jobs.push({ cat, variant: sv });
    });
    const focus = focusOf(media.frames[Math.floor(media.frames.length / 2)]);
    const enc = (c, q) => { const u = c.toDataURL('image/webp', q); return /^data:image\/webp/.test(u) ? u : c.toDataURL('image/jpeg', q); };
    for (const { cat, variant } of jobs) {
      const { w: W, h: H } = CANVAS[cat];
      let asset, palette;
      if (media.frames.length > 1) {
        const max = { nameplates: 12, decorations: 12, effects: 14, frames: 6 }[cat];
        const step = Math.max(1, Math.ceil(media.frames.length / max));
        const pick = media.frames.filter((_, i) => i % step === 0);
        const urls = pick.map((fr) => {
          const c = document.createElement('canvas'); c.width = W; c.height = H;
          coverInto(c.getContext('2d'), fr, cat, focus);
          return enc(c, cat === 'frames' ? 0.72 : 0.8);
        });
        if (cat === 'effects' && pick.length >= 6) {
          // começo = entrada (a cena acontecendo); o loop usa a segunda metade, mais curta
          const half = Math.floor(urls.length / 2);
          const secs = media.seconds || pick.length * 0.4;
          asset = { type: 'svg', ...flipbookSvgs(cat, urls.slice(half), secs / 2, variant, urls, secs) };
        } else {
          asset = { type: 'svg', ...flipbookSvgs(cat, urls, media.seconds || pick.length * 0.4, variant) };
        }
        const c0 = document.createElement('canvas'); c0.width = W; c0.height = H;
        coverInto(c0.getContext('2d', { willReadFrequently: true }), pick[0], cat, focus);
        palette = paletteOf(c0.getContext('2d', { willReadFrequently: true }), W, H);
      } else {
        if (cat === 'effects' && STUDY.loop) {
          // imagem parada: entrada com o mapa da entrada; loop leve com o mapa do loop
          const artI = await processImage(null, cat, { canvas: media.frames[0], focus, variant: 'intro' });
          const artL = await processImage(null, cat, { canvas: media.frames[0], focus, variant: variant || 'loop' });
          const a1 = buildSvgs(cat, artI, 11, motion[cat] || {}), a2 = buildSvgs(cat, artL, 11, motion[cat] || {});
          asset = { type: 'svg', ...a1, svg: a2.svg, loopSeconds: a2.loopSeconds };
          palette = artI.palette;
        } else {
          const art = await processImage(null, cat, { canvas: media.frames[0], focus, variant });
          asset = { type: 'svg', ...buildSvgs(cat, art, 11, motion[cat] || {}) };
          palette = art.palette;
        }
      }
      if (cat === 'frames') asset.wrap = FRAME_WRAP;
      const base = (media.name || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim();
      out.push({
        cat,
        palette,
        raw: { ...metaFor(cat, base || 'Sua mídia'), ...(typeof variant === 'number' && cat === 'decorations' ? { name: (metaFor(cat, base || 'Sua mídia').name.slice(0, 14) + ' · ' + shapeLabel(STUDY.shapes[variant]).label).slice(0, 28) } : {}), prompt: base, engine: 'media', engineLabel: 'Sua mídia · ' + (media.kind || ''), asset },
        quality: { ok: true, issues: [], summary: '✓ sua mídia · zonas protegidas' },
      });
    }
    return out;
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
    await loadStudy();
    const provider = imageApi(cfg);
    const theme = cleanTheme(req.prompt) || 'tema livre, item premium';
    let done = 0;
    const tick = () => opts.onProgress && opts.onProgress(`Pintando as ilustrações… ${done}/${req.cats.length}`);
    tick();
    const results = [];
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    // Uma por vez: modelos de imagem têm cota por minuto baixa (em paralelo, metade voltava 429)
    for (const [i, cat] of req.cats.entries()) results.push(await (async () => {
      try {
        const detail = req.details && req.details[cat] ? cleanTheme(req.details[cat]) : '';
        const hint = shapeHint(cat, opts.shapes && opts.shapes[cat]);
        const catTheme = (detail ? `${detail}. General theme and art style: ${theme}` : theme) + (hint ? `. ${hint}` : '');
        const paint = async (strict) => {
          for (let attempt = 0; ; attempt++) {
            try {
              const refs = (opts.refs && opts.refs[cat]) || [];
              if (provider === 'gemini') return await geminiImage(cat, catTheme, cfg, refs, strict, opts.fromMedia);
              if (provider === 'openai') return await openaiImage(cat, catTheme, cfg, strict);
              const pr = promptFor(cat, catTheme, 'gemini', refs.length > 0, strict, opts.fromMedia && refs.length > 0);
              if (provider === 'dashscope') return await dashscopeImage(cat, pr, cfg, refs);
              if (provider === 'chat-image') return await chatImage(cat, pr, cfg, refs);
              return await imagesApi(cat, pr, cfg);
            } catch (e) {
              if (!e.retryAfter || attempt >= 2) throw e;
              for (let t = Math.ceil(e.retryAfter); t > 0; t--) {
                opts.onProgress && opts.onProgress(`Limite do provedor: tentando de novo em ${t} s… (${done}/${req.cats.length})`);
                await sleep(1000);
              }
            }
          }
        };
        let gen = await paint(false);
        let art = await processImage(gen, cat);
        let full = art.coverage > FULL_LIMIT[cat];
        if (full) {
          // O modelo pintou uma cena inteira (fundo não sai): pede de novo, só os elementos soltos
          opts.onProgress && opts.onProgress(`A arte de ${CAT_WORD[cat]} veio com cenário cheio; pedindo de novo só os elementos…`);
          try {
            const gen2 = await paint(true);
            const art2 = await processImage(gen2, cat);
            if (art2.coverage < art.coverage) { gen = gen2; art = art2; }
            full = art.coverage > FULL_LIMIT[cat];
          } catch (e) { console.warn('[Ilustração] nova tentativa falhou', e); }
        }
        const anim = buildSvgs(cat, art, 1 + i * 97 + theme.length, (opts.motion && opts.motion[cat]) || {});
        const label = API_LABEL[provider] + ' · ' + gen.model;
        return {
          cat,
          raw: { ...metaFor(cat, (req.details && req.details[cat]) || theme),
            ...(gen.name ? { name: gen.name.slice(0, 28) } : {}), prompt: theme, engine: provider, engineLabel: label, asset: { type: 'svg', ...anim, ...(cat === 'frames' ? { wrap: FRAME_WRAP } : {}) } },
          quality: full
            ? { ok: false, issues: [], summary: `⚠ a IA pintou um cenário cheio (${Math.round(art.coverage * 100)}%): use ✏️ Refazer ou gere de novo` }
            : { ok: true, issues: [], summary: '✓ ilustração · fundo recortado' },
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

  /* ---------------------------------------------------------------- */
  /* REFAZER: edita uma ilustração já gerada com um pedido em texto    */
  /* ---------------------------------------------------------------- */
  /** A arte (camada #art) embutida no SVG de um item do modo Ilustração. */
  function artOf(svg) {
    const m = String(svg || '').match(/<image[^>]*id="art"[^>]*href="(data:image\/[a-z]+;base64,[^"]+)"/) || String(svg || '').match(/href="(data:image\/[a-z]+;base64,[^"]+)"/);
    return m ? m[1] : '';
  }
  /** Arte sobre fundo verde chapado (o modelo devolve no mesmo esquema e o recorte continua funcionando). */
  async function onGreen(dataUrl) {
    const img = await loadImage(dataUrl);
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);
    return c.toDataURL('image/png').split(',')[1];
  }
  async function editGemini(cat, b64, instruction, cfg) {
    const model = geminiImageModel(cfg.model);
    const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`;
    const text = [
      `This image is a Discord ${CAT_WORD[cat]} on a flat green background. EDIT it following this request: ${instruction}.`,
      'Change only what the request asks for. Keep the same format, framing, composition, proportions, art style and everything else.',
      LAYOUT[cat],
      'Keep the background perfectly flat pure green (#00FF00), no text, one single object.',
    ].join('\n\n');
    for (const withAspect of [true, false]) {
      const generationConfig = { responseModalities: ['TEXT', 'IMAGE'] };
      if (withAspect) generationConfig.imageConfig = { aspectRatio: ASPECT[cat].gemini };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text }, { inlineData: { mimeType: 'image/png', data: b64 } }] }], generationConfig }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = (data && data.error && data.error.message) || '';
        if (withAspect && res.status === 400 && /image_?config|aspect/i.test(msg)) continue;
        throw new Error('Gemini: ' + (msg || 'HTTP ' + res.status));
      }
      const cand = data && data.candidates && data.candidates[0];
      const img = ((cand && cand.content && cand.content.parts) || []).find((p) => p.inlineData && /^image\//.test(p.inlineData.mimeType || ''));
      if (!img) throw new Error('O Gemini não devolveu a imagem editada.');
      return { mime: img.inlineData.mimeType, data: img.inlineData.data, model };
    }
    throw new Error('O Gemini não aceitou o pedido.');
  }
  async function editOpenAI(cat, dataUrl, instruction, cfg) {
    const model = openaiImageModel(cfg.model);
    const base = (cfg.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const blob = await (await fetch(dataUrl)).blob();
    const png = await new Promise((resolve) => {
      createImageBitmap(blob).then((bmp) => {
        const c = document.createElement('canvas');
        c.width = bmp.width; c.height = bmp.height;
        c.getContext('2d').drawImage(bmp, 0, 0);
        c.toBlob(resolve, 'image/png');
      });
    });
    const fd = new FormData();
    fd.append('model', model);
    fd.append('image', png, 'art.png');
    fd.append('prompt', `Edit this Discord ${CAT_WORD[cat]}: ${instruction}. Change only what is asked; keep format, composition and style. Transparent background, no text.`);
    fd.append('size', ASPECT[cat].openai);
    fd.append('background', 'transparent');
    const res = await fetch(base + '/images/edits', { method: 'POST', headers: { Authorization: 'Bearer ' + cfg.key }, body: fd });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error('OpenAI: ' + ((data && data.error && data.error.message) || 'HTTP ' + res.status));
    const b64 = data && data.data && data.data[0] && data.data[0].b64_json;
    if (!b64) throw new Error('A OpenAI não devolveu a imagem editada.');
    return { mime: 'image/png', data: b64, model };
  }
  /**
   * Refaz uma ilustração: edita a arte com o pedido e remonta recorte, máscaras e animação.
   * @returns {Promise<{asset:object, palette:string[], label:string}>}
   */
  async function remake(cat, item, instruction, cfg, motion = {}) {
    const art = artOf(item.asset && item.asset.svg);
    if (!art) throw new Error('Não achei a ilustração deste item.');
    const provider = imageApi(cfg);
    const editText = [`This image is a Discord ${CAT_WORD[cat]} on a flat green background. EDIT it following this request: ${instruction}.`, 'Change only what the request asks for. Keep the same format, composition and art style.', LAYOUT[cat], 'Keep the background perfectly flat pure green (#00FF00), no text, one single object.'].join('\n\n');
    const green = () => onGreen(art).then((data) => [{ mime: 'image/png', data }]);
    const gen = provider === 'gemini' ? await editGemini(cat, await onGreen(art), instruction, cfg)
      : provider === 'openai' ? await editOpenAI(cat, art, instruction, cfg)
        : provider === 'dashscope' ? await dashscopeImage(cat, editText, cfg, await green())
          : provider === 'chat-image' ? await chatImage(cat, editText, cfg, await green())
            : (() => { throw new Error('Esta API não edita imagens: gere de novo com o pedido no texto.'); })();
    const out = await processImage(gen, cat);
    const anim = buildSvgs(cat, out, 7 + instruction.length, motion);
    return {
      asset: { type: 'svg', ...anim, ...(cat === 'frames' ? { wrap: FRAME_WRAP } : {}) },
      palette: out.palette,
      label: API_LABEL[provider] + ' · ' + gen.model,
    };
  }

  window.CosmeticIllustration = { shapeOptions, shapePreview, fromMedia, imageApi, FX_DEFAULT, FX_LABELS, fxFromText, remake, artOf, cleanTheme, generate, processImage, buildSvgs, chromaKey, removeBackground, promptFor, geminiImageModel, openaiImageModel, CANVAS };
})();
