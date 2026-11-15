# Guia de estilo dos cosméticos do Discord (medido)

Gerado por `tools/analyze_discord_style.py` a partir de 160 itens oficiais da loja de 2026-11-15 (40 Profile Effect, 40 Avatar Decoration, 40 Nameplate, 40 Profile Frame). Os números são medianas (p25–p75 entre parênteses).

## Profile effect (450×880)
- Camadas: 2 (entrada + loop). Entrada ≈ 4.2 s (3.0–5.0); loop ≈ 4.1 s; pausa entre loops ≈ 2.4 s.
- Ocupa ≈ 14% do canvas, concentrada nos 60% de cima; a base (últimos 30%) fica quase vazia.
- No quadro de destaque, cobre o avatar ≈ 8%, o nome ≈ 34% e o texto ≈ 33%: o efeito ATRAVESSA o perfil, mas não fica parado sobre o avatar.
- Cores principais ≈ 22; saturação 0.38; brilho 0.78; contorno preto ≈ 2% dos pixels.

## Avatar decoration (288×288)
- Vazio no centro; a arte é um anel colado ao avatar. Densidade por anel (centro → borda): 1%, 1%, 1%, 2%, 6%, 13%, 26%, 42%, 54%, 29%.
- Cobre o avatar ≈ 11% (até 18%). Distribuição na borda: topo 42%, base 43%, esquerda 44%, direita 35%.
- Cores principais ≈ 18; brilho 0.88; quase sem contorno preto (0%).

## Nameplate (448×84, fundo transparente + paleta)
- Densidade da esquerda para a direita (8 faixas): 0%, 0%, 2%, 8%, 21%, 39%, 59%, 66% — a arte fica nos 40% da direita.
- Lado do nome (x < 200) coberto ≈ 1%. Cobertura total ≈ 15%; cores ≈ 10.

## Profile frame (1312 px de largura)
- Faixa no topo (≈ 45% da altura) + laterais finas até a base; centro 0% e nome 0%. Avatar ≈ 10%.
- Cores ≈ 16; contorno preto ≈ 1% (alguns frames usam contorno grosso, até 51%).
