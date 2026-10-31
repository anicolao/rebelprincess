# Bot baseline and promotion report

This repository has three live bot difficulties:

- **Easy** uses the modular heuristic with 30% seeded exploration.
- **Standard** uses the deterministic modular heuristic.
- **Learned** uses a sparse outcome-trained residual on top of Standard.

## Learned v2 promotion

The v2 policy was tuned in 2,420 deterministic full games. Its six learned
residuals improve passing and the Haggle, Mulan, and Pocahontas decisions while
leaving Standard's other decisions unchanged. Training used isolated decision
families so an improvement in one rule could not hide a regression in another.

Promotion uses a separate seed set and rotates Learned through every seat at
three, four, five, and six players. Round sets and Princess assignments rotate
through the complete catalogs. Positive differential means Learned received
fewer proposals than its Standard opponents. Promotion requires at least 120
games, a win rate above 50%, and a positive lower bound for the 95% confidence
interval.

The `combined-holdout-v2` holdout result is:

| Policy | Games | Wins | Ties | Losses | Win rate | Mean differential | 95% CI |
|---|---:|---:|---:|---:|---:|---:|---:|
| Learned v2 vs Standard | 1,800 | 1,006 | 30 | 764 | 55.89% | +0.9217 | +0.4015 to +1.4419 |

This satisfies every promotion condition. The earlier `basic-rl-2000` model did
not: on a 60-game Standard comparison it averaged −3.625 with 26 wins and 34
losses.

Run a fresh promotion matrix from the development shell:

```sh
bun run benchmark:bot -- --mode promotion --seeds 100 --seed combined-holdout-v2
```

The command performs 1,800 five-round games. A faster smoke run can use fewer
seeds, but its confidence interval is not a replacement for the checked-in
promotion result.

The original random-opponent regression remains available separately:

```sh
bun run benchmark:bot -- --mode random-baseline --seeds 20 --seed bot-baseline-v1
```
