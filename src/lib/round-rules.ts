import type { Card } from './setup';
import { trickWinner, type TrickState } from './trick-taking';
import { legalCardsWithPeaPower } from './princess-powers';

export function roundLegalCards(hand: Card[], trick: TrickState, princesBroken: boolean, roundId: string, peaActive = false): Card[] {
  const legal = legalCardsWithPeaPower(hand, trick, princesBroken, peaActive);
  if (roundId === 'midnight-makeover' && trick.plays.length) {
    const ledSuit = trick.plays[0].card.suit;
    const follows = hand.filter((card) => card.suit === ledSuit || card.suit === 'fairies');
    return hand.some((card) => card.suit === ledSuit) && follows.length ? follows : legal;
  }
  if (roundId === 'odds-and-evens' && trick.plays.length) {
    const parity = trick.plays[0].card.rank % 2;
    const matching = legal.filter((card) => card.rank % 2 === parity);
    return matching.length ? matching : legal;
  }
  if (roundId !== 'magic-beans') return legal;
  return legal.filter((card) => {
    const ranks = legal.filter((candidate) => candidate.suit === card.suit).map((candidate) => candidate.rank);
    return card.rank === Math.min(...ranks) || card.rank === Math.max(...ranks);
  });
}

export function roundTrickWinner(trick: TrickState, roundId: string): string {
  if (roundId === 'midnight-makeover') {
    const ledSuit = trick.plays[0]?.card.suit;
    const eligible = trick.plays.filter((play) => play.card.suit === ledSuit || play.card.suit === 'fairies');
    return eligible.reduce((winner, play) => (play.effectiveRank ?? play.card.rank) >= (winner.effectiveRank ?? winner.card.rank) ? play : winner).uid;
  }
  if (roundId === 'prince-rings-twice') {
    const ledSuit = trick.plays[0]?.card.suit;
    const totals = new Map<string, { total: number; high: number }>();
    for (const play of trick.plays) {
      const current = totals.get(play.uid) ?? { total: 0, high: 0 };
      const rank = play.effectiveRank ?? play.card.rank;
      if (play.card.suit === ledSuit) { current.total += rank; current.high = Math.max(current.high, rank); }
      totals.set(play.uid, current);
    }
    return [...totals].reduce((winner, entry) => entry[1].total > winner[1].total || (entry[1].total === winner[1].total && entry[1].high > winner[1].high) ? entry : winner)[0];
  }
  if (roundId === 'poisoned-apple') {
    const ledSuit = trick.plays[0]?.card.suit;
    const voids = trick.plays.filter((play) => play.card.suit !== ledSuit);
    if (!voids.length) return trickWinner(trick);
    return voids.reduce((winner, play) => {
      const rank = play.effectiveRank ?? play.card.rank;
      const winnerRank = winner.effectiveRank ?? winner.card.rank;
      return trick.reversed ? rank < winnerRank ? play : winner : rank > winnerRank ? play : winner;
    }).uid;
  }
  if (roundId === 'sisterhood') {
    const lead = trick.plays[0];
    if (!lead) return trick.leaderUid;
    const suited = trick.plays.filter((play) => play.card.suit === lead.card.suit);
    const candidates = suited.length > 1 ? suited : trick.plays;
    const leadRank = lead.effectiveRank ?? lead.card.rank;
    return candidates.reduce((winner, play) => {
      const rank = play.effectiveRank ?? play.card.rank;
      const winnerRank = winner.effectiveRank ?? winner.card.rank;
      const distance = Math.abs(rank - leadRank);
      const winnerDistance = Math.abs(winnerRank - leadRank);
      return distance > winnerDistance || (distance === winnerDistance && rank > winnerRank) ? play : winner;
    }).uid;
  }
  if (roundId === 'always-the-bridesmaid') {
    const ledSuit = trick.plays[0]?.card.suit;
    const followers = trick.plays.filter((play) => play.card.suit === ledSuit);
    if (followers.length === 1) return followers[0].uid;
    const ordered = [...followers].sort((left, right) => {
      const leftRank = left.effectiveRank ?? left.card.rank;
      const rightRank = right.effectiveRank ?? right.card.rank;
      return trick.reversed ? leftRank - rightRank : rightRank - leftRank;
    });
    return ordered[1].uid;
  }
  if (roundId !== 'royal-decree') return trickWinner(trick);
  const queens = trick.plays.filter((play) => play.card.suit === 'queens');
  if (!queens.length) return trickWinner(trick);
  return queens.reduce((winner, play) => {
    const rank = play.effectiveRank ?? play.card.rank;
    const winnerRank = winner.effectiveRank ?? winner.card.rank;
    return trick.reversed ? rank < winnerRank ? play : winner : rank > winnerRank ? play : winner;
  }).uid;
}

export function cardsPerTrick(roundId: string): number { return roundId === 'prince-rings-twice' ? 2 : 1; }

export function roundCardScore(cards: Card[], roundId: string): { princes: number; frog: number; roundRule: number; total: number } {
  const princes = cards.filter((card) => card.suit === 'princes').length;
  const frog = cards.some((card) => card.suit === 'pets' && card.rank === 8) ? 5 : 0;
  const roundRule = roundId === 'pets-revenge' ? cards.filter((card) => card.suit === 'pets').length
    : roundId === 'three-times-a-lady' ? -3 * cards.filter((card) => card.rank === 3).length
    : roundId === 'single-fairy' ? -cards.filter((card) => card.suit === 'fairies').length
    : roundId === 'arranged-marriage' && cards.length === 0 ? 5 : 0;
  return { princes, frog, roundRule, total: princes + frog + roundRule };
}

export function isMasqueradeHidden(roundId: string, trick: TrickState, uid: string, playerCount: number): boolean {
  return roundId === 'masquerade-ball' && trick.plays.length > 0 && trick.plays.length < playerCount && uid !== trick.leaderUid;
}
