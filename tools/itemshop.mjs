#!/usr/bin/env node
/**
 * Cliente da Item Shop API do itemshop.gg para o LADO DO SERVIDOR (Node 18+).
 * Referência: https://itemshop.gg/developers · Tipos: types/itemshop.d.ts
 *
 * A chave vem SÓ da variável de ambiente ITEMSHOP_API_KEY (nunca do código, do
 * repositório ou do navegador). Sem chave, /games, /shop e /rotations funcionam
 * (30 req/min por IP); /history e /items exigem a chave.
 *
 * Uso (CLI):
 *   node --env-file=.env tools/itemshop.mjs games
 *   node --env-file=.env tools/itemshop.mjs rotations
 *   node --env-file=.env tools/itemshop.mjs shop [jogo=discord]
 *   node --env-file=.env tools/itemshop.mjs history [jogo=discord] [AAAA-MM-DD]
 *   node --env-file=.env tools/itemshop.mjs item <jogo> <itemKey>
 * (sem arquivo .env, rode sem --env-file ou exporte a variável no terminal)
 *
 * Exibindo os dados: os termos exigem um link visível "Data from itemshop.gg"
 * apontando para meta.attribution.url da resposta.
 */

/** @typedef {import('../types/itemshop').GamesAnswer} GamesAnswer */
/** @typedef {import('../types/itemshop').RotationsAnswer} RotationsAnswer */
/** @typedef {import('../types/itemshop').ShopAnswer} ShopAnswer */
/** @typedef {import('../types/itemshop').HistoryAnswer} HistoryAnswer */
/** @typedef {import('../types/itemshop').HistoryDayAnswer} HistoryDayAnswer */
/** @typedef {import('../types/itemshop').ItemAnswer} ItemAnswer */

const BASE = 'https://itemshop.gg/api/v1';
const USER_AGENT = 'cosmetic-studio/1.0 (+https://github.com/wemerson-silva-kz/discord-maker)';
const TTL = 2 * 60 * 1000;

export class ItemShopError extends Error {
  constructor(status, code, message, retryAfter = 0) {
    super(message || `itemshop.gg respondeu ${status}`);
    this.name = 'ItemShopError';
    this.status = status;
    this.code = code || null;
    this.retryAfter = retryAfter;
  }
}

export class ItemShopClient {
  /** @param {{ apiKey?: string, maxRetries?: number }} [opts] */
  constructor({ apiKey = process.env.ITEMSHOP_API_KEY, maxRetries = 2 } = {}) {
    this.apiKey = apiKey && apiKey.trim() ? apiKey.trim() : null;
    this.maxRetries = maxRetries;
    /** Cache por caminho: { t, etag, body } — respostas valem ~2 min. */
    this.cache = new Map();
  }

  /**
   * @template T
   * @param {string} path
   * @param {{ needsKey?: boolean }} [opts]
   * @returns {Promise<T>}
   */
  async get(path, { needsKey = false } = {}) {
    if (needsKey && !this.apiKey) {
      throw new ItemShopError(401, 'key_required',
        'Este endpoint (histórico/itens) exige uma chave. Crie em https://itemshop.gg/account#api e defina a variável de ambiente ITEMSHOP_API_KEY.');
    }
    const cached = this.cache.get(path);
    if (cached && Date.now() - cached.t < TTL) return cached.body;

    for (let attempt = 0; ; attempt++) {
      const headers = { Accept: 'application/json', 'User-Agent': USER_AGENT };
      if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
      if (cached && cached.etag) headers['If-None-Match'] = cached.etag;

      const res = await fetch(BASE + path, { headers });
      if (res.status === 304 && cached) {
        cached.t = Date.now();
        return cached.body;
      }
      if (res.ok) {
        const body = await res.json();
        this.cache.set(path, { t: Date.now(), etag: res.headers.get('etag'), body });
        return body;
      }

      let code = null, message = null;
      try {
        const err = await res.json();
        code = err?.error?.code ?? null;
        message = err?.error?.message ?? null;
      } catch { /* corpo vazio */ }

      if (res.status === 429 || res.status === 503) {
        const secs = parseInt(res.headers.get('retry-after') || (res.status === 503 ? '30' : '60'), 10) || 60;
        if (attempt < this.maxRetries) {
          console.error(`itemshop.gg: ${res.status} — aguardando ${secs} s antes de tentar de novo…`);
          await new Promise((r) => setTimeout(r, secs * 1000));
          continue;
        }
        throw new ItemShopError(res.status, code, message || `Tente de novo em ${secs} s.`, secs);
      }
      if (res.status === 401) {
        throw new ItemShopError(401, code, code === 'invalid_key'
          ? 'A chave em ITEMSHOP_API_KEY é inválida ou foi revogada. Gere outra em https://itemshop.gg/account#api.'
          : message || 'Chave obrigatória para este endpoint.');
      }
      if (res.status === 404) {
        const why = { unknown_game: 'jogo desconhecido', not_recorded: 'dia não registrado', unknown_item: 'item desconhecido', no_items: 'sem itens' }[code];
        throw new ItemShopError(404, code, `${why || 'não encontrado'}${message ? ': ' + message : ''}`);
      }
      throw new ItemShopError(res.status, code, message);
    }
  }

  /** @returns {Promise<GamesAnswer>} */ games() { return this.get('/games'); }
  /** @returns {Promise<RotationsAnswer>} */ rotations() { return this.get('/rotations'); }
  /** @returns {Promise<ShopAnswer>} */ shop(game = 'discord') { return this.get(`/shop/${encodeURIComponent(game)}`); }
  /** @returns {Promise<HistoryAnswer>} */ history(game = 'discord') { return this.get(`/history/${encodeURIComponent(game)}`, { needsKey: true }); }
  /** @returns {Promise<HistoryDayAnswer>} */
  historyDay(game, date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ItemShopError(400, 'bad_date', 'Data no formato AAAA-MM-DD (UTC).');
    return this.get(`/history/${encodeURIComponent(game)}/${date}`, { needsKey: true });
  }
  /** @returns {Promise<ItemAnswer>} */ item(game, itemKey) { return this.get(`/items/${encodeURIComponent(game)}/${encodeURIComponent(itemKey)}`, { needsKey: true }); }

  /**
   * Busca a loja só se o fingerprint do jogo mudou desde `lastFingerprint`.
   * @returns {Promise<{ changed: boolean, fingerprint: string|null, shop?: ShopAnswer }>}
   */
  async shopIfChanged(game, lastFingerprint) {
    const rot = await this.rotations();
    const fingerprint = rot.data?.[game]?.fingerprint ?? null;
    if (fingerprint && fingerprint === lastFingerprint) return { changed: false, fingerprint };
    return { changed: true, fingerprint, shop: await this.shop(game) };
  }
}

/* ------------------------------------------------------------------ */
/* CLI                                                                  */
/* ------------------------------------------------------------------ */
function summarizeShop(answer) {
  const d = answer.data;
  const counts = {};
  for (const s of d.sections) for (const it of s.items) counts[it.type ?? 'null'] = (counts[it.type ?? 'null'] || 0) + 1;
  return {
    game: d.game, shopDate: d.shopDate, updatedAt: d.updatedAt, stale: d.stale, itemCount: d.itemCount,
    sections: d.sections.length, porTipo: counts,
    exemplos: d.sections.slice(0, 3).map((s) => ({ secao: s.title, emBreve: s.upcoming, itens: s.items.slice(0, 3).map((i) => ({ id: i.id, itemKey: i.itemKey, nome: i.name, tipo: i.type, preco: i.price?.amount ?? i.price?.label ?? null, moeda: i.price?.currency ?? null })) })),
  };
}

async function main([cmd, ...args]) {
  const client = new ItemShopClient();
  let answer, out;
  switch (cmd) {
    case 'games': answer = await client.games(); out = answer.data; break;
    case 'rotations': answer = await client.rotations(); out = answer.data; break;
    case 'shop': answer = await client.shop(args[0] || 'discord'); out = summarizeShop(answer); break;
    case 'history':
      answer = args[1] ? await client.historyDay(args[0] || 'discord', args[1]) : await client.history(args[0] || 'discord');
      out = args[1] ? summarizeShop(answer) : answer.data;
      break;
    case 'item':
      if (!args[0] || !args[1]) throw new ItemShopError(400, 'usage', 'Uso: item <jogo> <itemKey>');
      answer = await client.item(args[0], args[1]); out = answer.data; break;
    default:
      console.log('Comandos: games | rotations | shop [jogo] | history [jogo] [AAAA-MM-DD] | item <jogo> <itemKey>');
      return;
  }
  console.log(JSON.stringify(out, null, 2));
  console.log(`\n${answer.meta?.attribution?.text || 'Data from itemshop.gg'}: ${answer.meta?.attribution?.url || 'https://itemshop.gg'}  ·  termos: ${answer.meta?.terms || 'https://itemshop.gg/terms#api'}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(`Erro${e.status ? ' ' + e.status : ''}${e.code ? ' (' + e.code + ')' : ''}: ${e.message}`);
    process.exitCode = 1;
  });
}
