# Little Mermaid click activation

Click the Little Mermaid and click a visible suit choice.

## Clicking the Mermaid opens the legal suit chooser

![Clicking the Mermaid opens the legal suit chooser](./screenshots/000-little-mermaid-suit-prompt-desktop.png)

**Verifications:**
- [x] The Princess button reports pressed
- [x] At least one semantic suit button is available

---

## The clicked suit becomes the shared active rule

![The clicked suit becomes the shared active rule](./screenshots/001-little-mermaid-suit-selected-desktop.png)

**Verifications:**
- [x] The power is exposed to observers
- [x] The suit chooser closes after selection

---

## The clicked suit constrains the leader’s visible cards

![The clicked suit constrains the leader’s visible cards](./screenshots/002-little-mermaid-clicks-suit-desktop.png)

**Verifications:**
- [x] Every legal lead matches the clicked suit
- [x] Observers see the Mermaid exhausted

---

## Alex clicks Fairies 3, visibly leading the requested fairies suit

![Alex clicks Fairies 3, visibly leading the requested fairies suit](./screenshots/003-little-mermaid-requested-suit-led-desktop.png)

**Verifications:**
- [x] The played card belongs to the requested suit
- [x] Every player sees the requested-suit lead in the center

---
