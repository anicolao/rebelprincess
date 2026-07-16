# Base trick-taking loop

Three trustworthy clients play complete synchronized tricks through follow-suit, void, Prince-breaking, capture, and winner-led transitions.

## The leader may play non-Princes but cannot lead an unbroken Prince

![The leader may play non-Princes but cannot lead an unbroken Prince](./screenshots/000-leader-legal-cards-desktop.png)

**Verifications:**
- [x] Alex is prompted to lead the first trick
- [x] Every client identifies Alex as the leader
- [x] Every client sees the remaining players clockwise in play order
- [x] The leader sees a prominent highlighted lead badge
- [x] A Prince is disabled before the suit is broken
- [x] A Fairy is a legal opening lead

---

## Every client sees the lead; Jo is visibly void while Sam must follow suit

![Every client sees the lead; Jo is visibly void while Sam must follow suit](./screenshots/001-observer-sees-lead-desktop.png)

**Verifications:**
- [x] The shared trick shows Alex’s Fairy 6
- [x] The played card uses the Fairies atlas graphic and visible value
- [x] The played card animates from the hand into the table
- [x] Jo has no Fairies and may discard a Prince
- [x] Sam holds Fairies and cannot discard an off-suit Prince

---

## The completed trick pauses on the table, sweeps toward its winner, and remains available for review

![The completed trick pauses on the table, sweeps toward its winner, and remains available for review](./screenshots/002-winner-collects-and-reviews-trick-desktop.png)

**Verifications:**
- [x] Alex’s trick counter records the captured trick
- [x] Tapping the counter reveals the most recently captured cards
- [x] The collection uses the requested three-second ease-in-out motion

---

## Jo’s void discard broke Princes, so the trick winner may immediately lead one

![Jo’s void discard broke Princes, so the trick winner may immediately lead one](./screenshots/003-winner-leads-broken-prince-desktop.png)

**Verifications:**
- [x] Alex captured the complete opening trick
- [x] Prince 4 is enabled after the suit was broken
- [x] The second trick is ready for the previous winner

---
