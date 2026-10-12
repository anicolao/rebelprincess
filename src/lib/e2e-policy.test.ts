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
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
  const workflow = readFileSync(join(process.cwd(), '.github/workflows/ci-and-deploy.yml'), 'utf8');

  it('keeps the global deterministic rendering and timing contract', () => {
    expect(config).toMatch(/retries:\s*0\b/);
    expect(config).toMatch(/forbidOnly:\s*true\b/);
    expect(config).toMatch(/actionTimeout:\s*2000\b/);
    expect(config).toMatch(/expect:\s*\{\s*timeout:\s*2000\b/);
    expect(config).toMatch(
      /toHaveScreenshot:\s*\{[\s\S]*?threshold:\s*0\b[\s\S]*?maxDiffPixels:\s*0\b/
    );
    expect(config.match(/\bmaxDiffPixels\s*:/g)).toHaveLength(1);
    expect(config.match(/\bmaxDiffPixels\s*:\s*0\b/g)).toHaveLength(1);
    expect(config.match(/\bthreshold\s*:/g)).toHaveLength(1);
    expect(config.match(/\bthreshold\s*:\s*0\b/g)).toHaveLength(1);
    expect(config).not.toMatch(
      /\b(?:maxDiffPixelRatio|mask|maskColor|stylePath|ignoreSnapshots|updateSnapshots|testIgnore|grepInvert|grep|shard)\s*:/
    );
    expect(config).toMatch(/fullPage:\s*true\b/);
  });

  it('runs the ordinary strict suite in CI without snapshot-update flags', () => {
    expect(packageJson.scripts['test:e2e']).toMatch(/\bplaywright test"?$/);
    expect(packageJson.scripts['test:e2e']).not.toMatch(/update[-_]snapshots/i);
    expect(workflow).toMatch(/run:\s*nix develop --command bun run test:e2e\b/);
    expect(workflow).not.toMatch(/update[-_]snapshots/i);
  });

  it.each([
    ['screenshot masks', /\bmask(?:Color)?\s*:/],
    ['per-screenshot diff tolerances', /\b(?:maxDiffPixels|maxDiffPixelRatio|threshold)\s*:/],
    ['screenshot-only styles or clipping', /\b(?:stylePath|clip)\s*:/],
    ['manual screenshots', /\.screenshot\s*\(/],
    ['ignored or focused tests', /\b(?:(?:test|describe)(?:\.describe)?\.(?:skip|fixme|only|fail)|fit|fdescribe|xit|xdescribe)\s*\(/],
    ['conditional CI behavior', /\bprocess\.env\.(?:CI|GITHUB_ACTIONS)\b/],
    ['arbitrary waits', /\b(?:waitForTimeout|setTimeout|sleep)\s*\(/],
    ['explicit timeout overrides', /\b(?:timeout\s*:|test\.setTimeout\s*\(|test\.slow\s*\()/],
    ['retry-dependent behavior', /\b(?:testInfo\.retry|retries\s*:|repeatEach\s*:)/],
    ['soft assertions', /\bexpect\.soft\s*\(/],
    ['forced or synthetic actions', /\b(?:force\s*:\s*true|dispatchEvent\s*\()/]
  ])('contains no %s', (_label, forbidden) => {
    const violations = sources
      .filter(({ source }) => forbidden.test(source))
      .map(({ path }) => path.replace(`${process.cwd()}/`, ''));
    expect(violations).toEqual([]);
  });
});
