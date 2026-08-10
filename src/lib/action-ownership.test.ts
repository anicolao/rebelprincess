import { describe, expect, it } from 'vitest';
import { actionOwnership } from './action-ownership';
import type { GameProjection } from './game-events';

function projection(overrides: Partial<GameProjection> = {}): GameProjection {
  return {
    players: [
      { uid: 'alex', displayName: 'Alex' },
      { uid: 'jo', displayName: 'Jo' },
      { uid: 'sam', displayName: 'Sam' }
    ],
    roundComplete: false,
    passComplete: true,
    passSubmissions: {},
    awaitingRoundAction: null,
    roundActionSubmissions: {},
    roundCardSubmissions: {},
    suitCommitments: {},
    pendingMulanUid: null,
    pendingPower: null,
    haggleWinnerUid: null,
    currentTurnUid: 'alex',
    ...overrides
  } as GameProjection;
}

describe('actionOwnership', () => {
  it('identifies the one player who owns an ordinary turn or power resolution', () => {
    const turn = projection();
    expect(actionOwnership(turn, 'alex')).toEqual({ state: 'active', label: 'Play a card' });
    expect(actionOwnership(turn, 'jo').state).toBe('idle');

    const power = projection({ pendingPower: { powerId: 'ice-princess', actorUid: 'jo', cards: [] } });
    expect(actionOwnership(power, 'alex').state).toBe('idle');
    expect(actionOwnership(power, 'jo')).toEqual({ state: 'active', label: 'Resolve power' });
  });

  it.each([
    ['opening pass', { passComplete: false, passSubmissions: { jo: [{ suit: 'pets', rank: 2 }] } }, 'Choose pass', 'Pass locked'],
    ['Wedding Gift', { awaitingRoundAction: 'wedding-gift', roundActionSubmissions: { jo: { suit: 'pets', rank: 2 } } }, 'Choose gift', 'Gift wrapped'],
    ['Crystal Clear', { awaitingRoundAction: 'reveal-suit', suitCommitments: { jo: 'sealed' } }, 'Choose suit', 'Suit locked'],
    ['After Party', { awaitingRoundAction: 'split-hand', roundCardSubmissions: { jo: [{ suit: 'pets', rank: 2 }] } }, 'Choose hand', 'Hand set']
  ] as const)('shows every pending player and completed player during %s', (_name, overrides, activeLabel, completeLabel) => {
    const game = projection(overrides as Partial<GameProjection>);
    expect(actionOwnership(game, 'alex')).toEqual({ state: 'active', label: activeLabel });
    expect(actionOwnership(game, 'jo')).toEqual({ state: 'complete', label: completeLabel });
    expect(actionOwnership(game, 'sam')).toEqual({ state: 'active', label: activeLabel });
  });

  it('moves Sleeping Beauty ownership from contributors to the redistributing actor', () => {
    const collecting = projection({
      pendingPower: { powerId: 'sleeping-beauty', actorUid: 'alex', cards: [{ uid: 'jo', card: { suit: 'pets', rank: 2 } }] }
    });
    expect(actionOwnership(collecting, 'alex')).toEqual({ state: 'active', label: 'Choose card' });
    expect(actionOwnership(collecting, 'jo')).toEqual({ state: 'complete', label: 'Card given' });
    expect(actionOwnership(collecting, 'sam')).toEqual({ state: 'active', label: 'Choose card' });

    const redistributing = projection({
      pendingPower: {
        powerId: 'sleeping-beauty', actorUid: 'alex', cards: [
          { uid: 'alex', card: { suit: 'fairies', rank: 2 } },
          { uid: 'jo', card: { suit: 'pets', rank: 2 } },
          { uid: 'sam', card: { suit: 'queens', rank: 2 } }
        ]
      }
    });
    expect(actionOwnership(redistributing, 'alex')).toEqual({ state: 'active', label: 'Redistribute cards' });
    expect(actionOwnership(redistributing, 'jo')).toEqual({ state: 'complete', label: 'Card given' });
  });
});
