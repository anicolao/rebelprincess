import { readFile } from 'node:fs/promises';
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, it } from 'vitest';

let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'rebel-princess-e2e',
    firestore: { rules: await readFile('firestore.rules', 'utf8') }
  });
});

afterAll(async () => {
  await environment.cleanup();
});

describe('closed foundation rules', () => {
  it('denies reads and writes before the event protocol opens', async () => {
    const firestore = environment.authenticatedContext('foundation-player').firestore();
    const probe = doc(firestore, 'health', 'readiness');

    await assertFails(getDoc(probe));
    await assertFails(setDoc(probe, { ready: true }));
  });
});
