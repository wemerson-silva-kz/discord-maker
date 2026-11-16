/* ==========================================================================
   COSMETIC STUDIO — Exportar cosméticos animados como APNG
   --------------------------------------------------------------------------
   Renderiza a animação quadro a quadro, controlando o tempo de cada animação
   CSS pela Web Animations API, e monta um APNG (UPNG.js) no tamanho oficial:
     nameplate 448×84 · moldura 288×288 · efeito 450×880 (entrada + loop)

   • Arte SVG (IA): roda num iframe isolado (sem scripts) para o CSS da arte
     não vazar para a página; cada quadro é "congelado" (valores animados
     viram estilo fixo) e desenhado num canvas.
   • Partículas/CSS do app: capturado com html-to-image.
   • Loop sem emenda: cada animação infinita é ajustada para fechar um número
     inteiro de ciclos dentro da duração do loop.
   ========================================================================== */
(function () {
  'use strict';

  const CS = window.CosmeticStudio;
  if (!CS) return;
  const $ = (s, r = document) => r.querySelector(s);

  const H2I_URL = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/+esm';
  const UPNG_URL = 'https://cdn.jsdelivr.net/npm/upng-js@2.1.0/+esm';
  let libsPromise = null;
  const loadLibs = () => (libsPromise ||= Promise.all([import(H2I_URL), import(UPNG_URL)])
    .then(([h2i, upng]) => ({ toCanvas: h2i.toCanvas, UPNG: upng.default }))
    .catch((e) => { libsPromise = null; throw e; }));

  /** Tamanho de saída e tamanho em que o layout é desenhado (o app foi desenhado para um card de 340 px). */
  const OUT = {
    nameplates: { w: 448, h: 84, rw: 448, rh: 84 },
    decorations: { w: 288, h: 288, rw: 288, rh: 288 },
    effects: { w: 450, h: 880, rw: 340, rh: 665 },
    // Frame: o Discord usa PNG estático de 1312 px; o APNG animado sai em meia resolução
    frames: { w: 656, h: 358, rw: 656, rh: 358 },
  };
  const FRAME_FULL = { w: 1312, h: 716 };

  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  /** Avança todas as animações para o tempo t (ms) — loop: ciclos inteiros dentro de L. */
  function seek(entries, t, L, loop) {
    for (const e of entries) {
      if (loop && e.inf && e.d > 0) {
        const cycles = Math.max(1, Math.round(L / e.d));
        e.a.currentTime = e.t0 + t * (cycles * e.d / L);
      } else {
        e.a.currentTime = e.t0 + t;
      }
    }
  }
  function pauseAll(anims) {
    return anims.map((a) => {
      a.pause();
      const tm = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : {};
      return { a, t0: a.currentTime || 0, d: Number(tm.duration) || 0, inf: tm.iterations === Infinity };
    });
  }

  /* ---------------- Captura: arte SVG (iframe isolado) ---------------- */
  const BAKE = ['transform', 'opacity', 'fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-width',
    'stroke-dasharray', 'stroke-dashoffset', 'visibility', 'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y',
    'width', 'height', 'stop-color', 'stop-opacity', 'transform-origin'];

  async function svgFrames(svgText, cat, seconds, fps, loop, onFrame, isCancelled, size) {
    const { w, h } = size || OUT[cat];
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-same-origin'); // sem allow-scripts
    iframe.style.cssText = `position:fixed;left:-30000px;top:0;width:${w}px;height:${h}px;border:0;visibility:hidden`;
    iframe.srcdoc = `<!doctype html><html><body style="margin:0;background:transparent">${svgText}</body></html>`;
    document.body.appendChild(iframe);
    await new Promise((r) => { iframe.onload = r; });
    await nextFrame();
    const doc = iframe.contentDocument;
    const svg = doc.querySelector('svg');
    const entries = pauseAll(doc.getAnimations());
    const els = [svg, ...svg.querySelectorAll('*')].filter((n) => n.nodeName.toLowerCase() !== 'style');
    const win = iframe.contentWindow;

    const L = seconds * 1000;
    const n = Math.max(1, Math.round(seconds * fps));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const frames = [];
    try {
      for (let k = 0; k < n; k++) {
        if (isCancelled()) throw new Error('cancelado');
        seek(entries, (k * L) / n, L, loop);
        // Congela os valores animados como estilo inline num clone
        const clone = svg.cloneNode(true);
        const cloneEls = [clone, ...clone.querySelectorAll('*')].filter((n2) => n2.nodeName.toLowerCase() !== 'style');
        els.forEach((src, i) => {
          const cs = win.getComputedStyle(src);
          const dst = cloneEls[i];
          if (!dst) return;
          let style = dst.getAttribute('style') || '';
          for (const prop of BAKE) {
            const v = cs.getPropertyValue(prop);
            if (v && !/url\(/.test(v)) style += `;${prop}:${v}`;
          }
          dst.setAttribute('style', style);
        });
        const st = clone.querySelector('style') || clone.insertBefore(doc.createElementNS('http://www.w3.org/2000/svg', 'style'), clone.firstChild);
        st.textContent += '\n*{animation:none!important;transition:none!important}';
        const data = new XMLSerializer().serializeToString(clone);
        const img = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data);
        await img.decode();
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        frames.push(ctx.getImageData(0, 0, w, h).data.buffer.slice(0));
        onFrame(k + 1, n);
      }
    } finally {
      iframe.remove();
    }
    return { frames, dels: frames.map(() => Math.round(L / n)), w, h };
  }

  /* ---------------- Captura: partículas/CSS do app (html-to-image) ---------------- */
  async function domFrames(item, cat, phase, seconds, fps, loop, onFrame, isCancelled) {
    const { toCanvas } = await loadLibs();
    const o = OUT[cat];
    const host = document.createElement('div');
    host.style.cssText = `position:fixed;left:-30000px;top:0;width:${o.rw}px;height:${o.rh}px;overflow:hidden;background:transparent`;
    const layer = CS.buildAsset(item, cat, { phase });
    layer.style.inset = '0';
    layer.style.borderRadius = '0';
    host.appendChild(layer);
    document.body.appendChild(host);
    await nextFrame();
    const entries = pauseAll(host.getAnimations({ subtree: true }));
    const L = seconds * 1000;
    const n = Math.max(1, Math.round(seconds * fps));
    const out = document.createElement('canvas');
    out.width = o.w;
    out.height = o.h;
    const ctx = out.getContext('2d', { willReadFrequently: true });
    const frames = [];
    try {
      for (let k = 0; k < n; k++) {
        if (isCancelled()) throw new Error('cancelado');
        seek(entries, (k * L) / n, L, loop);
        // O clone não pode herdar a posição fora da tela usada para esconder a captura
        const c = await toCanvas(layer, {
          width: o.rw, height: o.rh, pixelRatio: o.w / o.rw, skipFonts: true, cacheBust: false,
          style: { position: 'relative', inset: 'auto', left: '0', top: '0', margin: '0', width: o.rw + 'px', height: o.rh + 'px' },
        });
        ctx.clearRect(0, 0, o.w, o.h);
        ctx.drawImage(c, 0, 0, o.w, o.h);
        frames.push(ctx.getImageData(0, 0, o.w, o.h).data.buffer.slice(0));
        onFrame(k + 1, n);
      }
    } finally {
      host.remove();
    }
    return { frames, dels: frames.map(() => Math.round(L / n)), w: o.w, h: o.h };
  }

  /* ---------------- APNG ---------------- */
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes, start, end) {
    let c = 0xffffffff;
    for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  /** Ajusta quantas vezes o APNG toca (0 = infinito) no chunk acTL. */
  function setPlays(buf, plays) {
    const bytes = new Uint8Array(buf);
    const dv = new DataView(buf);
    let i = 8;
    while (i + 8 <= bytes.length) {
      const len = dv.getUint32(i);
      const type = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
      if (type === 'acTL') {
        dv.setUint32(i + 12, plays);
        dv.setUint32(i + 8 + len, crc32(bytes, i + 4, i + 8 + len));
        break;
      }
      i += 12 + len;
    }
    return buf;
  }

  async function encode(cap, plays, lossless) {
    const { UPNG } = await loadLibs();
    const buf = UPNG.encode(cap.frames, cap.w, cap.h, lossless ? 0 : 256, cap.dels);
    return setPlays(buf, plays);
  }

  /**
   * Exporta um item. Devolve [{ label, filename, blob, info }].
   * @param {{ fps: number, loopSeconds: number, lossless: boolean, onProgress: Function, isCancelled: Function }} opt
   */
  async function exportItem(cat, item, opt) {
    const a = item.asset || {};
    if (a.type === 'image') throw new Error('Itens oficiais já são APNG: use o link original.');
    await loadLibs();
    const slug = (item.name || 'cosmetico').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cosmetico';
    const introSecs = CS.introOf(cat, a);
    const loopSecs = a.type === 'svg' ? a.loopSeconds : opt.loopSeconds;
    const jobs = [];
    // Frame "em volta do card" (1312×2528) ou o antigo, preso no topo (1312×716)
    const full = cat === 'frames' && a.wrap ? { w: 1312, h: 2528 } : FRAME_FULL;
    const half = cat === 'frames' && a.wrap ? { w: 656, h: 1264 } : undefined;
    if (cat === 'frames' && a.type === 'svg') {
      jobs.push({ phase: 'loop', label: `PNG estático ${full.w}×${full.h} (formato do Discord)`, secs: 1 / opt.fps, plays: 0, file: `${slug}-frame.png`, size: full, still: true });
    }
    if (introSecs) jobs.push({ phase: 'intro', label: 'Entrada', secs: introSecs, plays: 1, file: `${slug}-entrada.png` });
    jobs.push({ phase: 'loop', label: introSecs ? 'Loop' : 'Animação', secs: loopSecs, plays: 0, file: `${slug}${introSecs ? '-loop' : ''}.png`, size: half });

    const total = jobs.reduce((s, j) => s + Math.max(1, Math.round(j.secs * opt.fps)), 0);
    let done = 0;
    const results = [];
    for (const job of jobs) {
      const onFrame = () => opt.onProgress(++done, total, job.label);
      const loop = job.phase === 'loop';
      const cap = a.type === 'svg'
        ? await svgFrames(job.phase === 'intro' ? a.introSvg : a.svg, cat, job.secs, opt.fps, loop, onFrame, opt.isCancelled, job.size)
        : await domFrames(item, cat, job.phase, job.secs, opt.fps, loop, onFrame, opt.isCancelled);
      opt.onProgress(done, total, job.label + ' — compactando');
      const buf = await encode(cap, job.plays, opt.lossless);
      const info = CS.parseApng(new Uint8Array(buf));
      results.push({ label: job.label, filename: job.file, blob: new Blob([buf], { type: 'image/png' }), info });
    }
    return results;
  }

  /* ---------------- Diálogo ---------------- */
  let dlg;
  function ensureDialog() {
    if (dlg) return dlg;
    document.body.insertAdjacentHTML('beforeend', `
      <dialog id="apng-dialog" class="json-modal w-[min(94vw,620px)] rounded-xl bg-dc-side text-dc-text p-0 border border-white/10 shadow-2xl">
        <div class="flex items-center justify-between px-4 py-3 border-b border-black/30">
          <h3 class="font-bold">Baixar APNG animado</h3>
          <button type="button" class="btn btn-ghost btn-sm" data-close aria-label="Fechar">✕</button>
        </div>
        <div class="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          <p class="text-sm" id="apng-title"></p>
          <div class="grid sm:grid-cols-3 gap-3">
            <label class="block"><span class="field-label">Quadros por segundo</span>
              <select id="apng-fps" class="dc-input text-sm">
                <option value="12">12 fps (igual ao Discord, menor)</option>
                <option value="24" selected>24 fps (fluido)</option>
                <option value="30">30 fps (mais fluido, maior)</option>
              </select></label>
            <label class="block" id="apng-loop-box"><span class="field-label">Duração do loop</span>
              <select id="apng-loop" class="dc-input text-sm">
                <option value="2">2 s</option><option value="3">3 s</option><option value="4" selected>4 s</option><option value="6">6 s</option>
              </select></label>
            <label class="block"><span class="field-label">Qualidade</span>
              <select id="apng-quality" class="dc-input text-sm">
                <option value="256" selected>256 cores (arquivo menor)</option>
                <option value="0">Sem perdas (maior)</option>
              </select></label>
          </div>
          <p class="text-[11px] text-dc-faint" id="apng-note"></p>
          <div id="apng-progress" class="hidden">
            <div class="h-2 rounded bg-dc-dark overflow-hidden"><div class="h-full bg-[#5865F2] transition-all" style="width:0%"></div></div>
            <p class="text-xs text-dc-muted mt-1" id="apng-progress-text"></p>
          </div>
          <div id="apng-results" class="grid gap-3"></div>
        </div>
        <div class="flex justify-end gap-2 px-4 py-3 border-t border-black/30">
          <button type="button" class="btn btn-ghost btn-sm" data-close>Fechar</button>
          <button type="button" class="btn btn-primary btn-sm" id="apng-go">Gerar APNG</button>
        </div>
      </dialog>`);
    dlg = $('#apng-dialog');
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
    });
    dlg.addEventListener('close', () => { dlg._cancel = true; });
    $('#apng-go').addEventListener('click', run);
    return dlg;
  }

  let current = null;
  function open(cat, id) {
    const item = CS.findItem(cat, id);
    if (!item) return;
    ensureDialog();
    current = { cat, item };
    const a = item.asset || {};
    const introSecs = CS.introOf(cat, a);
    const size = { nameplates: '448×84', decorations: '288×288', effects: '450×880', frames: a.wrap ? '1312×2528' : '1312×716' }[cat];
    $('#apng-title').innerHTML = '';
    $('#apng-title').append(Object.assign(document.createElement('b'), { textContent: item.name }), ` · ${CS.CATS[cat].singular} · ${size}`);
    $('#apng-loop-box').classList.toggle('hidden', a.type === 'svg');
    $('#apng-note').textContent = cat === 'frames'
      ? (a.wrap
        ? 'Frame em volta do card (1312×2528, card de 1200 px com 304 px por cima, 212 por baixo e 56 de cada lado): sai o PNG estático e um APNG animado em meia resolução (656×1264).'
        : 'No Discord o frame é um PNG estático de 1312 px: sai esse PNG e também um APNG animado em meia resolução (656×358).')
      : introSecs
        ? `Efeito em duas fases, como no Discord: um arquivo de ENTRADA (${introSecs.toFixed(1)} s, toca 1×) e um de LOOP (repete).`
        : 'Um arquivo em loop infinito, com fundo transparente.';
    $('#apng-results').innerHTML = '';
    $('#apng-progress').classList.add('hidden');
    $('#apng-go').disabled = false;
    dlg.showModal();
  }

  async function run() {
    if (!current) return;
    const btn = $('#apng-go');
    btn.disabled = true;
    dlg._cancel = false;
    const bar = $('#apng-progress div div');
    const txt = $('#apng-progress-text');
    $('#apng-progress').classList.remove('hidden');
    $('#apng-results').innerHTML = '';
    txt.textContent = 'Carregando o codificador…';
    try {
      const results = await exportItem(current.cat, current.item, {
        fps: +$('#apng-fps').value,
        loopSeconds: +$('#apng-loop').value,
        lossless: $('#apng-quality').value === '0',
        isCancelled: () => dlg._cancel,
        onProgress: (k, n, label) => {
          bar.style.width = Math.round((k / n) * 100) + '%';
          txt.textContent = `${label}: quadro ${k} de ${n}`;
        },
      });
      txt.textContent = 'Pronto!';
      for (const r of results) {
        const url = URL.createObjectURL(r.blob);
        const row = document.createElement('div');
        row.className = 'flex items-center gap-3 rounded-lg bg-dc-dark p-2';
        const prev = document.createElement('img');
        prev.src = url;
        prev.alt = r.label;
        prev.className = 'h-20 w-auto max-w-[120px] object-contain rounded bg-[repeating-conic-gradient(#2B2D31_0_25%,#1E1F22_0_50%)] bg-[length:12px_12px]';
        const meta = document.createElement('div');
        meta.className = 'flex-1 min-w-0 text-xs text-dc-muted';
        const i = r.info;
        meta.innerHTML = `<div class="text-sm font-semibold text-dc-text"></div><div></div>`;
        meta.firstChild.textContent = r.label;
        meta.lastChild.textContent = i.frames > 1
          ? `${i.width}×${i.height} · ${i.frames} quadros · ${i.duration.toFixed(2)} s · ${i.fps} fps · ${i.plays === 0 ? 'loop infinito' : 'toca ' + i.plays + '×'} · ${(r.blob.size / 1024).toFixed(0)} KB`
          : `${i.width}×${i.height} · PNG estático · ${(r.blob.size / 1024).toFixed(0)} KB`;
        const a = document.createElement('a');
        a.href = url;
        a.download = r.filename;
        a.className = 'btn btn-primary btn-sm';
        a.textContent = '⬇ Baixar';
        row.append(prev, meta, a);
        $('#apng-results').appendChild(row);
      }
    } catch (e) {
      if (e.message !== 'cancelado') {
        console.error('[APNG]', e);
        txt.textContent = 'Erro: ' + (e.message || e);
        CS.toast('Não foi possível gerar o APNG: ' + (e.message || e), 'danger');
      }
    } finally {
      btn.disabled = false;
    }
  }

  /**
   * Renderiza `count` quadros de um SVG animado (iframe isolado) para análise.
   * Devolve [{ w, h, data: Uint8ClampedArray RGBA }].
   */
  async function sampleSvg(svgText, cat, seconds, count, size) {
    const secs = Math.max(0.1, seconds);
    const cap = await svgFrames(svgText, cat, secs, count / secs, true, () => {}, () => false, size);
    return cap.frames.map((buf) => ({ w: cap.w, h: cap.h, data: new Uint8ClampedArray(buf) }));
  }

  window.CosmeticExport = { open, exportItem, sampleSvg };
})();
