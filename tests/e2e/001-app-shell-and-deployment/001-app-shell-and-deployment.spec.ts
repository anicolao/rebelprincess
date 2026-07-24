import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('application shell reaches Firebase and renders deterministically', async ({ page }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Application shell and Firebase readiness',
    'The static client loads its original card artwork and reaches the local Firestore emulator.'
  );

  await page.goto('/');
  await steps.step('firebase-ready', {
    description: 'The ball is ready for the first players',
    verifications: [
      {
        spec: 'The page has the stable Rebel Princess title',
        check: async () => {
          await expect(page).toHaveTitle('Rebel Princess — Live card play');
        }
      },
      {
        spec: 'The landing page exposes its primary heading',
        check: async () => {
          await expect(page.getByRole('heading', { level: 1 })).toHaveText(
            'The ball is almost ready.'
          );
        }
      },
      {
        spec: 'The client has reached the Firestore emulator',
        check: async () => {
          await expect(page.getByRole('status')).toHaveText('Firebase emulator ready');
        }
      },
      {
        spec: 'The exact deterministic build marker is visible',
        check: async () => {
          await expect(page.getByTestId('build-marker')).toHaveText('Build e2e-test-commit');
        }
      },
      {
        spec: 'The alternate artwork preview grid is loaded',
        check: async () => {
          await expect(page.locator('.alternate-preview-grid')).toBeVisible();
          await expect(page.locator('.alternate-preview-card')).toHaveCount(4);
        }
      }
    ]
  });

  steps.generateDocs();
});
