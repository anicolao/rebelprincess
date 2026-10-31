# Playable reinforcement-learning bots

A human host fills an otherwise empty room with two independently authenticated RL bots, then deals, passes, and completes a trick with them.

## Two trained bots join and seal their own Princess choices

![Two trained bots join and seal their own Princess choices](./screenshots/000-bots-ready-desktop.png)

**Verifications:**
- [x] The guest list contains one human and two separately named RL bots
- [x] Every seat is ready after the bots complete sealed Princess commit and reveal
- [x] Both live controllers report that they are waiting for gameplay

---

## The learned policy passes cards and plays whenever its seat owns the action

![The learned policy passes cards and plays whenever its seat owns the action](./screenshots/001-bots-play-desktop.png)

**Verifications:**
- [x] The simultaneous pass resolves without either bot retracting its submission
- [x] The human receives a playable turn after autonomous bot decisions
- [x] Every seat still owns exactly twelve cards after the conserved pass

---

## The bots finish the first trick and advance to the next human decision

![The bots finish the first trick and advance to the next human decision](./screenshots/002-first-trick-complete-desktop.png)

**Verifications:**
- [x] The table advances to trick two without another human driving the bot seats
- [x] The human played exactly one card in the completed trick
- [x] Both independently controlled bot seats remain at the table

---
