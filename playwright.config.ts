import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5184',
    trace: 'retain-on-failure',
    contextOptions: { reducedMotion: 'reduce' },
    serviceWorkers: 'block',
    deviceScaleFactor: 1,
    timezoneId: 'America/Toronto',
    locale: 'en-CA',
    actionTimeout: 2000,
    launchOptions: {
      args: [
        '--font-render-hinting=none',
        '--disable-font-subpixel-positioning',
        '--disable-lcd-text',
        '--disable-skia-runtime-opts',
        '--disable-system-font-check',
        '--disable-features=FontAccess,WebRtcHideLocalIpsWithMdns',
        '--force-device-scale-factor=1',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--use-gl=swiftshader',
        '--disable-smooth-scrolling',
        '--disable-partial-raster'
      ]
    }
  },
  snapshotPathTemplate: '{testDir}/{testFileDir}/screenshots/{arg}{ext}',
  projects: [
    {
      name: 'phone',
      use: { browserName: 'chromium', viewport: { width: 393, height: 852 } }
    },
    {
      name: 'desktop',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 1000 } }
    }
  ],
  webServer: {
    command: 'bun run dev:e2e',
    url: 'http://127.0.0.1:5184',
    reuseExistingServer: false,
    env: {
      VITE_FIREBASE_API_KEY: 'e2e-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'rebel-princess-e2e.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'rebel-princess-e2e',
      VITE_FIREBASE_STORAGE_BUCKET: 'rebel-princess-e2e.firebasestorage.app',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '123456789',
      VITE_FIREBASE_APP_ID: '1:123456789:web:e2e',
      VITE_USE_FIREBASE_EMULATORS: 'true',
      VITE_FIRESTORE_EMULATOR_HOST: '127.0.0.1',
      VITE_FIRESTORE_EMULATOR_PORT: '8185',
      VITE_FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1',
      VITE_FIREBASE_AUTH_EMULATOR_PORT: '9199',
      VITE_GIT_HASH: 'e2e-test-commit'
    }
  },
  // A production-size five-round game performs 180 observable Firestore-backed
  // card plays. This is only the runner's whole-test safety ceiling; actions
  // and assertions retain the strict two-second synchronization ceiling below.
  timeout: 150000,
  expect: {
    timeout: 2000,
    toHaveScreenshot: {
      // Transient effects are settled by TestStepHelper and UI icons use
      // bundled vectors, so every committed pixel is expected to match.
      maxDiffPixels: 0,
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      scale: 'css'
    }
  }
});
