import { cardLabel, type Card } from './setup';
import { legalCards, type TrickPlay, type TrickState } from './trick-taking';

export const PRINCESS_POWER_TEXT: Record<string, string> = {
  'little-mermaid': 'Before a trick, choose a suit the leader must play if able.',
  'sleeping-beauty': 'Before a trick, collect one card from everyone and redistribute them.',
  alice: 'After winning a Frog-free trick, shuffle it back into everyone’s hands.',
  scheherazade: 'Before a trick, take a random card and swap it for one of yours or return it.',
  'ice-princess': 'Before a trick, inspect two random cards and freeze one for its owner to play.',
  'snow-white': 'Play a 7 or lower as a zero.',
  cinderella: 'Before a trick, lower cards win the led suit.',
  pocahontas: 'Before a trick, choose any player to lead.',
  mulan: 'After a trick fills, swap your card for another of the same suit.',
  'pea-princess': 'Before a trick, everyone must play above 5 when legally able.'
};

export function legalCardsWithPeaPower(hand: Card[], trick: TrickState, princesBroken: boolean, active: boolean): Card[] {
  const legal = legalCards(hand, trick, princesBroken);
  if (!active) return legal;
  const high = legal.filter((card) => card.rank > 5);
  return high.length ? high : legal;
}

export function snowWhiteCanZero(card: Card): boolean {
  return card.rank <= 7;
}

export function mulanReplacements(hand: Card[], play: TrickPlay): Card[] {
  if (play.card.suit === 'pets' && play.card.rank === 8) return [];
  return hand.filter((card) => card.suit === play.card.suit && cardLabel(card) !== cardLabel(play.card));
}
