# Bot baseline

This repository has three live bot difficulties:

- **Easy** uses the modular heuristic with 30% seeded exploration.
- **Standard** uses the deterministic modular heuristic.
- **Learned** uses the checked-in linear reinforcement-learning policy.

The benchmark rotates one challenger through every seat against random-legal
opponents. Each match is a deterministic five-round game, and positive score
differential means the challenger scored fewer proposals than its opponents.

Run the baseline from the development shell:

```sh
bun run benchmark:bot -- --seeds 20 --seed bot-baseline-v1
```

The initial `bot-baseline-v1` report is:

| Policy | Games | Wins | Ties | Losses | Mean score differential |
|---|---:|---:|---:|---:|---:|
| Standard (`heuristic-standard-v1`) | 60 | 51 | 0 | 9 | +12.125 |
| Learned (`basic-rl-2000`) | 60 | 49 | 0 | 11 | +10.2 |

This is a regression baseline, not a general strength claim. It uses the
representative five-Round set and random opponents. Promotion to a stronger bot
still requires a larger paired matrix over player counts, Princess assignments,
Round combinations, and fixed historical opponents.
