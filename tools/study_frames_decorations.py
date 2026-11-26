#!/usr/bin/env python3
"""
Estudo de GEOMETRIA dos Profile Frames e Avatar Decorations oficiais do Discord.

Mede, item por item, o que o gerador precisa respeitar:
  • Frames: espessura das laterais, quanto entram no card, altura da coroa
    acima do card, quanto a coroa desce sobre o banner, base, cobertura do miolo,
    camadas (staple/border/rail, frente/atrás) e a DESCRIÇÃO oficial da arte.
  • Molduras: perfil radial (avatar = raio 120 no canvas de 288), quanto entram
    no avatar, espessura do anel, onde fica a massa (topo/base/lados), vazios.

Fontes públicas: itemshop.gg (lista da loja), discord.com/api/v9/collectibles-products
(camadas e descrição) e cdn.discordapp.com (PNGs estáticos).
As imagens baixadas ficam só na pasta --cache (fora do repositório); no repositório
entram apenas números e descrições (catalog/frame-deco-study.json, docs/frame-deco-study.md).

Uso:  pip install pillow numpy
      python tools/study_frames_decorations.py --cache <pasta-temporaria> [--frames 40 --decos 60]
"""
import argparse, io, json, os, random, statistics as st, time, urllib.request
import numpy as np
from PIL import Image

UA = 'cosmetic-studio/1.0 (style research; +https://github.com/wemerson-silva-kz/discord-maker)'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAUSE = 0.35
CDN = 'https://cdn.discordapp.com/media/v1/collectibles-shop'


def get(url, as_json=False, cache=None):
    if cache and os.path.exists(cache):
        data = open(cache, 'rb').read()
    else:
        for k in range(3):
            try:
                data = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=30).read()
                time.sleep(PAUSE)
                break
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    time.sleep(5 * (k + 1)); continue
                raise
        else:
            raise RuntimeError('muitas tentativas: ' + url)
        if cache:
            os.makedirs(os.path.dirname(cache), exist_ok=True)
            open(cache, 'wb').write(data)
    return json.loads(data) if as_json else data


def alpha(img):
    return np.asarray(img.convert('RGBA'))[:, :, 3].astype(np.float32) / 255


def q(xs, p):
    xs = sorted(x for x in xs if x is not None)
    if not xs: return None
    return round(xs[min(len(xs) - 1, int(p * (len(xs) - 1) + 0.5))], 3)


def summ(xs):
    xs = [x for x in xs if x is not None]
    return {'mediana': q(xs, 0.5), 'p25': q(xs, 0.25), 'p75': q(xs, 0.75), 'n': len(xs)} if xs else None


# ----------------------------------------------------------------- frames
def study_frame(item, cache):
    p = get(f'https://discord.com/api/v9/collectibles-products/{item["id"]}', True, os.path.join(cache, 'p', item['id'] + '.json'))
    fr = next((x for x in p.get('items', []) if x.get('type') == 3), None)
    if not fr: return None
    ot, ob, oh, iw = fr.get('overflow_top', 0), fr.get('overflow_bottom', 0), fr.get('overflow_horizontal', 0), fr.get('inner_width', 1200)
    W = iw + 2 * oh
    out = {'nome': p.get('name'), 'descricao': (fr.get('label') or '').strip(), 'overflow_top': ot, 'overflow_bottom': ob,
           'overflow_horizontal': oh, 'camadas': [f"{L['type']}/{L['order']}/{L['anchor']}" for L in fr.get('layers', [])]}
    border = None
    staples = []
    for L in fr.get('layers', []):
        try:
            im = Image.open(io.BytesIO(get(f'{CDN}/{p["sku_id"]}/{L["id"]}/static', cache=os.path.join(cache, 'f', f'{p["sku_id"]}_{L["id"]}.png'))))
        except Exception as e:
            print('   camada falhou', L['type'], e); continue
        if L['type'] in ('border', 'rail') and im.width == W:
            border = alpha(im) if border is None else np.maximum(border, alpha(im))
        elif L['type'] == 'staple':
            staples.append((L, alpha(im)))
    H = border.shape[0] if border is not None else max(2528, ot + 2000)
    comp = np.zeros((H, W), np.float32) if border is None else border.copy()
    for L, a in staples:  # staple: centralizado, preso no topo (ou na base)
        h, w = a.shape
        x0 = max(0, (W - w) // 2)
        y0 = 0 if L['anchor'] == 'top' else H - h
        hh, ww = min(h, H - y0), min(w, W - x0)
        comp[y0:y0 + hh, x0:x0 + ww] = np.maximum(comp[y0:y0 + hh, x0:x0 + ww], a[:hh, :ww])
    cT, cB, cL, cR = ot, H - ob, oh, W - oh
    on = comp > 0.5
    # laterais: no meio do card (longe da coroa e da base)
    mid = range(cT + int((cB - cT) * 0.35), cT + int((cB - cT) * 0.65), 8)
    ins, outs = [], []
    for y in mid:
        row = on[y]
        xs = np.nonzero(row[: W // 2])[0]
        if len(xs):
            ins.append(xs.max() - cL)      # quanto entra no card (px; negativo = não chega)
            outs.append(cL - xs.min())     # quanto fica pra fora do card
        xs = np.nonzero(row[W // 2:])[0]
        if len(xs):
            ins.append(cR - (W // 2 + xs.min()))
            outs.append((W // 2 + xs.max()) - cR)
    out['lateral_entra_px'] = q(ins, 0.5) if ins else None
    out['lateral_fora_px'] = q(outs, 0.5) if outs else None
    out['lateral_vazia'] = (len(ins) == 0)
    # coroa: acima do card, e quanto desce sobre o card na faixa central
    rows_on = np.nonzero(on.any(axis=1))[0]
    out['coroa_altura_px'] = int(cT - rows_on.min()) if len(rows_on) and rows_on.min() < cT else 0
    center = on[:, cL + 150: cR - 150]
    deep = [np.nonzero(center[:, x])[0] for x in range(0, center.shape[1], 10)]
    reach = [ys[ys < cT + 900].max() - cT for ys in deep if len(ys) and (ys < cT + 900).any() and ys[ys < cT + 900].max() >= cT]
    out['coroa_desce_no_card_px'] = q(reach, 0.75) if reach else 0
    out['coroa_largura_frac'] = round(float(on[: cT].any(axis=0).mean()), 3) if cT > 0 else 0
    out['base_altura_px'] = int(rows_on.max() - cB) if len(rows_on) and rows_on.max() > cB else 0
    sub = on[cB - 600: cB, cL + 150: cR - 150]
    up = [cB - (cB - 600 + ys.min()) for ys in (np.nonzero(sub[:, x])[0] for x in range(0, sub.shape[1], 10)) if len(ys)]
    out['base_sobe_no_card_px'] = q(up, 0.75) if up else 0
    inner = comp[cT + 300: cB - 300, cL + 80: cR - 80]
    out['miolo_coberto'] = round(float(inner.mean()), 4)
    out['cobertura_total'] = round(float(comp.mean()), 4)
    out['_comp'] = comp
    return out


# ----------------------------------------------------------- decorations
def study_deco(item, cache):
    im = Image.open(io.BytesIO(get(item['images']['card'], cache=os.path.join(cache, 'd', item['id'] + '.png')))).convert('RGBA').resize((288, 288), Image.LANCZOS)
    a = alpha(im)
    yy, xx = np.mgrid[0:288, 0:288]
    r = np.hypot(xx - 143.5, yy - 143.5)
    th = np.arctan2(yy - 143.5, xx - 143.5)
    prof = [float(a[(r >= k) & (r < k + 4)].mean()) for k in range(0, 144, 4)]
    first = next((k * 4 for k, v in enumerate(prof) if v > 0.08), None)
    out = {'nome': item['name'],
           'avatar_coberto': round(float(a[r < 120].mean()), 4),
           'entra_no_avatar_px': (120 - first) if first is not None else None,
           'anel': {f'{k}-{k + 10}': round(float(a[(r >= k) & (r < k + 10)].mean()), 3) for k in range(90, 144, 10)},
           'perfil_radial_4px': [round(v, 3) for v in prof]}
    ring = (r >= 100) & (r < 144)
    def sector(lo, hi):
        m = ring & (th >= lo) & (th < hi)
        return float(a[m].mean()) if m.any() else 0
    pi = np.pi
    out['massa'] = {'topo': round(sector(-3 * pi / 4, -pi / 4), 3), 'base': round(sector(pi / 4, 3 * pi / 4), 3),
                    'direita': round((sector(-pi / 4, pi / 4)), 3), 'esquerda': round((sector(3 * pi / 4, pi + 0.01) + sector(-pi - 0.01, -3 * pi / 4)) / 2, 3)}
    # quanto do anel (100–144) está vazio: setores de 10° sem arte
    secs = [float(a[ring & (th >= -pi + k * pi / 18) & (th < -pi + (k + 1) * pi / 18)].mean()) for k in range(36)]
    out['setores_vazios_frac'] = round(sum(1 for v in secs if v < 0.05) / 36, 3)
    out['_a'] = a
    return out


def sheet(images, cols, cell, path, bg=(49, 51, 56)):
    rows = (len(images) + cols - 1) // cols
    S = Image.new('RGB', (cols * cell[0], rows * cell[1]), bg)
    for i, a in enumerate(images):
        im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).resize(cell)
        S.paste(Image.new('RGB', cell, (230, 230, 240)), ((i % cols) * cell[0], (i // cols) * cell[1]), im)
    S.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cache', required=True, help='pasta temporária para as imagens (fora do repositório)')
    ap.add_argument('--frames', type=int, default=40)
    ap.add_argument('--decos', type=int, default=60)
    ap.add_argument('--seed', type=int, default=11)
    args = ap.parse_args()
    random.seed(args.seed)
    shop = get('https://itemshop.gg/api/v1/shop/discord', True)
    items = [i for s in shop['data']['sections'] for i in s['items']]
    frames = [i for i in items if i['type'] == 'Profile Frame']
    decos = [i for i in items if i['type'] == 'Avatar Decoration' and i.get('images', {}).get('card')]
    frames = random.sample(frames, min(args.frames, len(frames)))
    decos = random.sample(decos, min(args.decos, len(decos)))

    F = []
    for i in frames:
        try:
            r = study_frame(i, args.cache)
            if r: F.append(r); print('frame', r['nome'], {k: r[k] for k in ('lateral_entra_px', 'lateral_fora_px', 'coroa_altura_px', 'coroa_desce_no_card_px', 'base_altura_px', 'miolo_coberto')})
        except Exception as e:
            print('erro frame', i['name'], e)
    D = []
    for i in decos:
        try:
            r = study_deco(i, args.cache)
            D.append(r); print('moldura', r['nome'], r['avatar_coberto'], r['entra_no_avatar_px'])
        except Exception as e:
            print('erro moldura', i['name'], e)

    sheet([f['_comp'] for f in F], 8, (164, 316), os.path.join(args.cache, 'frames_sheet.png'))
    sheet([d['_a'] for d in D], 10, (144, 144), os.path.join(args.cache, 'decos_sheet.png'))
    for x in F: x.pop('_comp')
    for x in D: x.pop('_a')

    fk = ['lateral_entra_px', 'lateral_fora_px', 'coroa_altura_px', 'coroa_desce_no_card_px', 'coroa_largura_frac', 'base_altura_px', 'base_sobe_no_card_px', 'miolo_coberto', 'cobertura_total', 'overflow_top', 'overflow_bottom', 'overflow_horizontal']
    res = {
        'fonte': 'loja oficial do Discord (itemshop.gg + discord.com/api/v9/collectibles-products + cdn.discordapp.com)',
        'data': shop['data'].get('shopDate'),
        'frames': {'n': len(F), **{k: summ([f[k] for f in F]) for k in fk},
                   'sem_lateral_frac': round(sum(1 for f in F if f['lateral_vazia']) / max(1, len(F)), 3),
                   'camadas_mais_comuns': sorted({c: sum(1 for f in F if c in f['camadas']) for f in F for c in f['camadas']}.items(), key=lambda x: -x[1])[:6],
                   'descricoes': [{'nome': f['nome'], 'descricao': f['descricao']} for f in F if f['descricao']]},
        'decorations': {'n': len(D), 'avatar_coberto': summ([d['avatar_coberto'] for d in D]), 'entra_no_avatar_px': summ([d['entra_no_avatar_px'] for d in D]),
                        'anel': {k: summ([d['anel'][k] for d in D]) for k in D[0]['anel']} if D else {},
                        'massa': {k: summ([d['massa'][k] for d in D]) for k in ('topo', 'base', 'esquerda', 'direita')},
                        'setores_vazios_frac': summ([d['setores_vazios_frac'] for d in D]),
                        'perfil_radial_4px_mediana': [q([d['perfil_radial_4px'][k] for d in D], 0.5) for k in range(36)] if D else []},
        'itens': {'frames': F, 'decorations': D},
    }
    json.dump(res, open(os.path.join(ROOT, 'catalog', 'frame-deco-study.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1, default=lambda o: o.item() if hasattr(o, 'item') else str(o))
    print(json.dumps({k: v for k, v in res['frames'].items() if k != 'descricoes'}, ensure_ascii=False, indent=1, default=lambda o: o.item()))
    print(json.dumps({k: v for k, v in res['decorations'].items() if k != 'perfil_radial_4px_mediana'}, ensure_ascii=False, indent=1, default=lambda o: o.item()))


if __name__ == '__main__':
    main()
