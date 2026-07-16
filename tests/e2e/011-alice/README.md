# Alice click activation

Click every card until Alice wins a Frog-free trick, then click Alice.

## Alice has won a reviewable Frog-free trick

![Alice has won a reviewable Frog-free trick](./screenshots/000-frog-free-trick-won-desktop.png)

**Verifications:**
- [x] Alice’s power button is semantically enabled
- [x] The captured trick contains three card records and no Frog

---

## Alice is clicked and the won trick leaves her captured collection

![Alice is clicked and the won trick leaves her captured collection](./screenshots/001-alice-card-clicked-desktop.png)

**Verifications:**
- [x] Alice’s card is semantically disabled after use
- [x] Alice’s captured trick counter decreases

---

## After ordinary clicked play, clicking Alice returns the won cards

![After ordinary clicked play, clicking Alice returns the won cards](./screenshots/002-alice-clicks-return-trick-desktop.png)

**Verifications:**
- [x] Every player receives one returned card
- [x] Alice is visibly exhausted

---
