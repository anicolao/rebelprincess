import { chromium, type FullConfig } from '@playwright/test';

export default async function waitForRenderedApplication(config: FullConfig) {
  const browser = await chromium.launch(config.projects[0].use.launchOptions);
  const page = await browser.newPage();
  try {
    await page.goto(String(config.projects[0].use.baseURL));
    await page.getByTestId('build-marker').waitFor();
    await page.getByText('Firebase emulator ready', { exact: true }).waitFor();
  } finally {
    await browser.close();
  }
}
