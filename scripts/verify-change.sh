#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${IN_NIX_SHELL:-}" ]]; then
  if ! command -v nix >/dev/null 2>&1; then
    echo "Verification requires Nix. Install Nix and retry." >&2
    exit 1
  fi
  exec nix develop --command bun run verify:change
fi

echo "Checking staged and unstaged patches..."
git diff --cached --check
git diff --check

echo "Checking Firestore rules in the emulator..."
bun run test:rules

# Before the application tracer bullet, src/ did not exist. From that increment
# onward, a missing verification script is an error rather than a skipped check.
if [[ ! -d src ]]; then
  echo "Application source is not scaffolded; application checks begin when src/ exists."
  exit 0
fi

required_scripts=(check test:unit test:rules test:e2e build)

for script in "${required_scripts[@]}"; do
  if ! bun -e "const p = await Bun.file('package.json').json(); process.exit(p.scripts?.['${script}'] ? 0 : 1)"; then
    echo "Required package script is missing: ${script}" >&2
    exit 1
  fi
done

echo "Running static checks..."
bun run check

echo "Running unit tests..."
bun run test:unit

echo "Running the complete E2E suite..."
bun run test:e2e

echo "Building the production client..."
bun run build
