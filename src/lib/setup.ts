export const SUITS = ['fairies', 'queens', 'princes', 'pets'] as const;
export type Suit = (typeof SUITS)[number];
export interface Card { suit: Suit; rank: number }

export const PRINCESSES = [
  ['snow-white', 'Snow White'], ['little-mermaid', 'The Little Mermaid'],
  ['cinderella', 'Cinderella'], ['pocahontas', 'Pocahontas'],
  ['sleeping-beauty', 'Sleeping Beauty'], ['alice', 'Alice'], ['mulan', 'Mulan'],
  ['scheherazade', 'Scheherazade'], ['pea-princess', 'The Pea Princess'],
  ['ice-princess', 'The Ice Princess'], ['rapunzel', 'Rapunzel'],
  ['thumbelina', 'Thumbelina']
] as const;

export const ROUND_RULES = [
  ['once-upon-a-time', 'Once Upon a Time…'], ['late-to-the-ball', 'Late to the Ball'],
  ['magic-beans', 'Magic Beans'], ['three-times-a-lady', 'Three Times a Lady'],
  ['arranged-marriage', 'Arranged Marriage'], ['royal-decree', 'Royal Decree'],
  ['always-the-bridesmaid', 'Always the Bridesmaid'], ['crystal-clear', 'Crystal Clear'],
  ['masquerade-ball', 'Masquerade Ball'], ['pets-revenge', 'Pets’ Revenge'],
  ['musical-chairs', 'Musical Chairs'], ['sisterhood', 'Sisterhood'],
  ['after-party', 'After Party'], ['late-for-a-very-important-date', 'Late for a Very Important Date'],
  ['wedding-gift', 'Wedding Gift'], ['haggle-with-the-hag', 'Haggle with the Hag'],
  ['blind-mans-bluff', 'Blind Man’s Bluff'], ['poisoned-apple', 'Poisoned Apple'],
  ['odds-and-evens', 'Odds and Evens'], ['single-fairy', 'Single Fairy'],
  ['prince-rings-twice', 'The Prince Always Rings Twice'], ['midnight-makeover', 'Midnight Makeover'],
  ['pass-the-bouquet', 'Pass the Bouquet'], ['upside-down', 'Upside Down'],
  ['bathroom-break', 'Bathroom Break'], ['dancing-queens', 'Dancing Queens'],
  ['invitation', 'Invitation']
] as const;

export const ROUND_RULE_TEXT: Record<string, string> = {
  'once-upon-a-time': 'No additional rule.',
  invitation: 'No additional rule.',
  'magic-beans': 'Play only the highest or lowest card of the suit you must play.',
  'three-times-a-lady': 'Each 3 scores −3 proposals; the Prince 3 scores −2 proposals.',
  'arranged-marriage': 'A player with no tricks at round end receives 5 proposals.',
  'always-the-bridesmaid': 'The second-highest card of the led suit wins; if every follower is void, the leader wins.',
  sisterhood: 'The card farthest from the led number wins; if every follower is void, use the farthest value in any suit.',
  'late-for-a-very-important-date': 'Each player’s last three hand cards are kept and scored as captured cards.',
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

export function princessOptionsForPlayers(playerUids: string[], seed: string): Record<string, string[]> {
  const pool = PRINCESSES.map(([id]) => id);
  const random = seededRandom(`${seed}:princesses`);
  for (let index = pool.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [pool[index], pool[other]] = [pool[other], pool[index]];
  }
  return Object.fromEntries(playerUids.map((uid, index) => [uid, pool.slice(index * 2, index * 2 + 2)]));
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
