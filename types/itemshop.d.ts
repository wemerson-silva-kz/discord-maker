/**
 * Tipos da Item Shop API do itemshop.gg (https://itemshop.gg/developers).
 * Todas as respostas têm o formato { data, meta }; erros, { error: { code, message } }.
 * Muitos campos podem ser null — trate isso.
 */

export type GameSlug =
  | 'fortnite' | 'valorant' | 'marvel-rivals' | 'overwatch' | 'diablo-4' | 'rocket-league'
  | 'call-of-duty' | 'rainbow-six-siege' | 'aniimo' | 'apex-legends' | 'arc-raiders'
  | 'battlefield-6' | 'dead-by-daylight' | 'war-thunder' | 'pubg' | 'once-human'
  | 'league-of-legends' | 'teamfight-tactics' | 'path-of-exile-2' | 'sea-of-thieves'
  | 'wardogs' | 'discord' | 'rust';

export interface Meta {
  generatedAt?: string;
  /** Obrigatório pelos termos: mostrar "Data from itemshop.gg" com link para attribution.url. */
  attribution: { text: string; url: string };
  docs?: string;
  /** Termos completos. */
  terms: string;
  [extra: string]: unknown;
}

export interface Answer<T> {
  data: T;
  meta: Meta;
}

export type ErrorCode =
  | 'key_required' | 'invalid_key'            // 401
  | 'unknown_game' | 'not_recorded' | 'unknown_item' | 'no_items' // 404
  | string;

export interface ErrorAnswer {
  error: { code: ErrorCode; message: string };
}

/* ---------- /games ---------- */
export interface Game {
  slug: GameSlug | string;
  name: string;
  /** Página do jogo no itemshop.gg. */
  url: string;
  shopUrl: string;
  historyUrl: string | null;
  historyFrom: string | null;
  currency: { name: string; icon: string | null } | null;
  /** Horário de reset (UTC); null quando a loja não tem reset fixo (ex.: Discord). */
  reset: string | null;
  /** Se há histórico por item (/items). No Discord é false e os itemKey vêm null. */
  itemHistory: boolean;
  [extra: string]: unknown;
}
export type GamesAnswer = Answer<Game[]>;

/* ---------- /rotations ---------- */
export interface Rotation {
  /** Muda quando a loja do jogo muda: busque /shop só quando mudar. */
  fingerprint: string;
  changedAt: string | null;
}
export type RotationsAnswer = Answer<Record<string, Rotation>>;

/* ---------- /shop/{game} e /history/{game}/{date} ---------- */
export interface Rarity {
  name: string;
  color: string | null;
}

export interface Price {
  /** null quando a loja não mostra número; aí `label` traz uma palavra como "Included". */
  amount: number | null;
  label: string | null;
  /** Nome da moeda do jogo ("Orbs") ou código ISO ("USD") para dinheiro real. */
  currency: string | null;
  currencyIcon: string | null;
  regular: number | null;
}

export interface Item {
  id: string;
  /** Chave para /items/{game}/{itemKey}; pode ser null. */
  itemKey: string | null;
  name: string;
  /** No Discord: "Avatar Decoration", "Nameplate", "Profile Effect", "Profile Frame", "Bundle"… */
  type: string | null;
  rarity: Rarity | null;
  price: Price | null;
  images: { card: string | null; render: string | null };
  badge: string | null;
  availability: { from: string | null; until: string | null; untilLabel: string | null } | null;
  bundle: unknown | null;
  contents: Item[] | unknown[];
  soldOut: boolean;
  sourceUrl: string | null;
  /** Variante pintada (Rocket League) é um item próprio, com itemKey próprio. */
  paint: { name: string; color: string | null } | null;
}

export interface Section {
  title: string;
  /** true = ainda não pode ser comprada. */
  upcoming: boolean;
  endsAt: string | null;
  items: Item[];
}

export interface NextRotation {
  startsAt: string;
  sections: Array<{
    title: string;
    subtitle: string | null;
    category: string | null;
    new: boolean;
    background: string | null;
    logo: string | null;
  }>;
  leaving: string[];
}

export interface Shop {
  game: GameSlug | string;
  shopDate: string;
  updatedAt: string | null;
  expiresAt: string | null;
  /** sections vazio com stale:false = loja realmente vazia. */
  stale: boolean;
  itemCount: number;
  /** Imagens PNG da loja inteira (não contam no limite). Histórico: lista vazia. */
  images: string[];
  sections: Section[];
  /** Só Fortnite; vazio nos demais. */
  nextRotations: NextRotation[];
}
export type ShopAnswer = Answer<Shop>;

export interface HistoryShop extends Shop {
  exact: boolean;
}
export type HistoryDayAnswer = Answer<HistoryShop>;

/* ---------- /history/{game} ---------- */
/** Dias em que a loja mudou, do mais recente para o mais antigo. */
export type HistoryAnswer = Answer<Array<{ date: string; [extra: string]: unknown } | string>>;

/* ---------- /items/{game}/{itemKey} ---------- */
export interface ItemDetail extends Item {
  /** Passagens do item pela loja. */
  stays?: Array<{ from: string | null; until: string | null; [extra: string]: unknown }>;
  [extra: string]: unknown;
}
export type ItemAnswer = Answer<ItemDetail>;
