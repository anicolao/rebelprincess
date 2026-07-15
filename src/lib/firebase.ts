import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  type Firestore
} from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { readFirebaseConfig } from './firebase-config';

let database: Firestore | undefined;

function firebaseDatabase(): Firestore {
  if (database) return database;

  const config = readFirebaseConfig(import.meta.env);
  const app = getApps().length === 0 ? initializeApp(config) : getApp();
  database = getFirestore(app);

  if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
    connectFirestoreEmulator(
      database,
      import.meta.env.VITE_FIRESTORE_EMULATOR_HOST ?? '127.0.0.1',
      Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT ?? '8085')
    );
  }

  return database;
}

export async function probeFirebase(): Promise<'emulator' | 'production'> {
  try {
    await getDoc(doc(firebaseDatabase(), 'health', 'readiness'));
  } catch (error) {
    // A permission-denied response proves the configured Firestore endpoint is
    // reachable while production rules intentionally remain closed.
    if (!(error instanceof FirebaseError) || error.code !== 'permission-denied') {
      throw error;
    }
  }

  return import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' ? 'emulator' : 'production';
}
