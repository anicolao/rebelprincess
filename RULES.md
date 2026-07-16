# Rebel Princess rules summary

This is an implementation-oriented summary using the Deluxe Edition setup and
round-lead rules,
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

Shuffle and deal the entire deck equally. At the start of the game, deal two
Princesses to each player; each player chooses one and keeps it for all five
rounds. Princess powers refresh between rounds, but Princesses are not chosen
again. Choose five Round cards and order them;
each supplies the special rule and card-pass instruction for one round.

## A round

1. Reveal the round's Round card and apply its effect.
2. Each player simultaneously chooses and passes the indicated cards in the
   indicated direction. Choose outgoing cards before looking at incoming cards.
3. Play tricks until all hands are empty.
4. Score captured proposal cards.
5. Shuffle and redeal for the next round, refresh exhausted Princess powers,
   and reveal the next Round card. The player with the lowest cumulative score
   leads. If several players tie for lowest, start immediately clockwise after
   the previous round's leader and take the first tied player encountered.

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

The first implemented direct powers follow the Deluxe rules:

- **Snow White — Seven Dwarfs:** when playing, she may exhaust her power to
  treat a card numbered 7 or lower as having value 0. Its printed suit and
  number do not change for following-suit requirements.
- **Cinderella — Everything Changes at Midnight:** before a trick, she may
  reverse its rank hierarchy so the lowest card of the led suit wins.
- **Pocahontas — Wilderness Guide:** before a trick, she may choose any player
  to lead that trick.
- **Mulan — Camouflage:** after a trick's last card is played, she may exchange
  her played card for a card of
  the same suit from her hand; the Frog cannot be exchanged. Resolve the trick
  using the replacement.
- **The Pea Princess — Five More Minutes!:** before a trick, she may require
  every player to play a card above 5 whenever one is available among that
  player's otherwise legal choices. Following suit still takes precedence.

The interactive powers follow these Deluxe rules:

- **The Little Mermaid — Hypnotic Song:** before a trick, choose a suit the
  leader must play if they hold it. An unopened Prince suit cannot be compelled
  unless the leader holds only Princes.
- **Sleeping Beauty — The Spindle of Fate:** before a trick, every player
  contributes one visible card. Sleeping Beauty keeps one and assigns each
  remaining card to a different other player.
- **Alice — Cheshire’s Challenge:** after winning a trick that contains no
  Frog, shuffle that trick and deal one card back into every player’s hand.
  Any Princes in that trick remain considered broken.
- **Scheherazade — Barter in the Bazaar:** before a trick, inspect one random
  card from another player. Either exchange it for a card from her own hand or
  return it.
- **The Ice Princess — Freezing:** before a trick, inspect two random cards from
  any player, return one, and place the other in front of its owner. That card
  must be their next play even when it violates follow-suit or another ordinary
  play restriction; choosing a Prince breaks Princes.
- **Rapunzel — Royal Hair Climb:** before a trick, require the player with the
  lead to lead a Prince if they hold one, even when Princes have not yet snuck
  into the party. This play does not itself allow Princes to be led later.
- **Thumbelina — Ignorance is Bliss:** when she is not leading, she may play any
  card except a Prince or the Frog without following suit.

## Deluxe Round cards

The selectable deck contains the official twenty-six a–z Deluxe Round cards.
Each card also supplies its printed opening-pass instruction.

- **Once Upon a Time…:** no additional rule.
- **Late to the Ball:** after the opening pass, set aside one card face down;
  return it as its owner’s only card for the final trick.
- **Magic Beans:** when following a suit, play only its highest or lowest card.
- **Three Times a Lady:** each 3 scores −3 proposals, so Prince 3 scores −2 net.
- **Arranged Marriage:** a player who captures no tricks scores +5 proposals.
- **Royal Decree:** Queens are trump; the highest Queen played wins.
- **Always the Bridesmaid:** the second-highest led-suit card wins.
- **Crystal Clear:** after passing, choose a suit and reveal every card of that
  suit in your hand for the round.
- **Masquerade Ball:** followers play face down, then reveal together.
- **Pets’ Revenge:** every captured Pet scores +1 proposal, including the Frog.
- **Musical Chairs:** after each non-final trick, simultaneously pass one card
  face down to the player on the right.
- **Sisterhood:** the card numerically farthest from the lead value wins.
- **After Party:** split the hand into equal chosen halves and finish the first
  half before picking up the second.
- **Late for a Very Important Date:** keep and score the final three hand cards.
- **Wedding Gift:** before each trick, every player contributes one face-down
  card to a gift pile captured by that trick’s winner.
- **Haggle with the Hag:** a trick winner may exchange one shown hand card for
  any card in that trick except their own play.
- **Blind Man’s Bluff:** after playing half a hand, pass the remaining half to
  the player on the right to play.
- **Poisoned Apple:** a void player wins; highest void value wins, with the
  earliest play breaking an exact tie.
- **Odds and Evens:** follow suit and the lead card’s parity when possible; suit
  has priority, and a void player follows parity when possible.
- **Single Fairy:** every captured Fairy removes one proposal; scores may be
  negative.
- **The Prince Always Rings Twice:** play two cards per trick and sum led-suit
  values; highest led-suit card breaks a tied sum.
- **Midnight Makeover:** Fairies are wild for following suit and for winning;
  the latest play breaks a tied highest value.
- **Pass the Bouquet:** every newly introduced suit becomes the led suit; the
  highest card of the last introduced suit wins.
- **Upside Down:** every played 6 toggles the rank hierarchy for that trick.
- **Bathroom Break:** Princes score double except for each player tied for the
  highest cumulative score before the round.
- **Dancing Queens:** pair captured Princes and Queens. A same-value pair scores
  3, a mismatched pair 2, and an unpaired Prince 1; unpaired Queens score 0.

## Scoring and winning

At the end of each round:

- Every captured Prince is 1 proposal.
- The captured Frog (Pet 8) is 5 proposals.
- Apply any scoring change on the current Round card.

If one player captures every Prince present in the player-count deck and the
Frog, they are the **Rebel of the Ball** and score exactly −10 for the round,
ignoring all other additions or subtractions that would affect them. Other
players retain their ordinary Round-card scoring. The achievement cannot be
earned during Wedding Gift because proposal cards in gift piles are not won as
ordinary trick cards.

Add the round score to each player's running total. After five rounds, the
lowest total wins. Break a tie in favor of the tied player with more rounds in
which they scored zero proposals; if still tied, share the victory.

## Edition note

This implementation uses the complete Deluxe roster of twelve Princesses,
twenty-six Round cards, and Rebel of the Ball. The removed non-Deluxe
**Invitation** ID remains understood only when replaying an older event stream;
it is not available when creating a new game.

## Source

Published Deluxe Edition English rulebook:
https://cdn.shopify.com/s/files/1/0740/4855/files/RPDX_Online_Rules_Preview.pdf
