import type { GameProjection } from './game-events';

export type ActionOwnershipState = 'active' | 'complete' | 'idle';

export type ActionOwnership = {
  state: ActionOwnershipState;
  label: string;
};

type OwnershipProjection = Pick<GameProjection,
  | 'players'
  | 'roundComplete'
  | 'passComplete'
  | 'passSubmissions'
  | 'awaitingRoundAction'
  | 'roundActionSubmissions'
  | 'roundCardSubmissions'
  | 'suitCommitments'
  | 'pendingMulanUid'
  | 'pendingPower'
  | 'beforeTrickWindow'
  | 'haggleWinnerUid'
  | 'currentTurnUid'
>;

const IDLE: ActionOwnership = { state: 'idle', label: '' };

function simultaneousChoice(submitted: boolean, activeLabel: string, completeLabel: string): ActionOwnership {
  return submitted
    ? { state: 'complete', label: completeLabel }
    : { state: 'active', label: activeLabel };
}

/** Derive public, per-seat action responsibility from the accepted projection. */
export function actionOwnership(game: OwnershipProjection, uid: string): ActionOwnership {
  if (game.roundComplete) return IDLE;

  if (!game.passComplete) {
    return simultaneousChoice(Boolean(game.passSubmissions[uid]), 'Choose pass', 'Pass locked');
  }

  if (game.awaitingRoundAction) {
    if (game.awaitingRoundAction === 'haggle') {
      return game.haggleWinnerUid === uid ? { state: 'active', label: 'Resolve haggle' } : IDLE;
    }
    if (game.awaitingRoundAction === 'reveal-suit') {
      return simultaneousChoice(Boolean(game.suitCommitments[uid]), 'Choose suit', 'Suit locked');
    }
    if (game.awaitingRoundAction === 'split-hand') {
      return simultaneousChoice(Boolean(game.roundCardSubmissions[uid]), 'Choose hand', 'Hand set');
    }

    const labels: Record<string, [string, string]> = {
      'set-aside': ['Choose reserve', 'Card reserved'],
      'musical-pass': ['Choose card', 'Card ready'],
      'wedding-gift': ['Choose gift', 'Gift wrapped']
    };
    const [activeLabel, completeLabel] = labels[game.awaitingRoundAction] ?? ['Choose card', 'Ready'];
    return simultaneousChoice(Boolean(game.roundActionSubmissions[uid]), activeLabel, completeLabel);
  }

  if (game.pendingMulanUid) {
    return game.pendingMulanUid === uid ? { state: 'active', label: 'Resolve Mulan' } : IDLE;
  }

  if (game.pendingPower) {
    if (game.pendingPower.powerId === 'sleeping-beauty') {
      const allCardsCollected = game.pendingPower.cards.length === game.players.length;
      if (allCardsCollected && game.pendingPower.actorUid === uid) return { state: 'active', label: 'Redistribute cards' };
      return simultaneousChoice(game.pendingPower.cards.some((entry) => entry.uid === uid), 'Choose card', 'Card given');
    }
    return game.pendingPower.actorUid === uid ? { state: 'active', label: 'Resolve power' } : IDLE;
  }

  if (game.beforeTrickWindow) {
    return game.beforeTrickWindow.priorityUid === uid ? { state: 'active', label: 'Before-trick decision' } : IDLE;
  }

  return game.currentTurnUid === uid ? { state: 'active', label: 'Play a card' } : IDLE;
}
