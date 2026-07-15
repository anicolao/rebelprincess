# Rebel Princess rules summary

This is an implementation-oriented summary of the second-edition base rules,
not a replacement for the published rulebook. Round cards and Princess powers
override the base rules and need their own precise specifications before the
game is implemented.

## Goal

Rebel Princess is a trick-taking game for 3–6 players. Over five rounds, avoid
capturing marriage proposals. After round five, the player with the fewest total
proposals wins.

## Cards and setup

The suited deck has four suits—Fairies, Queens, Princes, and Pets—with cards
numbered 1–12. Pet 8 is the Frog.

- 3 players: remove ranks 1, 11, and 12 from every suit (36 cards).
- 4 or 5 players: remove ranks 11 and 12 from every suit (40 cards).
- 6 players: use all ranks (48 cards).

Shuffle and deal the entire deck equally. Each player selects a distinct
Princess with a once-per-round power. Choose five Round cards and order them;
each supplies the special rule and card-pass instruction for one round.

## A round

1. Reveal the round's Round card and apply its effect.
2. Each player simultaneously chooses and passes the indicated cards in the
   indicated direction. Choose outgoing cards before looking at incoming cards.
3. Play tricks until all hands are empty.
4. Score captured proposal cards.
5. Shuffle and redeal for the next round, refresh exhausted Princess powers,
   and reveal the next Round card. The winner of the previous round's final
   trick leads the new round.

## Playing a trick

The leader plays one card face up. In clockwise order, every other player plays
one card. A player who holds the led suit must follow suit; a player who does not
may play any card. The highest-ranked card of the led suit wins. The winner
captures the trick face down and leads the next trick. Captured cards cannot be
consulted until scoring at the end of the round.

Princes may not lead a trick until a Prince has been discarded by a player who
could not follow suit. The Frog does not break the Prince suit. Once broken,
Princes may lead for the rest of that round. A player holding only Princes may
lead one even if the suit has not yet been broken.

## Princess powers

A player may use their Princess power at most once per round, at the time stated
on that Princess. Mark the Princess exhausted after use; all Princesses refresh
at the end of the round. For teaching games, Princess powers may be omitted.

Precedence for resolving conflicts should be specified as Princess power, then
Round card, then base rules. Individual powers and Round cards require an edge-
case specification before coding.

## Scoring and winning

At the end of each round:

- Every captured Prince is 1 proposal.
- The captured Frog (Pet 8) is 5 proposals.
- Apply any scoring change on the current Round card.

Add the round score to each player's running total. After five rounds, the
lowest total wins. Break a tie in favor of the tied player with more rounds in
which they scored zero proposals; if still tied, share the victory.

## Edition note

The Deluxe Edition changes and expands content, including additional Princesses
and Round cards and a “Rebel of the Ball” catch-up rule. The first implementation
must choose and version one edition explicitly instead of mixing content from
different rulebooks. This summary starts from the earlier second-edition rules.

## Source

Published second-edition English rulebook:
https://zombipaella.com/wp-content/uploads/2024/02/rebelprincess-ed02_rulebook_en.pdf
