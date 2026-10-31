# Bot difficulty, removal, and complete learned-bot play

A human host selects and removes an Easy bot, then fills the room with two independently authenticated Learned bots, reloads their controllers, and finishes all five rounds with them.

## The host chooses a difficulty and can remove a bot before setup locks

![The host chooses a difficulty and can remove a bot before setup locks](./screenshots/000-bot-controls-desktop.png)

**Verifications:**
- [x] Easy is the selected difficulty for the next bot
- [x] The Easy bot joined through its own authenticated controller
- [x] The host can remove the bot while Princess choices are still open

---

## Two trained bots join and seal their own Princess choices

![Two trained bots join and seal their own Princess choices](./screenshots/001-bots-ready-desktop.png)

**Verifications:**
- [x] The guest list contains one human and two separately named RL bots
- [x] Every seat is ready after the bots complete sealed Princess commit and reveal
- [x] Both live controllers report that they are waiting for gameplay

---

## The learned policy passes cards and plays whenever its seat owns the action

![The learned policy passes cards and plays whenever its seat owns the action](./screenshots/002-bots-play-desktop.png)

**Verifications:**
- [x] The simultaneous pass resolves without either bot retracting its submission
- [x] The human receives a playable turn after autonomous bot decisions
- [x] Every seat still owns exactly twelve cards after the conserved pass

---

## Reloading the host reconstructs both bot controllers without changing the game

![Reloading the host reconstructs both bot controllers without changing the game](./screenshots/003-bots-recovered-desktop.png)

**Verifications:**
- [x] Both independently authenticated bot controllers are restored
- [x] The host returns to the same playable turn with the same twelve-card hand
- [x] Both bot seats remain present after replay

---

## The recovered bots finish the first trick and advance to the next human decision

![The recovered bots finish the first trick and advance to the next human decision](./screenshots/004-first-trick-complete-desktop.png)

**Verifications:**
- [x] The table advances to trick two without another human driving the bot seats
- [x] The human played exactly one card in the completed trick
- [x] Both independently controlled bot seats remain at the table

---

## The recovered learned bots finish all five rounds with the human host

![The recovered learned bots finish all five rounds with the human host](./screenshots/005-full-game-complete-desktop.png)

**Verifications:**
- [x] Every one of the five rounds has an immutable score column
- [x] All 180 dealt cards were legally played through the shared stream
- [x] The game reports a final winner or shared victory
- [x] Both recovered bot controllers remain healthy at game end

---
