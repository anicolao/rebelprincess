import { describe, expect, it } from 'vitest';
import { buildBotObservation, createSeededRandom, legalBotActions, runHeadlessOrdinaryRound } from './bot-engine';
import { BASIC_RL_MODEL_FORMAT, LinearRlBotPolicy, RL_FEATURE_NAMES, rlActionFeatures, roundUtilities, type BasicRlModel } from './bot-rl';
import { deriveGame, type GameEvent } from './game-events';
import modelData from './models/basic-rl-v1.json';

const trainedModel = modelData as BasicRlModel;

describe('basic reinforcement-learning policy', () => {
  it('loads a versioned, genuinely trained model with one weight per feature', () => {
    expect(trainedModel.format).toBe(BASIC_RL_MODEL_FORMAT);
    expect(trainedModel.id).toBe('learned-outcome-v2');
    expect(trainedModel.trainingMethod).toBe('targeted-full-game-outcome-search-v1');
    expect(trainedModel.trainingGames).toBe(2_420);
    expect(trainedModel.featureNames).toEqual([...RL_FEATURE_NAMES]);
    expect(trainedModel.weights).toHaveLength(RL_FEATURE_NAMES.length);
    expect(trainedModel.weights.some((weight) => Math.abs(weight) > 0.01)).toBe(true);
  });

  it('keeps the trained residual sparse and auditable on top of Standard', () => {
    const nonZero = Object.fromEntries(trainedModel.featureNames.flatMap((name, index) =>
      trainedModel.weights[index] === 0 ? [] : [[name, trainedModel.weights[index]]]
    ));
    expect(nonZero).toEqual({
      'heuristic-score': 1,
      'creates-void': 0.5,
      'leaves-singleton': -0.5,
      'haggle:offered-danger': -2,
      'haggle:taken-danger': 2,
      'mulan:recipient-danger': 1,
      'princess:pocahontas:target-self': -0.1
    });
  });

  it('scores only the supplied legal actions and is deterministic in evaluation mode', async () => {
    const result = await runHeadlessOrdinaryRound({ playerCount: 3, seed: 'rl-observation' });
    const opening = deriveGame(result.events.slice(0, 4) as GameEvent[]);
    const actions = legalBotActions(opening, 'bot-1');
    const observation = buildBotObservation(opening, 'bot-1');
    const policy = new LinearRlBotPolicy(trainedModel);
    const first = policy.choose(observation, actions, createSeededRandom('first'));
    const second = policy.choose(observation, actions, createSeededRandom('second'));
    expect(first.actionIndex).toBe(second.actionIndex);
    expect(actions[first.actionIndex]).toBeDefined();
    expect(rlActionFeatures(observation, actions[first.actionIndex])).toHaveLength(RL_FEATURE_NAMES.length);
  });

  it.each([3, 4, 5, 6])('plays a complete legal round with %i seats', async (playerCount) => {
    const result = await runHeadlessOrdinaryRound({
      playerCount,
      seed: `trained-policy:${playerCount}`,
      policy: new LinearRlBotPolicy(trainedModel)
    });
    expect(result.projection.roundComplete).toBe(true);
    expect(Object.values(result.projection.hands!).every((hand) => hand.length === 0)).toBe(true);
    expect(Object.keys(roundUtilities(result.projection))).toHaveLength(playerCount);
  });

  it('rejects incompatible model artifacts instead of silently using the wrong features', () => {
    expect(() => new LinearRlBotPolicy({ ...trainedModel, weights: trainedModel.weights.slice(1) })).toThrow('Incompatible basic RL model');
  });
});
