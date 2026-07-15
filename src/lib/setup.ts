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

export const ROUND_RULE_TEXT: Record<string, string> = {
  'once-upon-a-time': 'No additional rule.',
  invitation: 'No additional rule.',
  'masquerade-ball': 'Except for the lead, play cards face down. Reveal them together to determine the trick winner.',
  'royal-decree': 'Queens always win the trick; the highest Queen wins if several are played.',
  'musical-chairs': 'After every trick, everyone simultaneously passes one card face down to the player on their right.',
  'pets-revenge': 'At the end of the round, every Pet scores one proposal, including the Frog 6.',
  'late-to-the-ball': 'After passing, set aside one card face down. It must be played normally in the final trick.',
  'poisoned-apple': 'A player who is void wins with the card they play. Highest value wins among multiple void players; latest play breaks ties.',
  'crystal-clear': 'Reveal every card of one suit from your hand. They remain in your hand and may be played normally.',
  'upside-down': 'Each 6 played reverses the card ranking for that trick; a second 6 reverses it again.',
  'dancing-queens': 'Matching Prince and Queen values score three proposals each. Unmatched couples score two; an unpaired Prince scores one.',
  'prince-rings-twice': 'Everyone plays two cards per trick. Add leading-suit values to find the winner; highest leading-suit card breaks ties.',
  'wedding-gift': 'Before each trick, everyone adds one face-down card to a gift pile won with that trick.',
  'after-party': 'Split your hand into equal halves. Play the first half before picking up and playing the second.',
  'bathroom-break': 'Princes score double, except for the player or players currently carrying the most proposals.',
  'single-fairy': 'Each captured Fairy removes one proposal; round scores may be negative.',
  'midnight-makeover': 'Fairies are wild for following suit. Highest leading-suit card or Fairy wins, with latest play breaking ties.',
  'blind-mans-bluff': 'Play half your hand, then give the other half to the player on your right for them to play.',
  'odds-and-evens': 'Follow both suit and the lead card’s parity when possible, with suit taking priority and parity applying again when void.',
  'pass-the-bouquet': 'Every newly played suit becomes the leading suit. The highest card of the last new suit wins.',
  'haggle-with-the-hag': 'A trick winner may show and swap a card from their hand for any card in the trick except the card they played.'
};

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
