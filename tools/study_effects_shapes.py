#!/usr/bin/env python3
"""
Estudo (2): ENTRADA × LOOP dos Profile Effects e FORMAS das Avatar Decorations oficiais.

  • Efeitos: baixa as camadas de entrada e de loop (APNG, config oficial em
    discord.com/api/v9/collectibles-products/<sku>) e mede, quadro a quadro,
    onde fica a arte (mapa 9×16 de ocupação média e máxima) e quanto ela cobre
    o avatar, o nome e o texto — separado para entrada e loop.
  • Molduras: perfil angular (36 setores) do anel de cada moldura e k-means em
    TIPOS DE FORMA. Só as médias estatísticas (não as artes) vão para o repositório.

Uso:  pip install pillow numpy
      python tools/study_effects_shapes.py --cache <pasta-temporária> [--effects 60 --decos 0(=todas)]
Saída: catalog/effect-shape-study.json (números) e, na pasta --cache, folhas de contato.
"""
import argparse, io, json, os, random, time, urllib.request
import numpy as np
from PIL import Image, ImageSequence

UA = 'cosmetic-studio/1.0 (style research; +https://github.com/wemerson-silva-kz/discord-maker)'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAUSE = 0.3
# zonas do card no canvas do efeito 450×880 (iguais às do gerador)
ZONES = {'avatar': ('c', 82, 138, 66), 'nome': ('r', 21, 199, 323, 72), 'texto': ('r', 21, 283, 408, 273), 'banner': ('r', 0, 0, 450, 120)}


def get(url, as_json=False, cache=None):
    if cache and os.path.exists(cache):
        data = open(cache, 'rb').read()
    else:
        for k in range(3):
            try:
                data = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60).read()
                time.sleep(PAUSE)
                break
            except urllib.error.HTTPError as e:
                if e.code == 429: time.sleep(5 * (k + 1)); continue
                raise
            except Exception:
                if k == 2: raise
                time.sleep(2)
        if cache:
            os.makedirs(os.path.dirname(cache), exist_ok=True)
            open(cache, 'wb').write(data)
    return json.loads(data) if as_json else data


def zone_masks(W=450, H=880):
    yy, xx = np.mgrid[0:H, 0:W]
    out = {}
    for k, z in ZONES.items():
        if z[0] == 'c': out[k] = (xx - z[1]) ** 2 + (yy - z[2]) ** 2 <= z[3] ** 2
        else: out[k] = (xx >= z[1]) & (xx < z[1] + z[3]) & (yy >= z[2]) & (yy < z[2] + z[4])
    return out


ZM = zone_masks()


def frames_alpha(data, maxf=40):
    im = Image.open(io.BytesIO(data))
    n = getattr(im, 'n_frames', 1)
    step = max(1, n // maxf)
    out = []
    for i, fr in enumerate(ImageSequence.Iterator(im)):
        if i % step: continue
        a = np.asarray(fr.convert('RGBA').resize((450, 880)))[:, :, 3].astype(np.float32) / 255
        out.append(a)
    return out, n


def layer_stats(frames):
    st = np.stack(frames)
    mean = st.mean(0)
    cover = st.mean((1, 2))
    z = {k: float((st[:, m]).mean()) for k, m in ZM.items()}
    zmax = {k: float(max(f[m].mean() for f in frames)) for k, m in ZM.items()}
    grid = mean.reshape(16, 55, 9, 50).mean((1, 3))
    return {'cobertura_media': float(cover.mean()), 'cobertura_pico': float(cover.max()),
            'zonas_media': z, 'zonas_pico': zmax, 'grade_9x16': grid.round(3).tolist(), '_mean': mean}


def study_effect(item, cache):
    p = get(f'https://discord.com/api/v9/collectibles-products/{item["id"]}', True, os.path.join(cache, 'p', item['id'] + '.json'))
    fx = next((x for x in p.get('items', []) if x.get('type') == 1), None)
    if not fx or not fx.get('effects'): return None
    eff = fx['effects']
    intro = [e for e in eff if not e.get('loop')]
    loop = [e for e in eff if e.get('loop')]
    res = {'nome': p.get('name'), 'descricao': (fx.get('accessibilityLabel') or '').strip(),
           'entrada_ms': max((e['start'] + e['duration'] for e in intro), default=0),
           'loop_ms': loop[0]['duration'] if loop else 0, 'loop_pausa_ms': loop[0].get('loopDelay', 0) if loop else 0}
    for name, layers in (('entrada', intro[:1]), ('loop', loop[:1])):
        if not layers: continue
        e = layers[0]
        data = get(e['src'], cache=os.path.join(cache, 'e', e['src'].rsplit('/', 1)[-1] + '.png'))
        frs, n = frames_alpha(data)
        s = layer_stats(frs)
        s['quadros'] = n
        res[name] = s
    return res


# ------------------------------------------------------------ decorations
def deco_profile(item, cache):
    im = Image.open(io.BytesIO(get(item['images']['card'], cache=os.path.join(cache, 'd', item['id'] + '.png')))).convert('RGBA').resize((144, 144), Image.LANCZOS)
    a = np.asarray(im)[:, :, 3].astype(np.float32) / 255
    yy, xx = np.mgrid[0:144, 0:144]
    r = np.hypot(xx - 71.5, yy - 71.5) * 2  # em px do canvas 288
    th = (np.degrees(np.arctan2(yy - 71.5, xx - 71.5)) + 90) % 360  # 0° = topo, sentido horário
    sec = (th // 10).astype(int)
    mass, reach, inner = [], [], []
    for k in range(36):
        m = sec == k
        ring = m & (r >= 96)
        mass.append(float(a[ring].mean()))
        rr = r[m & (a > 0.5)]
        reach.append(float(rr.max()) if len(rr) else 120.0)
        inner.append(float(rr[rr >= 60].min()) if (rr >= 60).any() else 144.0)
    return {'nome': item['name'], 'massa': mass, 'alcance': reach, 'interno': inner, '_a': a}


def kmeans(X, k, it=60, seed=3):
    rng = np.random.default_rng(seed)
    C = X[rng.choice(len(X), k, replace=False)]
    for _ in range(it):
        lab = ((X[:, None] - C[None]) ** 2).sum(-1).argmin(1)
        C2 = np.stack([X[lab == j].mean(0) if (lab == j).any() else C[j] for j in range(k)])
        if np.allclose(C, C2): break
        C = C2
    return lab, C


def sheet(arrs, cols, cell, path):
    rows = (len(arrs) + cols - 1) // cols
    S = Image.new('RGB', (cols * cell[0], max(1, rows) * cell[1]), (49, 51, 56))
    for i, a in enumerate(arrs):
        im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).resize(cell)
        S.paste(Image.new('RGB', cell, (230, 230, 240)), ((i % cols) * cell[0], (i // cols) * cell[1]), im)
    S.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cache', required=True)
    ap.add_argument('--effects', type=int, default=60)
    ap.add_argument('--decos', type=int, default=0, help='0 = todas')
    ap.add_argument('--k', type=int, default=8)
    ap.add_argument('--seed', type=int, default=5)
    args = ap.parse_args()
    random.seed(args.seed)
    shop = get('https://itemshop.gg/api/v1/shop/discord', True)
    items = [i for s in shop['data']['sections'] for i in s['items']]
    effects = random.sample([i for i in items if i['type'] == 'Profile Effect'], args.effects)
    decos = [i for i in items if i['type'] == 'Avatar Decoration' and i.get('images', {}).get('card')]
    if args.decos: decos = random.sample(decos, args.decos)

    E = []
    for i in effects:
        try:
            r = study_effect(i, args.cache)
            if r and 'loop' in r:
                E.append(r)
                print('efeito', r['nome'], 'entrada', round(r.get('entrada', {}).get('cobertura_media', 0), 3), 'loop', round(r['loop']['cobertura_media'], 3), {k: round(v, 2) for k, v in r['loop']['zonas_media'].items()})
        except Exception as e:
            print('erro efeito', i['name'], e)
    D = []
    for n, i in enumerate(decos):
        try:
            D.append(deco_profile(i, args.cache))
            if n % 50 == 0: print('molduras', n, '/', len(decos))
        except Exception as e:
            print('erro moldura', i['name'], e)

    def med(xs): return float(np.median(xs)) if len(xs) else None
    def agg(key):
        L = [e[key] for e in E if key in e]
        return {'n': len(L), 'cobertura_media': med([x['cobertura_media'] for x in L]), 'cobertura_pico': med([x['cobertura_pico'] for x in L]),
                'zonas_media': {z: med([x['zonas_media'][z] for x in L]) for z in ZONES}, 'zonas_pico': {z: med([x['zonas_pico'][z] for x in L]) for z in ZONES},
                'grade_9x16_mediana': np.median(np.stack([np.array(x['grade_9x16']) for x in L]), 0).round(3).tolist() if L else []}
    loopmap = np.mean(np.stack([e['loop']['_mean'] for e in E]), 0)
    intromap = np.mean(np.stack([e['entrada']['_mean'] for e in E if 'entrada' in e]), 0)
    Image.fromarray((np.clip(loopmap / max(1e-6, loopmap.max()), 0, 1) * 255).astype(np.uint8)).save(os.path.join(args.cache, 'loop_heatmap.png'))
    Image.fromarray((np.clip(intromap / max(1e-6, intromap.max()), 0, 1) * 255).astype(np.uint8)).save(os.path.join(args.cache, 'intro_heatmap.png'))
    sheet([e['loop']['_mean'] for e in E], 10, (90, 176), os.path.join(args.cache, 'effects_loop_sheet.png'))
    sheet([e['entrada']['_mean'] for e in E if 'entrada' in e], 10, (90, 176), os.path.join(args.cache, 'effects_intro_sheet.png'))

    # formas das molduras: massa angular normalizada + alcance
    X = np.array([np.r_[np.array(d['massa']) / (max(d['massa']) + 1e-6), (np.array(d['alcance']) - 120) / 24] for d in D])
    lab, C = kmeans(X, args.k)
    tipos = []
    for j in range(args.k):
        idx = np.nonzero(lab == j)[0]
        if not len(idx): continue
        tipos.append({'id': j, 'n': int(len(idx)), 'frac': round(len(idx) / len(D), 3),
                      'massa_36': np.median(np.array([D[i]['massa'] for i in idx]), 0).round(3).tolist(),
                      'alcance_36': np.median(np.array([D[i]['alcance'] for i in idx]), 0).round(1).tolist(),
                      'interno_36': np.median(np.array([D[i]['interno'] for i in idx]), 0).round(1).tolist(),
                      'exemplos': [D[i]['nome'] for i in idx[:6]]})
        sheet([D[i]['_a'] for i in idx[:40]], 10, (96, 96), os.path.join(args.cache, f'decos_tipo{j}.png'))
    tipos.sort(key=lambda t: -t['n'])

    for e in E:
        for k in ('entrada', 'loop'):
            if k in e: e[k].pop('_mean', None)
    res = {'fonte': 'loja oficial do Discord (itemshop.gg + discord.com/api/v9/collectibles-products + cdn.discordapp.com)',
           'data': shop['data'].get('shopDate'),
           'efeitos': {'n': len(E), 'entrada_ms': med([e['entrada_ms'] for e in E]), 'loop_ms': med([e['loop_ms'] for e in E]), 'loop_pausa_ms': med([e['loop_pausa_ms'] for e in E]),
                       'entrada': agg('entrada'), 'loop': agg('loop'),
                       'loop_mapa_16x9': (loopmap.reshape(16, 55, 9, 50).mean((1, 3))).round(3).tolist(),
                       'entrada_mapa_16x9': (intromap.reshape(16, 55, 9, 50).mean((1, 3))).round(3).tolist(),
                       'itens': [{k: v for k, v in e.items()} for e in E]},
           'molduras_formas': {'n': len(D), 'tipos': tipos}}
    json.dump(res, open(os.path.join(ROOT, 'catalog', 'effect-shape-study.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1, default=lambda o: o.item() if hasattr(o, 'item') else str(o))
    print(json.dumps({k: v for k, v in res['efeitos'].items() if k not in ('itens',)}, ensure_ascii=False, default=lambda o: o.item())[:3000])
    for t in tipos: print('tipo', t['id'], t['n'], t['exemplos'][:4])


if __name__ == '__main__':
    main()
