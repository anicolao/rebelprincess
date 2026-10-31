import type { BeforeTrickWindow } from './bat-priority';
import type { RoundScore } from './game-events';
import type { Card } from './setup';

export const BOT_ENGINE_VERSION = 1;
export const BOT_OBSERVATION_VERSION = 1;
export const BOT_ACTION_VERSION = 1;

export type BotAction =
  | { type: 'choose-princess'; princessId: string }
  | { type: 'submit-pass'; cards: Card[] }
  | { type: 'retract-pass' }
  | { type: 'raise-before-trick-hand'; targetTrickIndex: number }
  | { type: 'lower-before-trick-hand'; targetTrickIndex: number }
  | { type: 'decline-before-trick-priority'; windowId: string }
  | { type: 'begin-before-trick-power'; powerId: string; windowId?: string }
  | { type: 'activate-power'; powerId: string; windowId?: string; targetUid?: string; suit?: Card['suit']; card?: Card; cards?: Card[] }
  | { type: 'contribute-power-card'; powerId: 'sleeping-beauty'; card: Card }
  | { type: 'decline-power'; powerId: 'mulan' | 'scheherazade' }
  | { type: 'set-aside-round-card'; card: Card }
  | { type: 'submit-musical-chair-card'; card: Card }
  | { type: 'choose-crystal-clear-suit'; suit: Card['suit'] }
  | { type: 'select-after-party-half'; cards: Card[] }
  | { type: 'submit-wedding-gift'; card: Card }
  | { type: 'swap-haggle-card'; offered: Card; taken: Card }
  | { type: 'decline-haggle' }
  | { type: 'play-card'; card: Card }
  | { type: 'deal-next-round' }
  | { type: 'rematch' };

export type BotPhase =
  | 'setup'
  | 'passing'
  | 'round-action'
  | 'before-trick'
  | 'power-resolution'
  | 'playing'
  | 'round-complete'
  | 'game-complete'
  | 'waiting';

export interface BotObservedPlayer {
  uid: string;
  displayName: string;
  host: boolean;
  princessId?: string;
  ready: boolean;
  handSize: number;
  passSubmitted: boolean;
  roundActionSubmitted: boolean;
  roundCardsSubmitted: boolean;
}

export interface BotObservedTrickPlay {
  uid: string;
  card: Card | null;
  effectiveRank?: number;
}

export interface BotPendingPowerObservation {
  powerId: string;
  actorUid: string;
  targetUid?: string;
  contributorUids: string[];
  visibleCards: Array<{ uid: string; card: Card }>;
}

export interface BotObservation {
  version: typeof BOT_OBSERVATION_VERSION;
  gameId: string;
  seatUid: string;
  phase: BotPhase;
  players: BotObservedPlayer[];
  ownHand: Card[];
  ownPrincessOptions: string[];
  ownPassSubmission: Card[];
  ownRoundActionCard?: Card;
  ownRoundCardSubmission: Card[];
  ownRetainedCards: Card[];
  roundIds: string[];
  roundIndex: number;
  activeRoundId: string;
  trick: { leaderUid: string; plays: BotObservedTrickPlay[]; reversed?: boolean; requiredSuit?: Card['suit']; forcePrinceLead?: boolean } | null;
  currentTurnUid: string | null;
  princesBroken: boolean;
  capturedCounts: Record<string, number>;
  capturedTricks: Record<string, Array<Array<{ uid: string; card: Card; effectiveRank?: number }>>>;
  lastCompletedTrick: { winnerUid: string; plays: Array<{ uid: string; card: Card; effectiveRank?: number }> } | null;
  completedTricks: number;
  roundComplete: boolean;
  roundScores: Record<string, RoundScore>;
  roundScoreHistory: Array<Record<string, RoundScore>>;
  totalScores: Record<string, number>;
  nextLeaderUid: string | null;
  gameComplete: boolean;
  winnerUids: string[];
  exhaustedPrincessUids: string[];
  powerIdsThisTrick: string[];
  pendingMulanUid: string | null;
  pendingPower: BotPendingPowerObservation | null;
  batPriorityEnabled: boolean;
  batSignals: Record<string, { targetTrickIndex: number; raised: boolean }>;
  batSignalTargetTrick: number | null;
  beforeTrickWindow: BeforeTrickWindow | null;
  visibleForcedCards: Record<string, Card>;
  awaitingRoundAction: 'set-aside' | 'musical-pass' | 'reveal-suit' | 'split-hand' | 'wedding-gift' | 'haggle' | null;
  revealedSuits: Record<string, Card['suit']>;
  princessCommitmentCount: number;
  suitCommitmentCount: number;
  ownPrincessCommitted: boolean;
  ownSuitCommitted: boolean;
  haggleWinnerUid: string | null;
  blindTransferComplete: boolean;
  rebelUids: string[];
}

export interface SeededRandom {
  readonly seed: string;
  next(): number;
  integer(upperExclusive: number): number;
}

export interface BotDecision {
  actionIndex: number;
  policyId: string;
  seed: string;
  diagnostics?: Record<string, number | string | boolean>;
}

export interface BotPolicy {
  readonly id: string;
  readonly usesOptionalBeforeTrickPowers?: boolean;
  choose(
    observation: BotObservation,
    legalActions: readonly BotAction[],
    random: SeededRandom
  ): BotDecision | Promise<BotDecision>;
}
