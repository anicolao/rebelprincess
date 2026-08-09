import { expect, type Page, type TestInfo } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface Verification {
  spec: string;
  check: () => Promise<void>;
}

export interface StepOptions {
  description: string;
  verifications: Verification[];
  networkStatus?: 'synced' | 'offline' | 'error' | 'skip';
}

interface DocStep {
  title: string;
  image: string;
  specs: string[];
}

export class TestStepHelper {
  private stepCount = 0;
  private steps: DocStep[] = [];
  private metadataTitle = '';
  private metadataDescription = '';

  constructor(
    private page: Page,
    private testInfo: TestInfo
  ) {}

  setMetadata(title: string, description: string) {
    this.metadataTitle = title;
    this.metadataDescription = description;
  }

  async step(id: string, options: StepOptions) {
    for (const verification of options.verifications) {
      await verification.check();
    }

    const expectedStatus = options.networkStatus ?? 'synced';
    if (expectedStatus !== 'skip') {
      await expect(this.page.locator('[role="status"][data-status]')).toHaveAttribute(
        'data-status',
        expectedStatus
      );
    }

    // Documentation captures describe the settled game state. Power bursts
    // are asserted separately, then allowed to clear before they can obscure
    // the board or make a screenshot depend on timer scheduling.
    await expect(
      this.page.locator('.princess-power-burst, .table-board.power-flash')
    ).toHaveCount(0, { timeout: 3000 });

    await this.page.mouse.move(0, 0);
    await this.page.evaluate(async () => {
      // A remote projection can replace a just-rendered card between frames.
      // Finish finite animations over consecutive frames so a replacement
      // cannot leave a capture at the enlarged animation start state.
      for (let pass = 0; pass < 3; pass += 1) {
        const finiteAnimations = document.getAnimations().filter((animation) => {
          const timing = animation.effect?.getTiming();
          return timing?.iterations !== Infinity && timing?.duration !== Infinity;
        });
        for (const animation of finiteAnimations) {
          try {
            animation.finish();
          } catch {
            // A detached animation can disappear while the projection updates.
          }
        }
        if (pass < 2) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
      }

      for (const element of document.querySelectorAll<HTMLElement>('[data-e2e-layout] *')) {
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (
          rect.left < -1 ||
          rect.right > window.innerWidth + 1
        ) {
          throw new Error(
            `${element.tagName}.${element.className} is outside ${window.innerWidth}x${window.innerHeight}`
          );
        }
      }
    });

    const paddedIndex = String(this.stepCount++).padStart(3, '0');
    const filename = `${paddedIndex}-${id.replaceAll('_', '-')}-${this.testInfo.project.name}.png`;
    // Firestore can replace an element after the settling loop and start a new
    // entrance animation immediately before Playwright captures the page. Keep
    // trick-card entrance motion at its final keyframe for the entire capture,
    // then restore it so scenarios can continue to exercise and assert the real
    // animation. Retaining the keyframe avoids changing its rendered pixels.
    const settledMotionStyle = await this.page.addStyleTag({
      content: `
        @media (min-width: 1000px) {
          [data-e2e-layout] .trick-card {
            animation-delay: -1s !important;
          }
        }
      `
    });
    try {
      await this.page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }));
      await expect(this.page).toHaveScreenshot(filename);
    } finally {
      await settledMotionStyle.evaluate((style) => style.parentNode?.removeChild(style)).catch(() => {});
    }

    this.steps.push({
      title: options.description,
      image: `./screenshots/${filename}`,
      specs: options.verifications.map((verification) => verification.spec)
    });
  }

  generateDocs() {
    if (this.testInfo.project.name !== 'desktop') return;

    const testDirectory = path.dirname(this.testInfo.file);
    let content = `# ${this.metadataTitle}\n\n${this.metadataDescription}\n\n`;

    for (const step of this.steps) {
      content += `## ${step.title}\n\n`;
      content += `![${step.title}](${step.image})\n\n`;
      content += '**Verifications:**\n';
      for (const specification of step.specs) content += `- [x] ${specification}\n`;
      content += '\n---\n\n';
    }

    fs.writeFileSync(path.join(testDirectory, 'README.md'), `${content.trimEnd()}\n`);
  }
}
