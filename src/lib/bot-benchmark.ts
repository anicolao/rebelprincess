import { runHeadlessFiveRoundGame } from './bot-engine';
import type { BotPolicy } from './bot-types';

export interface BotBenchmarkResult {
  challengerId: string;
  baselineId: string;
  seeds: number;
  games: number;
  meanScoreDifferential: number;
  wins: number;
  ties: number;
  losses: number;
}

export async function benchmarkBotPolicy(options: {
  challenger: BotPolicy;
  baseline: BotPolicy;
  seeds: number;
  playerCount?: number;
  seed?: string;
}): Promise<BotBenchmarkResult> {
  const { challenger, baseline, seeds, playerCount = 3, seed = 'bot-benchmark-v1' } = options;
  if (!Number.isInteger(seeds) || seeds <= 0) throw new Error('Benchmark seeds must be a positive integer');
  if (playerCount < 3 || playerCount > 6) throw new Error('Benchmarks require 3–6 players');
  let differential = 0;
  let wins = 0;
  let ties = 0;
  let losses = 0;
  for (let seedIndex = 0; seedIndex < seeds; seedIndex += 1) {
    for (let seat = 0; seat < playerCount; seat += 1) {
      const policies = Array.from({ length: playerCount }, (_, index) => index === seat ? challenger : baseline);
      const result = await runHeadlessFiveRoundGame({
        playerCount,
        seed: `${seed}:${seedIndex}:seat-${seat + 1}`,
        seatPolicies: policies
      });
      const uid = result.projection.players[seat].uid;
      const score = result.projection.totalScores[uid] ?? 0;
      const opponentScores = result.projection.players.filter((_, index) => index !== seat).map((player) => result.projection.totalScores[player.uid] ?? 0);
      const opponentMean = opponentScores.reduce((sum, value) => sum + value, 0) / opponentScores.length;
      const gameDifferential = opponentMean - score;
      differential += gameDifferential;
      if (gameDifferential > 0) wins += 1;
      else if (gameDifferential < 0) losses += 1;
      else ties += 1;
    }
  }
  const games = seeds * playerCount;
  return {
    challengerId: challenger.id,
    baselineId: baseline.id,
    seeds,
    games,
    meanScoreDifferential: Number((differential / games).toFixed(4)),
    wins,
    ties,
    losses
  };
}
