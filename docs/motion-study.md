# Estudo de movimento: o que se repete nos vídeos de referência

Estudei 10 pins do Pinterest, sendo 7 vídeos e 3 imagens. Os vídeos foram lidos quadro a quadro: 16 quadros por vídeo e um mapa de diferença entre quadros, para ver o que se move. As mídias ficam numa pasta temporária e não entram no repositório.

| Elemento | Como se move nos vídeos | No gerador (`PARTS`) |
|---|---|---|
| Corvos e pássaros | Bando no terço de cima, atravessando de lado. As asas batem rápido. Alguns grandes passam perto da câmera. | `corvos` |
| Grama | Tufos na base, presos embaixo, balançam fora de fase. A grama da frente é maior e desfocada. | `grama` |
| Penas e folhas | Caem girando e "achatam" ao virar. Ficam em 3 planos: pequenas e lentas ao fundo, grandes e desfocadas na frente. | `penas`, `folhas`, `petalas` |
| Fogo e faíscas | Brasas pequenas e brilhantes sobem e somem. | `brasas` |
| Raios elétricos | Zigue-zagues que acendem num instante e apagam, fora de fase. | `raios` |
| Raios de luz | Feixes diagonais largos que pulsam devagar. | `luz` |
| Tecido se desfazendo | Pedaços escuros se soltam e vão para um lado. | `fragmentos` |
| Fumaça e névoa | Manchas desfocadas que sobem e crescem. | `fumaca` |
| Transição da entrada | Estouro de luz que revela a cena (flash), troca seca de cena (corte) ou dissolver. | `withIntroFx` |

Padrões que valem para todos:

1. **Profundidade em 3 planos.** Muitos pequenos ao fundo, vários no meio e poucos grandes e desfocados na frente.
2. **Nada é sincronizado.** Cada elemento tem a sua duração e o seu atraso.
3. **O personagem fica quase parado.** Quem dá vida é o que passa em volta. Por isso o loop guarda só partes da cena e soma camadas de elementos.

**Na tela:** a IA de visão recebe até 8 quadros da mídia e responde em JSON quais desses elementos aparecem, com direção, região, quantidade e cor. Ela também diz qual transição usar. O que você escolhe na tela tem prioridade sobre a resposta da IA.

## Moldura feita de objetos

As molduras oficiais são poucos objetos grandes colados à borda do avatar, e não um anel. Por isso o modo padrão agora segue estes passos:

1. **Acha os objetos em destaque** da mídia. Mede a distância de cor até o fundo (as bordas da imagem), separa com limiar de Otsu e fica com as maiores regiões. Com a IA ligada, ela mesma aponta as caixas dos objetos.
2. **Recorta cada objeto sem fundo**, usando a distância de cor até o fundo dentro da caixa.
3. **Encaixa os objetos nos cantos e no topo ou na base**, que são os lugares com espaço fora do avatar, seguindo os ângulos de maior massa da forma escolhida. A borda interna do objeto entra cerca de 28 px no avatar.
4. **Anima com os quadros reais** quando a mídia é vídeo, ou com um balanço leve quando é imagem.

O modo "Anel recortado" continua disponível.
