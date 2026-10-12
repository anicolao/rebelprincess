import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function typeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return typeScriptFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('E2E policy', () => {
  const sources = typeScriptFiles(join(process.cwd(), 'tests/e2e')).map((path) => ({
    path,
    source: readFileSync(path, 'utf8')
  }));
  const config = readFileSync(join(process.cwd(), 'playwright.config.ts'), 'utf8');

  it('keeps the global deterministic rendering and timing contract', () => {
    expect(config).toMatch(/retries:\s*0\b/);
    expect(config).toMatch(/forbidOnly:\s*true\b/);
    expect(config).toMatch(/actionTimeout:\s*2000\b/);
    expect(config).toMatch(/expect:\s*\{\s*timeout:\s*2000\b/);
    expect(config).toMatch(/toHaveScreenshot:\s*\{[\s\S]*?maxDiffPixels:\s*0\b/);
  });

  it.each([
    ['screenshot masks', /\bmask(?:Color)?\s*:/],
    ['screenshot diff tolerances', /\b(?:maxDiffPixels|maxDiffPixelRatio|threshold)\s*:/],
    ['manual screenshots', /\.screenshot\s*\(/],
    ['ignored or focused tests', /\b(?:(?:test|describe)(?:\.describe)?\.(?:skip|fixme|only|fail)|fit|fdescribe|xit|xdescribe)\s*\(/],
    ['conditional CI behavior', /\bprocess\.env\.(?:CI|GITHUB_ACTIONS)\b/],
    ['arbitrary waits', /\b(?:waitForTimeout|setTimeout|sleep)\s*\(/],
    ['explicit timeout overrides', /\btimeout\s*:/],
    ['forced or synthetic actions', /\b(?:force\s*:\s*true|dispatchEvent\s*\()/]
  ])('contains no %s', (_label, forbidden) => {
    const violations = sources
      .filter(({ source }) => forbidden.test(source))
      .map(({ path }) => path.replace(`${process.cwd()}/`, ''));
    expect(violations).toEqual([]);
  });
});
