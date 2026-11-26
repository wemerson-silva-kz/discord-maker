"""Mais formas aprendidas dos itens oficiais.

- Molduras: reagrupa as ~707 avatar decorations da loja em --k tipos (padrão 16).
- Efeitos: agrupa os mapas de loop já medidos (catalog/effect-shape-study.json) em --ke tipos.
Atualiza catalog/media-study.json (lido pelo site). As imagens ficam só em --cache.

    python tools/study_more_shapes.py --cache <pasta-temporária> --k 16 --ke 8
"""
import argparse, json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from study_effects_shapes import get, deco_profile, kmeans, ROOT  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cache', required=True)
    ap.add_argument('--k', type=int, default=16)
    ap.add_argument('--ke', type=int, default=8)
    a = ap.parse_args()
    shop = get('https://itemshop.gg/api/v1/shop/discord', True)
    items = [i for s in shop['data']['sections'] for i in s['items']]
    decos = [i for i in items if i['type'] == 'Avatar Decoration' and i.get('images', {}).get('card')]
    D = []
    for n, i in enumerate(decos):
        try: D.append(deco_profile(i, a.cache))
        except Exception as e: print('erro', i['name'], e)
        if n % 100 == 0: print('molduras', n, '/', len(decos), flush=True)
    X = np.array([np.r_[np.array(d['massa']) / (max(d['massa']) + 1e-6), (np.array(d['alcance']) - 120) / 24] for d in D])
    lab, _ = kmeans(X, a.k, seed=7)
    tipos = []
    for j in range(a.k):
        idx = np.nonzero(lab == j)[0]
        if len(idx) < 6: continue
        tipos.append({'id': j, 'n': int(len(idx)), 'frac': round(len(idx) / len(D), 3),
                      'massa_36': np.median([D[i]['massa'] for i in idx], 0).round(3).tolist(),
                      'alcance_36': np.median([D[i]['alcance'] for i in idx], 0).round(1).tolist(),
                      'interno_36': np.median([D[i]['interno'] for i in idx], 0).round(1).tolist(),
                      'exemplos': [D[i]['nome'] for i in idx[:6]]})
    tipos.sort(key=lambda t: -t['n'])

    big = json.load(open(os.path.join(ROOT, 'catalog', 'effect-shape-study.json'), encoding='utf-8'))
    E = [e for e in big['efeitos']['itens'] if e.get('loop', {}).get('grade_9x16')]
    G = np.array([np.array(e['loop']['grade_9x16'], dtype=float) for e in E])
    G = G.reshape(len(G), -1) if G.ndim == 3 else G
    Gn = G / (G.max(1, keepdims=True) + 1e-6)
    shape = np.array(E[0]['loop']['grade_9x16']).shape
    labe, _ = kmeans(Gn, a.ke, seed=4)
    etipos = []
    for j in range(a.ke):
        idx = np.nonzero(labe == j)[0]
        if len(idx) < 2: continue
        m = Gn[idx].mean(0).reshape(shape)
        if m.shape[0] < m.shape[1]: m = m.T  # sempre 16 linhas × 9 colunas
        etipos.append({'n': int(len(idx)), 'mapa_16x9': m.round(3).tolist(), 'exemplos': [E[i]['nome'] for i in idx[:5]]})
    etipos.sort(key=lambda t: -t['n'])

    p = os.path.join(ROOT, 'catalog', 'media-study.json')
    ms = json.load(open(p, encoding='utf-8'))
    ms['molduras_formas'] = {'n': len(D), 'k': a.k, 'tipos': tipos}
    ms['efeitos']['loop_tipos'] = etipos
    json.dump(ms, open(p, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('molduras', len(D), 'tipos', [t['n'] for t in tipos], '| efeitos', [t['n'] for t in etipos], np.array(etipos[0]['mapa_16x9']).shape)


if __name__ == '__main__':
    main()
