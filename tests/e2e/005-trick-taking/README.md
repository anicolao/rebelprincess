# Base trick-taking loop

Three trustworthy clients play complete synchronized tricks through follow-suit, void, Prince-breaking, capture, and winner-led transitions.

## The leader may play non-Princes but cannot lead an unbroken Prince

![The leader may play non-Princes but cannot lead an unbroken Prince](./screenshots/000-leader-legal-cards-desktop.png)

**Verifications:**
- [x] Alex is prompted to lead the first trick
- [x] A Prince is disabled before the suit is broken
- [x] A Fairy is a legal opening lead

---

## Every client sees the lead and Jo must follow suit

![Every client sees the lead and Jo must follow suit](./screenshots/001-observer-sees-lead-desktop.png)

**Verifications:**
- [x] The shared trick shows Alex’s Fairy 4
- [x] Jo can follow with a Fairy
- [x] Jo cannot discard an off-suit Prince while holding Fairies

---

## A void player may discard a Prince and break the suit

![A void player may discard a Prince and break the suit](./screenshots/002-void-breaks-princes-desktop.png)

**Verifications:**
- [x] Jo has no Fairies remaining and may play a Prince
- [x] The current trick is synchronized through Alex’s lead

---

## The trick winner leads again and may now lead Princes

![The trick winner leads again and may now lead Princes](./screenshots/003-winner-leads-broken-prince-desktop.png)

**Verifications:**
- [x] Alex has captured two complete tricks
- [x] Prince 4 is enabled after the suit was broken
- [x] The fourth trick is ready for the previous winner

---
