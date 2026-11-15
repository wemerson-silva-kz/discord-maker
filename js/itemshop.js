/* ==========================================================================
   COSMETIC STUDIO — Cliente da Item Shop API (itemshop.gg) para o NAVEGADOR
   --------------------------------------------------------------------------
   Só usa os endpoints SEM chave (/shop, /rotations, /games): a chave nunca vai
   para o navegador (exigência dos termos). Chamadas com chave ficam em
   tools/itemshop.mjs (Node, lado do servidor).

   Boas práticas da API seguidas aqui:
   • cache de ~2 min por resposta (localStorage);
   • consulta /rotations e só baixa a loja quando o fingerprint do jogo muda;
   • envia o ETag em If-None-Match e trata 304 como "sem mudança";
   • em 429, respeita Retry-After antes de tentar de novo;
   • erros no formato { error: { code, message } }.
   Obs.: navegadores não deixam definir o header User-Agent; o Node define.

   Tipos: types/itemshop.d.ts
   ========================================================================== */
(function () {
  'use strict';

  /** @typedef {import('../types/itemshop').RotationsAnswer} RotationsAnswer */
  /** @typedef {import('../types/itemshop').ShopAnswer} ShopAnswer */
  /** @typedef {import('../types/itemshop').Meta} Meta */

  const BASE = 'https://itemshop.gg/api/v1';
  const TTL = 2 * 60 * 1000;
  const PREFIX = 'cosmetic-studio:itemshop:v2:';

  class ItemShopError extends Error {
    constructor(status, code, message, retryAfter) {
      super(message || `itemshop.gg respondeu ${status}`);
      this.name = 'ItemShopError';
      this.status = status;
      this.code = code || null;
      this.retryAfter = retryAfter || 0;
    }
  }

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(PREFIX + k) || 'null'); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  };

  /** Em 429 guardamos até quando esperar (vale para todas as abas). */
  function blockedFor() {
    const until = store.get('retry-until') || 0;
    return Math.max(0, until - Date.now());
  }

  /**
   * GET com ETag. Devolve { status: 200|304, body, etag }.
   * @param {string} path
   * @param {string|null} etag
   */
  async function get(path, etag) {
    const wait = blockedFor();
    if (wait) throw new ItemShopError(429, 'rate_limited', `Limite de requisições: aguarde ${Math.ceil(wait / 1000)} s.`, Math.ceil(wait / 1000));
    const headers = { Accept: 'application/json' };
    if (etag) headers['If-None-Match'] = etag;
    let res;
    try {
      res = await fetch(BASE + path, { headers, cache: 'no-cache' });
    } catch (e) {
      throw new ItemShopError(0, 'network', 'Sem conexão com itemshop.gg.');
    }
    if (res.status === 304) return { status: 304, body: null, etag };
    if (res.ok) return { status: 200, body: await res.json(), etag: res.headers.get('etag') };
    let code = null, message = null;
    try {
      const err = await res.json();
      code = err && err.error && err.error.code;
      message = err && err.error && err.error.message;
    } catch (e) { /* corpo vazio */ }
    if (res.status === 429) {
      const secs = parseInt(res.headers.get('retry-after') || '60', 10) || 60;
      store.set('retry-until', Date.now() + secs * 1000);
      throw new ItemShopError(429, code || 'rate_limited', message || `Limite de requisições: aguarde ${secs} s.`, secs);
    }
    if (res.status === 503) throw new ItemShopError(503, code || 'unavailable', message || 'itemshop.gg indisponível agora; tente mais tarde.');
    throw new ItemShopError(res.status, code, message);
  }

  /** /rotations com cache de 2 min e ETag. */
  async function rotations() {
    const c = store.get('rotations');
    if (c && Date.now() - c.t < TTL) return c.body;
    const r = await get('/rotations', c && c.etag);
    const body = r.status === 304 ? c.body : r.body;
    store.set('rotations', { t: Date.now(), etag: r.etag, body });
    return body;
  }

  /**
   * Loja de um jogo, já transformada por `transform` (o resultado vai para o cache;
   * guardar a resposta crua de ~1.700 itens estouraria o localStorage).
   * @template T
   * @param {string} game
   * @param {(answer: ShopAnswer) => T} transform
   * @returns {Promise<{ value: T, meta: Meta, shopDate: string, fromCache: boolean, stale: boolean }>}
   */
  async function shop(game, transform) {
    const key = 'shop:' + game;
    const c = store.get(key);
    const fromCache = (stale) => ({ value: c.value, meta: c.meta, shopDate: c.shopDate, fromCache: true, stale });
    if (c && Date.now() - c.t < TTL) return fromCache(false);

    try {
      // 1) Fingerprint: se a loja não mudou, nem baixa a loja.
      const rot = await rotations();
      const fp = rot && rot.data && rot.data[game] && rot.data[game].fingerprint;
      if (c && fp && c.fingerprint === fp) {
        store.set(key, { ...c, t: Date.now() });
        return fromCache(false);
      }
      // 2) Loja, com If-None-Match.
      const r = await get('/shop/' + encodeURIComponent(game), c && c.etag);
      if (r.status === 304 && c) {
        store.set(key, { ...c, t: Date.now(), fingerprint: fp || c.fingerprint });
        return fromCache(false);
      }
      /** @type {ShopAnswer} */
      const answer = r.body;
      const entry = { t: Date.now(), etag: r.etag, fingerprint: fp || null, meta: answer.meta, shopDate: answer.data && answer.data.shopDate, value: transform(answer) };
      store.set(key, entry);
      return { value: entry.value, meta: entry.meta, shopDate: entry.shopDate, fromCache: false, stale: false };
    } catch (e) {
      // Sem rede / 429 / 503: usa o último cache, mesmo velho.
      if (c) return fromCache(true);
      throw e;
    }
  }

  window.ItemShop = { shop, rotations, ItemShopError, BASE };
})();
