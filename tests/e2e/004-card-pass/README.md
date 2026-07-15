# Simultaneous card passing

Early submissions reveal no incoming cards; the final submission deterministically resolves all three exact hands without losing or duplicating a card.

## The host is prompted to choose two cards for Jo

![The host is prompted to choose two cards for Jo](./screenshots/000-choose-two-cards-prompt-desktop.png)

**Verifications:**
- [x] The pass action names Jo as the recipient and is disabled until two cards are chosen
- [x] The center card states the round rule in text
- [x] The center card shows a clockwise arrow before the pass count

---

## The first chosen card rises from the hand

![The first chosen card rises from the hand](./screenshots/001-select-first-card-desktop.png)

**Verifications:**
- [x] Fairies 3 is visibly selected
- [x] One card is not enough to pass

---

## A selected card can be returned to the hand

![A selected card can be returned to the hand](./screenshots/002-unselect-first-card-desktop.png)

**Verifications:**
- [x] Fairies 3 is no longer selected
- [x] The pass action remains disabled

---

## Two selected cards enable the named pass

![Two selected cards enable the named pass](./screenshots/003-select-required-cards-desktop.png)

**Verifications:**
- [x] Both selected cards are visibly raised
- [x] The pass to Jo is now enabled

---

## Committed cards remain visible while the host waits

![Committed cards remain visible while the host waits](./screenshots/004-commit-pass-desktop.png)

**Verifications:**
- [x] The waiting message identifies Jo and the two-card left pass
- [x] The committed cards identify their destination

---

## Taking back one committed card reopens the choice

![Taking back one committed card reopens the choice](./screenshots/005-reclaim-committed-card-desktop.png)

**Verifications:**
- [x] Fairies 4 remains selected after the pass is retracted
- [x] The host must again choose a second card

---

## The revised pair is committed for Jo

![The revised pair is committed for Jo](./screenshots/006-commit-revised-pass-desktop.png)

**Verifications:**
- [x] Fairies 4 and Fairies 5 are now headed to Jo
- [x] The host waits for both other players

---

## All exact hands resolve after the final hidden submission

![All exact hands resolve after the final hidden submission](./screenshots/007-resolved-left-pass-desktop.png)

**Verifications:**
- [x] The UI reports that simultaneous passing is complete
- [x] The host’s revised pass and exact incoming cards survive reload
- [x] All 36 cards remain accounted for after resolution
- [x] Every card preserves the source atlas cell aspect ratio
- [x] The gameplay table has no horizontal or vertical scrolling
- [x] Opponent hand counts remain twelve without revealing their faces

---
