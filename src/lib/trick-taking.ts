import { cardLabel, type Card } from './setup';

export interface TrickPlay { uid: string; card: Card }
export interface TrickState { leaderUid: string; plays: TrickPlay[] }

export function legalCards(hand: Card[], trick: TrickState, princesBroken: boolean): Card[] {
  if (trick.plays.length === 0) {
    const nonPrinces = hand.filter((card) => card.suit !== 'princes');
    return princesBroken || nonPrinces.length === 0 ? hand : nonPrinces;
  }
  const ledSuit = trick.plays[0].card.suit;
  const following = hand.filter((card) => card.suit === ledSuit);
  return following.length ? following : hand;
}

export function canPlay(hand: Card[], trick: TrickState, princesBroken: boolean, card: Card): boolean {
  return legalCards(hand, trick, princesBroken).some((candidate) => cardLabel(candidate) === cardLabel(card));
}

export function trickWinner(trick: TrickState): string {
  const ledSuit = trick.plays[0].card.suit;
  return trick.plays.filter((play) => play.card.suit === ledSuit)
    .reduce((winner, play) => play.card.rank > winner.card.rank ? play : winner).uid;
}

export function breaksPrinces(trick: TrickState, card: Card): boolean {
  return trick.plays.length > 0 && card.suit === 'princes' && trick.plays[0].card.suit !== 'princes';
}
