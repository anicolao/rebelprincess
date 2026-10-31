import { cardLabel, type Card } from './setup';
import type { BotAction, BotDecision, BotObservation, BotPolicy, SeededRandom } from './bot-types';

export const HEURISTIC_POLICY_VERSION = 1;

function actionCards(action: BotAction): Card[] {
  switch (action.type) {
    case 'submit-pass':
    case 'select-after-party-half': return action.cards;
    case 'play-card':
    case 'set-aside-round-card':
    case 'submit-musical-chair-card':
    case 'submit-wedding-gift':
    case 'contribute-power-card': return [action.card];
    case 'swap-haggle-card': return [action.offered];
    case 'activate-power': return action.cards ?? (action.card ? [action.card] : []);
    default: return [];
  }
}

function danger(card: Card): number {
  if (card.suit === 'pets' && card.rank === 8) return 50;
  if (card.suit === 'princes') return 16 + card.rank / 12;
  return card.rank / 12;
}

function visibleTrickPenalty(observation: BotObservation): number {
  return observation.trick?.plays.reduce((total, play) => {
    if (!play.card) return total;
    return total + (play.card.suit === 'princes' ? 1 : 0) + (play.card.suit === 'pets' && play.card.rank === 8 ? 5 : 0);
  }, 0) ?? 0;
}

function wouldWin(observation: BotObservation, card: Card): boolean {
  const visible = observation.trick?.plays.filter((play) => play.card !== null) ?? [];
  const ledSuit = visible[0]?.card?.suit;
  if (!ledSuit) return true;
  if (card.suit !== ledSuit) return false;
  const ranks = visible.filter((play) => play.card?.suit === ledSuit).map((play) => play.effectiveRank ?? play.card!.rank);
  return observation.trick?.reversed ? card.rank < Math.min(...ranks) : card.rank > Math.max(...ranks);
}

function princessScore(princessId: string, roundIds: readonly string[]): number {
  const flexible: Record<string, number> = {
    thumbelina: 8,
    'snow-white': 7,
    alice: 6,
    mulan: 6,
    'ice-princess': 5,
    'little-mermaid': 5,
    cinderella: 4,
    pocahontas: 4,
    'pea-princess': 4,
    rapunzel: 4,
    scheherazade: 3,
    'sleeping-beauty': 3
  };
  let score = flexible[princessId] ?? 0;
  if (roundIds.includes('upside-down') && princessId === 'cinderella') score += 4;
  if (roundIds.includes('royal-decree') && ['snow-white', 'mulan'].includes(princessId)) score += 2;
  return score;
}

export function scoreHeuristicAction(observation: BotObservation, action: BotAction): number {
  const cards = actionCards(action);
  const cardDanger = cards.reduce((sum, card) => sum + danger(card), 0);
  switch (action.type) {
    case 'choose-princess': return princessScore(action.princessId, observation.roundIds);
    case 'submit-pass': {
      const outgoing = new Map<Card['suit'], number>();
      for (const card of action.cards) outgoing.set(card.suit, (outgoing.get(card.suit) ?? 0) + 1);
      const createsVoid = [...outgoing].some(([suit, count]) => observation.ownHand.filter((card) => card.suit === suit).length === count);
      return cardDanger + (createsVoid ? 7 : 0);
    }
    case 'play-card': {
      const ledSuit = observation.trick?.plays.find((play) => play.card)?.card?.suit;
      const offSuitDump = Boolean(ledSuit && action.card.suit !== ledSuit);
      const winning = wouldWin(observation, action.card);
      const trickPenalty = visibleTrickPenalty(observation);
      if (offSuitDump) return cardDanger * 3 + action.card.rank / 12;
      if (winning) return -trickPenalty * 40 - danger(action.card) - action.card.rank / 24;
      return cardDanger + action.card.rank / 12;
    }
    case 'set-aside-round-card':
    case 'submit-musical-chair-card':
    case 'submit-wedding-gift': return cardDanger;
    case 'select-after-party-half': return -cardDanger;
    case 'choose-crystal-clear-suit': return observation.ownHand.filter((card) => card.suit === action.suit).length;
    case 'swap-haggle-card': return danger(action.offered) - danger(action.taken);
    case 'decline-haggle': return 0;
    case 'raise-before-trick-hand': return 3;
    case 'lower-before-trick-hand': return -3;
    case 'begin-before-trick-power': return 5;
    case 'decline-before-trick-priority': return 0;
    case 'activate-power': return 5 + cardDanger;
    case 'contribute-power-card': return -cardDanger;
    case 'decline-power': return 0;
    default: return 0;
  }
}

export class HeuristicBotPolicy implements BotPolicy {
  readonly id: string;
  readonly usesOptionalBeforeTrickPowers = true;

  constructor(private readonly exploration = 0) {
    this.id = exploration > 0 ? 'heuristic-easy-v1' : 'heuristic-standard-v1';
  }

  choose(observation: BotObservation, legalActions: readonly BotAction[], random: SeededRandom): BotDecision {
    if (!legalActions.length) throw new Error('Heuristic policy requires at least one legal action');
    const scores = legalActions.map((action) => scoreHeuristicAction(observation, action));
    const exploring = this.exploration > 0 && random.next() < this.exploration;
    const best = Math.max(...scores);
    const candidates = scores.flatMap((score, index) => score === best ? [index] : []);
    const actionIndex = exploring ? random.integer(legalActions.length) : candidates[random.integer(candidates.length)];
    return {
      actionIndex,
      policyId: this.id,
      seed: random.seed,
      diagnostics: {
        score: scores[actionIndex],
        candidates: legalActions.length,
        tiedBest: candidates.length,
        explored: exploring,
        action: actionCards(legalActions[actionIndex]).map(cardLabel).join(',')
      }
    };
  }
}
