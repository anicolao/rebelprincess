import { readFile } from 'node:fs/promises';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, it } from 'vitest';

let environment: RulesTestEnvironment;
const path = 'games/MOON42/events/host-0000000001';

function validEvent(actorUid = 'host') {
  return {
    type: 'game/created',
    payload: { gameId: 'MOON42', displayName: 'Alex' },
    actorUid,
    clientSeq: 1,
    createdAt: serverTimestamp(),
    schemaVersion: 1,
    reducerVersion: 1
  };
}

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'rebel-princess-e2e',
    firestore: { rules: await readFile('firestore.rules', 'utf8') }
  });
});

afterAll(async () => environment.cleanup());

describe('append-only game event rules', () => {
  it('lets a signed-in actor append a valid event and read the shared stream', async () => {
    const host = environment.authenticatedContext('host').firestore();
    await assertSucceeds(setDoc(doc(host, path), validEvent()));
    await assertSucceeds(getDoc(doc(host, path)));
  });

  it('denies unauthenticated reads and actor spoofing', async () => {
    const guest = environment.authenticatedContext('guest').firestore();
    await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), path)));
    await assertFails(setDoc(doc(guest, 'games/MOON42/events/spoof'), validEvent('host')));
  });

  it('denies malformed, mismatched, and out-of-schema events', async () => {
    const host = environment.authenticatedContext('host').firestore();
    await assertFails(setDoc(doc(host, 'games/MOON42/events/wrong-game'), {
      ...validEvent(), payload: { gameId: 'OTHER', displayName: 'Alex' }
    }));
    await assertFails(setDoc(doc(host, 'games/MOON42/events/extra'), {
      ...validEvent(), secret: 'not in the envelope'
    }));
  });

  it('accepts configuration and complete deal payloads from their actors', async () => {
    const host = environment.authenticatedContext('host').firestore();
    await assertSucceeds(setDoc(doc(host, 'games/MOON42/events/host-config'), {
      ...validEvent(), type: 'player/configured', payload: { gameId: 'MOON42', princessId: 'snow-white', ready: true }
    }));
    await assertSucceeds(setDoc(doc(host, 'games/MOON42/events/host-deal'), {
      ...validEvent(), type: 'game/dealt', payload: {
        gameId: 'MOON42', seed: 'fixed-003', roundIds: ['a', 'b', 'c', 'd', 'e'],
        hands: { host: [{ suit: 'fairies', rank: 2 }] }
      }
    }));
    await assertSucceeds(setDoc(doc(host, 'games/MOON42/events/host-pass'), {
      ...validEvent(), type: 'pass/submitted', payload: {
        gameId: 'MOON42', cards: [{ suit: 'fairies', rank: 2 }, { suit: 'princes', rank: 4 }]
      }
    }));
    await assertSucceeds(setDoc(doc(host, 'games/MOON42/events/host-retract'), {
      ...validEvent(), type: 'pass/retracted', payload: { gameId: 'MOON42' }
    }));
    await assertSucceeds(setDoc(doc(host, 'games/MOON42/events/host-play'), {
      ...validEvent(), type: 'card/played', payload: { gameId: 'MOON42', card: { suit: 'pets', rank: 8 } }
    }));
    await assertSucceeds(setDoc(doc(host, 'games/MOON42/events/host-rematch'), {
      ...validEvent(), type: 'game/rematched', payload: { gameId: 'MOON42' }
    }));
    await assertSucceeds(setDoc(doc(host, 'games/MOON42/events/host-power'), {
      ...validEvent(), type: 'power/activated', payload: { gameId: 'MOON42', powerId: 'pocahontas', targetUid: 'guest' }
    }));
    await assertSucceeds(setDoc(doc(host, 'games/MOON42/events/host-decline'), {
      ...validEvent(), type: 'power/declined', payload: { gameId: 'MOON42', powerId: 'mulan' }
    }));
    await assertSucceeds(setDoc(doc(host, 'games/MOON42/events/host-contribution'), {
      ...validEvent(), type: 'power/contributed', payload: { gameId: 'MOON42', powerId: 'sleeping-beauty', card: { suit: 'fairies', rank: 2 } }
    }));
    await assertSucceeds(setDoc(doc(host, 'games/MOON42/events/host-interactive-power'), {
      ...validEvent(), type: 'power/activated', payload: { gameId: 'MOON42', powerId: 'little-mermaid', suit: 'queens', cards: [{ suit: 'pets', rank: 3 }] }
    }));
  });

  it('never permits mutation or deletion of an existing event', async () => {
    const host = environment.authenticatedContext('host').firestore();
    await assertFails(updateDoc(doc(host, path), { 'payload.displayName': 'Changed' }));
    await assertFails(deleteDoc(doc(host, path)));
  });
});
