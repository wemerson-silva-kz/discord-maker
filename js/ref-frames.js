/* ==========================================================================
   Referências quadro a quadro.
   Extrai alguns quadros de cada referência da biblioteca (APNG/WebP animado
   do Discord, SVG animado gerado, camadas de entrada/loop dos efeitos) e
   monta uma TIRA de quadros (esquerda → direita = tempo) para a IA de visão
   enxergar o movimento, não só a imagem parada.
   ========================================================================== */
(() => {
  'use strict';
  const CS = window.CosmeticStudio;
  const FRAME_H = { nameplates: 84, decorations: 220, effects: 300, frames: 200 };

  /** URL animada (com CORS) de um item do tipo imagem; para efeitos, entrada e loop. */
  function animatedUrls(item) {
    const a = item.asset || {};
    const fix = (u) => (u ? (CS && CS.mediaProxyUrl ? CS.mediaProxyUrl(u) : u) : '');
    if (Array.isArray(a.layers) && a.layers.length) {
      const intro = a.layers.find((l) => !l.loop) || a.layers[0];
      const loop = a.layers.find((l) => l.loop) || a.layers[a.layers.length - 1];
      return [...new Set([intro.src, loop.src].filter(Boolean))].map(fix);
    }
    const urls = [a.intro, a.loop || a.src].filter(Boolean);
    if (!urls.length && a.staticSrc) urls.push(a.staticSrc);
    return [...new Set(urls)].map((u) => {
      // decorações: a versão animada vem com passthrough=true
      if (/avatar-decoration-presets\//.test(u)) return u.replace(/passthrough=false/, 'passthrough=true');
      return fix(u);
    });
  }

  function toCanvas(src, w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(src, 0, 0, w, h);
    return c;
  }

  /** Quadros de uma imagem animada (ImageDecoder do navegador; senão só o 1º quadro). */
  async function imageFrames(url, count) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    const type = blob.type || (/\.png|format=png/.test(url) ? 'image/png' : 'image/webp');
    if ('ImageDecoder' in window) {
      try {
        const dec = new window.ImageDecoder({ data: await blob.arrayBuffer(), type });
        await dec.tracks.ready;
        const total = (dec.tracks.selectedTrack && dec.tracks.selectedTrack.frameCount) || 1;
        const m = Math.min(count, total);
        // pega o meio de cada trecho (o 1º quadro de uma entrada costuma ser vazio)
        const idx = [...new Set(Array.from({ length: m }, (_, i) => Math.min(total - 1, Math.floor(((i + 0.5) * total) / m))))];
        const out = [];
        for (const frameIndex of idx) {
          const { image } = await dec.decode({ frameIndex });
          out.push(toCanvas(image, image.displayWidth, image.displayHeight));
          image.close();
        }
        dec.close();
        return { frames: out, animated: total > 1, total };
      } catch (e) { /* tipo não suportado: cai para <img> */ }
    }
    const bmp = await createImageBitmap(blob);
    return { frames: [toCanvas(bmp, bmp.width, bmp.height)], animated: false, total: 1 };
  }

  /** Quadros de um SVG animado (renderizado no iframe isolado do exportador). */
  async function svgFrames(svg, cat, seconds, count) {
    if (!window.CosmeticExport || !window.CosmeticExport.sampleSvg) return { frames: [], animated: false };
    const size = { nameplates: { w: 448, h: 84 }, decorations: { w: 288, h: 288 }, effects: { w: 225, h: 440 }, frames: { w: 656, h: 358 } }[cat];
    const list = await window.CosmeticExport.sampleSvg(svg, cat, seconds, count, size);
    return {
      frames: list.map((f) => {
        const c = document.createElement('canvas');
        c.width = f.w; c.height = f.h;
        c.getContext('2d').putImageData(new ImageData(f.data, f.w, f.h), 0, 0);
        return c;
      }),
      animated: list.length > 1,
    };
  }

  /** Quadros de uma referência, em ordem de tempo. */
  async function framesOf(item, cat, count = 4) {
    const a = item.asset || {};
    if (a.type === 'svg' && a.svg) {
      const parts = [];
      if (cat === 'effects' && a.introSvg) parts.push(...(await svgFrames(CS.sanitizeSvg(a.introSvg, cat), cat, a.introSeconds || 3, 2)).frames);
      parts.push(...(await svgFrames(CS.sanitizeSvg(a.svg, cat), cat, a.loopSeconds || 4, parts.length ? count - 1 : count)).frames);
      return { frames: parts, animated: parts.length > 1 };
    }
    if (a.type === 'image') {
      const urls = animatedUrls(item);
      const all = [];
      let animated = false;
      for (const [i, u] of urls.entries()) {
        try {
          const r = await imageFrames(u, urls.length > 1 ? (i === 0 ? 2 : count - 1) : count);
          all.push(...r.frames);
          animated = animated || r.animated;
        } catch (e) { /* tenta a próxima */ }
      }
      return { frames: all, animated };
    }
    return { frames: [], animated: false };
  }

  /** Tira de quadros (fundo do Discord, numerados) → PNG base64. */
  function strip(frames, cat) {
    const H = FRAME_H[cat] || 200;
    const scaled = frames.map((f) => ({ f, w: Math.round((f.width / f.height) * H) }));
    const gap = 8, pad = 8;
    const W = Math.min(2400, scaled.reduce((s, x) => s + x.w, 0) + gap * (scaled.length - 1) + pad * 2);
    const c = document.createElement('canvas');
    c.width = W; c.height = H + pad * 2;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#313338';
    ctx.fillRect(0, 0, c.width, c.height);
    let x = pad;
    scaled.forEach(({ f, w }, i) => {
      ctx.drawImage(f, x, pad, w, H);
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(x, pad, 18, 16);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(String(i + 1), x + 5, pad + 12);
      x += w + gap;
    });
    return c.toDataURL('image/png').split(',')[1];
  }

  /**
   * Tira de quadros de uma referência, ou null se não der para ler.
   * @returns {Promise<{mime:string,data:string,frames:number,animated:boolean,first:string}|null>}
   */
  async function stripOf(item, cat, count = 4) {
    try {
      const { frames, animated } = await framesOf(item, cat, count);
      if (!frames.length) return null;
      return {
        mime: 'image/png',
        data: strip(frames, cat),
        frames: frames.length,
        animated,
        first: frames[0].toDataURL('image/png').split(',')[1],
      };
    } catch (e) {
      console.warn('[Referência]', item.name, e);
      return null;
    }
  }

  window.CosmeticRefFrames = { stripOf, framesOf, animatedUrls };
})();
