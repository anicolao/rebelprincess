# The Prince Always Rings Twice

Play one complete six-card trick in two visible laps, independently total the leading suit, inspect the winner’s six cards, and finish all six tricks.

## The Prince Always Rings Twice prints a 2-card split pass before play begins

![The Prince Always Rings Twice prints a 2-card split pass before play begins](./screenshots/000-opening-pass-prompt-desktop.png)

**Verifications:**
- [x] The center icon announces Pass 2 split
- [x] The action names Jo and Sam as the recipients
- [x] The pass cannot be committed before any card is chosen

---

## Alex clicks Fairies 2; it is assignment 1 of 2 to Jo

![Alex clicks Fairies 2; it is assignment 1 of 2 to Jo](./screenshots/001-opening-pass-select-1-desktop.png)

**Verifications:**
- [x] Exactly 1 chosen card is raised
- [x] Fairies 2 stays visibly selected
- [x] 1 more selection is still required

---

## Alex clicks Fairies 4; it is assignment 2 of 2 to Sam

![Alex clicks Fairies 4; it is assignment 2 of 2 to Sam](./screenshots/002-opening-pass-select-2-desktop.png)

**Verifications:**
- [x] Exactly 2 chosen cards are raised
- [x] Fairies 4 stays visibly selected
- [x] The complete printed pass is ready to commit

---

## Alex commits the 2 cards toward Jo and Sam while both other players are still choosing

![Alex commits the 2 cards toward Jo and Sam while both other players are still choosing](./screenshots/003-opening-pass-committed-desktop.png)

**Verifications:**
- [x] All 2 outgoing cards remain visible and raised
- [x] The waiting message preserves the printed split direction
- [x] No incoming cards arrive before every player commits

---

## Jo commits next; Alex still sees the cards held until Sam makes the final decision

![Jo commits next; Alex still sees the cards held until Sam makes the final decision](./screenshots/004-opening-pass-one-waiting-desktop.png)

**Verifications:**
- [x] Exactly one other player remains
- [x] Alex can still identify every outgoing card

---

## Sam commits last; all three split transfers resolve simultaneously and play can begin

![Sam commits last; all three split transfers resolve simultaneously and play can begin](./screenshots/005-opening-pass-resolved-desktop.png)

**Verifications:**
- [x] Every player again holds twelve cards
- [x] Alex receives the exact split incoming cards
- [x] The table leaves the simultaneous pass phase for play or the Round card’s next action

---

## The center announces two cards per player, summed only in the leading suit with a highest-card tie-break

![The center announces two cards per player, summed only in the leading suit with a highest-card tie-break](./screenshots/006-rings-ready-desktop.png)

**Verifications:**
- [x] The exact double-play rule is readable
- [x] All players begin with twelve cards

---

## The first clockwise lap places Fairies 5, Fairies 2, Fairies 3 in the center without resolving the trick

![The first clockwise lap places Fairies 5, Fairies 2, Fairies 3 in the center without resolving the trick](./screenshots/007-rings-first-lap-desktop.png)

**Verifications:**
- [x] Three actual card graphics remain in the current trick
- [x] No trick counter increments after only one lap

---

## The second lap completes six cards; Alex has the greatest Fairies sum (then highest-card tie-break) and receives the trick

![The second lap completes six cards; Alex has the greatest Fairies sum (then highest-card tie-break) and receives the trick](./screenshots/008-rings-second-lap-desktop.png)

**Verifications:**
- [x] All six graphics are visible during collection
- [x] The trick counter awards Alex

---

## Alex opens the six-card capture so both cards from every player can be recomputed

![Alex opens the six-card capture so both cards from every player can be recomputed](./screenshots/009-rings-reviewed-desktop.png)

**Verifications:**
- [x] The review contains all six played cards
- [x] Each hand has ten cards after two plays

---

## Five more six-card tricks consume all hands and reveal normal round scoring

![Five more six-card tricks consume all hands and reveal normal round scoring](./screenshots/010-rings-complete-desktop.png)

**Verifications:**
- [x] Exactly six tricks were awarded
- [x] Round one scoring is visible

---
