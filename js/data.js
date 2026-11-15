/* ==========================================================================
   COSMETIC STUDIO — CATÁLOGO DE ITENS (Mock Data)
   --------------------------------------------------------------------------
   Este é o ÚNICO arquivo que você precisa editar para adicionar, remover ou
   trocar cosméticos. Cada item tem um objeto `asset` que diz COMO ele é
   desenhado:

   1) Efeito em CSS (padrão deste projeto):
      asset: {
        type: 'css',
        className: 'np-neon',            // classe definida em css/cosmetics.css
        particles: [                     // opcional: partículas geradas via JS
          { kind: 'streak', count: 6, color: '#00F0FF' }
        ]
      }

   2) Imagem real (.png, .gif, .webp, .apng):
      asset: {
        type: 'image',
        src: 'https://cdn.exemplo.com/nameplate-animada.webp',
        staticSrc: 'https://cdn.exemplo.com/nameplate-estatica.png' // opcional:
        // exibido nos cards e na lista até o mouse passar por cima
      }

   3) Efeito de perfil do Discord em DUAS FASES (entrada → loop):
      asset: {
        type: 'image',
        intro: 'https://cdn.discordapp.com/media/v1/collectibles-shop/<hash-entrada>', // toca 1×, até 6 s
        loop:  'https://cdn.discordapp.com/media/v1/collectibles-shop/<hash-loop>',    // repete
      }
      Molduras e nameplates do Discord têm dois estados:
        src: '.../collectibles-shop/<id>/animated', staticSrc: '.../collectibles-shop/<id>/static'
      Itens oficiais ficam em catalog/discord.json (carregado automaticamente).
      Use o botão "Importar do Discord" da galeria para montar isso a partir de um ID/URL.
      Opcional: `meta` com quadros/duração/FPS, gerado por `node tools/measure-apng.mjs`
      (o CDN /collectibles-shop/ não libera CORS, então o navegador não consegue medir sozinho).

   4) Vídeo (.webm / .mp4):
      asset: { type: 'video', src: 'https://cdn.exemplo.com/efeito.webm' }

   Tipos de partícula disponíveis (kind):
     petal, star, ember, streak, bolt, sparkle (rise:true p/ flutuar),
     warp, rain, orb, drop, ring (shape: petal|blossom|flame|bolt|crystal|
     planet|star|pixel), svgring.
   Opções comuns: count, color, size (multiplicador), speed (multiplicador).
   ========================================================================== */

window.COSMETICS_DATA = {
  /* Coleções: usadas nos filtros e nas tags dos cards */
  collections: {
    Cyberpunk: { color: '#FF2BD6' },
    Anime: { color: '#FF8FC7' },
    Galaxy: { color: '#9B8CFF' },
    Fantasia: { color: '#3EE6B0' },
    Pixel: { color: '#FF8A00' },
    Elemental: { color: '#4AA3FF' },
    Discord: { color: '#5865F2' },
  },

  rarities: {
    Raro: { color: '#00A8FC' },
    Épico: { color: '#B66DFF' },
    Lendário: { color: '#F0B232' },
    Oficial: { color: '#5865F2' },
  },

  /* ------------------------------------------------------------------ */
  /* NAMEPLATES — fundo animado atrás do nome na lista de membros / DMs */
  /* ------------------------------------------------------------------ */
  nameplates: [
    {
      id: 'np-neon-overdrive',
      name: 'Neon Overdrive',
      collection: 'Cyberpunk',
      rarity: 'Épico',
      description: 'Letreiros de néon varrendo uma avenida chuvosa de Neo-Tóquio.',
      tags: ['neon', 'cidade', 'rosa', 'ciano', 'synthwave'],
      asset: {
        type: 'css',
        className: 'np-neon',
        particles: [
          { kind: 'streak', count: 5, color: '#00F0FF' },
          { kind: 'streak', count: 3, color: '#FF2BD6' },
        ],
      },
    },
    {
      id: 'np-sakura-breeze',
      name: 'Brisa de Sakura',
      collection: 'Anime',
      rarity: 'Raro',
      description: 'Um galho em flor e pétalas dançando ao vento da primavera.',
      tags: ['flor', 'rosa', 'primavera', 'japão', 'petalas'],
      asset: {
        type: 'css',
        className: 'np-sakura',
        particles: [{ kind: 'petal', count: 11, speed: 2.4, wind: 2.2, size: 0.75 }],
      },
    },
    {
      id: 'np-nebula-drift',
      name: 'Deriva Nebular',
      collection: 'Galaxy',
      rarity: 'Lendário',
      description: 'Nuvens de poeira cósmica e estrelas cintilando em outra galáxia.',
      tags: ['estrelas', 'espaço', 'cosmos', 'roxo', 'nebulosa'],
      asset: {
        type: 'css',
        className: 'np-galaxy',
        particles: [
          { kind: 'star', count: 20, size: 0.7 },
          { kind: 'sparkle', count: 3, color: '#D7CCFF', size: 0.8 },
        ],
      },
    },
    {
      id: 'np-pixel-inferno',
      name: 'Inferno 8-Bit',
      collection: 'Pixel',
      rarity: 'Épico',
      description: 'Chamas pixeladas direto de um fliperama dos anos 90.',
      tags: ['fogo', 'retro', 'arcade', 'chamas', 'laranja'],
      asset: {
        type: 'css',
        className: 'np-pixel',
        particles: [{ kind: 'ember', count: 12, speed: 1.5 }],
      },
    },
    {
      id: 'np-thunderstrike',
      name: 'Thunderstrike',
      collection: 'Elemental',
      rarity: 'Lendário',
      description: 'Raios rasgando nuvens de tempestade a cada poucos segundos.',
      tags: ['raio', 'eletrico', 'tempestade', 'azul', 'chuva'],
      asset: {
        type: 'css',
        className: 'np-thunder',
        particles: [{ kind: 'bolt', count: 2 }],
      },
    },
    {
      id: 'np-elven-aurora',
      name: 'Aurora Élfica',
      collection: 'Fantasia',
      rarity: 'Raro',
      description: 'Véus de luz boreal sobre a floresta encantada dos elfos.',
      tags: ['aurora', 'verde', 'magia', 'floresta', 'boreal'],
      asset: {
        type: 'css',
        className: 'np-aurora',
        particles: [{ kind: 'sparkle', count: 7, color: '#B8FFE6', size: 0.7 }],
      },
    },
  ],

  /* ------------------------------------------------------------------ */
  /* MOLDURAS DE AVATAR — sobrepostas ao avatar (≈ 124% do tamanho)      */
  /* ------------------------------------------------------------------ */
  decorations: [
    {
      id: 'deco-neon-halo',
      name: 'Halo Neon',
      collection: 'Cyberpunk',
      rarity: 'Épico',
      description: 'Anel holográfico giratório com mira de HUD tática.',
      tags: ['neon', 'hud', 'holograma', 'anel'],
      asset: {
        type: 'css',
        className: 'deco-neon',
        particles: [
          { kind: 'svgring', radius: 49, width: 0.6, dash: '2 4', color: '#00F0FF', spin: 9, reverse: true },
        ],
      },
    },
    {
      id: 'deco-sakura-crown',
      name: 'Coroa de Sakura',
      collection: 'Anime',
      rarity: 'Raro',
      description: 'Pétalas e flores de cerejeira orbitando com suavidade.',
      tags: ['flor', 'rosa', 'coroa', 'primavera'],
      asset: {
        type: 'css',
        className: 'deco-sakura',
        particles: [
          { kind: 'ring', shape: 'petal', count: 10, radius: 44, spin: 26 },
          { kind: 'ring', shape: 'blossom', count: 4, radius: 45, spin: 26, offset: 18 },
        ],
      },
    },
    {
      id: 'deco-star-orbit',
      name: 'Órbita Estelar',
      collection: 'Galaxy',
      rarity: 'Lendário',
      description: 'Planetas em órbita e poeira estelar ao redor do seu avatar.',
      tags: ['planeta', 'estrelas', 'espaço', 'orbita'],
      asset: {
        type: 'css',
        className: 'deco-orbit',
        particles: [
          { kind: 'svgring', radius: 45, width: 0.7, dash: '2 3', color: 'rgba(180,165,255,.7)', spin: 40 },
          { kind: 'svgring', radius: 49.5, width: 0.5, dash: '1 4', color: 'rgba(127,208,255,.7)', spin: 60, reverse: true },
          { kind: 'ring', shape: 'planet', count: 1, radius: 45, spin: 7, color: '#FFB46B' },
          { kind: 'ring', shape: 'planet', count: 2, radius: 49.5, spin: 12, reverse: true, size: 0.65, color: '#7FD0FF' },
          { kind: 'ring', shape: 'star', count: 8, radius: 47, spin: 50, size: 0.8 },
        ],
      },
    },
    {
      id: 'deco-pixel-blaze',
      name: 'Aura Ígnea 8-Bit',
      collection: 'Pixel',
      rarity: 'Épico',
      description: 'Labaredas pixeladas e faíscas saltando em todas as direções.',
      tags: ['fogo', 'retro', 'chamas', 'arcade'],
      asset: {
        type: 'css',
        className: 'deco-flame',
        particles: [
          { kind: 'ring', shape: 'flame', count: 14, radius: 45 },
          { kind: 'ring', shape: 'pixel', count: 12, radius: 46, offset: 13 },
        ],
      },
    },
    {
      id: 'deco-storm-crown',
      name: 'Coroa da Tempestade',
      collection: 'Elemental',
      rarity: 'Lendário',
      description: 'Arcos voltaicos que estalam sem parar em volta do avatar.',
      tags: ['raio', 'eletrico', 'azul', 'energia'],
      asset: {
        type: 'css',
        className: 'deco-storm',
        particles: [
          { kind: 'svgring', radius: 42.5, width: 1.6, dash: '10 3 2 3', color: '#9FD4FF', spin: 4, glow: true, flicker: true },
          { kind: 'svgring', radius: 47, width: 0.8, dash: '3 6', color: '#4AA3FF', spin: 7, reverse: true, glow: true },
          { kind: 'ring', shape: 'bolt', count: 6, radius: 47, spin: 14 },
        ],
      },
    },
    {
      id: 'deco-arcane-crystals',
      name: 'Cristais Arcanos',
      collection: 'Fantasia',
      rarity: 'Raro',
      description: 'Fragmentos de mana cristalizada flutuando em círculo.',
      tags: ['cristal', 'magia', 'mana', 'arcano'],
      asset: {
        type: 'css',
        className: 'deco-crystal',
        particles: [
          { kind: 'ring', shape: 'crystal', count: 6, radius: 45, spin: 18 },
          { kind: 'ring', shape: 'star', count: 6, radius: 49, spin: 18, reverse: true, size: 0.7, color: '#B5F5FF', offset: 30 },
        ],
      },
    },
  ],

  /* ------------------------------------------------------------------ */
  /* EFEITOS DE PERFIL — animação em tela cheia sobre o popout de perfil */
  /* ------------------------------------------------------------------ */
  effects: [
    {
      id: 'fx-sakura-rain',
      name: 'Chuva de Sakura',
      collection: 'Anime',
      rarity: 'Raro',
      description: 'Uma tempestade suave de pétalas caindo sobre o seu perfil.',
      tags: ['flor', 'rosa', 'petalas', 'primavera'],
      asset: {
        type: 'css',
        className: 'fx-sakura',
        particles: [
          { kind: 'petal', count: 24, wind: 0.6 },
          { kind: 'sparkle', count: 6, color: '#FFD6E8' },
        ],
      },
    },
    {
      id: 'fx-hyperspace',
      name: 'Salto Hiperespacial',
      collection: 'Galaxy',
      rarity: 'Lendário',
      description: 'Estrelas esticando em linhas de luz rumo à velocidade da luz.',
      tags: ['estrelas', 'espaço', 'velocidade', 'warp'],
      asset: {
        type: 'css',
        className: 'fx-hyperspace',
        particles: [
          { kind: 'warp', count: 42 },
          { kind: 'star', count: 16 },
        ],
      },
    },
    {
      id: 'fx-pixel-embers',
      name: 'Brasas Pixeladas',
      collection: 'Pixel',
      rarity: 'Épico',
      description: 'Uma fogueira de 8 bits soltando brasas quadradinhas.',
      tags: ['fogo', 'retro', 'brasa', 'chamas'],
      asset: {
        type: 'css',
        className: 'fx-embers',
        particles: [{ kind: 'ember', count: 30 }],
      },
    },
    {
      id: 'fx-thunderstorm',
      name: 'Tempestade Elétrica',
      collection: 'Elemental',
      rarity: 'Lendário',
      description: 'Chuva pesada, relâmpagos e o céu se acendendo de repente.',
      tags: ['raio', 'chuva', 'tempestade', 'azul'],
      asset: {
        type: 'css',
        className: 'fx-lightning',
        particles: [
          { kind: 'drop', count: 36 },
          { kind: 'bolt', count: 3, size: 1.8 },
        ],
      },
    },
    {
      id: 'fx-glitch-code',
      name: 'Código Glitch',
      collection: 'Cyberpunk',
      rarity: 'Épico',
      description: 'Chuva de dados, scanlines e falhas de sinal no seu card.',
      tags: ['hacker', 'matrix', 'glitch', 'dados', 'neon'],
      asset: {
        type: 'css',
        className: 'fx-glitch',
        particles: [
          { kind: 'rain', count: 14, color: '#00F0FF' },
          { kind: 'rain', count: 6, color: '#FF2BD6' },
        ],
      },
    },
    {
      id: 'fx-fairy-dust',
      name: 'Pó de Fada',
      collection: 'Fantasia',
      rarity: 'Raro',
      description: 'Vaga-lumes mágicos e faíscas douradas subindo devagar.',
      tags: ['magia', 'brilho', 'fada', 'dourado', 'vaga-lume'],
      asset: {
        type: 'css',
        className: 'fx-fairy',
        particles: [
          { kind: 'orb', count: 10, color: 'rgba(160,255,220,.85)' },
          { kind: 'sparkle', count: 22, rise: true, color: '#FFF3B0' },
        ],
      },
    },
  ],

  /* ------------------------------------------------------------------ */
  /* PROFILE FRAMES — arte sobre o card de perfil (vêm da loja do Discord) */
  /* Formato: { type: 'image', src: '<png>' } — imagem presa ao topo do  */
  /* card, na largura dele (os oficiais têm 1312 px de largura).          */
  /* ------------------------------------------------------------------ */
  frames: [],
};
