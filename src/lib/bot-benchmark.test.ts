import { describe, expect, it } from 'vitest';
import { benchmarkBotPolicy, benchmarkBotPolicyMatrix } from './bot-benchmark';
import { randomLegalBotPolicy } from './bot-engine';
import { HeuristicBotPolicy } from './bot-heuristic';

describe('deterministic bot benchmark', () => {
  it('rotates the challenger through every seat and reproduces the same report', async () => {
    const options = {
      challenger: new HeuristicBotPolicy(),
      baseline: randomLegalBotPolicy,
      seeds: 2,
      seed: 'benchmark-test'
    };
    const first = await benchmarkBotPolicy(options);
    const second = await benchmarkBotPolicy(options);
    expect(second).toEqual(first);
    expect(first).toMatchObject({
      challengerId: 'heuristic-standard-v1',
      baselineId: 'random-legal-v1',
      seeds: 2,
      games: 6
    });
    expect(first.wins + first.ties + first.losses).toBe(first.games);
  });

  it('runs a reproducible all-player-count promotion matrix with uncertainty', async () => {
    const options = {
      challenger: new HeuristicBotPolicy(),
      baseline: randomLegalBotPolicy,
      seedsPerPlayerCount: 1,
      seed: 'matrix-test'
    };
    const first = await benchmarkBotPolicyMatrix(options);
    const second = await benchmarkBotPolicyMatrix(options);
    expect(second).toEqual(first);
    expect(first.games).toBe(3 + 4 + 5 + 6);
    expect(first.confidence95.lower).toBeLessThanOrEqual(first.meanScoreDifferential);
    expect(first.confidence95.upper).toBeGreaterThanOrEqual(first.meanScoreDifferential);
    expect(first.promoted).toBe(false);
  });
});
