import { benchmarkBotPolicy } from '../src/lib/bot-benchmark';
import { randomLegalBotPolicy } from '../src/lib/bot-engine';
import { HeuristicBotPolicy } from '../src/lib/bot-heuristic';
import { createBotPolicy } from '../src/lib/bot-policies';

const argument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const seeds = Number(argument('--seeds') ?? 20);
const seed = argument('--seed') ?? 'bot-benchmark-v1';

const reports = [];
for (const challenger of [new HeuristicBotPolicy(), createBotPolicy('learned')]) {
  reports.push(await benchmarkBotPolicy({ challenger, baseline: randomLegalBotPolicy, seeds, seed }));
}
process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`);
