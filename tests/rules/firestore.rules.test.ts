import { readFile } from 'node:fs/promises';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, it } from 'vitest';

let environment: RulesTestEnvironment;
const path = 'games/MOON42/events/host-0000000001';

function attributedEvent(actorUid = 'host') {
  return {
    actorUid,
    type: 'anything/the-trusted-client-understands',
    payload: { any: 'shape', nested: { values: [1, true, null] } }
  };
}

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'rebel-princess-e2e',
    firestore: { rules: await readFile('firestore.rules', 'utf8') }
  });
});

afterAll(async () => environment.cleanup());

describe('append-only game stream rules', () => {
  it('lets a signed-in actor append arbitrary game data and read the shared stream', async () => {
    const host = environment.authenticatedContext('host').firestore();
    await assertSucceeds(setDoc(doc(host, path), attributedEvent()));
    await assertSucceeds(getDoc(doc(host, path)));
  });

  it('does not validate current or future action types and payload shapes', async () => {
    const host = environment.authenticatedContext('host').firestore();
    await assertSucceeds(setDoc(doc(host, 'games/MOON42/events/late-ball'), {
      actorUid: 'host', type: 'round/card-set-aside', payload: { card: { suit: 'queens', rank: 7 } }
    }));
    await assertSucceeds(setDoc(doc(host, 'games/MOON42/events/future-action'), {
      actorUid: 'host', futureProtocolField: { deliberately: ['unrecognized'] }
    }));
  });

  it('denies unauthenticated access and actor spoofing', async () => {
    const guest = environment.authenticatedContext('guest').firestore();
    const anonymous = environment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonymous, path)));
    await assertFails(setDoc(doc(anonymous, 'games/MOON42/events/anonymous'), attributedEvent('')));
    await assertFails(setDoc(doc(guest, 'games/MOON42/events/spoof'), attributedEvent('host')));
  });

  it('never permits mutation or deletion of an existing event', async () => {
    const host = environment.authenticatedContext('host').firestore();
    await assertFails(updateDoc(doc(host, path), { payload: { changed: true } }));
    await assertFails(deleteDoc(doc(host, path)));
  });

  it('denies every path outside a game event stream', async () => {
    const host = environment.authenticatedContext('host').firestore();
    await assertFails(setDoc(doc(host, 'games/MOON42'), attributedEvent()));
    await assertFails(setDoc(doc(host, 'players/host'), attributedEvent()));
  });
});
