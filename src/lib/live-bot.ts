import { choiceCommitment, crystalClearChoiceScope, princessChoiceScope } from './choice-commitment';
import { botActionToEvent, buildBotObservation, createSeededRandom, legalBotActions } from './bot-engine';
import { LinearRlBotPolicy, type BasicRlModel } from './bot-rl';
import type { BotAction, BotPolicy } from './bot-types';
import { appendGameEvent, loadGame, subscribeToGame, type GameProjection } from './game-events';
import { createIsolatedFirebaseClient, type IsolatedFirebaseClient } from './firebase';
import modelData from './models/basic-rl-v1.json';

export type LiveBotStatus = 'starting' | 'joining' | 'choosing' | 'waiting' | 'acting' | 'stopped' | 'error';

export interface LiveBotState {
  uid: string;
  displayName: string;
  status: LiveBotStatus;
  detail: string;
}

type StoredChoice = { choice: string; nonce: string };

export function createBasicRlPolicy(): BotPolicy {
  return new LinearRlBotPolicy(modelData as BasicRlModel);
}

function actionKey(action: BotAction): string {
  return JSON.stringify(action);
}

export function botDecisionKey(game: GameProjection, uid: string, actions: readonly BotAction[]): string {
  return JSON.stringify({
    gameNumber: game.gameNumber,
    roundIndex: game.roundIndex,
    completedTricks: game.completedTricks,
    hand: game.hands?.[uid] ?? null,
    pass: game.passSubmissions[uid] ?? null,
    turn: game.currentTurnUid,
    beforeTrickWindow: game.beforeTrickWindow,
    pendingMulanUid: game.pendingMulanUid,
    pendingPower: game.pendingPower,
    awaitingRoundAction: game.awaitingRoundAction,
    roundAction: game.roundActionSubmissions[uid] ?? null,
    roundCards: game.roundCardSubmissions[uid] ?? null,
    commitments: [game.princessCommitments[uid] ?? null, game.suitCommitments[uid] ?? null],
    actions: actions.map(actionKey)
  });
}

export class LiveBotController {
  private client: IsolatedFirebaseClient | null = null;
  private unsubscribe = () => {};
  private stopped = false;
  private processing = false;
  private latestProjection: GameProjection | null = null;
  private lastDecisionKey = '';
  private princessChoice: StoredChoice | null = null;
  private crystalChoice: StoredChoice | null = null;
  private policy: BotPolicy;
  private state: LiveBotState;

  constructor(
    private readonly options: {
      gameId: string;
      displayName: string;
      instanceId: string;
      emulatorUid?: string;
      policy?: BotPolicy;
      receiveState?: (state: LiveBotState) => void;
    }
  ) {
    this.policy = options.policy ?? createBasicRlPolicy();
    this.state = { uid: '', displayName: options.displayName, status: 'starting', detail: 'Starting RL policy' };
  }

  private update(status: LiveBotStatus, detail: string): void {
    this.state = { ...this.state, status, detail };
    this.options.receiveState?.({ ...this.state });
  }

  async start(): Promise<void> {
    if (this.client || this.stopped) return;
    this.update('starting', 'Creating isolated bot identity');
    try {
      this.client = await createIsolatedFirebaseClient(`rebel-princess-${this.options.instanceId}`, this.options.emulatorUid);
      this.state.uid = this.client.uid;
      this.update('joining', 'Joining the room');
      const game = await loadGame(this.client.database, this.options.gameId);
      if (game.hands) throw new Error('Bots may only join before cards are dealt');
      if (game.players.length >= 6 && !game.players.some((player) => player.uid === this.client?.uid)) throw new Error('The room is full');
      await appendGameEvent(this.client.database, this.options.gameId, this.client.uid, 'player/joined', { displayName: this.options.displayName });
      this.unsubscribe = subscribeToGame(
        this.client.database,
        this.options.gameId,
        (projection) => {
          this.latestProjection = projection;
          void this.pump();
        },
        (error) => this.update('error', error.message)
      );
      this.update('waiting', 'Waiting for setup');
    } catch (error) {
      this.update('error', error instanceof Error ? error.message : 'Bot could not join');
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.unsubscribe();
    this.unsubscribe = () => {};
    const client = this.client;
    this.client = null;
    if (client) await client.dispose();
    this.update('stopped', 'Bot stopped');
  }

  private async append(type: Parameters<typeof appendGameEvent>[3], payload: Parameters<typeof appendGameEvent>[4]): Promise<void> {
    if (!this.client) throw new Error('Bot identity is unavailable');
    await appendGameEvent(this.client.database, this.options.gameId, this.client.uid, type, payload);
  }

  private async revealChoices(game: GameProjection, uid: string): Promise<boolean> {
    const player = game.players.find((candidate) => candidate.uid === uid);
    if (!player) return false;
    if (!game.hands && !player.ready && game.princessCommitments[uid] && this.princessChoice && game.players.every((candidate) => game.princessCommitments[candidate.uid])) {
      this.update('choosing', 'Revealing sealed Princess');
      await this.append('player/configured', {
        princessId: this.princessChoice.choice,
        nonce: this.princessChoice.nonce,
        ready: true
      });
      return true;
    }
    if (game.awaitingRoundAction === 'reveal-suit' && game.suitCommitments[uid] && !game.revealedSuits[uid] && this.crystalChoice && game.players.every((candidate) => game.suitCommitments[candidate.uid])) {
      this.update('choosing', 'Revealing Crystal Clear suit');
      await this.append('round/suit-revealed', {
        suit: this.crystalChoice.choice as 'fairies' | 'queens' | 'princes' | 'pets',
        nonce: this.crystalChoice.nonce
      });
      return true;
    }
    return false;
  }

  private async pump(): Promise<void> {
    if (this.stopped || this.processing || !this.client) return;
    this.processing = true;
    try {
      while (this.latestProjection && !this.stopped) {
        const game = this.latestProjection;
        this.latestProjection = null;
        const uid = this.client.uid;
        if (!game.players.some((player) => player.uid === uid)) continue;
        if (await this.revealChoices(game, uid)) continue;
        let actions = legalBotActions(game, uid);
        // Freeze the roster before bots commit. The human host signals that setup
        // is final by sealing a choice; a six-seat room is necessarily final.
        if (!game.hands && Object.keys(game.princessCommitments).length === 0 && game.players.length < 6) actions = [];
        if (!actions.length) {
          this.update('waiting', game.roundComplete ? 'Waiting for the host to deal' : 'Waiting for another player');
          continue;
        }
        const key = botDecisionKey(game, uid, actions);
        if (key === this.lastDecisionKey) continue;
        this.lastDecisionKey = key;
        const random = createSeededRandom(`${game.gameId}:${uid}:${key}`);
        const decision = await this.policy.choose(buildBotObservation(game, uid), actions, random);
        const action = actions[decision.actionIndex];
        if (!action) throw new Error(`Policy ${this.policy.id} chose an invalid action`);
        this.update('acting', action.type);
        if (action.type === 'choose-princess') {
          const nonce = `${crypto.randomUUID()}${crypto.randomUUID()}`;
          this.princessChoice = { choice: action.princessId, nonce };
          await this.append('player/princess-committed', {
            commitment: choiceCommitment(princessChoiceScope(game.gameId, game.gameNumber, uid), action.princessId, nonce)
          });
        } else if (action.type === 'choose-crystal-clear-suit') {
          const nonce = `${crypto.randomUUID()}${crypto.randomUUID()}`;
          this.crystalChoice = { choice: action.suit, nonce };
          await this.append('round/suit-committed', {
            commitment: choiceCommitment(crystalClearChoiceScope(game.gameId, game.gameNumber, game.roundIndex, uid), action.suit, nonce)
          });
        } else {
          const intent = botActionToEvent(action);
          await this.append(intent.type, intent.payload);
        }
        this.update('waiting', 'Decision submitted');
      }
    } catch (error) {
      this.lastDecisionKey = '';
      this.update('error', error instanceof Error ? error.message : 'Bot decision failed');
    } finally {
      this.processing = false;
    }
  }
}
