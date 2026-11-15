/* ==========================================================================
   COSMETIC STUDIO — Lógica da aplicação
   Os itens vivem em js/data.js (window.COSMETICS_DATA).
   ========================================================================== */
(function () {
  'use strict';

  const DATA = window.COSMETICS_DATA;
  const STORAGE_KEY = 'cosmetic-studio:v1';
  const CUSTOM_KEY = 'cosmetic-studio:custom:v1';
  const CUSTOM_COLLECTION = 'Criações IA';
  DATA.collections[CUSTOM_COLLECTION] = DATA.collections[CUSTOM_COLLECTION] || { color: '#57F287' };

  /* ---------------------------------------------------------------- */
  /* Configuração                                                      */
  /* ---------------------------------------------------------------- */
  const CATS = {
    nameplates: { key: 'nameplate', label: 'Nameplates', singular: 'Nameplate', short: 'np', g: 'a' },
    decorations: { key: 'decoration', label: 'Molduras de Avatar', singular: 'Moldura', short: 'deco', g: 'a' },
    effects: { key: 'effect', label: 'Efeitos de Perfil', singular: 'Efeito', short: 'fx', g: 'o' },
  };
  const CAT_BY_KEY = { nameplate: 'nameplates', decoration: 'decorations', effect: 'effects' };

  const svgUri = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const DEFAULT_AVATARS = [
    {
      label: 'Blob',
      src: svgUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="#5865F2"/><circle cx="64" cy="72" r="38" fill="#fff"/><circle cx="50" cy="66" r="6" fill="#23272A"/><circle cx="78" cy="66" r="6" fill="#23272A"/><circle cx="40" cy="78" r="5" fill="#FF9FD0" opacity=".7"/><circle cx="88" cy="78" r="5" fill="#FF9FD0" opacity=".7"/><path d="M52 82q12 10 24 0" stroke="#23272A" stroke-width="5" fill="none" stroke-linecap="round"/></svg>'),
    },
    {
      label: 'Gato',
      src: svgUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="#23A55A"/><path d="M30 56 37 22l23 20Z M98 56 91 22 68 42Z" fill="#FFE8C7"/><path d="M36 44 39 30l10 9Z M92 44 89 30l-10 9Z" fill="#FFB3C7"/><circle cx="64" cy="72" r="36" fill="#FFE8C7"/><ellipse cx="50" cy="68" rx="5" ry="7" fill="#23272A"/><ellipse cx="78" cy="68" rx="5" ry="7" fill="#23272A"/><path d="M54 84q5 5 10 0q5 5 10 0" stroke="#23272A" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="64" cy="79" r="3.5" fill="#EB459E"/></svg>'),
    },
    {
      label: 'Robô',
      src: svgUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="#EB459E"/><line x1="64" y1="24" x2="64" y2="42" stroke="#E3E5E8" stroke-width="5"/><circle cx="64" cy="22" r="7" fill="#FEE75C"/><rect x="28" y="42" width="72" height="58" rx="18" fill="#E3E5E8"/><rect x="40" y="58" width="16" height="14" rx="4" fill="#1E1F22"/><rect x="72" y="58" width="16" height="14" rx="4" fill="#1E1F22"/><rect x="44" y="61" width="6" height="6" rx="2" fill="#00E5FF"/><rect x="76" y="61" width="6" height="6" rx="2" fill="#00E5FF"/><rect x="48" y="82" width="32" height="6" rx="3" fill="#80848E"/></svg>'),
    },
  ];

  const STATUS = {
    online: { label: 'Online' },
    idle: { label: 'Ausente' },
    dnd: { label: 'Não perturbe' },
    offline: { label: 'Invisível' },
  };

  const BANNER_PRESETS = ['#5865F2', '#EB459E', '#57F287', '#FEE75C', '#ED4245', '#00A8FC', '#232428'];

  const DEFAULT_STATE = Object.freeze({
    name: 'Viajante',
    avatar: 0,
    customAvatar: null,
    status: 'online',
    banner: '#5865F2',
    nameplate: null,
    decoration: null,
    effect: null,
  });

  const FAKE_PEOPLE = {
    members: {
      header: 'Online — 4',
      rows: [
        { name: 'Luna', color: '#EB459E', status: 'online', sub: 'Jogando Stardew Valley' },
        { self: true },
        { name: 'Kai', color: '#F0B232', status: 'idle', sub: 'Ausente há 12 min' },
        { name: 'Byte', color: '#00A8FC', status: 'online', sub: 'Ouvindo /ajuda', bot: true },
      ],
    },
    dms: {
      header: 'Mensagens diretas',
      rows: [
        { self: true },
        { name: 'Mika', color: '#57F287', status: 'dnd', sub: 'Não perturbe' },
        { name: 'Theo', color: '#9B59B6', status: 'online', sub: 'Assistindo anime' },
        { name: 'Grupo da Raid', color: '#4E5058', status: null, sub: '5 membros', group: true },
      ],
    },
  };

  /* ---------------------------------------------------------------- */
  /* Utilitários                                                       */
  /* ---------------------------------------------------------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const R = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const normalize = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const findItem = (cat, id) => (id && DATA[cat].find((i) => i.id === id)) || null;
  const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v);
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function setVars(node, vars) {
    for (const k in vars) node.style.setProperty(k, vars[k]);
    return node;
  }
  function el(tag, cls, vars) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (vars) setVars(n, vars);
    return n;
  }
  function svgEl(tag, attrs) {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs || {}) n.setAttribute(k, attrs[k]);
    return n;
  }

  /* ---------------------------------------------------------------- */
  /* Sistema de partículas                                             */
  /* ---------------------------------------------------------------- */
  const SPARKLE_PATH = 'M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z';
  const RAIN_CHARS = 'アイウエオカキクケコサシスセソタチツテト01ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘ<>/#';

  function boltPath(mainX) {
    let x = mainX;
    let d = `M${x.toFixed(1)} 0`;
    const pts = [];
    for (let y = R(7, 12); y < 100; y += R(8, 14)) {
      x = clamp(x + R(-6, 6), 2, 18);
      pts.push([x, y]);
      d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    d += ` L${clamp(x + R(-4, 4), 2, 18).toFixed(1)} 100`;
    return { d, pts };
  }

  const BUILDERS = {
    petal: (o) => el('span', 'p p-petal', {
      '--x': R(-10, 100) + '%', '--s': R(6, 12) * o.size + 'px', '--d': R(4, 8) / o.speed + 's',
      '--delay': -R(0, 8) + 's', '--drift': R(10, 40) * o.wind + 'cqw', '--r': R(180, 720) + 'deg',
    }),
    star: (o) => el('span', 'p p-star', {
      left: R(0, 100) + '%', top: R(0, 100) + '%', '--s': R(1.5, 3.2) * o.size + 'px',
      '--d': R(1.4, 3.4) / o.speed + 's', '--delay': -R(0, 3) + 's',
    }),
    ember: (o) => el('span', 'p p-ember', {
      '--x': R(0, 100) + '%', '--s': Math.round(R(2, 4.5) * o.size) + 'px', '--d': R(1.8, 3.6) / o.speed + 's',
      '--delay': -R(0, 4) + 's', '--drift': R(-12, 12) + 'cqw',
    }),
    streak: (o) => el('span', 'p p-streak', {
      top: R(8, 92) + '%', '--w': R(15, 40) * o.size + 'cqw', '--d': R(1.2, 2.6) / o.speed + 's', '--delay': -R(0, 3) + 's',
    }),
    drop: (o) => el('span', 'p p-drop', {
      '--x': R(0, 130) + '%', '--l': R(10, 22) * o.size + 'px', '--d': R(0.5, 0.9) / o.speed + 's', '--delay': -R(0, 1) + 's',
    }),
    bolt: (o, i, n) => {
      const svg = svgEl('svg', { viewBox: '0 0 20 100', preserveAspectRatio: 'none', class: 'p p-bolt' });
      const main = boltPath(R(6, 14));
      svg.appendChild(svgEl('path', { d: main.d }));
      if (main.pts.length > 3) {
        const [bx, by] = main.pts[Math.floor(main.pts.length / 2)];
        const dir = Math.random() > 0.5 ? 1 : -1;
        svg.appendChild(svgEl('path', { class: 'branch', d: `M${bx.toFixed(1)} ${by.toFixed(1)} L${clamp(bx + dir * 5, 0, 20)} ${by + 9} L${clamp(bx + dir * 8, 0, 20)} ${by + 20}` }));
      }
      const slot = (100 / n) * i;
      return setVars(svg, {
        '--x': clamp(slot + R(0, 100 / n - 10), 2, 88) + '%', '--w': R(10, 18) * o.size + 'px',
        '--d': R(2.6, 5) / o.speed + 's', '--delay': -R(0, 5) + 's',
      });
    },
    sparkle: (o) => {
      const wrap = el('span', 'p p-sparkle' + (o.rise ? ' p-rise' : ''), {
        left: R(0, 96) + '%', top: R(0, 92) + '%', '--s': R(6, 14) * o.size + 'px',
        '--d': R(1.5, 3) / o.speed + 's', '--delay': -R(0, 3) + 's',
        '--rd': R(5, 9) / o.speed + 's', '--rdelay': -R(0, 9) + 's', '--drift': R(-10, 10) + 'cqw',
      });
      const svg = svgEl('svg', { viewBox: '0 0 24 24' });
      svg.appendChild(svgEl('path', { d: SPARKLE_PATH }));
      wrap.appendChild(svg);
      return wrap;
    },
    warp: (o) => el('span', 'p p-warp', {
      '--a': R(0, 360) + 'deg', '--l': R(20, 60) * o.size + 'px', '--d': R(0.8, 1.8) / o.speed + 's', '--delay': -R(0, 2) + 's',
    }),
    rain: (o, i, n) => {
      const s = el('span', 'p p-rain', {
        '--x': ((i + 0.5) / n) * 100 + R(-2, 2) + '%', '--fs': R(9, 13) * o.size + 'px',
        '--d': R(2, 4.5) / o.speed + 's', '--delay': -R(0, 5) + 's',
      });
      const len = Math.round(R(8, 16));
      let txt = '';
      for (let k = 0; k < len; k++) txt += RAIN_CHARS[Math.floor(Math.random() * RAIN_CHARS.length)] + (k < len - 1 ? '\n' : '');
      s.textContent = txt;
      return s;
    },
    glyph: (o) => {
      const motion = o.motion || 'fall';
      const chars = Array.from(o.glyphs || '✦');
      const s = el('span', 'p p-glyph p-glyph-' + motion, {
        '--x': R(-5, 95) + '%', left: R(0, 92) + '%', top: R(0, 88) + '%',
        '--s': R(10, 18) * o.size + 'px', '--d': (motion === 'fall' ? R(4, 8) : motion === 'rise' ? R(5, 9) : R(2, 4)) / o.speed + 's',
        '--delay': -R(0, 8) + 's', '--drift': R(-15, 25) * o.wind + 'cqw', '--r': R(-50, 50) + 'deg',
        '--dx': R(-12, 12) + 'cqw', '--dy': R(-12, 12) + 'cqh',
      });
      s.textContent = chars[Math.floor(Math.random() * chars.length)];
      return s;
    },
    orb: (o) => el('span', 'p p-orb', {
      left: R(0, 90) + '%', top: R(5, 90) + '%', '--s': R(14, 34) * o.size + 'px',
      '--d': R(4, 8) / o.speed + 's', '--delay': -R(0, 8) + 's', '--dx': R(-15, 15) + 'cqw', '--dy': R(-15, 15) + 'cqh',
    }),
    ring: (o) => {
      const wrap = el('span', 'p-ring' + (o.spin ? '' : ' no-spin'), {
        '--spin': (o.spin || 1) + 's', '--dir': o.reverse ? 'reverse' : 'normal',
      });
      for (let i = 0; i < o.count; i++) {
        const item = el('span', 'ring-item', {
          '--a': (360 / o.count) * i + (o.offset || 0) + R(-(o.jitter || 0), o.jitter || 0) + 'deg',
          '--r': (o.radius || 45) + 'cqw',
        });
        const shape = el('span', 'ring-shape shape-' + (o.shape || 'star'), {
          '--k': o.size, '--delay': -R(0, 3) + 's',
        });
        if (o.color) shape.style.setProperty('--c', o.color);
        if (o.shape === 'glyph') {
          const chars = Array.from(o.glyphs || '✦');
          shape.textContent = chars[i % chars.length];
        }
        item.appendChild(shape);
        wrap.appendChild(item);
      }
      return wrap;
    },
    svgring: (o) => {
      const cls = ['p-svgring', o.spin ? 'spin' : '', o.flicker ? 'flicker' : '', o.glow ? 'glow' : ''].join(' ');
      const svg = svgEl('svg', { viewBox: '0 0 100 100', class: cls });
      svg.appendChild(svgEl('circle', {
        cx: 50, cy: 50, r: o.radius || 46, 'stroke-width': o.width || 1, 'stroke-dasharray': o.dash || 'none', 'stroke-linecap': 'round',
      }));
      return setVars(svg, { '--spin': (o.spin || 10) + 's', '--dir': o.reverse ? 'reverse' : 'normal' });
    },
  };
  // Partículas que criam um único elemento (não repetem por `count`)
  const SINGLE = new Set(['ring', 'svgring']);

  function spawnParticles(layer, spec) {
    const build = BUILDERS[spec.kind];
    if (!build) return console.warn('[Cosmetic Studio] partícula desconhecida:', spec.kind);
    const o = Object.assign({ count: 8, size: 1, speed: 1, wind: 1 }, spec);
    const frag = document.createDocumentFragment();
    const n = SINGLE.has(spec.kind) ? 1 : o.count;
    for (let i = 0; i < n; i++) {
      const node = build(o, i, n);
      if (o.color && !SINGLE.has(spec.kind)) node.style.setProperty('--c', o.color);
      if (o.color && spec.kind === 'svgring') node.style.setProperty('--c', o.color);
      frag.appendChild(node);
    }
    layer.appendChild(frag);
  }

  /**
   * Constrói a camada visual de um item.
   * Suporta asset.type = 'css' | 'image' | 'video'.
   */
  function buildAsset(item, cat, { paused = false } = {}) {
    const a = item.asset || {};
    const layer = el('div', cat === 'decorations' ? 'deco-layer' : 'cosmetic-layer');
    if (paused) layer.classList.add('is-paused');

    if (a.type === 'image') {
      if (a.staticSrc) {
        layer.classList.add('has-static');
        const st = el('img', 'asset-static');
        st.src = a.staticSrc;
        st.alt = '';
        layer.appendChild(st);
      }
      const img = el('img', 'asset-anim');
      img.src = a.src;
      img.alt = '';
      img.decoding = 'async';
      if (a.staticSrc) img.style.position = 'absolute';
      layer.appendChild(img);
    } else if (a.type === 'gen') {
      buildGen(layer, a, cat);
    } else if (a.type === 'video') {
      const v = el('video', 'asset-anim');
      Object.assign(v, { src: a.src, autoplay: true, muted: true, loop: true, playsInline: true });
      layer.appendChild(v);
    } else {
      if (a.className) layer.classList.add(...a.className.split(/\s+/));
      (a.particles || []).forEach((spec) => spawnParticles(layer, spec));
    }
    return layer;
  }

  /* ---------------------------------------------------------------- */
  /* Cosméticos gerativos (asset.type = 'gen') — usados pelo Gerador IA */
  /* ---------------------------------------------------------------- */
  const GEN = {
    styles: ['gradient', 'radial', 'nebula', 'aurora', 'scanlines', 'storm', 'pixelfire', 'solid', 'none'],
    anims: ['none', 'shift', 'pulse', 'sweep', 'flash'],
    speeds: { slow: 0.6, normal: 1, fast: 1.7 },
    sizes: { small: 0.7, medium: 1, large: 1.45 },
    rings: ['none', 'conic', 'dashed', 'double', 'glow', 'pixel', 'hud'],
    kinds: ['petal', 'star', 'ember', 'streak', 'bolt', 'sparkle', 'sparkle-rise', 'warp', 'rain', 'orb', 'drop', 'ring', 'glyph'],
    shapes: ['none', 'petal', 'blossom', 'flame', 'bolt', 'crystal', 'planet', 'star', 'pixel', 'glyph'],
    motions: ['fall', 'rise', 'float', 'twinkle'],
    counts: {
      nameplates: { few: 4, some: 8, many: 13 },
      decorations: { few: 5, some: 8, many: 12 },
      effects: { few: 10, some: 22, many: 38 },
    },
    rarities: ['Raro', 'Épico', 'Lendário'],
  };
  const pick = (v, list, def) => (list.includes(v) ? v : def);
  const cleanText = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const hexOr = (v, def) => (isHex(v) ? v.toUpperCase() : def);

  function hexToHue(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (!d) return 0;
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  }

  /** Valida/normaliza a spec gerada (pela IA, pelo gerador local ou por um link). */
  function sanitizeGenAsset(a, cat) {
    a = a && typeof a === 'object' ? a : {};
    const pal = a.palette || {};
    const palette = {
      primary: hexOr(pal.primary, '#5865F2'),
      secondary: hexOr(pal.secondary, '#EB459E'),
      accent: hexOr(pal.accent, '#FFFFFF'),
      background: hexOr(pal.background, '#14151A'),
    };
    const base = a.base || {};
    const layers = (Array.isArray(a.layers) ? a.layers : []).slice(0, 5).map((l) => {
      l = l && typeof l === 'object' ? l : {};
      return {
        kind: pick(l.kind, GEN.kinds, 'sparkle'),
        color: hexOr(l.color, palette.accent),
        count: pick(l.count, ['few', 'some', 'many'], 'some'),
        size: pick(l.size, Object.keys(GEN.sizes), 'medium'),
        speed: pick(l.speed, Object.keys(GEN.speeds), 'normal'),
        shape: pick(l.shape, GEN.shapes, 'none'),
        motion: pick(l.motion, GEN.motions, 'fall'),
        glyphs: Array.from(cleanText(l.glyphs, 40).replace(/\s/g, '')).slice(0, 8).join(''),
      };
    });
    return {
      type: 'gen',
      palette,
      base: {
        style: pick(base.style, GEN.styles, cat === 'effects' ? 'none' : 'gradient'),
        animation: pick(base.animation, GEN.anims, 'shift'),
        speed: pick(base.speed, Object.keys(GEN.speeds), 'normal'),
      },
      ring: { style: pick(a.ring && a.ring.style, GEN.rings, cat === 'decorations' ? 'conic' : 'none') },
      layers,
    };
  }

  function sanitizeGenItem(cat, raw) {
    if (!CATS[cat] || !raw || typeof raw !== 'object') return null;
    const id = /^ai-[a-z0-9-]{4,40}$/.test(raw.id) ? raw.id : 'ai-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    return {
      id,
      name: cleanText(raw.name, 40) || 'Criação IA',
      collection: CUSTOM_COLLECTION,
      rarity: pick(raw.rarity, GEN.rarities, 'Épico'),
      description: cleanText(raw.description, 160),
      tags: (Array.isArray(raw.tags) ? raw.tags : []).slice(0, 6).map((t) => cleanText(t, 24)).filter(Boolean),
      prompt: cleanText(raw.prompt, 300),
      engine: pick(raw.engine, ['claude', 'local'], 'local'),
      asset: sanitizeGenAsset(raw.asset, cat),
      _custom: true,
    };
  }

  /** Converte uma camada da spec para o formato do sistema de partículas. */
  function genLayerToSpec(l, cat, i) {
    let kind = l.kind;
    if (cat !== 'decorations' && kind === 'ring') kind = 'sparkle';
    if (cat === 'decorations' && ['warp', 'rain', 'drop', 'streak'].includes(kind)) kind = 'sparkle';
    const spec = {
      kind,
      color: l.color,
      count: GEN.counts[cat][l.count],
      size: GEN.sizes[l.size],
      speed: GEN.speeds[l.speed],
    };
    if (kind === 'sparkle-rise') Object.assign(spec, { kind: 'sparkle', rise: true });
    if (kind === 'glyph') Object.assign(spec, { glyphs: l.glyphs || '✦', motion: l.motion });
    if (kind === 'ring') {
      const shape = l.shape === 'none' ? (l.glyphs ? 'glyph' : 'star') : l.shape;
      Object.assign(spec, {
        shape,
        glyphs: l.glyphs || '✦',
        radius: i % 2 ? 48 : 44.5,
        spin: { slow: 32, normal: 18, fast: 8 }[l.speed],
        reverse: i % 2 === 1,
        offset: i * 17,
      });
    }
    if (cat === 'nameplates' && (kind === 'petal' || (kind === 'glyph' && l.motion === 'fall'))) {
      spec.speed *= 2.2;
      spec.wind = 2;
    }
    return spec;
  }

  function buildGen(layer, a, cat) {
    const p = a.palette;
    const spd = GEN.speeds[a.base.speed];
    layer.classList.add('gen', 'gen-cat-' + cat);
    setVars(layer, {
      '--g1': p.primary, '--g2': p.secondary, '--g3': p.accent, '--gbg': p.background,
      '--gs': (7 / spd).toFixed(2) + 's', '--rs': (4 / spd).toFixed(2) + 's',
      '--hue': Math.round(hexToHue(p.primary) - 22) + 'deg',
    });
    if (cat === 'decorations') {
      const r = a.ring.style;
      if (r === 'dashed') spawnParticles(layer, { kind: 'svgring', radius: 44, width: 1.4, dash: '6 4', color: p.primary, spin: 10 / spd, glow: true });
      else if (r === 'double') {
        spawnParticles(layer, { kind: 'svgring', radius: 43.5, width: 1.6, color: p.primary, spin: 0, glow: true });
        spawnParticles(layer, { kind: 'svgring', radius: 48, width: 0.7, dash: '2 4', color: p.secondary, spin: 14 / spd, reverse: true, glow: true });
      } else if (r !== 'none') layer.appendChild(el('span', 'gen-ring gen-ring-' + r));
    } else if (a.base.style !== 'none') {
      const b = el('span', 'gen-base gen-' + a.base.style + (a.base.animation === 'shift' || a.base.animation === 'pulse' ? ' gen-anim-' + a.base.animation : ''));
      layer.appendChild(b);
      if (a.base.animation === 'sweep') layer.appendChild(el('span', 'gen-base gen-sweep'));
      if (a.base.animation === 'flash') layer.appendChild(el('span', 'gen-base gen-flash'));
    }
    a.layers.forEach((l, i) => spawnParticles(layer, genLayerToSpec(l, cat, i)));
  }

  /* Armazenamento das criações (localStorage) */
  let customEntries = []; // { cat, item }

  function registerCustom(cat, item, { saved = false } = {}) {
    item._custom = true;
    item._saved = !!saved;
    item._createdAt = item._createdAt || Date.now();
    DATA[cat].push(item);
    customEntries.push({ cat, item });
    persistCustom();
    return item;
  }
  function persistCustom() {
    // Mantém todas as salvas + equipadas + as 24 mais recentes
    const equipped = new Set([state.nameplate, state.decoration, state.effect]);
    const unsaved = customEntries.filter((e) => !e.item._saved && !equipped.has(e.item.id));
    const drop = new Set(unsaved.slice(0, Math.max(0, unsaved.length - 24)).map((e) => e.item.id));
    if (drop.size) {
      customEntries = customEntries.filter((e) => !drop.has(e.item.id));
      for (const cat in CATS) DATA[cat] = DATA[cat].filter((it) => !drop.has(it.id));
    }
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(customEntries.map((e) => ({ c: e.cat, s: !!e.item._saved, t: e.item._createdAt, i: publicItem(e.item) }))));
    } catch (e) { /* armazenamento indisponível */ }
  }
  const saveCustom = persistCustom;
  function loadCustom() {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); } catch (e) { list = []; }
    (Array.isArray(list) ? list : []).forEach((e) => {
      const item = sanitizeGenItem(e && e.c, e && e.i);
      if (!item || findItem(e.c, item.id)) return;
      item._saved = !!e.s;
      item._createdAt = e.t || Date.now();
      DATA[e.c].push(item);
      customEntries.push({ cat: e.c, item });
    });
  }
  function deleteCustom(id) {
    const entry = customEntries.find((e) => e.item.id === id);
    if (!entry) return;
    const key = CATS[entry.cat].key;
    if (state[key] === id) state[key] = null;
    customEntries = customEntries.filter((e) => e !== entry);
    DATA[entry.cat] = DATA[entry.cat].filter((it) => it.id !== id);
    persistCustom();
    commit();
    renderGallery();
    toast(`“${entry.item.name}” excluída.`, 'info');
  }
  /** Versão do item sem campos internos (para link/JSON/exportação). */
  function publicItem(it) {
    const { _custom, _saved, _createdAt, ...rest } = it;
    return rest;
  }
  function b64urlEncode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }

  /* ---------------------------------------------------------------- */
  /* Estado                                                            */
  /* ---------------------------------------------------------------- */
  let state = { ...DEFAULT_STATE };
  const ui = { tab: 'nameplates', query: '', collection: 'Todas', listMode: 'members' };

  function sanitizeState(s) {
    const out = { ...DEFAULT_STATE };
    if (!s || typeof s !== 'object') return out;
    if (typeof s.name === 'string') out.name = s.name.slice(0, 32);
    const av = parseInt(s.avatar, 10);
    if (av >= 0 && av < DEFAULT_AVATARS.length) out.avatar = av;
    if (typeof s.customAvatar === 'string' && s.customAvatar.startsWith('data:image/')) out.customAvatar = s.customAvatar;
    if (STATUS[s.status]) out.status = s.status;
    if (isHex(s.banner)) out.banner = s.banner;
    for (const key of ['nameplate', 'decoration', 'effect']) {
      if (findItem(CAT_BY_KEY[key], s[key])) out[key] = s[key];
    }
    return out;
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Sem espaço (avatar grande) ou storage bloqueado: tenta sem o avatar personalizado
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, customAvatar: null })); } catch (_) { /* ignora */ }
    }
  }

  /* Link de compartilhamento (hash) */
  function toHash() {
    const p = new URLSearchParams();
    p.set('n', state.name);
    p.set('a', String(state.avatar));
    p.set('s', state.status);
    p.set('b', state.banner.replace('#', ''));
    if (state.nameplate) p.set('np', state.nameplate);
    if (state.decoration) p.set('deco', state.decoration);
    if (state.effect) p.set('fx', state.effect);
    const custom = [];
    for (const key of ['nameplate', 'decoration', 'effect']) {
      const cat = CAT_BY_KEY[key];
      const it = findItem(cat, state[key]);
      if (it && it._custom) custom.push({ c: cat, i: publicItem(it) });
    }
    if (custom.length) p.set('g', b64urlEncode(JSON.stringify(custom)));
    return p.toString();
  }
  function fromHash() {
    const h = location.hash.replace(/^#/, '');
    if (!h || !/(^|&)(np|deco|fx|n)=/.test(h)) return null;
    const p = new URLSearchParams(h);
    if (p.get('g')) {
      try {
        const list = JSON.parse(b64urlDecode(p.get('g')));
        (Array.isArray(list) ? list.slice(0, 3) : []).forEach((e) => {
          if (!CATS[e.c]) return;
          const item = sanitizeGenItem(e.c, e.i);
          if (item && !findItem(e.c, item.id)) registerCustom(e.c, item, { saved: false });
        });
      } catch (err) {
        console.warn('[Cosmetic Studio] link com criações inválido', err);
      }
    }
    return {
      name: p.get('n') ?? undefined,
      avatar: p.get('a'),
      status: p.get('s'),
      banner: p.get('b') ? '#' + p.get('b') : undefined,
      nameplate: p.get('np'),
      decoration: p.get('deco'),
      effect: p.get('fx'),
    };
  }

  const displayName = () => state.name.trim() || 'Viajante';
  const handle = () => {
    const slug = normalize(displayName()).replace(/\s+/g, '.').replace(/[^a-z0-9._]/g, '').replace(/\.{2,}/g, '.').replace(/^\.|\.$/g, '').slice(0, 20);
    return slug || 'viajante';
  };
  const avatarSrc = () => state.customAvatar || DEFAULT_AVATARS[state.avatar].src;
  const equippedCount = () => ['nameplate', 'decoration', 'effect'].filter((k) => state[k]).length;

  /* ---------------------------------------------------------------- */
  /* Toasts                                                            */
  /* ---------------------------------------------------------------- */
  const TOAST_ICONS = {
    success: { bg: '#23A55A', svg: '<path d="m5 12.5 4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"/>' },
    info: { bg: '#5865F2', svg: '<path d="M12 8h.01M11 12h1v5h1" stroke-linecap="round" stroke-linejoin="round"/>' },
    danger: { bg: '#DA373C', svg: '<path d="M7 7l10 10M17 7 7 17" stroke-linecap="round"/>' },
    camera: { bg: '#EB459E', svg: '<path d="M4 8h3l2-3h6l2 3h3v11H4z" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.5"/>' },
  };
  function toast(message, type = 'success') {
    const root = $('#toast-root');
    while (root.children.length >= 3) root.firstElementChild.remove();
    const ic = TOAST_ICONS[type] || TOAST_ICONS.info;
    const t = el('div', 'dc-toast');
    t.setAttribute('role', 'status');
    t.innerHTML = `<span class="toast-icon" style="background:${ic.bg}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true">${ic.svg}</svg></span><span></span>`;
    t.lastElementChild.textContent = message;
    root.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, 2800);
  }

  /* ---------------------------------------------------------------- */
  /* Galeria                                                           */
  /* ---------------------------------------------------------------- */
  function matches(item, q) {
    if (ui.collection !== 'Todas' && item.collection !== ui.collection) return false;
    if (!q) return true;
    const hay = normalize([item.name, item.collection, item.rarity, item.description, ...(item.tags || [])].join(' '));
    return q.split(/\s+/).every((w) => hay.includes(w));
  }
  function filtered(cat) {
    const q = normalize(ui.query).trim();
    return DATA[cat].filter((it) => !(it._custom && !it._saved) && matches(it, q));
  }

  function renderTabs() {
    const tabs = $('#tabs');
    tabs.innerHTML = '';
    for (const cat in CATS) {
      const b = el('button', 'tab-btn');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(ui.tab === cat));
      b.dataset.tab = cat;
      b.innerHTML = `<span>${CATS[cat].label}</span><span class="tab-count">${filtered(cat).length}</span>`;
      tabs.appendChild(b);
    }
    const g = el('button', 'tab-btn tab-ai');
    g.type = 'button';
    g.setAttribute('role', 'tab');
    g.setAttribute('aria-selected', String(ui.tab === 'generator'));
    g.dataset.tab = 'generator';
    g.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10 2c.5 4 2.6 6.1 6.6 6.6-4 .5-6.1 2.6-6.6 6.6-.5-4-2.6-6.1-6.6-6.6C7.4 8.1 9.5 6 10 2Z"/><path d="M18 13c.3 2.3 1.5 3.5 3.8 3.8-2.3.3-3.5 1.5-3.8 3.8-.3-2.3-1.5-3.5-3.8-3.8 2.3-.3 3.5-1.5 3.8-3.8Z"/></svg><span>Gerador IA</span><span class="tab-new">NOVO</span>';
    tabs.appendChild(g);
    $$('.rail-btn[data-tab]').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === ui.tab));
  }

  function renderChips() {
    const box = $('#collection-chips');
    box.innerHTML = '';
    const names = ['Todas', ...Object.keys(DATA.collections)];
    for (const name of names) {
      const b = el('button', 'chip shrink-0' + (ui.collection === name ? ' is-active' : ''));
      b.type = 'button';
      b.dataset.collection = name;
      const color = DATA.collections[name]?.color;
      b.innerHTML = (color ? `<span class="chip-dot" style="--dot:${color}"></span>` : '') + escapeHtml(name);
      box.appendChild(b);
    }
  }

  function cardPreview(cat, item) {
    const wrap = el('div', 'card-preview relative h-40 flex items-center justify-center overflow-hidden');
    wrap.insertAdjacentHTML('beforeend', `<span class="hover-hint"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>Passe o mouse</span>`);
    if (cat === 'nameplates') {
      const row = el('div', 'relative w-[86%] max-w-[300px] h-[44px] rounded-md overflow-hidden flex items-center gap-3 px-2.5 bg-dc-side shadow-lg');
      row.appendChild(buildAsset(item, cat, { paused: true }));
      row.insertAdjacentHTML('beforeend', `
        <div class="relative w-8 h-8 shrink-0"><img class="js-user-avatar w-8 h-8 rounded-full object-cover" alt="" /></div>
        <div class="relative min-w-0 leading-tight">
          <div class="js-user-name text-[15px] font-semibold text-white truncate drop-shadow"></div>
          <div class="text-[11px] text-white/70 truncate">Online</div>
        </div>`);
      wrap.appendChild(row);
    } else if (cat === 'decorations') {
      const av = el('div', 'relative w-[84px] h-[84px]');
      av.innerHTML = '<img class="js-user-avatar w-full h-full rounded-full object-cover" alt="" />';
      av.appendChild(buildAsset(item, cat, { paused: true }));
      wrap.appendChild(av);
    } else {
      const mini = el('div', 'mini-profile');
      mini.innerHTML = `
        <div class="h-11 js-user-banner"></div>
        <div class="absolute left-2.5 top-6 w-10 h-10 rounded-full bg-dc-side p-[3px]"><img class="js-user-avatar w-full h-full rounded-full object-cover" alt="" /></div>
        <div class="px-2.5 pt-7 space-y-1.5">
          <div class="js-user-name text-[12px] font-bold truncate"></div>
          <div class="h-1.5 w-16 rounded bg-white/10"></div>
          <div class="h-10 rounded-md bg-dc-dark/70 mt-2"></div>
        </div>`;
      mini.appendChild(buildAsset(item, cat, { paused: true }));
      wrap.appendChild(mini);
    }
    return wrap;
  }

  function buildCard(cat, item, { variant = 'gallery' } = {}) {
    const coll = DATA.collections[item.collection] || { color: '#B5BAC1' };
    const rar = DATA.rarities[item.rarity] || { color: '#B5BAC1' };
    const card = el('article', 'cosmetic-card hover-host fade-in rounded-xl bg-dc-side border border-white/5 overflow-hidden flex flex-col');
    card.dataset.id = item.id;
    card.dataset.cat = cat;
    card.appendChild(cardPreview(cat, item));
    card.insertAdjacentHTML('beforeend', `
      <span class="equipped-badge hidden"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Equipado</span>
      <div class="p-3.5 flex flex-col gap-2 flex-1">
        <div class="flex items-start justify-between gap-2">
          <h3 class="font-bold text-[15px] leading-5">${escapeHtml(item.name)}</h3>
          <span class="text-[11px] font-bold shrink-0 mt-0.5" style="color:${rar.color}">${escapeHtml(item.rarity || '')}</span>
        </div>
        <p class="text-xs text-dc-muted leading-snug">${escapeHtml(item.description || '')}</p>
        <div class="mt-auto pt-2 flex items-center justify-between gap-2">
          <button type="button" class="tag" style="--tag:${coll.color}" data-collection="${escapeHtml(item.collection)}" title="Filtrar pela coleção ${escapeHtml(item.collection)}">#${escapeHtml(item.collection)}</button>
          <button type="button" class="btn btn-sm btn-primary btn-try" data-id="${escapeHtml(item.id)}" data-cat="${cat}">Testar no Perfil</button>
        </div>
        ${variant === 'gen' ? `
        <div class="flex flex-wrap gap-1.5 pt-1 border-t border-white/5 mt-1">
          <button type="button" class="btn btn-sm btn-ghost !px-2 gen-save" data-id="${escapeHtml(item.id)}">${item._saved ? '★ Salvo' : '☆ Salvar'}</button>
          <button type="button" class="btn btn-sm btn-ghost !px-2 gen-vary" data-id="${escapeHtml(item.id)}">🎲 Variar</button>
          <button type="button" class="btn btn-sm btn-ghost !px-2 gen-json" data-id="${escapeHtml(item.id)}">{ } JSON</button>
        </div>` : ''}
        ${variant === 'gallery' && item._custom ? `<button type="button" class="self-start text-[11px] text-dc-faint hover:text-dc-red gen-delete" data-id="${escapeHtml(item.id)}">Excluir criação</button>` : ''}
      </div>`);
    return card;
  }

  function renderGrid() {
    const grid = $('#grid');
    const isGen = ui.tab === 'generator';
    $('#generator-panel').classList.toggle('hidden', !isGen);
    ['#grid', '#collection-chips', '#results-row'].forEach((s) => $(s).classList.toggle('hidden', isGen));
    if (isGen) {
      $('#empty').classList.add('hidden');
      document.dispatchEvent(new CustomEvent('cs:generator-open'));
      return;
    }
    const items = filtered(ui.tab);
    grid.innerHTML = '';
    const frag = document.createDocumentFragment();
    items.forEach((it, i) => {
      const c = buildCard(ui.tab, it);
      c.style.animationDelay = i * 30 + 'ms';
      frag.appendChild(c);
    });
    grid.appendChild(frag);

    const total = DATA[ui.tab].length;
    $('#results-label').textContent = items.length === total
      ? `${CATS[ui.tab].label} — ${total} itens`
      : `${items.length} de ${total} ${CATS[ui.tab].label.toLowerCase()}`;

    const empty = $('#empty');
    empty.classList.toggle('hidden', items.length > 0);
    if (!items.length) {
      const actions = $('#empty-actions');
      actions.innerHTML = '';
      for (const cat in CATS) {
        if (cat === ui.tab) continue;
        const n = filtered(cat).length;
        if (n) {
          const b = el('button', 'btn btn-sm btn-secondary');
          b.type = 'button';
          b.dataset.goto = cat;
          b.textContent = `Ver ${n} em ${CATS[cat].label}`;
          actions.appendChild(b);
        }
      }
      const clear = el('button', 'btn btn-sm btn-ghost');
      clear.type = 'button';
      clear.dataset.clearFilters = '1';
      clear.textContent = 'Limpar filtros';
      actions.appendChild(clear);
      $('#empty-text').textContent = ui.query
        ? `Nada em ${CATS[ui.tab].label} para “${ui.query}”${ui.collection !== 'Todas' ? ` na coleção ${ui.collection}` : ''}.`
        : `Nenhum item da coleção ${ui.collection} em ${CATS[ui.tab].label}.`;
    }
    syncUserBits(grid);
    updateCardStates();
  }

  function updateCardStates() {
    $$('.cosmetic-card[data-cat]').forEach((card) => {
      const key = CATS[card.dataset.cat].key;
      const on = state[key] === card.dataset.id;
      card.classList.toggle('is-equipped', on);
      card.querySelector('.equipped-badge').classList.toggle('hidden', !on);
      const btn = card.querySelector('.btn-try');
      btn.textContent = on ? 'Remover' : 'Testar no Perfil';
      btn.classList.toggle('btn-primary', !on);
      btn.classList.toggle('btn-secondary', on);
      btn.setAttribute('aria-pressed', String(on));
    });
  }

  function renderGallery() {
    renderTabs();
    renderChips();
    renderGrid();
  }

  /* ---------------------------------------------------------------- */
  /* Pré-visualização                                                  */
  /* ---------------------------------------------------------------- */
  function fakeAvatar(p) {
    const initial = escapeHtml(p.name.charAt(0));
    const icon = p.group
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><circle cx="16.5" cy="9" r="2.8" opacity=".8"/><path d="M2.5 19c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5zM15 13.6c3 .2 5.6 1.9 6.3 5.4H17"/></svg>'
      : initial;
    return `<div class="relative w-8 h-8 shrink-0"><div class="fake-avatar" style="background:${p.color}">${icon}</div>${p.status ? `<span class="status-dot status-${p.status}" style="font-size:10px;right:-2px;bottom:-2px;--ring:#2B2D31"></span>` : ''}</div>`;
  }

  function renderList() {
    const box = $('#sim-list');
    const cfg = FAKE_PEOPLE[ui.listMode];
    box.innerHTML = `<div class="px-2 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-dc-faint flex items-center justify-between">${escapeHtml(cfg.header)}${ui.listMode === 'dms' ? '<span class="text-base leading-none text-dc-muted">+</span>' : ''}</div>`;
    for (const p of cfg.rows) {
      if (p.self) {
        box.insertAdjacentHTML('beforeend', `
          <div class="member-row hover-host is-self ${ui.listMode === 'dms' ? 'bg-[#404249]/60' : ''}" title="Passe o mouse para animar">
            <div class="np-slot js-np-slot"></div>
            <div class="relative w-8 h-8 shrink-0">
              <img class="js-user-avatar w-8 h-8 rounded-full object-cover" alt="" />
              <div class="js-deco-slot js-deco-paused absolute inset-0"></div>
              <span class="status-dot js-user-status" style="font-size:10px;right:-2px;bottom:-2px;--ring:#2B2D31"></span>
            </div>
            <div class="relative min-w-0 leading-tight">
              <div class="js-user-name text-[15px] font-semibold text-white truncate"></div>
              <div class="text-xs text-[#DBDEE1]/80 truncate">Testando cosméticos ✨</div>
            </div>
          </div>`);
      } else {
        box.insertAdjacentHTML('beforeend', `
          <div class="member-row">
            ${fakeAvatar(p)}
            <div class="min-w-0 leading-tight">
              <div class="text-[15px] font-medium text-dc-faint truncate">${escapeHtml(p.name)}${p.bot ? '<span class="bot-tag">APP</span>' : ''}</div>
              <div class="text-xs text-dc-faint/80 truncate">${escapeHtml(p.sub)}</div>
            </div>
          </div>`);
      }
    }
    $$('#list-mode button').forEach((b) => b.classList.toggle('is-active', b.dataset.mode === ui.listMode));
    mounted.nameplate = mounted.decoration = undefined; // força remontagem nos slots novos
    renderPreview();
  }

  const mounted = { nameplate: undefined, decoration: undefined, effect: undefined };

  function mountCosmetic(key, { force = false } = {}) {
    const cat = CAT_BY_KEY[key];
    const id = state[key];
    if (!force && mounted[key] === id) return;
    mounted[key] = id;
    const item = findItem(cat, id);

    if (key === 'nameplate') {
      $$('.js-np-slot').forEach((slot) => {
        slot.innerHTML = '';
        slot.closest('.member-row')?.classList.toggle('has-np', !!item);
        if (item) slot.appendChild(buildAsset(item, cat, { paused: true }));
      });
    } else if (key === 'decoration') {
      $$('#preview-panel .js-deco-slot').forEach((slot) => {
        slot.innerHTML = '';
        if (item) slot.appendChild(buildAsset(item, cat, { paused: slot.classList.contains('js-deco-paused') }));
      });
    } else {
      const slot = $('#profile-effect');
      slot.innerHTML = '';
      if (item) slot.appendChild(buildAsset(item, cat));
      $('#btn-replay').classList.toggle('hidden', !item);
    }
  }

  function syncUserBits(root = document) {
    const name = displayName();
    const src = avatarSrc();
    $$('.js-user-name', root).forEach((n) => { if (n.textContent !== name) n.textContent = name; });
    $$('.js-user-avatar', root).forEach((img) => { if (img.getAttribute('src') !== src) img.src = src; });
    $$('.js-user-banner', root).forEach((b) => { b.style.background = state.banner; });
  }

  function renderPreview() {
    syncUserBits();
    $$('.js-user-handle').forEach((n) => { n.textContent = '@' + handle(); });
    $$('.js-user-status').forEach((n) => {
      n.classList.remove('status-online', 'status-idle', 'status-dnd', 'status-offline');
      n.classList.add('status-' + state.status);
    });
    $$('.js-status-label').forEach((n) => { n.textContent = STATUS[state.status].label; });
    $('#profile-banner').style.background = state.banner;

    mountCosmetic('nameplate');
    mountCosmetic('decoration');
    mountCosmetic('effect');

    renderEquipped();
    renderControlsState();
  }

  function renderEquipped() {
    const list = $('#equipped-list');
    const chips = $('#profile-cosmetics');
    list.innerHTML = '';
    chips.innerHTML = '';
    let any = false;
    for (const cat in CATS) {
      const key = CATS[cat].key;
      const item = findItem(cat, state[key]);
      const coll = item ? DATA.collections[item.collection] : null;
      const row = el('div', 'flex items-center gap-2.5 rounded-lg px-2.5 h-10 ' + (item ? 'bg-dc-dark/60' : 'bg-dc-dark/30 border border-dashed border-white/10'));
      row.innerHTML = `
        <span class="text-[11px] font-bold uppercase tracking-wide text-dc-faint w-[68px] shrink-0">${CATS[cat].singular}</span>
        ${item
          ? `<span class="w-2 h-2 rounded-full shrink-0" style="background:${coll.color}"></span>
             <button type="button" class="text-sm font-semibold truncate text-left hover:underline" data-goto="${cat}" title="Ver na galeria">${escapeHtml(item.name)}</button>
             <button type="button" class="ml-auto w-6 h-6 rounded-full grid place-items-center text-dc-muted hover:text-white hover:bg-white/10" data-unequip="${key}" aria-label="Remover ${escapeHtml(item.name)}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round"/></svg></button>`
          : `<button type="button" class="text-sm text-dc-faint hover:text-dc-muted" data-goto="${cat}">Nenhum — escolher…</button>`}`;
      list.appendChild(row);
      if (item) {
        any = true;
        const c = el('span', 'tag');
        c.style.setProperty('--tag', coll.color);
        c.textContent = item.name;
        chips.appendChild(c);
      }
    }
    if (!any) chips.innerHTML = '<span class="text-[#DBDEE1]/60 text-xs">Nenhum cosmético equipado ainda.</span>';
    const n = equippedCount();
    const badge = $('#fab-badge');
    badge.textContent = n;
    badge.classList.toggle('hidden', n === 0);
  }

  function renderAvatarPicks() {
    const box = $('#avatar-picks');
    $$('.avatar-pick[data-avatar]', box).forEach((n) => n.remove());
    const upload = $('#avatar-upload-label');
    DEFAULT_AVATARS.forEach((av, i) => {
      const b = el('button', 'avatar-pick');
      b.type = 'button';
      b.dataset.avatar = String(i);
      b.title = av.label;
      b.innerHTML = `<img src="${av.src}" alt="Avatar padrão ${escapeHtml(av.label)}" />`;
      box.insertBefore(b, upload);
    });
    const custom = el('button', 'avatar-pick hidden');
    custom.type = 'button';
    custom.dataset.avatar = 'custom';
    custom.title = 'Sua foto';
    custom.innerHTML = '<img alt="Sua foto enviada" />';
    box.insertBefore(custom, upload);
  }

  function renderStatusPicks() {
    const box = $('#status-picks');
    box.innerHTML = '';
    for (const k in STATUS) {
      const b = el('button', '');
      b.type = 'button';
      b.dataset.status = k;
      b.setAttribute('role', 'radio');
      b.innerHTML = `<span class="inline-flex items-center gap-1.5"><span class="relative inline-block w-3 h-3"><span class="status-dot status-${k}" style="font-size:8px;left:0;top:0;--ring:#404249;border-width:0"></span></span>${STATUS[k].label}</span>`;
      box.appendChild(b);
    }
  }

  function renderBannerPicks() {
    const box = $('#banner-picks');
    const custom = $('#input-banner');
    BANNER_PRESETS.forEach((c) => {
      const b = el('button', 'swatch');
      b.type = 'button';
      b.dataset.banner = c;
      b.style.background = c;
      b.title = c;
      b.setAttribute('aria-label', 'Banner ' + c);
      box.insertBefore(b, custom);
    });
  }

  function renderControlsState() {
    const nameInput = $('#input-name');
    if (document.activeElement !== nameInput) nameInput.value = state.name;
    $('#name-count').textContent = `${nameInput.value.length}/32`;

    const customBtn = $('.avatar-pick[data-avatar="custom"]');
    if (state.customAvatar) {
      customBtn.classList.remove('hidden');
      customBtn.querySelector('img').src = state.customAvatar;
    } else customBtn.classList.add('hidden');
    $$('.avatar-pick[data-avatar]').forEach((b) => {
      const v = b.dataset.avatar;
      b.classList.toggle('is-active', state.customAvatar ? v === 'custom' : v === String(state.avatar));
    });

    $$('#status-picks button').forEach((b) => {
      const on = b.dataset.status === state.status;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', String(on));
    });

    const preset = BANNER_PRESETS.find((c) => c.toLowerCase() === state.banner.toLowerCase());
    $$('#banner-picks [data-banner]').forEach((b) => b.classList.toggle('is-active', b.dataset.banner === preset));
    const colorInput = $('#input-banner');
    colorInput.value = state.banner;
    colorInput.classList.toggle('is-active', !preset);
  }

  /* ---------------------------------------------------------------- */
  /* Ações                                                             */
  /* ---------------------------------------------------------------- */
  function commit() {
    saveLocal();
    renderPreview();
    updateCardStates();
    syncUserBits($('#grid'));
  }

  function toggleEquip(cat, id) {
    const key = CATS[cat].key;
    const item = findItem(cat, id);
    if (!item) return;
    const removing = state[key] === id;
    state[key] = removing ? null : id;
    commit();
    if (removing) toast(`${CATS[cat].singular} “${item.name}” removid${CATS[cat].g} do perfil.`, 'info');
    else {
      toast(`${CATS[cat].singular} “${item.name}” aplicad${CATS[cat].g} ao perfil!`, 'success');
      pulsePreview();
    }
  }

  function pulsePreview() {
    const card = $('#profile-card');
    card.style.boxShadow = '0 0 0 2px #5865F2, 0 8px 32px rgba(88,101,242,.45)';
    clearTimeout(pulsePreview.t);
    pulsePreview.t = setTimeout(() => { card.style.boxShadow = ''; }, 600);
  }

  function setTab(tab) {
    if ((!CATS[tab] && tab !== 'generator') || tab === ui.tab) return;
    ui.tab = tab;
    renderTabs();
    renderGrid();
  }

  function resetAll() {
    state = { ...DEFAULT_STATE };
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignora */ }
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    $('#input-name').value = state.name;
    commit();
    toast('Perfil restaurado ao padrão.', 'info');
  }

  async function copyLink() {
    const hash = toHash();
    const url = location.href.split('#')[0] + '#' + hash;
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch (e) {
      const ta = el('textarea', 'fixed -left-[9999px] top-0');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
      ta.remove();
    }
    try { history.replaceState(null, '', '#' + hash); } catch (e) { /* ignora */ }
    toast(ok ? 'Link da combinação copiado para a área de transferência!' : 'Não foi possível copiar — o link está na barra de endereço.', ok ? 'success' : 'danger');
    if (state.customAvatar) setTimeout(() => toast('Fotos enviadas não vão no link — quem abrir verá um avatar padrão.', 'info'), 450);
  }

  function savePrint() {
    const flash = $('#profile-flash');
    flash.classList.remove('is-flashing');
    void flash.offsetWidth; // reinicia a animação
    flash.classList.add('is-flashing');
    const date = new Date().toISOString().slice(0, 10);
    setTimeout(() => toast(`Print salvo como perfil-${handle()}-${date}.png (simulado)`, 'camera'), 250);
  }

  function handleUpload(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('Escolha um arquivo de imagem (PNG, JPG, GIF ou WEBP).', 'danger');
    if (file.size > 8 * 1024 * 1024) return toast('Imagem muito grande — o limite é 8 MB.', 'danger');
    const reader = new FileReader();
    reader.onload = () => {
      // Reduz para 256px para caber no armazenamento local
      const img = new Image();
      img.onload = () => {
        let url = reader.result;
        if (file.type !== 'image/gif') {
          const size = 256;
          const c = document.createElement('canvas');
          c.width = c.height = size;
          const ctx = c.getContext('2d');
          const s = Math.min(img.width, img.height);
          ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
          try { url = c.toDataURL('image/webp', 0.9); } catch (e) { /* mantém original */ }
          if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/png');
        }
        state.customAvatar = url;
        commit();
        toast('Avatar atualizado!', 'success');
      };
      img.onerror = () => toast('Não foi possível ler essa imagem.', 'danger');
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  /* ---------------------------------------------------------------- */
  /* Eventos                                                           */
  /* ---------------------------------------------------------------- */
  function bindEvents() {
    $('#tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (b) setTab(b.dataset.tab);
    });
    $('#tabs').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const keys = Object.keys(CATS);
      const i = keys.indexOf(ui.tab);
      setTab(keys[(i + (e.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length]);
      $(`#tabs [data-tab="${ui.tab}"]`)?.focus();
    });
    $$('.rail-btn[data-tab]').forEach((b) => b.addEventListener('click', () => {
      setTab(b.dataset.tab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }));

    $('#collection-chips').addEventListener('click', (e) => {
      const b = e.target.closest('[data-collection]');
      if (!b) return;
      ui.collection = b.dataset.collection;
      renderGallery();
    });

    let searchTimer;
    $('#search').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        ui.query = e.target.value;
        // Se a aba atual não tiver resultados mas outra tiver, troca automaticamente
        if (ui.query && !filtered(ui.tab).length) {
          const other = Object.keys(CATS).find((c) => filtered(c).length);
          if (other) ui.tab = other;
        }
        renderTabs();
        renderGrid();
      }, 120);
    });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        $('#search').focus();
        $('#search').select();
      }
    });
    if (/Mac|iPhone|iPad/.test(navigator.platform || '')) $('#kbd-hint').textContent = '⌘ K';

    $('#grid').addEventListener('click', (e) => {
      const tryBtn = e.target.closest('.btn-try');
      if (tryBtn) return toggleEquip(tryBtn.dataset.cat, tryBtn.dataset.id);
      const del = e.target.closest('.gen-delete');
      if (del) return deleteCustom(del.dataset.id);
      const tag = e.target.closest('[data-collection]');
      if (tag) {
        ui.collection = tag.dataset.collection;
        renderGallery();
      }
    });

    $('#empty').addEventListener('click', (e) => {
      const go = e.target.closest('[data-goto]');
      if (go) return setTab(go.dataset.goto);
      if (e.target.closest('[data-clear-filters]')) {
        ui.query = '';
        ui.collection = 'Todas';
        $('#search').value = '';
        renderGallery();
      }
    });

    $('#equipped-list').addEventListener('click', (e) => {
      const un = e.target.closest('[data-unequip]');
      if (un) {
        const key = un.dataset.unequip;
        const cat = CAT_BY_KEY[key];
        const item = findItem(cat, state[key]);
        state[key] = null;
        commit();
        if (item) toast(`“${item.name}” removido do perfil.`, 'info');
        return;
      }
      const go = e.target.closest('[data-goto]');
      if (go) {
        setTab(go.dataset.goto);
        if (window.innerWidth < 1024) window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    const nameInput = $('#input-name');
    nameInput.addEventListener('input', () => {
      state.name = nameInput.value.slice(0, 32);
      commit();
    });
    nameInput.addEventListener('blur', () => renderControlsState());

    $('#avatar-picks').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-avatar]');
      if (!b) return;
      if (b.dataset.avatar === 'custom') return;
      state.avatar = parseInt(b.dataset.avatar, 10);
      state.customAvatar = null;
      commit();
    });
    $('#input-avatar').addEventListener('change', (e) => {
      handleUpload(e.target.files[0]);
      e.target.value = '';
    });

    $('#status-picks').addEventListener('click', (e) => {
      const b = e.target.closest('[data-status]');
      if (!b) return;
      state.status = b.dataset.status;
      commit();
    });

    $('#banner-picks').addEventListener('click', (e) => {
      const b = e.target.closest('[data-banner]');
      if (!b) return;
      state.banner = b.dataset.banner;
      commit();
    });
    $('#input-banner').addEventListener('input', (e) => {
      if (isHex(e.target.value)) {
        state.banner = e.target.value;
        commit();
      }
    });

    $('#list-mode').addEventListener('click', (e) => {
      const b = e.target.closest('[data-mode]');
      if (!b || b.dataset.mode === ui.listMode) return;
      ui.listMode = b.dataset.mode;
      renderList();
    });
    $('#force-anim').addEventListener('change', (e) => {
      $('#sim-list').classList.toggle('force-anim', e.target.checked);
    });

    $('#btn-replay').addEventListener('click', () => mountCosmetic('effect', { force: true }));
    $('#btn-reset').addEventListener('click', resetAll);
    $('#btn-copy').addEventListener('click', copyLink);
    $('#btn-print').addEventListener('click', savePrint);
    $('#fab-preview').addEventListener('click', () => {
      $('#preview-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    window.addEventListener('hashchange', () => {
      const h = fromHash();
      if (!h) return;
      state = sanitizeState({ ...state, ...stripUndefined(h), customAvatar: null });
      commit();
      toast('Combinação carregada do link!', 'success');
    });
  }

  function stripUndefined(o) {
    const out = {};
    for (const k in o) if (o[k] !== undefined && o[k] !== null) out[k] = o[k];
    return out;
  }

  /* ---------------------------------------------------------------- */
  /* Inicialização                                                     */
  /* ---------------------------------------------------------------- */
  function init() {
    loadCustom();
    const fromLink = fromHash();
    if (fromLink) {
      // Link compartilhado: aplica exatamente a combinação recebida
      state = sanitizeState(stripUndefined(fromLink));
    } else {
      state = sanitizeState(loadLocal());
    }

    $('#member-since').textContent = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });

    renderAvatarPicks();
    renderStatusPicks();
    renderBannerPicks();
    bindEvents();
    renderGallery();
    renderList(); // também chama renderPreview()

    if (fromLink) {
      saveLocal();
      setTimeout(() => toast('Combinação carregada do link!', 'success'), 300);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Exposto para depuração / extensões
  window.CosmeticStudio = {
    CATS, DATA, GEN, buildAsset, buildCard, toast, syncUserBits, updateCardStates, findItem,
    sanitizeGenItem, registerCustom, saveCustom, deleteCustom, publicItem,
    equip: (cat, id) => toggleEquip(cat, id),
    setSaved(cat, id, saved) {
      const it = findItem(cat, id);
      if (!it) return;
      it._saved = !!saved;
      persistCustom();
      renderTabs();
    },
    get state() { return { ...state }; },
  };
})();
