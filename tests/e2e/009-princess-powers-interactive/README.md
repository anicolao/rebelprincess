# Interactive Princess powers

Five deterministic games exercise suit requests, forced cards, hand swaps, multiplayer contributions, redistribution, and trick returns through real clients and Firestore.

## The Little Mermaid requires the leader to play a chosen suit

![The Little Mermaid requires the leader to play a chosen suit](./screenshots/000-little-mermaid-requests-suit-desktop.png)

**Verifications:**
- [x] Every legal lead uses the requested suit
- [x] Observers see the active power and exhausted card

---

## The Ice Princess inspects two cards and freezes one for its owner

![The Ice Princess inspects two cards and freezes one for its owner](./screenshots/001-ice-princess-freezes-card-desktop.png)

**Verifications:**
- [x] Only the chosen frozen card is playable for Jo
- [x] The Ice Princess is visibly exhausted

---

## Scheherazade exchanges a random card from another hand for one of hers

![Scheherazade exchanges a random card from another hand for one of hers](./screenshots/002-scheherazade-barters-card-desktop.png)

**Verifications:**
- [x] The inspected card enters Scheherazade’s hand
- [x] The card she gave away leaves her hand and hand sizes remain conserved

---

## Every player contributes and Sleeping Beauty assigns every card

![Every player contributes and Sleeping Beauty assigns every card](./screenshots/003-sleeping-beauty-redistributes-cards-desktop.png)

**Verifications:**
- [x] Sleeping Beauty keeps the first selected contribution
- [x] Jo and Sam receive their explicitly ordered cards

---

## Alice shuffles a Frog-free trick she won back into all hands

![Alice shuffles a Frog-free trick she won back into all hands](./screenshots/004-alice-returns-won-trick-desktop.png)

**Verifications:**
- [x] Every player receives exactly one returned card
- [x] Alice’s captured trick counter decreases and her card exhausts

---
