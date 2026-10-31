import { defineConfig } from '@playwright/test';

const scenarioIds = Array.from({ length: 54 }, (_, index) =>
  String(index + 1).padStart(3, '0')
);

function scenarioProjects(name: 'phone' | 'desktop', viewport: { width: number; height: number }) {
  return scenarioIds.map((id) => ({
    name,
    testMatch: new RegExp(`${id}-.*\\.spec\\.ts`),
    use: { browserName: 'chromium' as const, viewport }
  }));
}

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
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
  // Repeated display names preserve viewport-based game IDs and snapshot names.
  // Each tracer bullet is its own project so Playwright starts it with a fresh
  // renderer instead of carrying glyph/image caches across unrelated games.
  projects: [
    ...scenarioProjects('phone', { width: 393, height: 852 }),
    ...scenarioProjects('desktop', { width: 1280, height: 1000 })
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
  timeout: 240000,
  expect: {
    timeout: 2000,
    toHaveScreenshot: {
      // Transient effects are settled by TestStepHelper and UI icons use
      // bundled vectors, so every channel of every committed pixel must match.
      threshold: 0,
      maxDiffPixels: 0,
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      scale: 'css'
    }
  }
});
