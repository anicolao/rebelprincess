<script lang="ts">
  import '@fontsource/atkinson-hyperlegible/latin-400.css';
  import '@fontsource/atkinson-hyperlegible/latin-700.css';
  import '@fontsource/cormorant-garamond/latin-600.css';
  import '@fontsource/cormorant-garamond/latin-700.css';
  import { base } from '$app/paths';
  import bidCoin from '../../../../assets/zombie/tokens/bid-coin.png';
  import skullToken from '../../../../assets/zombie/tokens/skull-token.png';

  const artModules = import.meta.glob('../../../../assets/zombie/{playing,princesses,rounds}/**/*.jpg', {
    eager: true,
    query: '?url',
    import: 'default'
  }) as Record<string, string>;

  function art(path: string) {
    const source = artModules[`../../../../assets/zombie/${path}`];
    if (!source) throw new Error(`Missing Zombie Princess art: ${path}`);
    return source;
  }

  const suits = [
    { id: 'villager', folder: 'villagers', name: 'Villagers', accent: '#d49a42', ink: '#3b220f' },
    { id: 'pet', folder: 'pets', name: 'Pets', accent: '#83a34f', ink: '#1a301c' },
    { id: 'knight', folder: 'knights', name: 'Knights', accent: '#6ea3b4', ink: '#132b37' },
    { id: 'prince', folder: 'princes', name: 'Princes', accent: '#a76b9d', ink: '#31162d' }
  ].map((suit) => ({
    ...suit,
    cards: Array.from({ length: 15 }, (_, index) => ({
      rank: index + 1,
      art: art(`playing/${suit.folder}/${String(index + 1).padStart(2, '0')}.jpg`)
    }))
  }));

  const princesses = [
    { slug: 'alice', name: 'Alice', power: 'Tea(m) Time', tag: 'Teams · 1× per round', text: 'Ask your partner to play a card in front of you, then give them one card in return.' },
    { slug: 'cinderella', name: 'Cinderella', power: 'Smashing Pumpkins', tag: 'Always active', text: 'When Princes are led, you do not have to follow with a Prince.' },
    { slug: 'dorothy', name: 'Dorothy', power: 'Drop a House On It', tag: '1× per round', text: 'Hide a trick you just won so it does not count, then gain 3 skulls at scoring.' },
    { slug: 'goldilocks', name: 'Goldilocks', power: 'This Bid Is Just Right', tag: 'Always active', text: 'Gain 3 skulls when your own tricks match your bid exactly.' },
    { slug: 'ice-princess', name: 'Ice Princess', power: 'Flurry Fury', tag: '1× per round', text: 'Before a trick, return one bid coin to reduce your bid by one, including to zero.' },
    { slug: 'pea-princess', name: 'Pea Princess', power: 'Pea Shooter', tag: '1× per round', text: 'Add 5 to your played card for this trick and win ties.' },
    { slug: 'rapunzel', name: 'Rapunzel', power: 'A Brush with Death', tag: '1× per round', text: 'When you win a trick with Villagers, gain one skull per Villager at scoring.' },
    { slug: 'red-riding-hood', name: 'Red Riding Hood', power: 'Axe-cessorize', tag: '1× per round', text: 'Inspect a trick you won and swap a hand card for one non-Prince in it.' },
    { slug: 'scheherazade', name: 'Scheherazade', power: 'The Pen Is Mightier', tag: '1× per round', text: 'Before the fourth trick, change your bid; changing it to zero creates a zero bid.' },
    { slug: 'sleeping-beauty', name: 'Sleeping Beauty', power: 'Spindle of Fight', tag: 'Teams · 1× per round', text: 'Before a trick, give your partner one to three cards; they return the same number.' },
    { slug: 'swan-maiden', name: 'Swan Maiden', power: '2 Birds 1 Skull', tag: 'Always active', text: 'Gain one skull for every two tricks you win.' },
    { slug: 'thumbelina', name: 'Thumbelina', power: 'Choose Your Weapon', tag: '1× per round', text: 'Play any non-Prince card, ignoring the requirement to follow suit.' }
  ].map((princess) => ({ ...princess, art: art(`princesses/${princess.slug}.jpg`) }));

  type PassDirection = 'left' | 'right';
  type PassCount = number | '½';

  type RoundSource = {
    id: string; slug: string; name: string; text: string;
    passDirection: PassDirection; passCount: PassCount; hourglass?: boolean;
  };

  const roundSources: RoundSource[] = [
    { id: 'A', slug: 'opening-night', name: 'Opening Night (of Living Dead)', text: 'No additional rule.', passDirection: 'left', passCount: 4 },
    { id: 'B', slug: 'ah-one-and-ah-two', name: 'Ah One and Ah Two', text: 'A captured 1 grants 1 skull; a captured 2 grants 2 skulls.', passDirection: 'right', passCount: 1 },
    { id: 'C', slug: 'dead-last', name: 'Dead Last', text: 'Set one card aside before play and use it in the final trick.', passDirection: 'right', passCount: 2 },
    { id: 'D', slug: 'dead-set-on-winning', name: 'Dead Set on Winning', text: 'Every trick won by someone not currently leading grants 1 skull.', passDirection: 'left', passCount: 5, hourglass: true },
    { id: 'E', slug: 'triple-tap', name: 'Triple Tap', text: 'Every captured 3 grants 1 skull.', passDirection: 'left', passCount: 5 },
    { id: 'F', slug: 'shambler-swap', name: 'Shambler Swap', text: 'After each trick, pass one card right, or to your partner in teams.', passDirection: 'right', passCount: 1 },
    { id: 'G', slug: 'brain-drain', name: 'Brain Drain', text: 'Tricks containing a Villager do not count.', passDirection: 'right', passCount: 5 },
    { id: 'H', slug: 'headhunters', name: 'Headhunters', text: 'A nonleader may wager all skulls on matching their bid exactly.', passDirection: 'left', passCount: 1, hourglass: true },
    { id: 'I', slug: 'brainpan-bonanza', name: 'Brainpan Bonanza', text: 'Gain skulls equal to the lowest printed value among cards you won.', passDirection: 'right', passCount: 4 },
    { id: 'J', slug: 'necro-narcissism', name: 'Necro Narcissism', text: 'Before play, choose one suit you hold and expose all of it.', passDirection: 'left', passCount: 2 },
    { id: 'K', slug: 'conspiratorial-corpse-crusade', name: 'Conspiratorial Corpse Crusade', text: 'Secretly show all cards of one suit to your partner, or the player on your right.', passDirection: 'right', passCount: 3 },
    { id: 'L', slug: 'revenge-of-the-living', name: 'Revenge of the Living', text: 'A leader who fails to make their bid exactly loses all skulls.', passDirection: 'right', passCount: 5, hourglass: true },
    { id: 'M', slug: 'ultimate-won-knight', name: 'Ultimate Won Knight', text: 'Gain one skull for every captured Knight.', passDirection: 'left', passCount: 2 },
    { id: 'N', slug: 'grave-new-world', name: 'Grave New World', text: 'Set aside half your hand; play the other half before picking it up.', passDirection: 'left', passCount: '½' },
    { id: 'O', slug: 'decomposing-duos', name: 'Decomposing Duos', text: 'Before each trick, nonleaders choose two cards and may play only one.', passDirection: 'right', passCount: 2 },
    { id: 'P', slug: 'a-view-to-a-kill', name: 'A View to a Kill', text: 'After passing, nonleaders inspect the player to their right’s hand.', passDirection: 'right', passCount: 4, hourglass: true },
    { id: 'Q', slug: 'skull-smashers', name: 'Skull Smashers', text: 'Double the normal skull cost for every overtrick.', passDirection: 'left', passCount: 4 },
    { id: 'R', slug: 'we-the-villagers', name: 'We the Villagers', text: 'Villagers are wild and count as the led suit.', passDirection: 'left', passCount: 1 },
    { id: 'S', slug: 'divide-and-conquer', name: 'Divide and Conquer', text: 'Set aside half your hand, then give it away after playing the first half.', passDirection: 'right', passCount: '½' },
    { id: 'T', slug: 'high-cost-of-living', name: 'High Cost of Living', text: 'Each leader’s Prince adds a skull to a pot awarded to last place.', passDirection: 'right', passCount: 3, hourglass: true },
    { id: 'U', slug: 'his-majestys-last-groan', name: 'His Majesty’s Last Groan', text: 'Give the final trick to the player on its winner’s left.', passDirection: 'left', passCount: 3 },
    { id: 'V', slug: 'undead-on-arrival', name: 'Undead on Arrival', text: 'Stop taking turns after matching your bid exactly.', passDirection: 'left', passCount: 1 },
    { id: 'W', slug: 'fester-feast', name: 'Fester Feast', text: 'Discard and total one card each; the first card above that total wins its trick.', passDirection: 'right', passCount: 4 },
    { id: 'X', slug: 'revenge-of-the-reanimated', name: 'Revenge of the Reanimated', text: 'After passing, current leaders give printed cards to last place.', passDirection: 'left', passCount: 3, hourglass: true },
    { id: 'Y', slug: 'undead-uprising', name: 'Undead Uprising', text: 'Every newly played suit becomes the led suit; Princes remain trump.', passDirection: 'right', passCount: 2 },
    { id: 'Z', slug: 'ghoulfriends', name: 'Ghoulfriends', text: 'Everyone plays twice; compare combined values and split the winning pile.', passDirection: 'left', passCount: 4 }
  ];

  const rounds = roundSources.map((round) => ({ ...round, art: art(`rounds/${round.id.toLowerCase()}-${round.slug}.jpg`) }));

  function passLabel(direction: PassDirection, count: PassCount) {
    const cards = count === '½' ? 'half your hand' : `${count} ${count === 1 ? 'card' : 'cards'}`;
    return `Pass ${cards} ${direction}`;
  }
</script>

<svelte:head>
  <title>Zombie Princess complete asset review</title>
  <meta name="description" content="Review all Zombie Princess playing cards, Princesses, round cards, and table components." />
</svelte:head>

<main data-e2e-layout>
  <header class="masthead">
    <a class="wordmark" href={`${base}/`} aria-label="Rebel Princess home"><span>Rebel</span><strong>Princess</strong></a>
    <nav aria-label="Review navigation"><a href={`${base}/assets/`}>Rebel assets</a><a href={`${base}/`}>Back to game</a></nav>
  </header>
  <span class="sr-only" role="status" data-status="synced">Ready</span>

  <section class="hero" aria-labelledby="zombie-title">
    <div class="hero-copy">
      <h1 id="zombie-title"><span>Zombie</span> Princess</h1>
      <p class="lede">60 suited cards, 12 Princesses, and 26 round cards.</p>
    </div>
    <figure class="hero-art"><img src={art('playing/princes/11.jpg')} alt="An undead prince in a ruined ballroom" /></figure>
  </section>

  <section class="gallery-section" aria-labelledby="playing-title">
    <header class="section-heading"><h2 id="playing-title">Playing cards</h2></header>
    {#each suits as suit}
      <section class="suit-family" aria-labelledby={`${suit.id}-title`} style={`--accent:${suit.accent};--ink:${suit.ink}`}>
        <header><span class={`large-suit-icon ${suit.id}`} aria-hidden="true">{suit.id === 'villager' ? '⌂' : suit.id === 'pet' ? '●' : suit.id === 'knight' ? '◆' : '♛'}</span><h3 id={`${suit.id}-title`}>{suit.name}</h3></header>
        <div class="playing-grid">
          {#each suit.cards as card}
            <article class:the-frog={suit.id === 'pet' && card.rank === 6} class="playing-card" aria-label={`${suit.name} ${card.rank}${suit.id === 'pet' && card.rank === 6 ? ', the Frog' : ''}`}>
              <img src={card.art} alt="" />
              <div class="corner"><strong>{card.rank}</strong><span aria-hidden="true">{suit.id === 'villager' ? '⌂' : suit.id === 'pet' ? '●' : suit.id === 'knight' ? '◆' : '♛'}</span></div>
              <div class="card-name">{suit.id === 'pet' && card.rank === 6 ? 'The Frog' : suit.name}</div>
            </article>
          {/each}
        </div>
      </section>
    {/each}
    <aside class="frog-note"><strong>Pet 6 · The Frog</strong><span>Its captured trick may be counted or ignored at round end.</span></aside>
  </section>

  <section class="gallery-section" aria-labelledby="princess-title">
    <header class="section-heading"><h2 id="princess-title">Princesses</h2></header>
    <div class="princess-grid">
      {#each princesses as princess}
        <article class="princess-card"><div class="princess-art"><img src={princess.art} alt={`${princess.name} character art`} /></div><div class="princess-copy"><p>{princess.name}</p><h3>{princess.power}</h3><span>{princess.text}</span><i>{princess.tag}</i></div></article>
      {/each}
    </div>
  </section>

  <section class="gallery-section" aria-labelledby="round-title">
    <header class="section-heading"><h2 id="round-title">Round cards</h2></header>
    <div class="round-grid">
      {#each rounds as round}
        <article class:hourglass={round.hourglass} class="round-card" data-round={round.id}>
          <div class="round-art"><img src={round.art} alt={`${round.name} round art`} /><strong>{round.id}</strong>{#if round.hourglass}<span class="hourglass-mark" aria-label="Black hourglass round">⧖</span>{/if}</div>
          <div class="round-copy"><h3>{round.name}</h3><p>{round.text}</p><div class="pass-row"><div class="pass-icon" aria-label={passLabel(round.passDirection, round.passCount)}>{#if round.passDirection === 'left'}<span aria-hidden="true">&#8635;</span>{/if}<strong>{round.passCount}</strong>{#if round.passDirection === 'right'}<span aria-hidden="true">&#8634;</span>{/if}</div></div></div>
        </article>
      {/each}
    </div>
  </section>

  <section class="gallery-section" aria-labelledby="economy-title">
    <header class="section-heading"><h2 id="economy-title">Tokens and bidding</h2></header>
    <div class="economy-grid">
      <article class="token-study"><img src={bidCoin} alt="Oxidized-copper bidding coin" /><div><h3>Bid coin</h3><p>Take one per expected trick. Team bids combine; zero bids stay personal.</p></div></article>
      <article class="token-study"><img src={skullToken} alt="Carved bone skull counter" /><div><h3>Skull token</h3><p>Buy missing tricks, pay for overtricks, or keep pairs for final points.</p></div></article>
      <article class="bid-panel" aria-label="Example bidding interface"><div class="bid-head"><span>Your bid</span><strong>3</strong></div><div class="bid-meter"><button type="button" aria-label="Decrease example bid">−</button><div><i></i><i></i><i></i><span></span><span></span></div><button type="button" aria-label="Increase example bid">+</button></div><div class="team-line"><span>You <b>3</b></span><span>Partner <b>2</b></span><strong>Team 5</strong></div><button class="lock-bid" type="button">Lock in 3</button></article>
    </div>
  </section>

  <section class="interface-strip" aria-labelledby="interface-title"><div><h2 id="interface-title">Phase display</h2><p>Passing leads into bidding, then tricks. Prince-break state and an unresolved Frog remain visible.</p></div><div class="phase-demo" aria-label="Example Zombie Princess phase display"><span>Round 2 of 4</span><strong>Bidding</strong><ol><li class="done">Pass</li><li class="active">Bid</li><li>Play</li><li>Score</li></ol><p><b>Princes</b> locked · <b>Frog</b> unresolved</p></div></section>
</main>

<style>
  :global(*) { box-sizing: border-box; }
  :global(html) { color-scheme: dark; background: #0d1718; font-family: 'Atkinson Hyperlegible', sans-serif; }
  :global(body) { margin: 0; min-width: 320px; min-height: 100vh; background: radial-gradient(circle at 75% 7%, rgba(131, 163, 79, .16), transparent 31rem), radial-gradient(circle at 8% 30%, rgba(91, 141, 148, .14), transparent 26rem), #0d1718; }
  :global(button), :global(a) { font: inherit; }
  main { width: min(1580px, calc(100% - clamp(28px, 5vw, 84px))); margin: 0 auto; overflow: hidden; }
  .masthead { min-height: 86px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(222, 202, 149, .24); }
  .wordmark { display: flex; align-items: baseline; gap: 7px; color: #f6e9c4; font-family: 'Cormorant Garamond', serif; font-size: 22px; text-decoration: none; }
  .wordmark strong { color: #d3a653; font-size: 31px; }
  .masthead nav { display: flex; gap: 8px; }
  .masthead nav a { padding: 7px 11px; border: 1px solid rgba(222, 202, 149, .28); border-radius: 999px; color: #eee1bd; font-size: 13px; text-decoration: none; }
  a:focus-visible, button:focus-visible { outline: 3px solid #cfe58e; outline-offset: 3px; }
  .hero { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(280px, .55fr); align-items: center; gap: clamp(30px, 7vw, 110px); min-height: min(760px, 86vh); padding: clamp(54px, 8vw, 108px) 0; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
  h1, h2, h3, p { overflow-wrap: break-word; }
  h1 { margin: 0; color: #f1dfb1; font-family: 'Cormorant Garamond', serif; font-size: clamp(72px, 11vw, 154px); font-weight: 700; line-height: .69; letter-spacing: -.045em; }
  h1 span { display: block; color: #aac85b; font-size: .67em; letter-spacing: .02em; }
  .lede { max-width: 720px; margin: 37px 0 0; color: #c0c8bd; font-size: clamp(17px, 1.7vw, 23px); line-height: 1.45; }
  .hero-art { position: relative; width: min(100%, 430px); margin: 0 auto; transform: rotate(2.5deg); }
  .hero-art::before { position: absolute; inset: -11px; content: ''; border: 1px solid rgba(214, 175, 98, .68); border-radius: 51% 51% 12px 12px; box-shadow: 0 34px 70px rgba(0, 0, 0, .48), 0 0 0 5px #172324; }
  .hero-art img { position: relative; display: block; width: 100%; aspect-ratio: 3 / 5; object-fit: cover; border-radius: 50% 50% 8px 8px; }
  .gallery-section { margin: 0 0 clamp(76px, 10vw, 140px); }
  .section-heading { margin-bottom: 33px; padding-top: 30px; border-top: 1px solid rgba(222, 202, 149, .2); }
  .section-heading h2, .interface-strip h2 { margin: 0; color: #efe1bc; font-family: 'Cormorant Garamond', serif; font-size: clamp(43px, 6vw, 72px); line-height: .86; }
  .suit-family { margin-bottom: 48px; padding: clamp(14px, 2vw, 24px); border: 1px solid color-mix(in srgb, var(--accent) 38%, transparent); border-radius: 22px; background: color-mix(in srgb, var(--ink) 52%, transparent); }
  .suit-family > header { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; color: var(--accent); }
  .suit-family > header h3 { margin: 0; color: #f0e3c2; font-family: 'Cormorant Garamond', serif; font-size: 36px; }
  .large-suit-icon { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; color: var(--ink); background: var(--accent); font-size: 27px; }
  .playing-grid { display: grid; grid-template-columns: repeat(15, minmax(0, 1fr)); gap: clamp(4px, .55vw, 9px); }
  .playing-card { position: relative; overflow: hidden; aspect-ratio: 3 / 5; padding: 4px; border: 3px solid var(--accent); border-radius: clamp(6px, .7vw, 11px); background: var(--ink); box-shadow: inset 0 0 0 1px rgba(249, 232, 188, .75), 0 8px 14px rgba(0, 0, 0, .3); }
  .playing-card img { display: block; width: 100%; height: 100%; border-radius: 4px; object-fit: cover; }
  .corner { position: absolute; top: 0; left: 0; display: grid; min-width: 35%; padding: 4px 2px; border-radius: 0 0 8px; color: var(--ink); background: var(--accent); line-height: .8; text-align: center; }
  .corner strong { font-family: 'Cormorant Garamond', serif; font-size: clamp(15px, 1.5vw, 24px); }
  .corner span { font-size: clamp(8px, .8vw, 12px); }
  .card-name { position: absolute; right: 7px; bottom: 7px; left: 7px; overflow: hidden; padding: 3px; border-radius: 999px; color: #fff0c9; background: color-mix(in srgb, var(--ink) 88%, transparent); font-family: 'Cormorant Garamond', serif; font-size: clamp(8px, .72vw, 12px); font-weight: 700; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
  .playing-card.the-frog { box-shadow: 0 0 0 3px #d9ed7d, 0 0 22px rgba(217, 237, 125, .6); }
  .frog-note { display: flex; align-items: center; gap: 16px; margin-top: -22px; padding: 16px 20px; border: 1px solid rgba(196, 222, 112, .3); border-radius: 16px; color: #b6c4b8; background: rgba(50, 78, 42, .23); }
  .frog-note strong { color: #e8f0bc; }
  .princess-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: clamp(12px, 1.8vw, 25px); }
  .princess-card { overflow: hidden; border: 2px solid rgba(247, 244, 228, .85); border-radius: 12px; background: #eae5d5; box-shadow: 0 19px 42px rgba(0, 0, 0, .34); }
  .princess-art { aspect-ratio: 666 / 1000; overflow: hidden; background: #172422; }
  .princess-art img { display: block; width: 100%; height: 100%; object-fit: contain; object-position: center; }
  .princess-copy { min-height: 190px; padding: 18px; color: #1d2a28; }
  .princess-copy p { margin: 0; color: #6d735c; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  .princess-copy h3 { margin: 3px 0 9px; color: #273a31; font-family: 'Cormorant Garamond', serif; font-size: clamp(24px, 2.5vw, 34px); line-height: .95; }
  .princess-copy span { display: block; color: #4a554f; font-size: 13px; line-height: 1.35; }
  .princess-copy i { display: inline-block; margin-top: 13px; padding: 4px 7px; border-radius: 999px; color: #e7ecc7; background: #506641; font-size: 9px; font-style: normal; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
  .round-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: clamp(12px, 1.8vw, 24px); }
  .round-card { overflow: hidden; padding: 8px; border: 5px solid #bca678; border-radius: 16px; background: #e8ddbf; box-shadow: inset 0 0 0 2px #6f6042, 0 20px 40px rgba(0, 0, 0, .35); }
  .round-art { position: relative; aspect-ratio: 1.18; overflow: hidden; border-radius: 7px 7px 2px 2px; }
  .round-art img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .round-art > strong, .hourglass-mark { position: absolute; top: 8px; display: grid; place-items: center; height: 35px; border: 1px solid #eadba9; border-radius: 50%; color: #f6e8bf; background: #263a34; font-family: 'Cormorant Garamond', serif; }
  .round-art > strong { left: 9px; width: 35px; font-size: 23px; }
  .hourglass-mark { right: 9px; width: 35px; font-size: 19px; }
  .round-copy { display: flex; flex-direction: column; min-height: 220px; padding: 15px 12px 9px; color: #29342f; }
  .round-copy h3 { margin: 0 0 8px; font-family: 'Cormorant Garamond', serif; font-size: clamp(24px, 2.4vw, 34px); line-height: .95; }
  .round-copy p { min-height: 4.1em; margin: 0; color: #535b52; font-size: 12px; line-height: 1.35; }
  .pass-row { display: flex; justify-content: center; align-items: center; margin-top: auto; padding-top: 12px; border-top: 1px solid rgba(83, 71, 45, .3); }
  .pass-icon { display: flex; justify-content: center; align-items: center; gap: 5px; color: #59684e; font-size: clamp(34px, 3.2vw, 46px); line-height: 1; }
  .pass-icon strong { font-size: .76em; }
  .round-card.hourglass { border-color: #5c5a5a; background: #d8d0bd; box-shadow: inset 0 0 0 2px #242525, 0 20px 40px rgba(0, 0, 0, .35); }
  .round-card.hourglass .round-copy { border-bottom: 11px solid #252a28; }
  .economy-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)) minmax(300px, .9fr); gap: 18px; }
  .token-study, .bid-panel { min-height: 280px; border: 1px solid rgba(222, 202, 149, .22); border-radius: 18px; background: rgba(20, 35, 34, .75); }
  .token-study { display: grid; grid-template-columns: minmax(110px, .7fr) minmax(0, 1fr); align-items: center; gap: 8px; padding: 22px; }
  .token-study > img { display: block; width: 100%; aspect-ratio: 1; object-fit: contain; }
  .token-study h3 { margin: 0; color: #eadbb0; font-family: 'Cormorant Garamond', serif; font-size: 30px; line-height: 1; }
  .token-study div > p:last-child { margin: 11px 0 0; color: #9daca2; font-size: 13px; line-height: 1.4; }
  .bid-panel { padding: 24px; }
  .bid-head { display: flex; align-items: baseline; justify-content: space-between; color: #a9b5ad; }
  .bid-head strong { color: #e0bc63; font-family: 'Cormorant Garamond', serif; font-size: 53px; line-height: .8; }
  .bid-meter { display: grid; grid-template-columns: 38px 1fr 38px; align-items: center; gap: 9px; margin: 22px 0; }
  .bid-meter button { height: 38px; border: 1px solid rgba(225, 191, 102, .35); border-radius: 50%; color: #f1dfad; background: #263c36; cursor: pointer; }
  .bid-meter > div { display: flex; justify-content: center; gap: 5px; }
  .bid-meter i, .bid-meter span { width: 15px; height: 23px; border: 2px solid #d1a649; border-radius: 50%; background: #3b2717; transform: rotate(-7deg); }
  .bid-meter span { border-color: #566961; background: transparent; }
  .team-line { display: flex; gap: 12px; padding: 12px 0; border-top: 1px solid rgba(222, 202, 149, .17); color: #87988e; font-size: 11px; }
  .team-line b { color: #e1ca8b; }
  .team-line strong { margin-left: auto; color: #c7d98a; }
  .lock-bid { width: 100%; margin-top: 15px; padding: 10px; border: 0; border-radius: 8px; color: #162019; background: #bfd269; font-weight: 700; cursor: pointer; }
  .interface-strip { display: grid; grid-template-columns: minmax(0, 1fr) minmax(330px, .8fr); align-items: center; gap: clamp(35px, 7vw, 100px); margin-bottom: 95px; padding: clamp(30px, 5vw, 62px); border: 1px solid rgba(170, 200, 91, .25); border-radius: 25px; background: linear-gradient(120deg, rgba(75, 102, 50, .17), rgba(18, 36, 36, .78)); }
  .interface-strip > div > p:last-child { max-width: 650px; color: #9ead9f; line-height: 1.5; }
  .phase-demo { padding: 22px; border: 1px solid rgba(222, 202, 149, .25); border-radius: 15px; background: rgba(8, 22, 21, .78); }
  .phase-demo > span { color: #86978c; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; }
  .phase-demo > strong { display: block; margin: 3px 0 15px; color: #c9de78; font-family: 'Cormorant Garamond', serif; font-size: 37px; }
  .phase-demo ol { display: grid; grid-template-columns: repeat(4, 1fr); margin: 0; padding: 0; list-style: none; }
  .phase-demo li { padding: 7px 4px; border-bottom: 3px solid #3c4c46; color: #75877c; font-size: 11px; text-align: center; }
  .phase-demo li.done { border-color: #69814d; color: #aab99d; }
  .phase-demo li.active { border-color: #c5dd6d; color: #eaf2c8; }
  .phase-demo p { margin: 16px 0 0; color: #7d8e83; font-size: 11px; }
  .phase-demo p b { color: #c7d7ca; }

  @media (max-width: 1100px) {
    .playing-grid { grid-template-columns: repeat(8, minmax(0, 1fr)); }
    .princess-grid, .round-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .economy-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .bid-panel { grid-column: 1 / -1; }
  }
  @media (max-width: 700px) {
    main { width: calc(100% - 24px); }
    .masthead { min-height: 70px; }
    .wordmark { flex-direction: column; gap: 0; font-size: 14px; line-height: .8; }
    .wordmark strong { font-size: 24px; }
    .masthead nav a { padding: 6px 8px; font-size: 10px; }
    .hero { display: flex; flex-direction: column; align-items: stretch; min-height: 0; padding: 56px 0 80px; }
    h1 { font-size: clamp(70px, 24vw, 110px); }
    .hero-art { width: min(78vw, 350px); margin-top: 20px; }
    .playing-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
    .playing-card { border-width: 2px; }
    .corner { min-width: 38%; }
    .frog-note { align-items: flex-start; flex-direction: column; gap: 5px; }
    .princess-grid, .round-grid, .economy-grid { grid-template-columns: 1fr; }
    .princess-copy { min-height: 190px; padding: 16px; }
    .round-copy { min-height: 210px; }
    .bid-panel { grid-column: auto; }
    .interface-strip { display: block; padding: 26px 19px; }
    .phase-demo { margin-top: 28px; }
  }
  @media (max-width: 410px) {
    .masthead nav a:first-child { display: none; }
    .playing-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .token-study { grid-template-columns: 105px 1fr; padding: 15px; }
  }
</style>
