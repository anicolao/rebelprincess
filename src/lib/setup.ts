export const SUITS = ['fairies', 'queens', 'princes', 'pets'] as const;
export type Suit = (typeof SUITS)[number];
export interface Card { suit: Suit; rank: number }

export const PRINCESSES = [
  ['snow-white', 'Snow White'], ['little-mermaid', 'The Little Mermaid'],
  ['cinderella', 'Cinderella'], ['pocahontas', 'Pocahontas'],
  ['sleeping-beauty', 'Sleeping Beauty'], ['alice', 'Alice'], ['mulan', 'Mulan'],
  ['scheherazade', 'Scheherazade'], ['pea-princess', 'The Pea Princess'],
  ['ice-princess', 'The Ice Princess']
] as const;

export const ROUND_RULES = [
  ['once-upon-a-time', 'Once Upon a Time…'], ['invitation', 'Invitation'],
  ['masquerade-ball', 'Masquerade Ball'], ['royal-decree', 'Royal Decree'],
  ['musical-chairs', 'Musical Chairs'], ['pets-revenge', 'Pets’ Revenge'],
  ['late-to-the-ball', 'Late to the Ball'], ['poisoned-apple', 'Poisoned Apple'],
  ['crystal-clear', 'Crystal Clear'], ['upside-down', 'Upside Down'],
  ['dancing-queens', 'Dancing Queens'], ['prince-rings-twice', 'The Prince Always Rings Twice'],
  ['wedding-gift', 'Wedding Gift'], ['after-party', 'After-party'],
  ['bathroom-break', 'Bathroom Break'], ['single-fairy', 'Single Fairy'],
  ['midnight-makeover', 'Midnight Makeover'], ['blind-mans-bluff', 'Blind Man’s Bluff'],
  ['odds-and-evens', 'Odds and Evens'], ['pass-the-bouquet', 'Pass the Bouquet!'],
  ['haggle-with-the-hag', 'Haggle with the Hag']
] as const;

export function deckForPlayers(playerCount: number): Card[] {
  if (playerCount < 3 || playerCount > 6) throw new Error('Rebel Princess requires 3–6 players');
  const removed = playerCount === 3 ? new Set([1, 11, 12]) : playerCount < 6 ? new Set([11, 12]) : new Set<number>();
  return SUITS.flatMap((suit) => Array.from({ length: 12 }, (_, index) => index + 1)
    .filter((rank) => !removed.has(rank)).map((rank) => ({ suit, rank })));
}

function seededRandom(seed: string): () => number {
  let hash = 2166136261;
  for (const char of seed) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return () => {
    hash += 0x6d2b79f5;
    let value = hash;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function dealForPlayers(playerUids: string[], seed: string): Record<string, Card[]> {
  const deck = deckForPlayers(playerUids.length);
  const random = seededRandom(seed);
  for (let index = deck.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [deck[index], deck[other]] = [deck[other], deck[index]];
  }
  const hands = Object.fromEntries(playerUids.map((uid) => [uid, [] as Card[]]));
  deck.forEach((card, index) => hands[playerUids[index % playerUids.length]].push(card));
  for (const hand of Object.values(hands)) hand.sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || a.rank - b.rank);
  return hands;
}

export function cardLabel(card: Card): string {
  return `${card.suit[0].toUpperCase()}${card.suit.slice(1)} ${card.rank}`;
}
