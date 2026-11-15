#!/usr/bin/env node
/**
 * Completa o catálogo catalog/discord.json:
 *   • valida cada item (tipo, IDs/hashes);
 *   • mede os APNGs e grava `meta` (quadros, duração, FPS, repetições);
 *   • avisa sobre entradas > 6 s e quadros que o navegador desacelera.
 *
 * Uso:  node tools/build-catalog.mjs            (mede só o que falta)
 *       node tools/build-catalog.mjs --force    (mede tudo de novo)
 *
 * Formato de cada item:
 *   { "type": "decoration", "name": "...", "collection": "...", "sku": "<id>" }      // ou "preset": "a_<hash>"
 *   { "type": "nameplate",  "name": "...", "collection": "...", "sku": "<id>" }
 *   { "type": "effect",     "name": "...", "collection": "...", "intro": "<hash|url>", "loop": "<hash|url>" }
 */
import { readFile, writeFile } from 'node:fs/promises';
import { measure } from './apng.mjs';

const FILE = new URL('../catalog/discord.json', import.meta.url);
const CDN = 'https://cdn.discordapp.com';
const SHOP = `${CDN}/media/v1/collectibles-shop/`;
const force = process.argv.includes('--force');

/** Mesmas regras do importador do navegador (js/discord-import.js). */
export function urlsFor(item) {
  const ref = (v) => {
    const s = String(v || '').trim();
    if (!s) return '';
    if (/^https:\/\//.test(s)) return s;
    if (/^[0-9a-f]{64}$/i.test(s)) return SHOP + s.toLowerCase();
    throw new Error(`hash/URL inválido: ${s}`);
  };
  if (item.type === 'effect') {
    const intro = ref(item.intro), loop = ref(item.loop);
    if (!intro && !loop) throw new Error('efeito precisa de "intro" e/ou "loop"');
    return { intro, loop };
  }
  if (item.sku) {
    if (!/^\d{15,21}$/.test(item.sku)) throw new Error(`sku inválido: ${item.sku}`);
    return { src: `${SHOP}${item.sku}/animated`, staticSrc: `${SHOP}${item.sku}/static` };
  }
  if (item.preset) {
    if (!/^(a_)?[0-9a-f]{32}$/i.test(item.preset)) throw new Error(`preset inválido: ${item.preset}`);
    if (item.type !== 'decoration') throw new Error('"preset" só vale para decoration');
    const u = `${CDN}/avatar-decoration-presets/${item.preset}.png?size=240&passthrough=`;
    return { src: u + 'true', staticSrc: u + 'false' };
  }
  if (item.src) return { src: ref(item.src), staticSrc: item.staticSrc ? ref(item.staticSrc) : '' };
  throw new Error('item precisa de "sku", "preset" ou "src"');
}

const catalog = JSON.parse(await readFile(FILE, 'utf8'));
let measured = 0, problems = 0;
for (const [n, item] of catalog.items.entries()) {
  const label = `#${n + 1} ${item.type} "${item.name || '(sem nome)'}"`;
  try {
    if (!['decoration', 'nameplate', 'effect'].includes(item.type)) throw new Error(`type inválido: ${item.type}`);
    const urls = urlsFor(item);
    const fields = item.type === 'effect' ? ['intro', 'loop'] : ['src'];
    item.meta = item.meta || {};
    for (const f of fields) {
      if (!urls[f] || (item.meta[f] && !force)) continue;
      item.meta[f] = await measure(urls[f]);
      measured++;
    }
    const warn = [];
    if (item.meta.intro && item.meta.intro.duration > 6) warn.push(`entrada com ${item.meta.intro.duration}s (o limite do Discord é 6 s)`);
    if (item.meta.intro && item.meta.intro.plays !== 1) warn.push(`entrada repete ${item.meta.intro.plays === 0 ? 'infinitamente' : item.meta.intro.plays + '×'}; deveria tocar 1×`);
    for (const [f, m] of Object.entries(item.meta)) {
      if (m.clampedFrames) warn.push(`${f}: ${m.clampedFrames} quadros com atraso ≤10 ms → navegador usa 100 ms (nominal ${m.nominalFps} fps, efetivo ${m.fps} fps)`);
    }
    const summary = Object.entries(item.meta).map(([f, m]) => `${f} ${m.width}×${m.height} ${m.frames}q ${m.duration}s ${m.fps}fps ${m.plays === 0 ? '∞' : m.plays + '×'}`).join(' | ');
    console.log(`✓ ${label}: ${summary}`);
    warn.forEach((w) => console.log(`  ⚠ ${w}`));
  } catch (e) {
    problems++;
    console.log(`✗ ${label}: ${e.message}`);
  }
}
await writeFile(FILE, JSON.stringify(catalog, null, 2) + '\n');
console.log(`\n${catalog.items.length} itens, ${measured} medições novas, ${problems} com erro. Salvo em catalog/discord.json`);
process.exitCode = problems ? 1 : 0;
