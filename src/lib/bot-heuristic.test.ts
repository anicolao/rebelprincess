import { describe, expect, it } from 'vitest';
import { HeuristicBotPolicy, scoreHeuristicAction } from './bot-heuristic';
import { buildBotObservation, createSeededRandom, legalBotActions, policyBotActions, runHeadlessFiveRoundGame } from './bot-engine';
import { createBotPolicy, normalizeBotDifficulty } from './bot-policies';
import { deriveGame, type GameEvent, type GameEventPayload, type GameEventType } from './game-events';
import { cardLabel, PRINCESSES, type Card } from './setup';

function openingGame() {
  let sequence = 0;
  const make = (type: GameEventType, actorUid: string, payload: Omit<GameEventPayload, 'gameId'>): GameEvent => ({
    id: String(++sequence).padStart(4, '0'),
    type,
    actorUid,
    clientSeq: sequence,
    createdAt: null,
    schemaVersion: 1,
    reducerVersion: 1,
    payload: { gameId: 'HEURISTIC', ...payload }
  });
  const hand = (cards: Card[]) => cards;
  const hands = {
    a: hand([
      { suit: 'pets', rank: 8 }, { suit: 'princes', rank: 12 }, { suit: 'princes', rank: 11 },
      { suit: 'fairies', rank: 1 }, { suit: 'fairies', rank: 2 }, { suit: 'fairies', rank: 3 },
      { suit: 'queens', rank: 1 }, { suit: 'queens', rank: 2 }, { suit: 'queens', rank: 3 },
      { suit: 'pets', rank: 1 }, { suit: 'pets', rank: 2 }, { suit: 'pets', rank: 3 }
    ] as Card[]),
    b: hand(Array.from({ length: 12 }, (_, index) => ({ suit: 'fairies' as const, rank: index + 1 }))),
    c: hand(Array.from({ length: 12 }, (_, index) => ({ suit: 'queens' as const, rank: index + 1 })))
  };
  return deriveGame([
    make('game/created', 'a', { displayName: 'A' }),
    make('player/joined', 'b', { displayName: 'B' }),
    make('player/joined', 'c', { displayName: 'C' }),
    make('game/dealt', 'a', { seed: 'heuristic', roundIds: Array(5).fill('once-upon-a-time'), hands })
  ]);
}

describe('modular heuristic bot', () => {
  it('passes the Frog and dangerous Princes instead of harmless low cards', () => {
    const game = openingGame();
    const actions = legalBotActions(game, 'a');
    const observation = buildBotObservation(game, 'a');
    const policy = new HeuristicBotPolicy();
    const decision = policy.choose(observation, actions, createSeededRandom('pass'));
    const chosen = actions[decision.actionIndex];
    expect(chosen.type).toBe('submit-pass');
    if (chosen.type !== 'submit-pass') throw new Error('Expected a passing action');
    expect(chosen.cards.map(cardLabel).sort()).toEqual(['Pets 8', 'Princes 11', 'Princes 12'].sort());
  });

  it('prefers losing a penalty-rich visible trick and shedding danger off suit', () => {
    const observation = buildBotObservation(openingGame(), 'a');
    observation.trick = {
      leaderUid: 'b',
      plays: [{ uid: 'b', card: { suit: 'fairies', rank: 10 } }, { uid: 'c', card: { suit: 'princes', rank: 4 } }]
    };
    const losing = { type: 'play-card', card: { suit: 'fairies', rank: 2 } } as const;
    const winning = { type: 'play-card', card: { suit: 'fairies', rank: 12 } } as const;
    const dump = { type: 'play-card', card: { suit: 'princes', rank: 12 } } as const;
    expect(scoreHeuristicAction(observation, losing)).toBeGreaterThan(scoreHeuristicAction(observation, winning));
    expect(scoreHeuristicAction(observation, dump)).toBeGreaterThan(scoreHeuristicAction(observation, losing));
  });

  it.each([3, 4, 5, 6])('finishes a complete five-round game with %i players', async (playerCount) => {
    const result = await runHeadlessFiveRoundGame({
      playerCount,
      seed: `heuristic-full:${playerCount}`,
      policy: new HeuristicBotPolicy()
    });
    expect(result.projection.gameComplete).toBe(true);
    expect(result.projection.roundScoreHistory).toHaveLength(5);
  });

  it('finishes a full game while actively resolving optional Princess powers', async () => {
    const result = await runHeadlessFiveRoundGame({
      playerCount: 3,
      seed: 'heuristic-princesses',
      policy: new HeuristicBotPolicy(),
      princessIds: ['sleeping-beauty', 'mulan', 'snow-white']
    });
    expect(result.projection.gameComplete).toBe(true);
    expect(result.events.some((event) => event.type === 'power/activation-started')).toBe(true);
    expect(result.events.some((event) => event.type === 'power/contributed')).toBe(true);
    expect(result.events.some((event) => event.type === 'power/activated')).toBe(true);
  });

  it('finishes seeded games covering every Princess assignment', async () => {
    const princessIds = PRINCESSES.map(([id]) => id);
    for (let offset = 0; offset < princessIds.length; offset += 3) {
      const group = princessIds.slice(offset, offset + 3);
      while (group.length < 3) group.push('alice');
      const result = await runHeadlessFiveRoundGame({
        playerCount: 3,
        seed: `princess-matrix:${offset}`,
        policy: new HeuristicBotPolicy(),
        princessIds: group
      });
      expect(result.projection.gameComplete).toBe(true);
    }
  });

  it('maps stable product difficulties to distinct policies and preserves the legacy default', () => {
    expect(createBotPolicy('easy').id).toBe('heuristic-easy-v1');
    expect(createBotPolicy('standard').id).toBe('heuristic-standard-v1');
    expect(createBotPolicy('learned').id).toBe('basic-rl-2000');
    expect(normalizeBotDifficulty(undefined)).toBe('learned');
  });

  it('keeps untrained Learned bots conservative about optional before-trick powers', () => {
    const observation = buildBotObservation(openingGame(), 'a');
    observation.beforeTrickWindow = {
      id: 'window', startingLeaderUid: 'a', eligibleUids: ['a'], priorityUid: 'a', actedUids: [], declinedSinceActivation: []
    };
    const actions = [
      { type: 'begin-before-trick-power', powerId: 'sleeping-beauty', windowId: 'window' } as const,
      { type: 'decline-before-trick-priority', windowId: 'window' } as const
    ];
    expect(policyBotActions(createBotPolicy('learned'), observation, actions)).toEqual([actions[1]]);
    expect(policyBotActions(createBotPolicy('standard'), observation, actions)).toEqual(actions);
  });
});
