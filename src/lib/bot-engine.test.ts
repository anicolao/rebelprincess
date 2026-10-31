import { describe, expect, it } from 'vitest';
import {
  botActionToEvent,
  buildBotObservation,
  createSeededRandom,
  HEADLESS_FIVE_ROUND_IDS,
  legalBotActions,
  randomLegalBotPolicy,
  runHeadlessFiveRoundGame,
  runHeadlessOrdinaryRound
} from './bot-engine';
import { BOT_ACTION_VERSION, BOT_ENGINE_VERSION, BOT_OBSERVATION_VERSION } from './bot-types';
import { deriveGame, type GameEvent, type GameEventPayload, type GameEventType } from './game-events';
import { roundLegalCards } from './round-rules';
import { cardLabel, dealForPlayers, ROUND_RULES, SUITS, type Card } from './setup';

function fixture(roundId = 'once-upon-a-time') {
  const uids = ['a', 'b', 'c'];
  const hands = dealForPlayers(uids, `bot-fixture:${roundId}`);
  let sequence = 0;
  const event = (type: GameEventType, actorUid: string, payload: Omit<GameEventPayload, 'gameId'>): GameEvent => ({
    id: String(++sequence).padStart(4, '0'),
    type,
    actorUid,
    clientSeq: sequence,
    createdAt: null,
    schemaVersion: 1,
    reducerVersion: 1,
    payload: { gameId: 'BOTTEST', ...payload }
  });
  const events = [
    event('game/created', 'a', { displayName: 'A' }),
    event('player/joined', 'b', { displayName: 'B' }),
    event('player/joined', 'c', { displayName: 'C' }),
    event('game/dealt', 'a', {
      seed: `bot-fixture:${roundId}`,
      roundIds: [roundId, 'once-upon-a-time', 'once-upon-a-time', 'once-upon-a-time', 'once-upon-a-time'],
      hands
    })
  ];
  return { uids, hands, events, event };
}

function card(suit: Card['suit'], rank: number): Card {
  return { suit, rank };
}

describe('bot engine contracts', () => {
  it('versions the engine, observation, and action contracts independently', () => {
    expect({ engine: BOT_ENGINE_VERSION, observation: BOT_OBSERVATION_VERSION, action: BOT_ACTION_VERSION }).toEqual({
      engine: 1,
      observation: 1,
      action: 1
    });
  });

  it('enumerates every legal opening pass and preserves split-pass recipient order', () => {
    const ordinary = fixture();
    const ordinaryActions = legalBotActions(deriveGame(ordinary.events), 'a');
    expect(ordinaryActions).toHaveLength(220);
    expect(ordinaryActions.every((action) => action.type === 'submit-pass' && action.cards.length === 3)).toBe(true);
    expect(new Set(ordinaryActions.map((action) => action.type === 'submit-pass' ? action.cards.map(cardLabel).join('|') : '')).size).toBe(220);

    const split = fixture('arranged-marriage');
    const splitActions = legalBotActions(deriveGame(split.events), 'a');
    expect(splitActions).toHaveLength(132);
    const first = splitActions[0];
    expect(first.type).toBe('submit-pass');
    if (first.type !== 'submit-pass') throw new Error('Expected a pass action');
    const reversed = splitActions.find((action) => action.type === 'submit-pass' &&
      cardLabel(action.cards[0]) === cardLabel(first.cards[1]) && cardLabel(action.cards[1]) === cardLabel(first.cards[0]));
    expect(reversed).toBeDefined();
  });

  it('waits after submitting a pass, then matches reducer-backed card legality', () => {
    const game = fixture();
    game.events.push(game.event('pass/submitted', 'a', { cards: game.hands.a.slice(0, 3) }));
    expect(legalBotActions(deriveGame(game.events), 'a')).toEqual([]);

    game.events.push(game.event('pass/submitted', 'b', { cards: game.hands.b.slice(0, 3) }));
    game.events.push(game.event('pass/submitted', 'c', { cards: game.hands.c.slice(0, 3) }));
    const projection = deriveGame(game.events);
    expect(projection.passComplete).toBe(true);
    expect(projection.currentTurnUid).toBe('a');
    const actions = legalBotActions(projection, 'a');
    const expected = roundLegalCards(projection.hands!.a, projection.trick!, false, 'once-upon-a-time').map(cardLabel);
    expect(actions.map((action) => action.type === 'play-card' ? cardLabel(action.card) : action.type)).toEqual(expected);

    const intent = botActionToEvent(actions[0]);
    expect(intent.type).toBe('card/played');
    game.events.push(game.event(intent.type, 'a', intent.payload));
    expect(deriveGame(game.events).currentTurnUid).toBe('b');
  });

  it('does not expose opponent hands, passes, private inspections, or face-down Masquerade cards', () => {
    const setup = fixture();
    setup.events.push(setup.event('pass/submitted', 'a', { cards: setup.hands.a.slice(0, 3) }));
    setup.events.push(setup.event('pass/submitted', 'b', { cards: setup.hands.b.slice(0, 3) }));
    const original = deriveGame(setup.events);
    const hiddenVariation = structuredClone(original);
    hiddenVariation.hands!.b = hiddenVariation.hands!.b.map((held, index) => index === 0 ? card('pets', held.rank === 8 ? 7 : 8) : held);
    hiddenVariation.passSubmissions.b = hiddenVariation.passSubmissions.b.map((held, index) => index === 0 ? card('queens', held.rank === 12 ? 11 : 12) : held);
    expect(buildBotObservation(hiddenVariation, 'a')).toEqual(buildBotObservation(original, 'a'));
    expect(buildBotObservation(hiddenVariation, 'b')).not.toEqual(buildBotObservation(original, 'b'));

    const inspectedOne = structuredClone(original);
    inspectedOne.pendingPower = { powerId: 'ice-princess', actorUid: 'b', targetUid: 'c', cards: [{ uid: 'c', card: card('fairies', 2) }] };
    const inspectedTwo = structuredClone(inspectedOne);
    inspectedTwo.pendingPower!.cards[0].card = card('princes', 10);
    expect(buildBotObservation(inspectedOne, 'a')).toEqual(buildBotObservation(inspectedTwo, 'a'));
    expect(buildBotObservation(inspectedOne, 'b')).not.toEqual(buildBotObservation(inspectedTwo, 'b'));

    const masqueradeOne = structuredClone(original);
    masqueradeOne.roundIds[0] = 'masquerade-ball';
    masqueradeOne.trick = {
      leaderUid: 'a',
      plays: [{ uid: 'a', card: card('fairies', 4) }, { uid: 'b', card: card('fairies', 2) }]
    };
    const masqueradeTwo = structuredClone(masqueradeOne);
    masqueradeTwo.trick!.plays[1].card = card('fairies', 11);
    expect(buildBotObservation(masqueradeOne, 'a')).toEqual(buildBotObservation(masqueradeTwo, 'a'));
    expect(buildBotObservation(masqueradeOne, 'b')).not.toEqual(buildBotObservation(masqueradeTwo, 'b'));
  });

  it('does not inspect the leader hand when Little Mermaid chooses a suit', () => {
    const setup = fixture();
    const projection = deriveGame(setup.events);
    projection.players[0].princessId = 'little-mermaid';
    projection.passComplete = true;
    projection.pendingPower = { powerId: 'little-mermaid', actorUid: 'a', cards: [] };
    projection.trick = { leaderUid: 'b', plays: [] };
    const changedHiddenHand = structuredClone(projection);
    changedHiddenHand.hands!.b = [card('pets', 8)];

    const choices = (game: typeof projection) => legalBotActions(game, 'a').map((action) =>
      action.type === 'activate-power' ? action.suit : undefined
    );
    expect(choices(projection)).toEqual([...SUITS]);
    expect(choices(changedHiddenHand)).toEqual([...SUITS]);
  });

  it('copies observation data so a policy cannot mutate the authoritative projection', () => {
    const setup = fixture();
    const projection = deriveGame(setup.events);
    const observation = buildBotObservation(projection, 'a');
    observation.ownHand[0].rank = 99;
    observation.players[0].displayName = 'Changed';
    observation.roundIds[0] = 'changed';
    expect(projection.hands!.a[0].rank).not.toBe(99);
    expect(projection.players[0].displayName).toBe('A');
    expect(projection.roundIds[0]).toBe('once-upon-a-time');
  });

  it('uses deterministic random decisions and rejects an empty candidate list', () => {
    const first = createSeededRandom('same');
    const second = createSeededRandom('same');
    expect(Array.from({ length: 10 }, () => first.integer(100))).toEqual(Array.from({ length: 10 }, () => second.integer(100)));
    const setup = fixture();
    const observation = buildBotObservation(deriveGame(setup.events), 'a');
    expect(() => randomLegalBotPolicy.choose(observation, [], createSeededRandom('empty'))).toThrow('at least one legal action');
    expect(randomLegalBotPolicy.choose(observation, [{ type: 'retract-pass' }], createSeededRandom('recorded-seed'))).toMatchObject({
      actionIndex: 0,
      policyId: 'random-legal-v1',
      seed: 'recorded-seed'
    });
  });
});

describe('headless ordinary-round simulation', () => {
  it.each([3, 4, 5, 6])('finishes seeded random-legal games for %i players with exact card conservation', async (playerCount) => {
    for (let index = 0; index < 4; index += 1) {
      const result = await runHeadlessOrdinaryRound({ playerCount, seed: `${playerCount}:${index}` });
      expect(result.projection.roundComplete).toBe(true);
      expect(result.projection.completedTricks).toBeGreaterThan(0);
      expect(Object.values(result.projection.hands!).every((hand) => hand.length === 0)).toBe(true);
      expect(result.decisionCount).toBe(Object.values(dealForPlayers(result.projection.players.map((player) => player.uid), `${playerCount}:${index}:deal`)).flat().length + playerCount);
    }
  });

  it('replays an identical action stream for the same seed', async () => {
    const first = await runHeadlessOrdinaryRound({ playerCount: 4, seed: 'replay' });
    const second = await runHeadlessOrdinaryRound({ playerCount: 4, seed: 'replay' });
    expect(second.events).toEqual(first.events);
    expect(second.projection).toEqual(first.projection);
  });
});

describe('headless five-round simulation', () => {
  it.each([3, 4, 5, 6])('finishes a deterministic five-round game for %i players', async (playerCount) => {
    const result = await runHeadlessFiveRoundGame({ playerCount, seed: `full:${playerCount}` });
    const dealtCards = Object.values(dealForPlayers(result.projection.players.map((player) => player.uid), `full:${playerCount}:round-1`)).flat().length;
    expect(result.projection.gameComplete).toBe(true);
    expect(result.projection.roundIndex).toBe(4);
    expect(result.projection.roundIds).toEqual(HEADLESS_FIVE_ROUND_IDS);
    expect(result.projection.roundScoreHistory).toHaveLength(5);
    expect(Object.values(result.projection.hands!).every((hand) => hand.length === 0)).toBe(true);
    expect(result.events.filter((event) => event.type === 'game/dealt')).toHaveLength(5);
    expect(result.events.filter((event) => event.type === 'card/played')).toHaveLength(dealtCards * 5);
    expect(result.events.some((event) => event.type === 'round/pass-submitted')).toBe(true);
  });

  it('replays the same complete game for the same seed', async () => {
    const first = await runHeadlessFiveRoundGame({ playerCount: 3, seed: 'full-replay' });
    const second = await runHeadlessFiveRoundGame({ playerCount: 3, seed: 'full-replay' });
    expect(second.events).toEqual(first.events);
    expect(second.projection).toEqual(first.projection);
  });

  it('requires exactly five Round cards', async () => {
    await expect(runHeadlessFiveRoundGame({ playerCount: 3, seed: 'bad-rounds', roundIds: ['once-upon-a-time'] })).rejects.toThrow('exactly five');
  });

  it('finishes games covering every Round card action', async () => {
    const roundIds = ROUND_RULES.map(([id]) => id);
    for (let offset = 0; offset < roundIds.length; offset += 5) {
      const group = roundIds.slice(offset, offset + 5);
      while (group.length < 5) group.push('once-upon-a-time');
      const result = await runHeadlessFiveRoundGame({ playerCount: 3, seed: `round-matrix:${offset}`, roundIds: group });
      expect(result.projection.gameComplete).toBe(true);
    }
  });
});
