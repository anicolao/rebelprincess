import { describe, expect, it } from 'vitest';
import { readFirebaseConfig } from './firebase-config';

const completeEnvironment = {
  VITE_FIREBASE_API_KEY: 'api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'example.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'example',
  VITE_FIREBASE_STORAGE_BUCKET: 'example.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '123',
  VITE_FIREBASE_APP_ID: '1:123:web:example'
};

describe('readFirebaseConfig', () => {
  it('maps the public Vite environment to Firebase options', () => {
    expect(readFirebaseConfig(completeEnvironment)).toEqual({
      apiKey: 'api-key',
      authDomain: 'example.firebaseapp.com',
      projectId: 'example',
      storageBucket: 'example.firebasestorage.app',
      messagingSenderId: '123',
      appId: '1:123:web:example'
    });
  });

  it('reports every missing option', () => {
    expect(() => readFirebaseConfig({})).toThrow(
      'Missing Firebase configuration: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID'
    );
  });
});
