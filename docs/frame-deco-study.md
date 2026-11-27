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

## Profile effect: entrada × loop

Medido com `tools/study_effects_shapes.py` em **60 efeitos oficiais**. Para cada um, a ferramenta lê a camada de entrada e a de loop, com até 40 quadros de cada.

| Medida | Entrada | Loop |
|---|---|---|
| Duração | 4,0 s | 4,2 s, com **pausa de 3 s** entre as repetições |
| Canvas coberto (média dos quadros) | 23% (pico 44%) | **7,6%** (pico 13%) |
| Avatar coberto | 18% | 7% |
| Nome coberto | 36% | **4%** |
| Texto coberto | 31% | **3%** |
| Banner coberto | 32% | 23% |

A entrada é o momento de impacto: a cena passa pelo perfil todo. O **loop deixa só partes da cena**, quase sempre no banner e em faixas finas nas laterais, e o resto do card fica livre. Os mapas médios de ocupação (grade 16×9) estão em `catalog/media-study.json`. O gerador usa esses mapas como máscara da entrada e do loop quando a mídia do usuário vira efeito: o começo do vídeo toca na entrada, e a segunda metade fica no loop, só nas áreas do mapa do loop.

## Avatar decoration: tipos de forma

As **707 molduras** da loja foram agrupadas (k-means) pelo perfil angular de massa e de alcance. Saíram 8 tipos, em ordem de frequência:

1. Anel cheio, às vezes com orelhas (171)
2. Anel irregular ou de chamas (158)
3. Só um ornamento no topo, como chapéu, cabelo ou orelhas (98)
4. Elementos soltos espalhados (91)
5. Orelhas ou chifres saindo do quadrado (61)
6. Lua crescente ou arco de um lado (50)
7. Asas ou arcos laterais (40)
8. Peso na base, como fogo, túmulos ou plantas (38)

O alcance chega aos cantos do canvas (~170 px do centro), já que orelhas e chifres passam do círculo. Quando a mídia vira moldura, o gerador sorteia 3 desses tipos e faz uma moldura de cada forma. O avatar fica livre, porque a arte só começa no raio 112.

## Mais formas (`tools/study_more_shapes.py`)

As 707 molduras foram reagrupadas em **28 grupos** (23 com 8 ou mais itens viram formas no seletor). Os mapas de loop dos 60 efeitos foram agrupados em **10 tipos**, e os que têm 2 ou mais efeitos aparecem no seletor como "Oficial: …". Os dois ficam em `catalog/media-study.json`, que o seletor de **Forma** lê.

```bash
python tools/study_more_shapes.py --cache <pasta-temporária> --k 28 --ke 10
```
