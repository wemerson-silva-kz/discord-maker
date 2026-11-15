/**
 * Leitor de PNG/APNG compartilhado pelas ferramentas de linha de comando.
 * Regra dos navegadores: atrasos de quadro ≤ 10 ms são exibidos como 100 ms.
 */
export function parseApng(bytes) {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!sig.every((b, i) => bytes[i] === b)) throw new Error('não é PNG');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let i = 8, width = 0, height = 0, plays = 1, raw = 0, total = 0, clamped = 0, frames = 0;
  while (i + 8 <= bytes.length) {
    const len = dv.getUint32(i);
    const type = String.fromCharCode(...bytes.subarray(i + 4, i + 8));
    const d = i + 8;
    if (type === 'IHDR') { width = dv.getUint32(d); height = dv.getUint32(d + 4); }
    else if (type === 'acTL') plays = dv.getUint32(d + 4);
    else if (type === 'fcTL') {
      const r = dv.getUint16(d + 20) / (dv.getUint16(d + 22) || 100);
      raw += r;
      total += r <= 0.01 ? 0.1 : r;
      if (r <= 0.01) clamped++;
      frames++;
    } else if (type === 'IEND') break;
    i = d + len + 4;
  }
  const out = { width, height, frames: frames || 1, duration: +total.toFixed(3), fps: frames ? +(frames / total).toFixed(1) : 0, plays };
  if (clamped) Object.assign(out, { nominalFps: +(frames / raw).toFixed(1), clampedFrames: clamped });
  return out;
}

export async function measure(src) {
  const { readFile } = await import('node:fs/promises');
  let bytes;
  if (/^https?:/.test(src)) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${src}`);
    bytes = new Uint8Array(await res.arrayBuffer());
  } else bytes = new Uint8Array(await readFile(src));
  return parseApng(bytes);
}
