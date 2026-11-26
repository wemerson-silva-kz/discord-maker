# Estudo: Profile Frames e Avatar Decorations oficiais

Gerado com `tools/study_frames_decorations.py` a partir de **40 profile frames e 60 avatar decorations** da loja oficial do Discord (itemshop.gg + `discord.com/api/v9/collectibles-products` + PNGs do CDN). Os números completos, item por item, estão em `catalog/frame-deco-study.json`. As imagens só são baixadas para uma pasta temporária e não entram no repositório.

Os números são medianas, com p25–p75 entre parênteses.

## Profile frame

O canvas tem **1312 px de largura**, e o card fica no meio, com 1200 px de largura. As camadas vêm da API do produto:

- `staple`: preso no topo ou na base, com **1287×716**, na frente ou atrás do card. Aparece em 40 de 40 frames no topo e em 34 de 40 na base.
- `border`: em volta do card, com **1312×2528**. Aparece em 11 de 40 frames.
- `rail`: aparece em 5 de 40 frames.

Os frames da loja são **estáticos**, sem versão `/animated`.

| Medida | Valor |
|---|---|
| Quanto o frame passa acima do card (`overflow_top`) | 303 px (280–304) |
| Quanto passa abaixo do card (`overflow_bottom`) | 190 px (123–212) |
| Quanto passa dos lados (`overflow_horizontal`) | 56 px (sempre) |
| Altura da coroa acima do card | 298 px (262–304) |
| Largura da coroa | 98% do canvas |
| Quanto a coroa **desce sobre o card** | **41 px** (24–90) |
| Altura da base abaixo do card | 183 px (102–209) |
| Quanto a base **sobe no card** | **30 px** (15–48) |
| Frames **sem lateral** no meio do card | **50%** |
| Lateral, quando existe: por fora do card | 36 px (31–45) |
| Lateral, quando existe: **para dentro do card** | **22 px** (15–29) |
| Miolo do card coberto | **0%** em todos |
| Canvas coberto | 18% (15–21%) |

Os layouts que se repetem:

1. **Coroa + base, sem laterais**: pérolas, flores, cristais, nuvens ou chamas ao longo do topo e da base.
2. **Criatura espiando por cima**: o rosto ou corpo de um bicho ou personagem fica no topo, com patas, pernas ou cauda na base.
3. **Borda fina com ornamento central no topo**: borda metálica, de néon ou de tecido, com uma joia, uma estrela ou uma máscara no alto.
4. **Elementos que escorrem pelas laterais**: a arte desce um pedaço das laterais a partir da coroa e some antes do meio.

## Avatar decoration

O canvas tem **288×288**. O avatar fica no centro e mede **240 px** (raio 120), porque a moldura é 1,2× o avatar.

| Medida | Valor |
|---|---|
| Avatar coberto | **17%** (9–23%) |
| Densidade do anel r 90–100 | 19% |
| Densidade do anel r 100–110 | 32% |
| Densidade do anel r 110–120 (borda do avatar) | 40% |
| Densidade do anel r 120–130 | 42% |
| Densidade do anel r 130–140 | 23% |
| Setores de 10° vazios no anel | 28% (6–53%) |
| Massa no topo | 0,32 |
| Massa na esquerda | 0,41 |
| Massa na direita | 0,31 |
| Massa na base | 0,21 |

As molduras **não são uma faixa cheia**. São poucos elementos grandes, colados à borda do avatar. Só pontas (uma pata, uma folha, um chifre) entram no avatar, e cerca de um quarto do anel fica vazio. O peso fica no topo e nas laterais.

## Onde isso é usado

- `js/ai-illustration.js`, `LAYOUT`: o pedido ao modelo de imagem usa essas proporções e esses layouts.
- `js/ai-illustration.js`, `mediaMask`: quando a mídia do usuário vira arte, o frame tem coroa e base com contorno irregular, laterais que entram 22 px e somem no meio, e o miolo vazio. A moldura fica por fora do avatar.
- `js/ai-illustration.js`, `protectZones`: limites das zonas protegidas na arte gerada pela IA.

Para refazer o estudo:

```bash
pip install pillow numpy
python tools/study_frames_decorations.py --cache <pasta-temporária> --frames 40 --decos 60
```
