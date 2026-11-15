/* ==========================================================================
   COSMETIC STUDIO — Importar cosméticos oficiais do Discord
   --------------------------------------------------------------------------
   Monta itens a partir de IDs/URLs do CDN do Discord (sem baixar nada para o
   repositório — as imagens são carregadas direto do cdn.discordapp.com):

   • Moldura / Nameplate (2 estados):
       https://cdn.discordapp.com/media/v1/collectibles-shop/<sku>/animated
       https://cdn.discordapp.com/media/v1/collectibles-shop/<sku>/static
     Molduras também aceitam o hash do preset (a_xxxxxxxx…):
       https://cdn.discordapp.com/avatar-decoration-presets/<hash>.png?passthrough=true|false
   • Efeito de perfil (2 fases): URL/hash da ENTRADA (toca 1×) + URL/hash do LOOP.
   ========================================================================== */
(function () {
  'use strict';

  const CS = window.CosmeticStudio;
  if (!CS) return;
  const { CATS } = CS;
  const $ = (s, r = document) => r.querySelector(s);
  const CDN = 'https://cdn.discordapp.com';
  const SHOP = CDN + '/media/v1/collectibles-shop/';

  /** Interpreta um ID/URL e devolve { animated, static } ou { url } . */
  function parseRef(input) {
    const s = String(input || '').trim();
    if (!s) return null;
    let m;
    if ((m = s.match(/avatar-decoration-presets\/((?:a_)?[0-9a-f]{32})/i)) || (m = s.match(/^((?:a_)?[0-9a-f]{32})$/i))) {
      const hash = m[1];
      return {
        kind: 'preset',
        key: hash,
        animated: `${CDN}/avatar-decoration-presets/${hash}.png?size=240&passthrough=true`,
        static: `${CDN}/avatar-decoration-presets/${hash}.png?size=240&passthrough=false`,
      };
    }
    if ((m = s.match(/collectibles-shop\/(\d{15,21})(?:\/(?:animated|static))?/)) || (m = s.match(/^(\d{15,21})$/))) {
      return { kind: 'sku', key: m[1], animated: `${SHOP}${m[1]}/animated`, static: `${SHOP}${m[1]}/static` };
    }
    if ((m = s.match(/collectibles-shop\/([0-9a-f]{64})/i)) || (m = s.match(/^([0-9a-f]{64})$/i))) {
      return { kind: 'hash', key: m[1].toLowerCase(), url: SHOP + m[1].toLowerCase() };
    }
    try {
      const u = new URL(s);
      if (u.protocol === 'https:') return { kind: 'url', key: u.pathname.split('/').pop().slice(0, 12), url: u.href, animated: u.href };
    } catch (e) { /* não é URL */ }
    return null;
  }

  function buildItem(cat, form) {
    const name = form.name.trim();
    const collection = form.collection.trim() || 'Discord';
    if (cat === 'effects') {
      const intro = parseRef(form.intro);
      const loop = parseRef(form.loop);
      if (!intro && !loop) throw new Error('Informe ao menos a URL/hash da entrada ou do loop.');
      const introUrl = intro && (intro.url || intro.animated);
      const loopUrl = loop && (loop.url || loop.animated);
      const key = (intro || loop).key.slice(0, 12);
      const linked = form.linkId && CS.findItem('effects', form.linkId);
      return CS.sanitizeCustomItem(cat, {
        id: linked ? linked.id : 'dc-fx-' + key.toLowerCase().replace(/[^a-z0-9-]/g, ''),
        name: name || `Efeito do Discord #${key.slice(0, 6)}`,
        collection,
        description: introUrl && loopUrl ? 'Efeito importado: entrada (1×) e depois loop.' : 'Efeito importado do Discord.',
        tags: ['discord', 'importado'],
        asset: { type: 'image', intro: introUrl || undefined, loop: loopUrl || undefined, introDuration: Math.min(6, Math.max(0.5, parseFloat(form.dur) || 4)) },
      });
    }
    const ref = parseRef(form.main);
    if (!ref) throw new Error('ID ou URL não reconhecido.');
    const sta = parseRef(form.staticUrl);
    const short = SHORT[cat] || 'np';
    return CS.sanitizeCustomItem(cat, {
      id: `dc-${short}-` + ref.key.toLowerCase().replace(/[^a-z0-9-]/g, ''),
      name: name || `${CATS[cat].singular} do Discord #${ref.key.slice(-6)}`,
      collection,
      description: 'Importado do Discord (estático até o hover, animado ao passar o mouse).',
      tags: ['discord', 'importado'],
      asset: { type: 'image', src: ref.animated || ref.url, staticSrc: (sta && (sta.static || sta.url)) || ref.static || undefined },
    });
  }

  /* ---------------- Catálogo (catalog/discord.json) ---------------- */
  const TYPE_TO_CAT = { decoration: 'decorations', nameplate: 'nameplates', effect: 'effects', frame: 'frames' };
  const CAT_TO_TYPE = { decorations: 'decoration', nameplates: 'nameplate', effects: 'effect', frames: 'frame' };
  const SHORT = { decorations: 'deco', nameplates: 'np', frames: 'frame' };

  /** Converte uma entrada do catálogo no item da galeria (mesmas regras do tools/build-catalog.mjs). */
  function catalogEntryToItem(e) {
    const cat = TYPE_TO_CAT[e && e.type];
    if (!cat) return null;
    const base = { name: e.name, collection: e.collection || 'Discord', description: e.description, tags: e.tags || ['discord', 'oficial'] };
    if (cat === 'effects') {
      const intro = parseRef(e.intro), loop = parseRef(e.loop);
      if (!intro && !loop) return null;
      const key = (intro || loop).key.slice(0, 12).toLowerCase();
      return { cat, raw: { ...base, id: 'dc-fx-' + key, name: e.name || `Efeito do Discord #${key.slice(0, 6)}`,
        description: e.description || 'Efeito oficial em duas fases: a entrada toca uma vez e depois entra o loop.',
        asset: { type: 'image', intro: intro && (intro.url || intro.animated), loop: loop && (loop.url || loop.animated), meta: e.meta } } };
    }
    const ref = parseRef(e.sku || e.preset || e.src);
    if (!ref) return null;
    const short = SHORT[cat] || 'np';
    return { cat, raw: { ...base, id: `dc-${short}-` + ref.key.toLowerCase().replace(/[^a-z0-9-]/g, ''),
      name: e.name || `${CATS[cat].singular} do Discord #${ref.key.slice(-6)}`,
      description: e.description || 'Asset oficial do CDN do Discord: estático até o hover, animado ao passar o mouse.',
      asset: { type: 'image', src: ref.animated || ref.url, staticSrc: (e.staticSrc && parseRef(e.staticSrc)?.url) || ref.static, meta: e.meta } } };
  }

  async function loadCatalog() {
    try {
      const res = await fetch('catalog/discord.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const entries = (Array.isArray(data.items) ? data.items : []).map(catalogEntryToItem).filter(Boolean);
      entries.forEach((e) => { e.raw.source = 'catalog'; });
      CS.addCatalogItems(entries);
    } catch (e) {
      console.warn('[Catálogo] não foi possível carregar catalog/discord.json (abra o site por um servidor HTTP):', e.message);
    }
  }

  /* ---------------- Loja ao vivo (API pública do itemshop.gg) ----------------
     O cliente (js/itemshop.js) cuida de cache, fingerprint, ETag e 429.
     Termos: mostrar "Data from itemshop.gg" com link para meta.attribution.url. */

  /** @param {import('../types/itemshop').Price | null} p */
  function priceLabel(p) {
    if (!p) return '';
    if (p.amount == null) return p.label || '';
    if (p.currency === 'USD') return 'US$ ' + Number(p.amount).toFixed(2).replace('.', ',');
    return `${p.amount} ${p.currency || ''}`.trim();
  }

  /**
   * Converte um item da API no formato da galeria (só tipos que dá para testar no perfil).
   * @param {import('../types/itemshop').Item} it
   * @param {import('../types/itemshop').Section} sec
   */
  function shopItemToEntry(it, sec) {
    const card = it.images && it.images.card;
    if (!card || !/^\d{15,21}$/.test(it.id || '')) return null;
    const section = sec.title;
    const desc = [sec.upcoming ? 'Em breve' : '', it.soldOut ? 'Esgotado' : '', priceLabel(it.price), section].filter(Boolean).join(' · ');
    const base = { name: it.name, collection: section || 'Loja do Discord', source: 'shop', tags: ['discord', 'loja', String(it.type || '').toLowerCase()] };
    if (it.type === 'Avatar Decoration' && /avatar-decoration-presets\//.test(card)) {
      return { cat: 'decorations', raw: { ...base, id: 'dc-deco-' + it.id, description: desc,
        asset: { type: 'image', src: card.replace('passthrough=false', 'passthrough=true'), staticSrc: card } } };
    }
    if (it.type === 'Nameplate' && /\/static$/.test(card)) {
      return { cat: 'nameplates', raw: { ...base, id: 'dc-np-' + it.id, description: desc,
        asset: { type: 'image', src: card.replace(/\/static$/, '/animated'), staticSrc: card } } };
    }
    if (it.type === 'Profile Frame' && /\/static$/.test(card)) {
      // Frame: arte estática (o CDN não tem versão animada)
      return { cat: 'frames', raw: { ...base, id: 'dc-frame-' + it.id, description: desc, asset: { type: 'image', src: card } } };
    }
    if (it.type === 'Profile Effect') {
      // A API só traz uma miniatura estática; entrada/loop podem ser adicionados pelo importador.
      return { cat: 'effects', raw: { ...base, id: 'dc-fx-' + it.id, description: desc,
        asset: { type: 'image', loop: card } } };
    }
    return null;
  }

  /** @param {import('../types/itemshop').ShopAnswer} answer */
  function shopToEntries(answer) {
    const entries = [];
    const bundles = [];
    for (const sec of (answer.data && answer.data.sections) || []) {
      for (const it of sec.items || []) {
        if (it.type === 'Bundle' && /^\d{15,21}$/.test(it.id || '')) {
          bundles.push({ id: it.id, name: it.name, section: sec.title, card: it.images && it.images.card, price: priceLabel(it.price) });
          continue;
        }
        const e = shopItemToEntry(it, sec);
        if (e) entries.push(e);
      }
    }
    return { entries, bundles };
  }

  /* ---------------- Produto oficial (API pública do Discord) ----------------
     GET discord.com/api/v9/collectibles-products/<sku> responde sem login e com
     CORS. Traz a config completa do efeito (camadas de entrada/loop com tempos)
     e o conteúdo exato dos pacotes. Buscado só sob demanda e guardado 7 dias. */
  const PRODUCT_API = 'https://discord.com/api/v9/collectibles-products/';
  const PRODUCT_CACHE = 'cosmetic-studio:discord-products:v1';
  const PRODUCT_TTL = 7 * 24 * 3600 * 1000;
  const productInflight = new Map();
  let productBlockedUntil = 0;
  const readProducts = () => { try { return JSON.parse(localStorage.getItem(PRODUCT_CACHE) || '{}') || {}; } catch (e) { return {}; } };
  function saveProduct(sku, compact) {
    const all = readProducts();
    all[sku] = { t: Date.now(), ...compact };
    const keys = Object.keys(all);
    if (keys.length > 400) keys.sort((a, b) => all[a].t - all[b].t).slice(0, keys.length - 400).forEach((k) => delete all[k]);
    try { localStorage.setItem(PRODUCT_CACHE, JSON.stringify(all)); } catch (e) { /* cheio */ }
  }
  /** Só o que usamos: camadas do efeito e conteúdo do pacote. */
  function compactProduct(p) {
    const out = { name: p.name || '' };
    const fx = (p.items || []).find((it) => it.type === 1 && Array.isArray(it.effects));
    if (fx) {
      out.effect = {
        layers: fx.effects.map((e) => ({ src: e.src, loop: !!e.loop, duration: e.duration, start: e.start, loopDelay: e.loopDelay, zIndex: e.zIndex })),
        thumb: fx.thumbnailPreviewSrc || '',
        reduced: fx.reducedMotionSrc || '',
      };
    }
    const np = (p.items || []).find((it) => String(it.type) === '2' && it.palette);
    if (np) out.palette = np.palette;
    if ((p.items || []).length > 1 || p.type === 1000) out.contents = (p.items || []).map((it) => ({ type: it.type, sku: String(it.sku_id || '') }));
    return out;
  }
  /** Fila: no máximo uma chamada ao Discord a cada 250 ms. */
  let queueTail = Promise.resolve();
  function enqueue(fn) {
    const run = queueTail.then(fn);
    queueTail = run.catch(() => {}).then(() => new Promise((r) => setTimeout(r, 250)));
    return run;
  }

  async function fetchProduct(sku) {
    if (!/^\d{15,21}$/.test(sku)) throw new Error('SKU inválido');
    const cached = readProducts()[sku];
    if (cached && Date.now() - cached.t < PRODUCT_TTL) return cached;
    if (Date.now() < productBlockedUntil) throw new Error('limite de requisições do Discord; tente em instantes');
    if (productInflight.has(sku)) return productInflight.get(sku);
    const job = enqueue(async () => {
      const res = await fetch(PRODUCT_API + sku, { credentials: 'omit' });
      if (res.status === 429) {
        let secs = 30;
        try { secs = Math.ceil((await res.json()).retry_after || 30); } catch (e) { /* padrão */ }
        productBlockedUntil = Date.now() + secs * 1000;
        throw new Error(`limite de requisições do Discord; tente em ${secs} s`);
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const compact = compactProduct(await res.json());
      saveProduct(sku, compact);
      return compact;
    }).finally(() => productInflight.delete(sku));
    productInflight.set(sku, job);
    return job;
  }
  const effectAsset = (fx) => ({ type: 'image', layers: fx.layers, staticSrc: fx.thumb || undefined, reduced: fx.reduced || undefined });

  /** Dá a um efeito da loja a animação oficial (camadas do Discord). */
  async function animateShopEffect(id, { play = false } = {}) {
    const it = CS.findItem('effects', id);
    if (!it || it.asset.layers) return;
    const sku = id.replace(/^dc-fx-/, '');
    try {
      const prod = await fetchProduct(sku);
      if (!prod.effect) return;
      const clean = CS.sanitizeCustomItem('effects', { id: it.id, name: it.name, collection: it.collection, asset: effectAsset(prod.effect) });
      if (clean) CS.updateAsset('effects', id, clean.asset, { play });
    } catch (e) {
      console.warn('[Discord] efeito', sku, e.message);
    }
  }
  /** Ao carregar a loja: aplica as configs já guardadas (sem rede). */
  function applyCachedEffects(entries) {
    const all = readProducts();
    for (const e of entries) {
      if (e.cat === 'nameplates') {
        const c = all[e.raw.id.replace(/^dc-np-/, '')];
        if (c && c.palette && Date.now() - c.t < PRODUCT_TTL) e.raw.asset = { ...e.raw.asset, discordPalette: c.palette };
        continue;
      }
      if (e.cat !== 'effects') continue;
      const c = all[e.raw.id.replace(/^dc-fx-/, '')];
      if (c && c.effect && Date.now() - c.t < PRODUCT_TTL) e.raw.asset = effectAsset(c.effect);
    }
  }
  /** Nameplate da loja: aplica a paleta oficial (nome da API; cor da tabela em data.js). */
  async function paletteShopNameplate(id) {
    const it = CS.findItem('nameplates', id);
    if (!it || it.source !== 'shop' || it.asset.discordPalette) return;
    try {
      const prod = await fetchProduct(id.replace(/^dc-np-/, ''));
      if (!prod.palette) return;
      CS.updateAsset('nameplates', id, { ...it.asset, discordPalette: prod.palette });
    } catch (e) {
      console.warn('[Discord] paleta', id, e.message);
    }
  }
  document.addEventListener('cs:visible', (ev) => {
    if (ev.detail.cat === 'effects') animateShopEffect(ev.detail.id, { play: true });
    if (ev.detail.cat === 'nameplates') paletteShopNameplate(ev.detail.id);
  });
  document.addEventListener('cs:need-effect', (ev) => animateShopEffect(ev.detail.id, { play: !!ev.detail.hover }));
  document.addEventListener('cs:equip', (ev) => {
    if (ev.detail.cat === 'effects') animateShopEffect(ev.detail.id);
    if (ev.detail.cat === 'nameplates') paletteShopNameplate(ev.detail.id);
  });

  /* ---------------- Pacotes (bundles) da loja ---------------- */
  let shopBundles = [];
  /** Itens da loja que formam o pacote: mesma coleção e mesmo nome-base ("X Bundle" → "X"). */
  function bundleContents(b) {
    const base = b.name.replace(/\s*bundle\s*$/i, '').trim().toLowerCase();
    const out = {};
    for (const cat of ['decorations', 'nameplates', 'effects', 'frames']) {
      const inSection = CS.DATA[cat].filter((it) => it.source === 'shop' && it.collection === b.section);
      out[cat] = inSection.find((it) => it.name.trim().toLowerCase() === base) || null;
    }
    return out;
  }
  const findBundle = (id) => shopBundles.find((b) => b.id === id) || null;

  async function loadShop() {
    if (!window.ItemShop) return;
    try {
      const res = await window.ItemShop.shop('discord', shopToEntries);
      const value = Array.isArray(res.value) ? { entries: res.value, bundles: [] } : res.value; // cache antigo
      applyCachedEffects(value.entries);
      CS.addCatalogItems(value.entries);
      shopBundles = value.bundles || [];
      CS.setShopAttribution(res.meta && res.meta.attribution && res.meta.attribution.url, res.meta && res.meta.terms, res.shopDate, res.stale);
    } catch (e) {
      console.warn('[Loja] não foi possível carregar a loja do itemshop.gg:', e.code || e.status || '', e.message);
      if (e.status === 429) CS.toast(`A loja do Discord está temporariamente indisponível (limite de requisições). Tente em ${e.retryAfter || 60} s.`, 'info');
    }
  }

  async function loadOfficial() {
    await loadCatalog(); // o catálogo vem primeiro: os itens dele já têm métricas (meta)
    await loadShop();
    CS.catalogReady();
  }

  /** Entrada pronta para colar em catalog/discord.json, a partir do formulário. */
  function formToCatalogEntry(cat, form) {
    const entry = { type: CAT_TO_TYPE[cat], name: form.name.trim() || undefined, collection: form.collection.trim() || 'Discord' };
    if (cat === 'effects') {
      const intro = parseRef(form.intro), loop = parseRef(form.loop);
      if (!intro && !loop) throw new Error('Informe a entrada e/ou o loop.');
      if (intro) entry.intro = intro.kind === 'hash' ? intro.key : intro.url || intro.animated;
      if (loop) entry.loop = loop.kind === 'hash' ? loop.key : loop.url || loop.animated;
    } else {
      const ref = parseRef(form.main);
      if (!ref) throw new Error('ID ou URL não reconhecido.');
      if (ref.kind === 'sku') entry.sku = ref.key;
      else if (ref.kind === 'preset') entry.preset = ref.key;
      else entry.src = ref.url;
    }
    return entry;
  }

  let dlg;
  function ensureDialog() {
    if (dlg) return dlg;
    document.body.insertAdjacentHTML('beforeend', `
      <dialog id="import-dialog" class="json-modal w-[min(94vw,560px)] rounded-xl bg-dc-side text-dc-text p-0 border border-white/10 shadow-2xl">
        <form method="dialog" class="flex flex-col max-h-[88vh]">
          <div class="flex items-center justify-between px-4 py-3 border-b border-black/30">
            <h3 class="font-bold">Importar cosmético do Discord</h3>
            <button type="button" class="btn btn-ghost btn-sm" data-close aria-label="Fechar">✕</button>
          </div>
          <div class="p-4 space-y-3 overflow-y-auto">
            <div>
              <span class="field-label">Categoria</span>
              <div class="seg" id="imp-cat">
                <button type="button" data-cat="decorations" class="is-active">Moldura</button>
                <button type="button" data-cat="nameplates">Nameplate</button>
                <button type="button" data-cat="effects">Efeito de Perfil</button>
                <button type="button" data-cat="frames">Frame</button>
              </div>
            </div>
            <div data-for="single">
              <label class="field-label" for="imp-main">ID, hash ou URL animada</label>
              <input id="imp-main" class="dc-input font-mono text-sm" placeholder="1476286689528774717  ou  .../collectibles-shop/<id>/animated" spellcheck="false" />
              <label class="field-label mt-3" for="imp-static">URL estática (opcional)</label>
              <input id="imp-static" class="dc-input font-mono text-sm" placeholder="detectada automaticamente para IDs do Discord" spellcheck="false" />
            </div>
            <div data-for="effects" class="hidden space-y-3">
              <div id="imp-link" class="hidden rounded-lg bg-[#5865F2]/15 border border-[#5865F2]/40 p-2 text-xs"></div>
              <details class="rounded-lg bg-dc-dark p-2 text-xs text-dc-muted">
                <summary class="cursor-pointer font-semibold text-dc-text">Onde acho os hashes da entrada e do loop?</summary>
                <ol class="list-decimal ml-4 mt-2 space-y-1">
                  <li>Abra o Discord no navegador (discord.com/app) e vá em <b>Loja</b>.</li>
                  <li>Aperte <b>F12</b> → aba <b>Rede/Network</b> e filtre por <code>collectibles-shop</code>.</li>
                  <li>Clique no efeito para ver a prévia: aparecem dois arquivos <code>collectibles-shop/&lt;hash&gt;</code> de 450×880. O primeiro, que toca uma vez, é a <b>entrada</b>; o outro é o <b>loop</b>.</li>
                  <li>Copie as URLs (ou só os hashes) para os campos abaixo.</li>
                </ol>
                <p class="mt-1">A API pública da loja só traz a miniatura estática dos efeitos; a animação vem da sua própria navegação.</p>
              </details>
              <div>
                <label class="field-label" for="imp-intro">Entrada (toca 1×, até 6 s)</label>
                <input id="imp-intro" class="dc-input font-mono text-sm" placeholder=".../collectibles-shop/<hash da entrada>" spellcheck="false" />
              </div>
              <div>
                <label class="field-label" for="imp-dur">Duração da entrada (s)</label>
                <input id="imp-dur" type="number" min="0.5" max="6" step="0.1" value="4" class="dc-input text-sm w-32" />
                <p class="text-[11px] text-dc-faint mt-1">O CDN do Discord não deixa o navegador ler os quadros, então informe a duração (ou meça com <code>node tools/measure-apng.mjs</code>).</p>
              </div>
              <div>
                <label class="field-label" for="imp-loop">Loop</label>
                <input id="imp-loop" class="dc-input font-mono text-sm" placeholder=".../collectibles-shop/<hash do loop>" spellcheck="false" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="field-label" for="imp-name">Nome (opcional)</label>
                <input id="imp-name" class="dc-input text-sm" maxlength="60" />
              </div>
              <div>
                <label class="field-label" for="imp-coll">Coleção</label>
                <input id="imp-coll" class="dc-input text-sm" maxlength="40" placeholder="Discord" />
              </div>
            </div>
            <div id="imp-preview" class="rounded-lg bg-dc-dark p-3 text-xs text-dc-muted min-h-[44px]">Cole um ID ou URL para medir a animação (quadros, duração e FPS).</div>
          </div>
          <div class="flex justify-end gap-2 px-4 py-3 border-t border-black/30">
            <button type="button" class="btn btn-ghost btn-sm mr-auto" id="imp-copy" title="Copia a entrada para colar em catalog/discord.json">{ } Copiar para o catálogo</button>
            <button type="button" class="btn btn-ghost btn-sm" data-close>Cancelar</button>
            <button type="button" class="btn btn-primary btn-sm" id="imp-save">Importar e testar</button>
          </div>
        </form>
      </dialog>`);
    dlg = $('#import-dialog');
    let cat = 'decorations';
    const setCat = (c) => {
      cat = c;
      dlg.querySelectorAll('#imp-cat button').forEach((b) => b.classList.toggle('is-active', b.dataset.cat === c));
      dlg.querySelector('[data-for="single"]').classList.toggle('hidden', c === 'effects');
      dlg.querySelector('[data-for="effects"]').classList.toggle('hidden', c !== 'effects');
      preview();
    };
    dlg.querySelector('#imp-cat').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]');
      if (b) setCat(b.dataset.cat);
    });
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
    });
    const form = () => ({
      main: $('#imp-main').value, staticUrl: $('#imp-static').value, intro: $('#imp-intro').value,
      loop: $('#imp-loop').value, name: $('#imp-name').value, collection: $('#imp-coll').value, dur: $('#imp-dur').value,
      linkId: dlg._linkId || '',
    });

    let timer;
    async function preview() {
      const box = $('#imp-preview');
      // ID de pacote (bundle) da loja?
      const raw = (cat === 'effects' ? '' : $('#imp-main').value).trim();
      const bundle = /^\d{15,21}$/.test(raw) ? findBundle(raw) : (raw.match(/bundle-fg-static\/(\d{15,21})/) ? findBundle(raw.match(/bundle-fg-static\/(\d{15,21})/)[1]) : null);
      if (bundle) return showBundle(box, bundle);
      let item;
      try { item = buildItem(cat, form()); } catch (e) { box.textContent = e.message; return; }
      if (!item) { box.textContent = 'Não reconheci esse ID/URL.'; return; }
      const a = item.asset;
      const parts = cat === 'effects' ? [['Entrada', 'intro'], ['Loop', 'loop']] : [['Animado', 'src'], ['Estático', 'staticSrc']];
      box.textContent = 'Medindo…';
      const lines = await Promise.all(parts.filter(([, f]) => a[f]).map(async ([label, f]) => {
        try {
          const i = await CS.getMetrics(a, f);
          let line = `${label}: ${i.width}×${i.height}, ${i.frames} quadro(s)${i.uniqueFrames ? ' únicos' : ''}`;
          if (i.animated) line += `, ${i.duration}s, ${i.uniqueFrames ? '≈' : ''}${i.fps} fps, ${i.plays === 0 ? 'loop infinito' : 'toca ' + i.plays + '×'}`;
          if (label === 'Entrada' && i.animated) { $('#imp-dur').value = Math.min(6, i.duration).toFixed(1); }
          if (i.clampedFrames) line += ` ⚠ atrasos ≤10 ms viram 100 ms no navegador (nominal ${i.nominalFps} fps)`;
          if (label === 'Entrada' && i.duration > 6) line += ' ⚠ entrada maior que 6 s';
          return line;
        } catch (e) {
          return `${label}: não foi possível carregar (${e.message})`;
        }
      }));
      box.innerHTML = '';
      lines.forEach((l) => {
        const d = document.createElement('div');
        d.textContent = l;
        box.appendChild(d);
      });
    }
    async function showBundle(box, b) {
      let parts = bundleContents(b);
      box.textContent = 'Consultando o pacote no Discord…';
      try {
        const prod = await fetchProduct(b.id);
        if (prod.contents && prod.contents.length) {
          const byType = { 0: ['decorations', 'dc-deco-'], 2: ['nameplates', 'dc-np-'], 1: ['effects', 'dc-fx-'] };
          const exact = {};
          for (const c of prod.contents) {
            const m = byType[c.type];
            if (m) exact[m[0]] = CS.findItem(m[0], m[1] + c.sku) || null;
          }
          exact.frames = parts.frames; // frames: pelo nome (o tipo não aparece nos pacotes analisados)
          parts = exact;
        }
      } catch (e) { /* segue com a associação pelo nome */ }
      const names = { decorations: 'Moldura', nameplates: 'Nameplate', effects: 'Efeito', frames: 'Frame' };
      box.innerHTML = '';
      const title = document.createElement('div');
      title.className = 'font-semibold text-dc-text mb-1';
      title.textContent = `📦 Pacote: ${b.name}${b.price ? ' · ' + b.price : ''} (${b.section})`;
      box.appendChild(title);
      let any = false;
      for (const cat of ['decorations', 'nameplates', 'effects', 'frames']) {
        if (cat === 'frames' && !parts[cat]) continue;
        const d = document.createElement('div');
        d.textContent = `${names[cat]}: ${parts[cat] ? parts[cat].name : '— não está na loja de hoje'}`;
        box.appendChild(d);
        if (parts[cat]) any = true;
      }
      if (!any) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-primary btn-sm mt-2';
      btn.textContent = 'Testar pacote completo';
      btn.addEventListener('click', () => {
        for (const cat of ['decorations', 'nameplates', 'effects', 'frames']) {
          const it = parts[cat];
          if (it && CS.state[CATS[cat].key] !== it.id) CS.equip(cat, it.id);
        }
        dlg.close();
        CS.toast(`Pacote “${b.name}” equipado!`, 'success');
      });
      box.appendChild(btn);
    }

    dlg.querySelectorAll('input').forEach((i) => i.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(preview, 400);
    }));

    $('#imp-copy').addEventListener('click', async () => {
      let entry;
      try { entry = formToCatalogEntry(cat, form()); } catch (e) { return CS.toast(e.message, 'danger'); }
      const text = JSON.stringify(entry, null, 2) + ',';
      try {
        await navigator.clipboard.writeText(text);
        CS.toast('Entrada copiada! Cole em catalog/discord.json e rode node tools/build-catalog.mjs.', 'success');
      } catch (e) {
        CS.toast('Não foi possível copiar automaticamente.', 'danger');
      }
    });

    $('#imp-save').addEventListener('click', () => {
      let item;
      try { item = buildItem(cat, form()); } catch (e) { return CS.toast(e.message, 'danger'); }
      if (!item) return CS.toast('Não reconheci esse ID/URL.', 'danger');
      CS.addCollection(item.collection, '#5865F2');
      const existing = CS.findItem(cat, item.id);
      if (!existing || dlg._linkId === item.id) CS.registerCustom(cat, item, { saved: true });
      dlg.close();
      CS.setTab(cat);
      CS.renderGallery();
      if (CS.state[CATS[cat].key] !== item.id) CS.equip(cat, item.id);
      else CS.refresh(); // já estava equipado (ex.: efeito da loja recém-animado): remonta a prévia
    });
    dlg._setCat = setCat;
    dlg.addEventListener('close', () => {
      dlg._linkId = '';
      $('#imp-link').classList.add('hidden');
    });
    return dlg;
  }

  /** Abre o importador para dar entrada/loop a um efeito da loja (que só tem miniatura estática). */
  function openForEffect(id) {
    const fx = CS.findItem('effects', id);
    if (!fx) return;
    ensureDialog();
    dlg._linkId = fx.id;
    $('#imp-name').value = fx.name;
    $('#imp-coll').value = fx.collection || 'Discord';
    $('#imp-intro').value = '';
    $('#imp-loop').value = '';
    const link = $('#imp-link');
    link.textContent = `🎬 Animando o efeito da loja “${fx.name}” (${fx.collection}). Cole a entrada e o loop; o card e o perfil passam a usar a animação.`;
    link.classList.remove('hidden');
    dlg._setCat('effects');
    dlg.showModal();
    $('#imp-intro').focus();
  }

  function init() {
    $('#btn-import').addEventListener('click', () => ensureDialog().showModal());
    loadOfficial();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.CosmeticImport = { parseRef, catalogEntryToItem, openForEffect, findBundle: (id) => findBundle(id), fetchProduct, animateShopEffect };
})();
