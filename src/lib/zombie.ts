import { SUITS, type Card } from './setup';
import type { PassInstruction } from './passing';

export const ZOMBIE_PRINCESSES = [
  { id: 'cinderella', name: 'Cinderella', power: 'Smashing Pumpkins', text: 'When Princes are led, you do not have to follow with a Prince.', always: true },
  { id: 'dorothy', name: 'Dorothy', power: 'Drop a House On It', text: 'Hide a trick you just won so it does not count, then gain 3 skulls.', always: false },
  { id: 'goldilocks', name: 'Goldilocks', power: 'This Bid Is Just Right', text: 'Gain 3 skulls when your tricks match your bid exactly.', always: true },
  { id: 'ice-princess', name: 'Ice Princess', power: 'Flurry Fury', text: 'Before a trick, reduce your bid by one, including to zero.', always: false },
  { id: 'pea-princess', name: 'Pea Princess', power: 'Pea Shooter', text: 'Add 5 to one played card for this trick.', always: false },
  { id: 'rapunzel', name: 'Rapunzel', power: 'A Brush with Death', text: 'When you win a trick with Villagers, gain one skull per Villager.', always: false },
  { id: 'red-riding-hood', name: 'Red Riding Hood', power: 'Axe-cessorize', text: 'Swap a hand card for a non-Prince in a trick you won.', always: false },
  { id: 'scheherazade', name: 'Scheherazade', power: 'The Pen Is Mightier', text: 'Before the fourth trick, change your bid.', always: false },
  { id: 'swan-maiden', name: 'Swan Maiden', power: '2 Birds 1 Skull', text: 'Gain one skull for every two tricks you win.', always: true },
  { id: 'thumbelina', name: 'Thumbelina', power: 'Choose Your Weapon', text: 'Play any non-Prince card, ignoring follow-suit.', always: false }
] as const;

export const ZOMBIE_ROUNDS = [
  { id: 'a', name: 'Opening Night (of Living Dead)', text: 'No additional rule.', direction: 'left', count: 4, art: 'a-opening-night.jpg' },
  { id: 'b', name: 'Ah One and Ah Two', text: 'A captured 1 grants 1 skull; a captured 2 grants 2 skulls.', direction: 'right', count: 1, art: 'b-ah-one-and-ah-two.jpg' },
  { id: 'c', name: 'Dead Last', text: 'Set one card aside before bidding and use it in the final trick.', direction: 'right', count: 2, art: 'c-dead-last.jpg' },
  { id: 'd', name: 'Dead Set on Winning', text: 'A trick won by someone not currently leading grants 1 skull.', direction: 'left', count: 5, art: 'd-dead-set-on-winning.jpg', hourglass: true }
] as const;

export const ZOMBIE_ROUND_IDS = ZOMBIE_ROUNDS.map((round) => round.id);

export function zombieRound(id: string) {
  return ZOMBIE_ROUNDS.find((round) => round.id === id) ?? ZOMBIE_ROUNDS[0];
}

export function zombiePrincess(id?: string) {
  return ZOMBIE_PRINCESSES.find((princess) => princess.id === id);
}

export function zombieSuitName(suit: Card['suit']): string {
  return suit === 'fairies' ? 'Villagers' : suit === 'queens' ? 'Knights' : suit === 'pets' ? 'Pets' : 'Princes';
}

export function zombieSuitFolder(suit: Card['suit']): string {
  return suit === 'fairies' ? 'villagers' : suit === 'queens' ? 'knights' : suit;
}

export function zombieCardLabel(card: Card): string {
  return `${zombieSuitName(card.suit)} ${card.rank}`;
}

export function zombiePassInstruction(roundId: string): PassInstruction {
  const round = zombieRound(roundId);
  return { direction: round.direction, count: round.count };
}

export function zombieDeckForPlayers(playerCount: number): Card[] {
  if (playerCount < 3 || playerCount > 6) throw new Error('Zombie Princess requires 3–6 players');
  const maximumRank = playerCount === 3 ? 9 : playerCount === 4 ? 10 : 15;
  return SUITS.flatMap((suit) => Array.from({ length: maximumRank }, (_, index) => ({ suit, rank: index + 1 })));
}

function seededRandom(seed: string): () => number {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash += 0x6d2b79f5;
    let value = hash;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function shuffle<T>(values: T[], seed: string): T[] {
  const result = [...values];
  const random = seededRandom(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function zombiePrincessOptions(playerUids: string[], seed: string): Record<string, string[]> {
  const pool = shuffle(ZOMBIE_PRINCESSES.map((princess) => princess.id), `${seed}:zombie-princesses`);
  const optionCount = playerUids.length === 6 ? 1 : 2;
  return Object.fromEntries(playerUids.map((uid, index) => [uid, pool.slice(index * optionCount, index * optionCount + optionCount)]));
}

export function zombieDeal(playerUids: string[], seed: string): Record<string, Card[]> {
  const deck = shuffle(zombieDeckForPlayers(playerUids.length), seed);
  const hands = Object.fromEntries(playerUids.map((uid) => [uid, [] as Card[]]));
  deck.forEach((card, index) => hands[playerUids[index % playerUids.length]].push(card));
  for (const hand of Object.values(hands)) {
    hand.sort((left, right) => SUITS.indexOf(left.suit) - SUITS.indexOf(right.suit) || left.rank - right.rank);
  }
  return hands;
}

export function zombieLegalCards(hand: Card[], plays: Array<{ card: Card }>, princesBroken: boolean, cinderella = false, thumbelina = false): Card[] {
  if (!plays.length) {
    const nonPrinces = hand.filter((card) => card.suit !== 'princes');
    return princesBroken || nonPrinces.length === 0 ? hand : nonPrinces;
  }
  if (thumbelina) return hand.filter((card) => card.suit !== 'princes');
  const ledSuit = plays[0].card.suit;
  if (cinderella && ledSuit === 'princes') return hand;
  const following = hand.filter((card) => card.suit === ledSuit);
  return following.length ? following : hand;
}

export function zombieTrickWinner(plays: Array<{ uid: string; card: Card; effectiveRank?: number; pea?: boolean }>): string {
  const ledSuit = plays[0].card.suit;
  const princes = plays.filter((play) => play.card.suit === 'princes');
  const eligible = princes.length ? princes : plays.filter((play) => play.card.suit === ledSuit);
  return eligible.reduce((winner, play) => {
    const rank = play.effectiveRank ?? play.card.rank;
    const winnerRank = winner.effectiveRank ?? winner.card.rank;
    return rank > winnerRank || (rank === winnerRank && play.pea && !winner.pea) ? play : winner;
  }).uid;
}
