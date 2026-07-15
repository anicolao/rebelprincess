# Direct Princess powers

Five deterministic games activate Snow White, Cinderella, Pocahontas, Mulan, and the Pea Princess through real clients and the append-only Firestore stream.

## Snow White turns her chosen low card into zero

![Snow White turns her chosen low card into zero](./screenshots/000-snow-white-zero-desktop.png)

**Verifications:**
- [x] The actual card remains visible with an effective value of zero
- [x] The observer sees Snow White’s card tilted and desaturated for this round

---

## Cinderella reverses the hierarchy for one complete trick

![Cinderella reverses the hierarchy for one complete trick](./screenshots/001-cinderella-reverses-rank-desktop.png)

**Verifications:**
- [x] All clients see Cinderella tilted and desaturated after the trick resolves
- [x] The completed trick is awarded under the lower-card hierarchy

---

## Pocahontas hands the lead to another player

![Pocahontas hands the lead to another player](./screenshots/002-pocahontas-chooses-leader-desktop.png)

**Verifications:**
- [x] Jo receives the prominent local lead indicator
- [x] Every client sees Pocahontas tilted, desaturated, and unavailable

---

## The Pea Princess requires a card above five when one is legal

![The Pea Princess requires a card above five when one is legal](./screenshots/003-pea-princess-requires-high-cards-desktop.png)

**Verifications:**
- [x] Every highlighted legal choice is above five
- [x] The active rule and exhausted Princess card are visible to observers

---

## Mulan replaces her played card after everyone commits

![Mulan replaces her played card after everyone commits](./screenshots/004-mulan-swaps-played-card-desktop.png)

**Verifications:**
- [x] The original played card returns to Mulan’s hand
- [x] The replacement is the actual card shown in the resolved trick
- [x] All clients see Mulan tilted and desaturated after the swap

---
