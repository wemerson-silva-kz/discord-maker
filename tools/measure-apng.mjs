#!/usr/bin/env node
/**
 * Mede APNG/PNG (quadros, duração, FPS, repetições) e imprime o bloco `meta`.
 * O CDN /collectibles-shop/ do Discord não libera CORS, então o navegador não
 * consegue ler os quadros — por isso a medição é feita aqui.
 *
 * Uso:
 *   node tools/measure-apng.mjs <url-ou-arquivo>
 *   node tools/measure-apng.mjs intro=<url> loop=<url>      (nomeia os campos)
 */
import { measure } from './apng.mjs';

const meta = {};
for (const arg of process.argv.slice(2)) {
  const [field, src] = arg.includes('=') && !arg.startsWith('http') ? arg.split(/=(.*)/s) : ['src', arg];
  meta[field] = await measure(src);
}
console.log(JSON.stringify({ meta }, null, 2));
