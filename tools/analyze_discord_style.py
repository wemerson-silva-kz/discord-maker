#!/usr/bin/env python3
"""
Estuda a biblioteca oficial de cosméticos do Discord e gera um GUIA DE ESTILO
medido (catalog/style-guide.json + docs/discord-style-guide.md), usado pelo
Gerador IA (prompt, referências de estilo e limites da revisão automática).

Fontes (públicas):
  • loja do dia: https://itemshop.gg/api/v1/shop/discord (sem chave)
  • config dos efeitos: https://discord.com/api/v9/collectibles-products/<sku>
  • imagens estáticas no CDN do Discord (leves; nada de baixar APNGs grandes)

Uso:  pip install pillow && python3 tools/analyze_discord_style.py [--per-cat 40]
Seja educado com as APIs: uma chamada por vez, com pausa.
"""
import argparse, io, json, math, os, random, statistics as st, sys, time, urllib.request
from collections import Counter
from PIL import Image

UA = 'cosmetic-studio/1.0 (style-guide research; +https://github.com/wemerson-silva-kz/discord-maker)'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAUSE = 0.3

# Mesmas zonas protegidas do gerador (js/ai-generator.js → ZONES)
ZONES = {
    'effects': {'w': 450, 'h': 880, 'zones': {
        'avatar': ('circle', 82, 138, 66), 'name': ('rect', 21, 199, 323, 72), 'content': ('rect', 21, 283, 408, 273)}},
    'frames': {'w': 1312, 'h': 716, 'zones': {
        'avatar': ('circle', 239, 401, 195), 'name': ('rect', 62, 579, 940, 137), 'center': ('rect', 120, 420, 1072, 296)}},
    'decorations': {'w': 288, 'h': 288, 'zones': {'avatar': ('circle', 144, 144, 104)}},
    'nameplates': {'w': 448, 'h': 84, 'zones': {'name': ('rect', 0, 0, 200, 84)}},
}


def get(url, as_json=False, tries=3):
    for k in range(tries):
        try:
            data = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=20).read()
            time.sleep(PAUSE)
            return json.loads(data) if as_json else data
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 5 * (k + 1)
                print(f'  429, aguardando {wait}s'); time.sleep(wait); continue
            raise
    raise RuntimeError('muitas tentativas: ' + url)


def load(url, size=None):
    im = Image.open(io.BytesIO(get(url))).convert('RGBA')
    if size: im = im.resize(size, Image.LANCZOS)
    return im


def zone_cov(im, cat):
    Z = ZONES[cat]
    W, H = im.size
    sx, sy = W / Z['w'], H / Z['h']
    a = im.getchannel('A').load()
    out = {}
    for name, z in Z['zones'].items():
        s = n = 0
        if z[0] == 'circle':
            _, cx, cy, r = z
            x0, x1, y0, y1 = cx - r, cx + r, cy - r, cy + r
        else:
            _, x, y, w, h = z
            x0, x1, y0, y1 = x, x + w, y, y + h
        step = 3
        for yy in range(int(y0 * sy), min(H, int(y1 * sy)), step):
            for xx in range(int(x0 * sx), min(W, int(x1 * sx)), step):
                if z[0] == 'circle' and ((xx / sx - cx) ** 2 + (yy / sy - cy) ** 2) > r * r: continue
                s += a[xx, yy] / 255; n += 1
        out[name] = s / n if n else 0
    return out


def style_stats(im):
    """Contorno escuro, nº de cores, saturação/brilho, cobertura total."""
    small = im.resize((max(1, im.width // 3), max(1, im.height // 3)))
    px = [p for p in small.getdata() if p[3] > 200]
    if not px: return None
    cover = len(px) / (small.width * small.height)
    dark = sum(1 for r, g, b, _ in px if max(r, g, b) < 45) / len(px)
    q = Counter(((r >> 5), (g >> 5), (b >> 5)) for r, g, b, _ in px)
    top = q.most_common()
    acc, colors = 0, 0
    for _, c in top:
        acc += c; colors += 1
        if acc / len(px) >= 0.9: break
    sats, vals = [], []
    for r, g, b, _ in px[:: max(1, len(px) // 4000)]:
        mx, mn = max(r, g, b), min(r, g, b)
        vals.append(mx / 255); sats.append(0 if mx == 0 else (mx - mn) / mx)
    return {'coverage': cover, 'darkOutline': dark, 'colors90': colors, 'saturation': st.median(sats), 'brightness': st.median(vals)}


def grid(im, cols, rows):
    """Ocupação (alfa médio) numa grade — mostra ONDE a arte fica."""
    a = im.getchannel('A').resize((cols, rows), Image.BOX).load()
    return [[round(a[x, y] / 255, 3) for x in range(cols)] for y in range(rows)]


def radial(im):
    """Molduras: alfa por anel (raio normalizado) e por quadrante (topo/lados/base)."""
    W, H = im.size
    cx, cy = W / 2, H / 2
    a = im.getchannel('A').load()
    bands = [0.0] * 10; nb = [0] * 10
    quad = {'topo': [0, 0], 'base': [0, 0], 'esquerda': [0, 0], 'direita': [0, 0]}
    for y in range(0, H, 2):
        for x in range(0, W, 2):
            dx, dy = x - cx, y - cy
            r = math.hypot(dx, dy) / (W / 2)
            if r >= 1: continue
            v = a[x, y] / 255
            i = min(9, int(r * 10)); bands[i] += v; nb[i] += 1
            if r > 0.7:
                ang = math.degrees(math.atan2(dy, dx))
                k = 'topo' if -135 <= ang < -45 else 'base' if 45 <= ang < 135 else 'direita' if -45 <= ang < 45 else 'esquerda'
                quad[k][0] += v; quad[k][1] += 1
    return [round(b / n, 3) if n else 0 for b, n in zip(bands, nb)], {k: round(s / n, 3) if n else 0 for k, (s, n) in quad.items()}


def pct(xs, p):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(p / 100 * len(xs)))] if xs else 0


def summarize(vals):
    return {'mediana': round(st.median(vals), 3), 'p25': round(pct(vals, 25), 3), 'p75': round(pct(vals, 75), 3), 'p90': round(pct(vals, 90), 3)} if vals else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--per-cat', type=int, default=40)
    ap.add_argument('--seed', type=int, default=7)
    args = ap.parse_args()
    random.seed(args.seed)

    shop = get('https://itemshop.gg/api/v1/shop/discord', as_json=True)
    items = [i for s in shop['data']['sections'] for i in s['items'] if i.get('images', {}).get('card')]
    by = {t: [i for i in items if i['type'] == t] for t in ('Profile Effect', 'Avatar Decoration', 'Nameplate', 'Profile Frame')}
    print({k: len(v) for k, v in by.items()})
    sample = {k: random.sample(v, min(args.per_cat, len(v))) for k, v in by.items()}

    out = {'fonte': 'loja oficial do Discord (itemshop.gg + discord.com/api/v9/collectibles-products + cdn.discordapp.com)',
           'data': shop['data'].get('shopDate'), 'amostra': {k: len(v) for k, v in sample.items()}, 'exemplos': {}}

    # ---------- Efeitos: config de tempo + composição (miniatura 900×1760 = 2× o canvas 450×880)
    tim = {'introMs': [], 'loopMs': [], 'gapMs': [], 'loopDelayMs': [], 'camadas': []}
    cov = {'avatar': [], 'name': [], 'content': []}
    sty, grids = [], []
    for i in sample['Profile Effect']:
        try:
            p = get(f"https://discord.com/api/v9/collectibles-products/{i['id']}", as_json=True)
            fx = next((it for it in p.get('items', []) if it.get('type') == 1), None)
            if fx:
                eff = fx.get('effects') or []
                tim['camadas'].append(len(eff))
                intro = [e for e in eff if not e.get('loop')]
                loop = [e for e in eff if e.get('loop')]
                if intro: tim['introMs'].append(max(e['start'] + e['duration'] for e in intro))
                if loop:
                    tim['loopMs'].append(loop[0]['duration']); tim['loopDelayMs'].append(loop[0].get('loopDelay', 0))
                    if intro: tim['gapMs'].append(loop[0]['start'] - max(e['start'] + e['duration'] for e in intro))
            im = load(i['images']['card'], (450, 880))
            c = zone_cov(im, 'effects')
            for k in cov: cov[k].append(c[k])
            s = style_stats(im)
            if s: sty.append(s)
            grids.append(grid(im, 9, 16))
            print('  efeito', i['name'], {k: round(v, 2) for k, v in c.items()})
        except Exception as e:
            print('  erro efeito', i['name'], e)
    out['effects'] = {
        'tempos': {k: summarize(v) for k, v in tim.items()},
        'coberturaZonas': {k: summarize(v) for k, v in cov.items()},
        'estilo': {k: summarize([s[k] for s in sty]) for k in (sty[0] if sty else {})},
        'mapaOcupacao9x16': [[round(st.mean(g[y][x] for g in grids), 3) for x in range(9)] for y in range(16)] if grids else None,
    }
    out['exemplos']['effects'] = [{'nome': i['name'], 'colecao': i.get('_s', ''), 'img': i['images']['card']} for i in sample['Profile Effect'][:12]]

    # ---------- Molduras (estático 288 via passthrough=false)
    cov, sty, rad, quads = [], [], [], []
    for i in sample['Avatar Decoration']:
        try:
            url = i['images']['card']  # size=320 (o CDN só aceita tamanhos fixos); redimensiona abaixo
            im = load(url, (288, 288))
            cov.append(zone_cov(im, 'decorations')['avatar'])
            s = style_stats(im)
            if s: sty.append(s)
            b, q = radial(im); rad.append(b); quads.append(q)
        except Exception as e:
            print('  erro moldura', i['name'], e)
    out['decorations'] = {
        'coberturaAvatar': summarize(cov),
        'estilo': {k: summarize([s[k] for s in sty]) for k in (sty[0] if sty else {})},
        'perfilRadial10': [round(st.mean(r[k] for r in rad), 3) for k in range(10)] if rad else None,
        'quadrantesBorda': {k: round(st.mean(q[k] for q in quads), 3) for k in ('topo', 'base', 'esquerda', 'direita')} if quads else None,
    }
    out['exemplos']['decorations'] = [{'nome': i['name'], 'img': i['images']['card']} for i in sample['Avatar Decoration'][:12]]

    # ---------- Nameplates (estático 448×84)
    cov, sty, cols = [], [], []
    for i in sample['Nameplate']:
        try:
            im = load(i['images']['card'], (448, 84))
            cov.append(zone_cov(im, 'nameplates')['name'])
            s = style_stats(im)
            if s: sty.append(s)
            g = grid(im, 8, 1)[0]; cols.append(g)
        except Exception as e:
            print('  erro nameplate', i['name'], e)
    out['nameplates'] = {
        'coberturaLadoDoNome': summarize(cov),
        'estilo': {k: summarize([s[k] for s in sty]) for k in (sty[0] if sty else {})},
        'perfilHorizontal8': [round(st.mean(c[k] for c in cols), 3) for k in range(8)] if cols else None,
    }
    out['exemplos']['nameplates'] = [{'nome': i['name'], 'img': i['images']['card']} for i in sample['Nameplate'][:12]]

    # ---------- Frames (estático 1312 de largura)
    cov = {'avatar': [], 'name': [], 'center': []}
    sty, grids = [], []
    for i in sample['Profile Frame']:
        try:
            im = load(i['images']['card'])
            canvas = Image.new('RGBA', (1312, 716), (0, 0, 0, 0))
            canvas.paste(im.resize((1312, round(im.height * 1312 / im.width))), (0, 0))
            c = zone_cov(canvas, 'frames')
            for k in cov: cov[k].append(c[k])
            s = style_stats(canvas)
            if s: sty.append(s)
            grids.append(grid(canvas, 16, 9))
        except Exception as e:
            print('  erro frame', i['name'], e)
    out['frames'] = {
        'coberturaZonas': {k: summarize(v) for k, v in cov.items()},
        'estilo': {k: summarize([s[k] for s in sty]) for k in (sty[0] if sty else {})},
        'mapaOcupacao16x9': [[round(st.mean(g[y][x] for g in grids), 3) for x in range(16)] for y in range(9)] if grids else None,
    }
    out['exemplos']['frames'] = [{'nome': i['name'], 'img': i['images']['card']} for i in sample['Profile Frame'][:12]]

    os.makedirs(os.path.join(ROOT, 'catalog'), exist_ok=True)
    path = os.path.join(ROOT, 'catalog', 'style-guide.json')
    json.dump(out, open(path, 'w'), ensure_ascii=False, indent=1)
    print('salvo em', path)
    md = os.path.join(ROOT, 'docs', 'discord-style-guide.md')
    write_markdown(out, md)
    print('guia legível em', md)



def write_markdown(d, path):
    """Versão legível do guia (docs/discord-style-guide.md)."""
    m = lambda s: s['mediana'] if s else 0
    p = lambda v: f"{round(v * 100)}%"
    e, dc, n, f = d['effects'], d['decorations'], d['nameplates'], d['frames']
    lines = [
        '# Guia de estilo dos cosméticos do Discord (medido)', '',
        f"Gerado por `tools/analyze_discord_style.py` a partir de {sum(d['amostra'].values())} itens oficiais da loja de {d['data']} "
        f"({', '.join(f'{v} {k}' for k, v in d['amostra'].items())}). Os números são medianas (p25–p75 entre parênteses).", '',
        '## Profile effect (450×880)',
        f"- Camadas: {m(e['tempos']['camadas']):.0f} (entrada + loop). Entrada ≈ {m(e['tempos']['introMs'])/1000:.1f} s ({e['tempos']['introMs']['p25']/1000:.1f}–{e['tempos']['introMs']['p75']/1000:.1f}); loop ≈ {m(e['tempos']['loopMs'])/1000:.1f} s; pausa entre loops ≈ {m(e['tempos']['loopDelayMs'])/1000:.1f} s.",
        f"- Ocupa ≈ {p(m(e['estilo']['coverage']))} do canvas, concentrada nos 60% de cima; a base (últimos 30%) fica quase vazia.",
        f"- No quadro de destaque, cobre o avatar ≈ {p(m(e['coberturaZonas']['avatar']))}, o nome ≈ {p(m(e['coberturaZonas']['name']))} e o texto ≈ {p(m(e['coberturaZonas']['content']))}: o efeito ATRAVESSA o perfil, mas não fica parado sobre o avatar.",
        f"- Cores principais ≈ {m(e['estilo']['colors90']):.0f}; saturação {m(e['estilo']['saturation']):.2f}; brilho {m(e['estilo']['brightness']):.2f}; contorno preto ≈ {p(m(e['estilo']['darkOutline']))} dos pixels.", '',
        '## Avatar decoration (288×288)',
        f"- Vazio no centro; a arte é um anel colado ao avatar. Densidade por anel (centro → borda): {', '.join(p(v) for v in dc['perfilRadial10'])}.",
        f"- Cobre o avatar ≈ {p(m(dc['coberturaAvatar']))} (até {p(dc['coberturaAvatar']['p75'])}). Distribuição na borda: " + ', '.join(f'{k} {p(v)}' for k, v in dc['quadrantesBorda'].items()) + '.',
        f"- Cores principais ≈ {m(dc['estilo']['colors90']):.0f}; brilho {m(dc['estilo']['brightness']):.2f}; quase sem contorno preto ({p(m(dc['estilo']['darkOutline']))}).", '',
        '## Nameplate (448×84, fundo transparente + paleta)',
        f"- Densidade da esquerda para a direita (8 faixas): {', '.join(p(v) for v in n['perfilHorizontal8'])} — a arte fica nos 40% da direita.",
        f"- Lado do nome (x < 200) coberto ≈ {p(m(n['coberturaLadoDoNome']))}. Cobertura total ≈ {p(m(n['estilo']['coverage']))}; cores ≈ {m(n['estilo']['colors90']):.0f}.", '',
        '## Profile frame (1312 px de largura)',
        f"- Faixa no topo (≈ 45% da altura) + laterais finas até a base; centro {p(m(f['coberturaZonas']['center']))} e nome {p(m(f['coberturaZonas']['name']))}. Avatar ≈ {p(m(f['coberturaZonas']['avatar']))}.",
        f"- Cores ≈ {m(f['estilo']['colors90']):.0f}; contorno preto ≈ {p(m(f['estilo']['darkOutline']))} (alguns frames usam contorno grosso, até {p(f['estilo']['darkOutline']['p90'])}).", '',
    ]
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w').write('\n'.join(lines))


if __name__ == '__main__' and os.environ.get('ONLY_MD'):
    write_markdown(json.load(open(os.path.join(ROOT, 'catalog', 'style-guide.json'))), os.path.join(ROOT, 'docs', 'discord-style-guide.md'))


if __name__ == '__main__' and not os.environ.get('ONLY_MD'):
    main()
