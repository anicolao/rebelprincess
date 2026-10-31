import { HeuristicBotPolicy } from './bot-heuristic';
import { LinearRlBotPolicy, type BasicRlModel } from './bot-rl';
import type { BotPolicy } from './bot-types';
import modelData from './models/basic-rl-v1.json';

export const BOT_DIFFICULTIES = ['easy', 'standard', 'learned'] as const;
export type BotDifficulty = typeof BOT_DIFFICULTIES[number];

export const BOT_DIFFICULTY_LABELS: Record<BotDifficulty, string> = {
  easy: 'Easy',
  standard: 'Standard',
  learned: 'Learned'
};

export function normalizeBotDifficulty(value: unknown): BotDifficulty {
  return BOT_DIFFICULTIES.includes(value as BotDifficulty) ? value as BotDifficulty : 'learned';
}

export function createBotPolicy(difficulty: BotDifficulty): BotPolicy {
  if (difficulty === 'easy') return new HeuristicBotPolicy(0.3);
  if (difficulty === 'standard') return new HeuristicBotPolicy();
  return new LinearRlBotPolicy(modelData as BasicRlModel);
}
