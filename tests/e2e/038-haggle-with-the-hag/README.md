# Haggle with the Hag

Complete a trick, select an offer in the winner’s real hand, take an opponent’s played card, and inspect both sides of the exchange.

## Haggle with the Hag prints a 1-card left pass before play begins

![Haggle with the Hag prints a 1-card left pass before play begins](./screenshots/000-opening-pass-prompt-desktop.png)

**Verifications:**
- [x] The center icon announces Pass 1 left
- [x] The action names Jo as the recipient
- [x] The pass cannot be committed before any card is chosen

---

## Alex clicks Fairies 2; it is assignment 1 of 1 to Jo

![Alex clicks Fairies 2; it is assignment 1 of 1 to Jo](./screenshots/001-opening-pass-select-1-desktop.png)

**Verifications:**
- [x] Exactly 1 chosen card is raised
- [x] Fairies 2 stays visibly selected
- [x] The complete printed pass is ready to commit

---

## Alex commits the 1 cards toward Jo while both other players are still choosing

![Alex commits the 1 cards toward Jo while both other players are still choosing](./screenshots/002-opening-pass-committed-desktop.png)

**Verifications:**
- [x] All 1 outgoing cards remain visible and raised
- [x] The waiting message preserves the printed left direction
- [x] No incoming cards arrive before every player commits

---

## Jo commits next; Alex still sees the cards held until Sam makes the final decision

![Jo commits next; Alex still sees the cards held until Sam makes the final decision](./screenshots/003-opening-pass-one-waiting-desktop.png)

**Verifications:**
- [x] Exactly one other player remains
- [x] Alex can still identify every outgoing card

---

## Sam commits last; all three left transfers resolve simultaneously and play can begin

![Sam commits last; all three left transfers resolve simultaneously and play can begin](./screenshots/004-opening-pass-resolved-desktop.png)

**Verifications:**
- [x] Every player again holds twelve cards
- [x] Alex receives the exact left incoming card
- [x] The table leaves the simultaneous pass phase for play or the Round card’s next action

---

## The round card explains that a winner may trade for a captured card other than their own play

![The round card explains that a winner may trade for a captured card other than their own play](./screenshots/005-haggle-ready-desktop.png)

**Verifications:**
- [x] The exact swap restriction is readable
- [x] No haggle controls appear before a trick is won

---

## Alex wins the visible trick and receives the exclusive offer-or-decline controls

![Alex wins the visible trick and receives the exclusive offer-or-decline controls](./screenshots/006-haggle-winner-chooses-desktop.png)

**Verifications:**
- [x] Only the winner sees Haggle controls
- [x] All other clients explicitly wait for the winner

---

## Alex clicks Fairies 5 as the visible offer; the two opponent-played cards become the only legal takes

![Alex clicks Fairies 5 as the visible offer; the two opponent-played cards become the only legal takes](./screenshots/007-haggle-offer-selected-desktop.png)

**Verifications:**
- [x] The offer is named in the controls
- [x] Exactly two take buttons exclude the winner’s own played card

---

## Alex takes Fairies 2 into hand and Fairies 5 replaces it in the captured trick

![Alex takes Fairies 2 into hand and Fairies 5 replaces it in the captured trick](./screenshots/008-haggle-swapped-desktop.png)

**Verifications:**
- [x] The taken card is now in the winner’s hand and the offer is gone
- [x] The captured review contains the offered card instead of the taken card
- [x] The winner can now lead the next trick

---
