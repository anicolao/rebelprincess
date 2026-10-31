import { scoreHeuristicAction } from './bot-heuristic';
import type { BotAction, BotDecision, BotObservation, BotPolicy, SeededRandom } from './bot-types';
import { PRINCESSES, ROUND_RULES, type Card } from './setup';
import { roundTrickWinner } from './round-rules';

export const BASIC_RL_MODEL_FORMAT = 'rebel-princess-linear-residual-policy-v2' as const;

const ACTION_TYPES: BotAction['type'][] = [
  'choose-princess', 'submit-pass', 'raise-before-trick-hand', 'decline-before-trick-priority',
  'begin-before-trick-power', 'activate-power', 'contribute-power-card', 'decline-power',
  'set-aside-round-card', 'submit-musical-chair-card', 'choose-crystal-clear-suit',
  'select-after-party-half', 'submit-wedding-gift', 'swap-haggle-card', 'decline-haggle', 'play-card'
];
const ROUND_IDS = ROUND_RULES.map(([id]) => id);
const PRINCESS_IDS = PRINCESSES.map(([id]) => id);

export const RL_FEATURE_NAMES = [
  'bias', 'heuristic-score', 'mean-rank', 'high-rank', 'low-rank', 'rank-squared',
  'danger', 'prince-count', 'frog-count', 'fairy-count', 'queen-count', 'pet-count',
  'creates-void', 'leaves-singleton', 'action-suit-hand-fraction', 'leading',
  'following-led-suit', 'off-suit', 'would-win-visible-trick', 'visible-trick-penalty',
  'trick-progress', 'hand-size', 'round-progress', 'princes-broken', 'score-differential',
  'pass:rank', 'pass:danger', 'play:rank', 'play:rank-squared', 'play:danger',
  'play:win', 'play:off-suit', 'play:visible-penalty', 'play:winning-round-value', 'play:suit-hand-fraction',
  'play:empties-suit', 'play:leaves-singleton', 'set-aside:danger', 'musical:danger',
  'gift:danger', 'after-party:danger', 'haggle:danger',
  'haggle:offered-danger', 'haggle:taken-danger', 'power:danger', 'power:target-self',
  'power:target-score-lead', 'mulan:recipient-danger',
  'sleeping-beauty:self-card-danger', 'contribution:danger',
  ...ACTION_TYPES.map((type) => `action:${type}`),
  ...(['fairies', 'queens', 'princes', 'pets'] as const).map((suit) => `suit:${suit}`),
  ...ROUND_IDS.flatMap((id) => ['heuristic', 'rank', 'danger', 'win', 'off-suit'].map((kind) => `round:${id}:${kind}`)),
  ...PRINCESS_IDS.flatMap((id) => ['heuristic', 'rank', 'activate', 'target-self'].map((kind) => `princess:${id}:${kind}`)),
  ...[3, 4, 5, 6].flatMap((count) => ['heuristic', 'rank', 'danger'].map((kind) => `players:${count}:${kind}`))
] as const;

export interface BasicRlModel {
  format: typeof BASIC_RL_MODEL_FORMAT;
  id: string;
  trainingMethod: 'targeted-full-game-outcome-search-v1';
  trainingGames: number;
  trainingSeed: string;
  featureNames: string[];
  weights: number[];
}

interface TrainingDecision {
  seatUid: string;
  chosen: number;
  features: number[][];
  probabilities: number[];
}

function actionCards(action: BotAction): Card[] {
  switch (action.type) {
    case 'submit-pass':
    case 'select-after-party-half': return action.cards;
    case 'play-card':
    case 'set-aside-round-card':
    case 'submit-musical-chair-card':
    case 'submit-wedding-gift':
    case 'contribute-power-card': return [action.card];
    case 'swap-haggle-card': return [action.offered, action.taken];
    case 'activate-power': return action.cards ?? (action.card ? [action.card] : []);
    default: return [];
  }
}

function actionSuit(action: BotAction, cards: Card[]): Card['suit'] | undefined {
  if (action.type === 'choose-crystal-clear-suit' || action.type === 'activate-power') return action.suit ?? cards[0]?.suit;
  return cards[0]?.suit;
}

function cardDanger(card: Card): number {
  if (card.suit === 'pets' && card.rank === 8) return 6;
  if (card.suit === 'princes') return 1 + card.rank / 12;
  return card.rank / 24;
}

function immediateRoundValue(card: Card, roundId: string): number {
  let value = card.suit === 'princes' ? 1 : card.suit === 'pets' && card.rank === 8 ? 5 : 0;
  if (roundId === 'pets-revenge' && card.suit === 'pets') value += 1;
  if (roundId === 'three-times-a-lady' && card.rank === 3) value -= 3;
  if (roundId === 'single-fairy' && card.suit === 'fairies') value -= 1;
  if (roundId === 'bathroom-break' && card.suit === 'princes') value += 1;
  return value;
}

export function rlActionFeatures(observation: BotObservation, action: BotAction): number[] {
  const cards = actionCards(action);
  const ranks = cards.map((card) => card.rank / 12);
  const meanRank = ranks.length ? ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length : 0;
  const highRank = ranks.length ? Math.max(...ranks) : 0;
  const lowRank = ranks.length ? Math.min(...ranks) : 0;
  const count = (suit: Card['suit'], rank?: number) => cards.filter((card) => card.suit === suit && (rank === undefined || card.rank === rank)).length;
  const suit = actionSuit(action, cards);
  const suitHandCount = suit ? observation.ownHand.filter((card) => card.suit === suit).length : 0;
  const outgoingSuitCount = suit ? cards.filter((card) => card.suit === suit).length : 0;
  const remainingSuitCount = suitHandCount - outgoingSuitCount;
  const createsVoid = action.type === 'submit-pass' && suitHandCount > 0 && remainingSuitCount === 0 ? 1 : 0;
  const leavesSingleton = action.type === 'submit-pass' && remainingSuitCount === 1 ? 1 : 0;
  const played = action.type === 'play-card' || (action.type === 'activate-power' && action.card) ? action.card : undefined;
  const visiblePlays = observation.trick?.plays.filter((play) => play.card !== null) ?? [];
  const ledSuit = visiblePlays[0]?.card?.suit;
  const ledRanks = visiblePlays.filter((play) => play.card?.suit === ledSuit).map((play) => play.effectiveRank ?? play.card!.rank);
  const playedRank = played?.rank ?? 0;
  const reversed = observation.trick?.reversed === true;
  const wouldWin = played && (!ledSuit || played.suit === ledSuit) &&
    (!ledRanks.length || (reversed ? playedRank < Math.min(...ledRanks) : playedRank > Math.max(...ledRanks))) ? 1 : 0;
  const following = played && ledSuit === played.suit ? 1 : 0;
  const offSuit = played && ledSuit && ledSuit !== played.suit ? 1 : 0;
  const visiblePenalty = visiblePlays.reduce((sum, play) => sum + (play.card?.suit === 'princes' ? 1 : 0) + (play.card?.suit === 'pets' && play.card.rank === 8 ? 5 : 0), 0) / 10;
  const danger = cards.reduce((sum, card) => sum + cardDanger(card), 0) / Math.max(1, cards.length) / 6;
  const heuristic = scoreHeuristicAction(observation, action) / 100;
  const ownScore = observation.totalScores[observation.seatUid] ?? 0;
  const opponents = observation.players.filter((player) => player.uid !== observation.seatUid);
  const opponentMean = opponents.reduce((sum, player) => sum + (observation.totalScores[player.uid] ?? 0), 0) / Math.max(1, opponents.length);
  const princessId = observation.players.find((player) => player.uid === observation.seatUid)?.princessId;
  const activates = action.type === 'activate-power' || action.type === 'begin-before-trick-power' || action.type === 'raise-before-trick-hand';
  const isPlay = action.type === 'play-card';
  const winningRoundValue = wouldWin
    ? [...visiblePlays.flatMap((play) => play.card ? [play.card] : []), ...(played ? [played] : [])]
        .reduce((sum, card) => sum + immediateRoundValue(card, observation.activeRoundId), 0) / 10
    : 0;
  const haggleOffered = action.type === 'swap-haggle-card' ? cardDanger(action.offered) / 6 : 0;
  const haggleTaken = action.type === 'swap-haggle-card' ? cardDanger(action.taken) / 6 : 0;
  const sleepingBeautySelfCard = action.type === 'activate-power' && action.powerId === 'sleeping-beauty' && action.cards?.[0]
    ? cardDanger(action.cards[0]) / 6
    : 0;
  const targetScore = action.type === 'activate-power' && action.targetUid
    ? observation.totalScores[action.targetUid] ?? 0
    : ownScore;
  let mulanRecipientDanger = 0;
  if (action.type === 'activate-power' && action.powerId === 'mulan' && action.card && observation.trick && observation.trick.plays.every((play) => play.card)) {
    const plays = observation.trick.plays.map((play) => ({
      uid: play.uid,
      card: play.uid === observation.seatUid ? action.card! : play.card!,
      ...(play.effectiveRank === undefined ? {} : { effectiveRank: play.effectiveRank })
    }));
    const winnerUid = roundTrickWinner({ ...observation.trick, plays }, observation.activeRoundId);
    mulanRecipientDanger = cardDanger(action.card) / 6 * (winnerUid === observation.seatUid ? -1 : 1);
  }
  const features = [
    1, heuristic, meanRank, highRank, lowRank, meanRank * meanRank, danger,
    count('princes') / 3, count('pets', 8), count('fairies') / 3, count('queens') / 3, count('pets') / 3,
    createsVoid, leavesSingleton, suitHandCount / Math.max(1, observation.ownHand.length),
    played && visiblePlays.length === 0 ? 1 : 0, following, offSuit, wouldWin, visiblePenalty,
    visiblePlays.length / Math.max(1, observation.players.length), observation.ownHand.length / 12,
    observation.completedTricks / 12, observation.princesBroken ? 1 : 0, (opponentMean - ownScore) / 50,
    action.type === 'submit-pass' ? meanRank : 0,
    action.type === 'submit-pass' ? danger : 0,
    isPlay ? meanRank : 0,
    isPlay ? meanRank * meanRank : 0,
    isPlay ? danger : 0,
    isPlay ? wouldWin : 0,
    isPlay ? offSuit : 0,
    isPlay ? visiblePenalty : 0,
    isPlay ? winningRoundValue : 0,
    isPlay ? suitHandCount / Math.max(1, observation.ownHand.length) : 0,
    isPlay && remainingSuitCount === 0 ? 1 : 0,
    isPlay && remainingSuitCount === 1 ? 1 : 0,
    action.type === 'set-aside-round-card' ? danger : 0,
    action.type === 'submit-musical-chair-card' ? danger : 0,
    action.type === 'submit-wedding-gift' ? danger : 0,
    action.type === 'select-after-party-half' ? danger : 0,
    action.type === 'swap-haggle-card' ? danger : 0,
    haggleOffered,
    haggleTaken,
    action.type === 'activate-power' ? danger : 0,
    action.type === 'activate-power' && action.targetUid === observation.seatUid ? 1 : 0,
    action.type === 'activate-power' && action.targetUid ? (ownScore - targetScore) / 50 : 0,
    mulanRecipientDanger,
    sleepingBeautySelfCard,
    action.type === 'contribute-power-card' ? danger : 0,
    ...ACTION_TYPES.map((type) => action.type === type ? 1 : 0),
    ...(['fairies', 'queens', 'princes', 'pets'] as const).map((candidate) => suit === candidate ? 1 : 0),
    ...ROUND_IDS.flatMap((id) => observation.activeRoundId === id ? [heuristic, meanRank, danger, wouldWin, offSuit] : [0, 0, 0, 0, 0]),
    ...PRINCESS_IDS.flatMap((id) => princessId === id ? [heuristic, meanRank, activates ? 1 : 0, action.type === 'activate-power' && action.targetUid === observation.seatUid ? 1 : 0] : [0, 0, 0, 0]),
    ...[3, 4, 5, 6].flatMap((playerCount) => observation.players.length === playerCount ? [heuristic, meanRank, danger] : [0, 0, 0])
  ];
  if (features.length !== RL_FEATURE_NAMES.length) throw new Error(`RL feature mismatch: ${features.length} != ${RL_FEATURE_NAMES.length}`);
  return features;
}

function dot(left: readonly number[], right: readonly number[]): number {
  return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}

function probabilities(scores: number[], temperature: number): number[] {
  if (temperature <= 0) {
    const maximum = Math.max(...scores);
    const first = scores.indexOf(maximum);
    return scores.map((_, index) => index === first ? 1 : 0);
  }
  const maximum = Math.max(...scores);
  const exponentials = scores.map((score) => Math.exp((score - maximum) / temperature));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return exponentials.map((value) => value / total);
}

function sample(values: number[], random: SeededRandom): number {
  let threshold = random.next();
  for (let index = 0; index < values.length; index += 1) {
    threshold -= values[index];
    if (threshold <= 0) return index;
  }
  return values.length - 1;
}

export class LinearRlBotPolicy implements BotPolicy {
  readonly id: string;
  readonly usesOptionalBeforeTrickPowers = true;
  private weights: number[];
  private episode: TrainingDecision[] = [];

  constructor(
    model?: BasicRlModel,
    private readonly options: { training?: boolean; temperature?: number; exploration?: number } = {}
  ) {
    if (model && (model.format !== BASIC_RL_MODEL_FORMAT || model.featureNames.join('|') !== RL_FEATURE_NAMES.join('|') || model.weights.length !== RL_FEATURE_NAMES.length)) {
      throw new Error('Incompatible basic RL model');
    }
    this.id = model?.id ?? 'full-game-residual-untrained';
    this.weights = model ? [...model.weights] : RL_FEATURE_NAMES.map((name) => name === 'heuristic-score' ? 1 : 0);
  }

  beginEpisode(): void {
    this.episode = [];
  }

  choose(observation: BotObservation, legalActions: readonly BotAction[], random: SeededRandom): BotDecision {
    if (!legalActions.length) throw new Error('RL policy requires at least one legal action');
    const featureRows = legalActions.map((action) => rlActionFeatures(observation, action));
    const scores = featureRows.map((features) => dot(this.weights, features));
    const distribution = probabilities(scores, this.options.temperature ?? (this.options.training ? 0.2 : 0));
    const explore = this.options.training === true && random.next() < (this.options.exploration ?? 0.04);
    const actionIndex = explore ? random.integer(legalActions.length) : sample(distribution, random);
    if (this.options.training) this.episode.push({ seatUid: observation.seatUid, chosen: actionIndex, features: featureRows, probabilities: distribution });
    return {
      actionIndex,
      policyId: this.id,
      seed: random.seed,
      diagnostics: { score: scores[actionIndex], candidates: legalActions.length, explored: explore }
    };
  }

  learn(rewards: Record<string, number>, learningRate: number): void {
    for (const decision of this.episode) {
      const advantage = Math.max(-3, Math.min(3, (rewards[decision.seatUid] ?? 0) / 10));
      for (let feature = 0; feature < this.weights.length; feature += 1) {
        const expectation = decision.features.reduce((sum, row, action) => sum + decision.probabilities[action] * row[feature], 0);
        this.weights[feature] += learningRate * advantage * (decision.features[decision.chosen][feature] - expectation);
      }
    }
    this.episode = [];
  }

  exportModel(details: { id: string; trainingGames: number; trainingSeed: string }): BasicRlModel {
    return {
      format: BASIC_RL_MODEL_FORMAT,
      id: details.id,
      trainingMethod: 'targeted-full-game-outcome-search-v1',
      trainingGames: details.trainingGames,
      trainingSeed: details.trainingSeed,
      featureNames: [...RL_FEATURE_NAMES],
      weights: this.weights.map((weight) => Number(weight.toFixed(8)))
    };
  }
}

export function scoreUtilities(observation: { players: Array<{ uid: string }>; totalScores: Record<string, number> }): Record<string, number> {
  return Object.fromEntries(observation.players.map((player) => {
    const opponents = observation.players.filter((candidate) => candidate.uid !== player.uid);
    const opponentMean = opponents.reduce((sum, opponent) => sum + (observation.totalScores[opponent.uid] ?? 0), 0) / opponents.length;
    return [player.uid, opponentMean - (observation.totalScores[player.uid] ?? 0)];
  }));
}

export function roundUtilities(observation: { players: Array<{ uid: string }>; roundScores: Record<string, { total: number }> }): Record<string, number> {
  return Object.fromEntries(observation.players.map((player) => {
    const opponents = observation.players.filter((candidate) => candidate.uid !== player.uid);
    const opponentMean = opponents.reduce((sum, opponent) => sum + (observation.roundScores[opponent.uid]?.total ?? 0), 0) / opponents.length;
    return [player.uid, opponentMean - (observation.roundScores[player.uid]?.total ?? 0)];
  }));
}
