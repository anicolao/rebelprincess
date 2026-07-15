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

    await this.page.mouse.move(0, 0);
    await this.page.evaluate(async () => {
      const finiteAnimations = document.getAnimations().filter((animation) => {
        const timing = animation.effect?.getTiming();
        return timing?.iterations !== Infinity && timing?.duration !== Infinity;
      });
      await Promise.all(finiteAnimations.map((animation) => animation.finished));

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
    await expect(this.page).toHaveScreenshot(filename);

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
