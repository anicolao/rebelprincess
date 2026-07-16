# Arranged Marriage

Reveal the trickless penalty, play all 36 cards through the UI, and compare a trickless player’s five proposals with a player who captured a trick.

## Arranged Marriage prints a 2-card split pass before play begins

![Arranged Marriage prints a 2-card split pass before play begins](./screenshots/000-opening-pass-prompt-desktop.png)

**Verifications:**
- [x] The center icon announces Pass 2 split
- [x] The action names Jo and Sam as the recipients
- [x] The pass cannot be committed before any card is chosen

---

## Alex clicks Fairies 5; it is assignment 1 of 2 to Jo

![Alex clicks Fairies 5; it is assignment 1 of 2 to Jo](./screenshots/001-opening-pass-select-1-desktop.png)

**Verifications:**
- [x] Exactly 1 chosen card is raised
- [x] Fairies 5 stays visibly selected
- [x] 1 more selection is still required

---

## Alex clicks Fairies 10; it is assignment 2 of 2 to Sam

![Alex clicks Fairies 10; it is assignment 2 of 2 to Sam](./screenshots/002-opening-pass-select-2-desktop.png)

**Verifications:**
- [x] Exactly 2 chosen cards are raised
- [x] Fairies 10 stays visibly selected
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

## Arranged Marriage warns that ending the round without a trick costs five proposals

![Arranged Marriage warns that ending the round without a trick costs five proposals](./screenshots/006-marriage-rule-ready-desktop.png)

**Verifications:**
- [x] The exact trickless penalty is printed
- [x] Every player begins with zero captured tricks

---

## Sam captured no tricks and receives the visible five-proposal Round penalty

![Sam captured no tricks and receives the visible five-proposal Round penalty](./screenshots/007-marriage-penalty-scored-desktop.png)

**Verifications:**
- [x] Sam still has zero captured tricks
- [x] The scoring row contains the +5 Round rule modifier
- [x] At least one player with a captured trick avoids that modifier

---
