/* ==========================================================================
   Mídia de referência: link (Pinterest, imagem, GIF, vídeo) ou arquivo.
   Lê alguns quadros ao longo do tempo para a IA "assistir" a mídia e gerar
   os formatos pedidos (nameplate, moldura, efeito, profile frame).
   ========================================================================== */
(() => {
  'use strict';
  const MAX_SIDE = 768;
  // Proxy de imagens com CORS (só recebe a URL pública da imagem). Usado quando o host não libera CORS.
  const IMG_PROXY = (u, animated) => `https://wsrv.nl/?url=${encodeURIComponent(u)}${animated ? '&n=-1&output=webp' : '&output=png'}`;

  function canvasOf(src, w, h, maxSide = MAX_SIDE) {
    const s = Math.min(1, maxSide / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * s));
    c.height = Math.max(1, Math.round(h * s));
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c;
  }

  /** Quadros espalhados de uma imagem (GIF/WebP/APNG animados via ImageDecoder). */
  async function framesFromBlob(blob, count, maxSide) {
    const type = blob.type || 'image/png';
    if ('ImageDecoder' in window && /gif|webp|png|apng/.test(type)) {
      try {
        const dec = new window.ImageDecoder({ data: await blob.arrayBuffer(), type });
        await dec.tracks.ready;
        const total = (dec.tracks.selectedTrack && dec.tracks.selectedTrack.frameCount) || 1;
        const m = Math.min(count, total);
        const idx = [...new Set(Array.from({ length: m }, (_, i) => Math.min(total - 1, Math.floor(((i + 0.5) * total) / m))))];
        const frames = [];
        for (const frameIndex of idx) {
          const { image } = await dec.decode({ frameIndex });
          frames.push(canvasOf(image, image.displayWidth, image.displayHeight, maxSide));
          image.close();
        }
        let seconds = 0;
        try { for (let i = 0; i < total; i++) seconds += (await dec.decode({ frameIndex: i })).image.duration / 1e6; } catch (e) { seconds = 0; }
        dec.close();
        return { frames, animated: total > 1, seconds: seconds || undefined };
      } catch (e) { /* cai para <img> */ }
    }
    const bmp = await createImageBitmap(blob);
    const c = canvasOf(bmp, bmp.width, bmp.height, maxSide);
    bmp.close();
    return { frames: [c], animated: false };
  }

  /** Quadros de um vídeo (arquivo ou URL com CORS), espalhados pela duração. */
  function framesFromVideo(src, count, maxSide, maxSpan) {
    return new Promise((resolve, reject) => {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
      const frames = [];
      let times = [];
      const fail = () => reject(new Error('Não deu para ler o vídeo.'));
      v.onerror = fail;
      v.onloadedmetadata = () => {
        const d = isFinite(v.duration) && v.duration > 0 ? v.duration : 1;
        const span = maxSpan ? Math.min(d, maxSpan) : d;
        times = Array.from({ length: count }, (_, i) => Math.min(d - 0.05, ((i + 0.5) * span) / count));
        v.currentTime = times[0];
      };
      v.onseeked = () => {
        try { frames.push(canvasOf(v, v.videoWidth, v.videoHeight, maxSide)); frames[frames.length - 1].getContext('2d').getImageData(0, 0, 1, 1); } catch (e) { return reject(new Error('O site do vídeo não deixa ler os quadros.')); }
        if (frames.length < times.length) v.currentTime = times[frames.length];
        else { resolve({ frames, animated: frames.length > 1, duration: v.duration, seconds: maxSpan ? Math.min(v.duration, maxSpan) : v.duration }); v.removeAttribute('src'); v.load(); }
      };
      v.src = src;
    });
  }

  async function fromFile(file, count = 6) {
    if (/^video\//.test(file.type)) {
      const url = URL.createObjectURL(file);
      try { return { ...(await framesFromVideo(url, count)), name: file.name, kind: 'vídeo', source: { video: file } }; } finally { URL.revokeObjectURL(url); }
    }
    if (!/^image\//.test(file.type)) throw new Error('Envie uma imagem, GIF ou vídeo.');
    return { ...(await framesFromBlob(file, count)), name: file.name, kind: /gif/.test(file.type) ? 'GIF' : 'imagem', source: { blob: file } };
  }

  const decode = (s) => { const t = document.createElement('textarea'); t.innerHTML = s || ''; return t.value; };

  /** Pin do Pinterest → mídia (API pública de widgets, com CORS). */
  async function pinterestMedia(pinId) {
    const res = await fetch(`https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=${pinId}`);
    const j = await res.json().catch(() => null);
    const d = j && j.data && j.data[0];
    if (!d) throw new Error('Pin não encontrado (ele pode ser privado).');
    const vids = d.videos && d.videos.video_list;
    const mp4 = vids && Object.values(vids).find((v) => /\.mp4/.test(v.url));
    const imgs = d.images || {};
    const best = imgs.orig || imgs['736x'] || imgs['564x'] || Object.values(imgs).pop();
    return {
      video: mp4 ? mp4.url : '',
      image: best ? best.url.replace(/\/(236|237|564)x\//, '/736x/') : '',
      title: decode(d.description || d.title || '').replace(/\s+/g, ' ').slice(0, 80),
    };
  }

  async function blobVia(url, animated) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.blob();
    } catch (e) { /* sem CORS: tenta o proxy */ }
    const r = await fetch(IMG_PROXY(url, animated));
    if (!r.ok) throw new Error('Não deu para baixar a imagem (HTTP ' + r.status + ').');
    return r.blob();
  }

  /**
   * Link → quadros. Aceita pin do Pinterest, imagem/GIF/WebP direto ou vídeo .mp4/.webm.
   * @returns {Promise<{frames:HTMLCanvasElement[], animated:boolean, name:string, kind:string, note?:string, videoUrl?:string}>}
   */
  async function fromUrl(raw, count = 6) {
    const url = String(raw || '').trim();
    if (!/^https?:\/\//i.test(url)) throw new Error('Cole um link começando com https://');
    if (/pin\.it\//i.test(url)) throw new Error('Links curtos pin.it não funcionam: abra o pin e copie o link completo (pinterest.com/pin/…).');
    const pin = url.match(/pinterest\.[a-z.]+\/pin\/(?:[^/]*--)?(\d+)/i);
    if (pin) {
      const m = await pinterestMedia(pin[1]);
      if (m.video) {
        try { return { ...(await framesFromVideo(m.video, count)), name: m.title || 'Vídeo do Pinterest', kind: 'vídeo' }; } catch (e) {
          // O Pinterest não libera ler os quadros do vídeo no navegador: usa a capa.
          const blob = await blobVia(m.image, false);
          const r = await framesFromBlob(blob, count);
          return { ...r, source: { blob }, name: m.title || 'Vídeo do Pinterest', kind: 'capa do vídeo', videoUrl: m.video, note: 'O Pinterest não deixa o navegador ler o vídeo: usei só a capa. Para a IA ver o movimento, baixe o vídeo e envie o arquivo.' };
        }
      }
      if (!m.image) throw new Error('Esse pin não tem imagem pública.');
      const isGif = /\.gif(\?|$)/i.test(m.image);
      const blob = await blobVia(m.image, isGif);
      return { ...(await framesFromBlob(blob, count)), name: m.title || 'Pin do Pinterest', kind: isGif ? 'GIF' : 'imagem', source: { blob } };
    }
    if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) {
      try { return { ...(await framesFromVideo(url, count)), name: url.split('/').pop().slice(0, 60), kind: 'vídeo', source: { videoUrl: url } }; } catch (e) {
        throw new Error('Esse site não deixa ler o vídeo pelo navegador. Baixe o vídeo e envie o arquivo.');
      }
    }
    const isGif = /\.gif(\?|$)/i.test(url);
    const blob = await blobVia(url, true);
    return { ...(await framesFromBlob(blob, count)), source: { blob }, name: url.split('/').pop().split('?')[0].slice(0, 60) || 'Imagem', kind: isGif ? 'GIF' : 'imagem' };
  }

  /** Tira de quadros (esquerda → direita = tempo), numerada, no formato das referências. */
  function stripOf(media, cat) {
    const H = { nameplates: 120, decorations: 220, effects: 300, frames: 240 }[cat] || 240;
    const fr = media.frames;
    const scaled = fr.map((f) => ({ f, w: Math.round((f.width / f.height) * H) }));
    const gap = 8, pad = 8;
    const c = document.createElement('canvas');
    c.width = Math.min(2400, scaled.reduce((s, x) => s + x.w, 0) + gap * (scaled.length - 1) + pad * 2);
    c.height = H + pad * 2;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#313338';
    ctx.fillRect(0, 0, c.width, c.height);
    let x = pad;
    scaled.forEach(({ f, w }, i) => {
      ctx.drawImage(f, x, pad, w, H);
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x, pad, 18, 16);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.fillText(String(i + 1), x + 5, pad + 12);
      x += w + gap;
    });
    return {
      mime: 'image/png',
      data: c.toDataURL('image/png').split(',')[1],
      frames: fr.length,
      animated: media.animated,
      first: fr[Math.floor(fr.length / 2)].toDataURL('image/png').split(',')[1],
    };
  }

  /** Quadros em resolução maior e mais seguidos, para usar a mídia COMO arte animada. */
  async function artFrames(media) {
    const src = media.source || {};
    try {
      if (src.video || src.videoUrl) {
        const url = src.video ? URL.createObjectURL(src.video) : src.videoUrl;
        try { return await framesFromVideo(url, 60, 900, 5); } finally { if (src.video) URL.revokeObjectURL(url); }
      }
      if (src.blob) return await framesFromBlob(src.blob, 48, 1000);
    } catch (e) { console.warn('[Mídia] quadros em alta falharam; usando os da prévia', e); }
    return { frames: media.frames, animated: media.animated, seconds: media.seconds || media.duration };
  }

  window.CosmeticMediaRef = { fromFile, fromUrl, stripOf, artFrames };
})();
