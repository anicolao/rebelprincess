import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signInWithCustomToken,
  signInAnonymously,
  type Auth,
  type User
} from 'firebase/auth';
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
let authentication: Auth | undefined;

export function firebaseDatabase(): Firestore {
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

export function firebaseAuth(): Auth {
  if (authentication) return authentication;
  firebaseDatabase();
  authentication = getAuth(getApp());
  if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
    connectAuthEmulator(
      authentication,
      `http://${import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1'}:${import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT ?? '9099'}`,
      { disableWarnings: true }
    );
  }
  return authentication;
}

function emulatorCustomToken(uid: string): string {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object) => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600,
    iss: 'rebel-princess-e2e@rebel-princess-e2e.iam.gserviceaccount.com',
    sub: 'rebel-princess-e2e@rebel-princess-e2e.iam.gserviceaccount.com',
    uid
  })}.`;
}

export async function ensureAnonymousIdentity(emulatorUid?: string): Promise<User> {
  const auth = firebaseAuth();
  if (auth.currentUser) return auth.currentUser;
  const existing = await new Promise<User | null>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
  if (existing) return existing;
  if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' && emulatorUid) {
    return (await signInWithCustomToken(auth, emulatorCustomToken(emulatorUid))).user;
  }
  return (await signInAnonymously(auth)).user;
}

export async function probeFirebase(emulatorUid?: string): Promise<'emulator' | 'production'> {
  await ensureAnonymousIdentity(emulatorUid);
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
