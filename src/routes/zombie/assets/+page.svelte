<script lang="ts">
  import '@fontsource/atkinson-hyperlegible/latin-400.css';
  import '@fontsource/atkinson-hyperlegible/latin-700.css';
  import '@fontsource/cormorant-garamond/latin-600.css';
  import '@fontsource/cormorant-garamond/latin-700.css';
  import { base } from '$app/paths';
  import bidCoin from '../../../../assets/zombie/concepts/bid-coin.png';
  import frog from '../../../../assets/zombie/concepts/frog.jpg';
  import dorothy from '../../../../assets/zombie/concepts/princess-dorothy.jpg';
  import goldilocks from '../../../../assets/zombie/concepts/princess-goldilocks.jpg';
  import redRidingHood from '../../../../assets/zombie/concepts/princess-red-riding-hood.jpg';
  import brainDrain from '../../../../assets/zombie/concepts/round-brain-drain.jpg';
  import hourglassComeback from '../../../../assets/zombie/concepts/round-hourglass-comeback.jpg';
  import openingNight from '../../../../assets/zombie/concepts/round-opening-night.jpg';
  import skullToken from '../../../../assets/zombie/concepts/skull-token.png';
  import knight from '../../../../assets/zombie/concepts/suit-knight.jpg';
  import pet from '../../../../assets/zombie/concepts/suit-pet.jpg';
  import prince from '../../../../assets/zombie/concepts/suit-prince.jpg';
  import villager from '../../../../assets/zombie/concepts/suit-villager.jpg';

  const suits = [
    { id: 'villager', name: 'Villagers', rank: 11, art: villager, accent: '#d49a42', ink: '#3b220f', alt: 'A friendly zombie village baker in a warm night market' },
    { id: 'pet', name: 'Pets', rank: 11, art: pet, accent: '#83a34f', ink: '#1a301c', alt: 'A scrappy zombie rabbit companion in an overgrown moonlit garden' },
    { id: 'knight', name: 'Knights', rank: 11, art: knight, accent: '#6ea3b4', ink: '#132b37', alt: 'An undead knight standing guard in blue moonlight' },
    { id: 'prince', name: 'Princes', rank: 11, art: prince, accent: '#a76b9d', ink: '#31162d', alt: 'A charming zombie prince in a ruined ballroom' }
  ] as const;

  const princesses = [
    { name: 'Red Riding Hood', power: 'Axe-cessorize', art: redRidingHood, alt: 'Red Riding Hood as an adult forest ranger with a practical axe', text: 'At the start of your turn, swap a hand card for a non-Prince in one trick you previously won.' },
    { name: 'Dorothy', power: 'Drop a House On It', art: dorothy, alt: 'Dorothy as an adult storm-country engineer with a house-shaped hammer', text: 'Hide a trick you just won so it does not count, then gain 3 skulls at scoring.' },
    { name: 'Goldilocks', power: 'This Bid Is Just Right', art: goldilocks, alt: 'Goldilocks as an adult survivalist with a cast-iron pan shield', text: 'Always active: gain 3 skulls when your own tricks match your bid exactly.' }
  ] as const;

  const rounds = [
    { id: 'A', name: 'Opening Night', art: openingNight, alt: 'A moonlit village theater opening while friendly zombies arrive', tag: 'First-game round', text: 'No additional rule. The pass instruction still applies.' },
    { id: 'G', name: 'Brain Drain', art: brainDrain, alt: 'Glowing thoughts stream away from a comic zombie crowd', tag: 'Trick modifier', text: 'Tricks containing a Villager do not count toward the bid.' },
    { id: '⧖', name: 'Final-round study', art: hourglassComeback, alt: 'A dramatic hourglass surrounded by skulls and an underdog rebellion', tag: 'Black hourglass', text: 'A frame direction for one of the catch-up rules used only in round four.' }
  ] as const;
</script>

<svelte:head>
  <title>Zombie Princess component study</title>
  <meta name="description" content="Review the proposed Zombie Princess card art and interface components." />
</svelte:head>

<main data-e2e-layout>
  <header class="masthead">
    <a class="wordmark" href={`${base}/`} aria-label="Rebel Princess home"><span>Rebel</span><strong>Princess</strong></a>
    <nav aria-label="Review navigation">
      <a href={`${base}/assets/`}>Rebel assets</a>
      <a href={`${base}/`}>Back to game</a>
    </nav>
  </header>

  <section class="hero" aria-labelledby="zombie-title">
    <div class="hero-copy">
      <p class="eyebrow">Variant art direction · concept set 01</p>
      <h1 id="zombie-title"><span>Zombie</span> Princess</h1>
      <p class="lede">A storybook resistance after dark: adventurous, theatrical, a little macabre, and never gory. This review combines borderless source art with deterministic component frames.</p>
      <div class="status" role="status" data-status="synced"><i aria-hidden="true"></i><strong>13 concept images</strong><span>not a production atlas</span></div>
    </div>
    <figure class="hero-art">
      <img src={prince} alt="Zombie Prince concept art in a ruined ballroom" />
      <figcaption>Bruised plum · moonlit teal · oxidized copper</figcaption>
    </figure>
  </section>

  <section class="gallery-section playing-section" aria-labelledby="playing-title">
    <header class="section-heading">
      <div><p class="eyebrow">60-card deck</p><h2 id="playing-title">Four suit families</h2></div>
      <p>One code-owned frame, four emblem and color systems. The art has no baked border, rank, or suit mark.</p>
    </header>
    <div class="playing-grid">
      {#each suits as suit}
        <article class="playing-card" style={`--accent:${suit.accent};--ink:${suit.ink}`}>
          <div class="card-rank top"><strong>{suit.rank}</strong><span class={`suit-icon ${suit.id}`} aria-label={suit.name}>
            {#if suit.id === 'villager'}
              <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 15 16 5l11 10v12H19v-8h-6v8H5Z" /></svg>
            {:else if suit.id === 'pet'}
              <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="9" cy="10" r="4"/><circle cx="16" cy="7" r="4"/><circle cx="23" cy="10" r="4"/><path d="M7 22c0-6 4-10 9-10s9 4 9 10c0 4-3 6-9 6s-9-2-9-6Z"/></svg>
            {:else if suit.id === 'knight'}
              <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3 27 7v8c0 7-4 12-11 15C9 27 5 22 5 15V7Zm0 6-5 2v5c0 3 2 6 5 8 3-2 5-5 5-8v-5Z" /></svg>
            {:else}
              <svg viewBox="0 0 32 32" aria-hidden="true"><path d="m4 10 7 6 5-10 5 10 7-6-3 16H7Zm4 19h16v-3H8Z" /></svg>
            {/if}
          </span></div>
          <div class="playing-art"><img src={suit.art} alt={suit.alt} /></div>
          <div class="suit-name"><span>{suit.name}</span></div>
          <div class="card-rank bottom" aria-hidden="true"><strong>{suit.rank}</strong></div>
        </article>
      {/each}
    </div>
    <div class="frog-row">
      <article class="playing-card frog-card">
        <div class="card-rank top"><strong>6</strong><span class="frog-mark" aria-hidden="true">●</span></div>
        <div class="playing-art"><img src={frog} alt="A living heroic frog resistance fighter with a sword and shield" /></div>
        <div class="suit-name"><span>The Frog · Pets</span></div>
        <div class="card-rank bottom" aria-hidden="true"><strong>6</strong></div>
      </article>
      <div class="frog-copy">
        <p class="eyebrow">Special card</p>
        <h3>One trick. Your choice.</h3>
        <p>Keep a captured trick containing the Frog face up. At round end, choose whether it counts toward your bid.</p>
        <span class="rule-chip">Princess → Frog → Round rule</span>
      </div>
    </div>
  </section>

  <section class="gallery-section" aria-labelledby="princess-title">
    <header class="section-heading">
      <div><p class="eyebrow">Player identity</p><h2 id="princess-title">Princess powers</h2></div>
      <p>Thin quiet edge, portrait-first composition, and rules rendered as live text for legibility at every size.</p>
    </header>
    <div class="princess-grid">
      {#each princesses as princess}
        <article class="princess-card">
          <div class="princess-art"><img src={princess.art} alt={princess.alt} /></div>
          <div class="princess-copy">
            <p>{princess.name}</p>
            <h3>{princess.power}</h3>
            <span>{princess.text}</span>
            <i aria-label="Once per round">1×</i>
          </div>
        </article>
      {/each}
    </div>
  </section>

  <section class="gallery-section" aria-labelledby="round-title">
    <header class="section-heading">
      <div><p class="eyebrow">Four-round arc</p><h2 id="round-title">Round rules</h2></div>
      <p>A warmer beige frame keeps event cards distinct from the playing deck; the black-hourglass family gets a dark final-round band.</p>
    </header>
    <div class="round-grid">
      {#each rounds as round}
        <article class:hourglass={round.id === '⧖'} class="round-card">
          <div class="round-art"><img src={round.art} alt={round.alt} /><strong>{round.id}</strong></div>
          <div class="round-copy"><span>{round.tag}</span><h3>{round.name}</h3><p>{round.text}</p><div class="pass-strip"><b>PASS</b><i>←</i><i>2</i><i>→</i></div></div>
        </article>
      {/each}
    </div>
  </section>

  <section class="gallery-section economy-section" aria-labelledby="economy-title">
    <header class="section-heading">
      <div><p class="eyebrow">Bidding and economy</p><h2 id="economy-title">Table components</h2></div>
      <p>The physical vocabulary carries into compact, readable controls without imitating photographed tokens.</p>
    </header>
    <div class="economy-grid">
      <article class="token-study">
        <div class="token-image coin"><img src={bidCoin} alt="An embossed oxidized-copper bidding coin with a closed-hand emblem" /></div>
        <div><p class="eyebrow">Bid coin</p><h3>Predict the tricks</h3><p>Take one coin per expected trick. Team bids combine, but zero bids stay personal.</p></div>
      </article>
      <article class="token-study">
        <div class="token-image skull"><img src={skullToken} alt="A friendly carved bone skull counter with a chartreuse glow" /></div>
        <div><p class="eyebrow">Skull token</p><h3>Spend or save</h3><p>Buy missing tricks, pay for overtricks, or keep pairs for end-game points.</p></div>
      </article>
      <article class="bid-panel" aria-label="Example bidding interface">
        <div class="bid-head"><span>Your bid</span><strong>3</strong></div>
        <div class="bid-meter"><button type="button" aria-label="Decrease example bid">−</button><div><i></i><i></i><i></i><span></span><span></span></div><button type="button" aria-label="Increase example bid">+</button></div>
        <div class="team-line"><span>You <b>3</b></span><span>Partner <b>2</b></span><strong>Team 5</strong></div>
        <button class="lock-bid" type="button">Lock in 3</button>
      </article>
    </div>
  </section>

  <section class="interface-strip" aria-labelledby="interface-title">
    <div><p class="eyebrow">Shared table shell</p><h2 id="interface-title">Same room. New rhythm.</h2><p>Passing leads into bidding, then tricks. The active phase, team total, Prince-break state, and deferred Frog choice remain visible without crowding the table.</p></div>
    <div class="phase-demo" aria-label="Example Zombie Princess phase display">
      <span>Round 2 of 4</span><strong>Bidding</strong><ol><li class="done">Pass</li><li class="active">Bid</li><li>Play</li><li>Score</li></ol><p><b>Princes</b> locked · <b>Frog</b> unresolved</p>
    </div>
  </section>

  <footer><p>Concept art only · review color, tone, silhouettes, frames, and component hierarchy before production generation.</p><a href={`${base}/zombie/assets/`}>Zombie component study</a></footer>
</main>

<style>
  :global(*) { box-sizing: border-box; }
  :global(html) { color-scheme: dark; background: #0d1718; font-family: 'Atkinson Hyperlegible', sans-serif; }
  :global(body) { margin: 0; min-width: 320px; min-height: 100vh; background: radial-gradient(circle at 75% 7%, rgba(131, 163, 79, .16), transparent 31rem), radial-gradient(circle at 8% 30%, rgba(91, 141, 148, .14), transparent 26rem), #0d1718; }
  :global(button), :global(a) { font: inherit; }
  main { width: min(1480px, calc(100% - clamp(28px, 5vw, 84px))); margin: 0 auto; overflow: hidden; }
  .masthead { min-height: 86px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(222, 202, 149, .24); }
  .wordmark { display: flex; align-items: baseline; gap: 7px; color: #f6e9c4; font-family: 'Cormorant Garamond', serif; font-size: 22px; text-decoration: none; }
  .wordmark strong { color: #d3a653; font-size: 31px; }
  .masthead nav { display: flex; gap: 8px; }
  .masthead nav a { padding: 7px 11px; border: 1px solid rgba(222, 202, 149, .28); border-radius: 999px; color: #eee1bd; font-size: 13px; text-decoration: none; }
  a:focus-visible, button:focus-visible { outline: 3px solid #cfe58e; outline-offset: 3px; }
  .hero { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(280px, .55fr); align-items: center; gap: clamp(30px, 7vw, 110px); min-height: min(760px, 86vh); padding: clamp(54px, 8vw, 108px) 0; }
  .eyebrow { margin: 0 0 9px; color: #bad56f; font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
  h1, h2, h3, p { overflow-wrap: break-word; }
  h1 { margin: 0; color: #f1dfb1; font-family: 'Cormorant Garamond', serif; font-size: clamp(72px, 11vw, 154px); font-weight: 700; line-height: .69; letter-spacing: -.045em; }
  h1 span { display: block; color: #aac85b; font-size: .67em; letter-spacing: .02em; }
  .lede { max-width: 720px; margin: 37px 0 25px; color: #c0c8bd; font-size: clamp(17px, 1.7vw, 23px); line-height: 1.45; }
  .status { display: flex; align-items: center; width: max-content; max-width: 100%; padding: 9px 13px; border: 1px solid rgba(186, 213, 111, .3); border-radius: 999px; color: #d7ddcf; background: rgba(9, 21, 20, .72); font-size: 12px; }
  .status i { width: 7px; height: 7px; margin-right: 8px; border-radius: 50%; background: #bad56f; box-shadow: 0 0 12px #bad56f; }
  .status span { margin-left: 8px; color: #84968b; }
  .hero-art { position: relative; width: min(100%, 430px); margin: 0 auto; transform: rotate(2.5deg); }
  .hero-art::before { position: absolute; inset: -11px; content: ''; border: 1px solid rgba(214, 175, 98, .68); border-radius: 51% 51% 12px 12px; box-shadow: 0 34px 70px rgba(0, 0, 0, .48), 0 0 0 5px #172324; }
  .hero-art img { position: relative; display: block; width: 100%; aspect-ratio: 3 / 5; object-fit: cover; border-radius: 50% 50% 8px 8px; }
  .hero-art figcaption { position: relative; margin-top: 23px; color: #8d9a90; font-size: 10px; letter-spacing: .08em; text-align: center; text-transform: uppercase; }
  .gallery-section { margin: 0 0 clamp(76px, 10vw, 140px); }
  .section-heading { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 520px); align-items: end; gap: 30px; margin-bottom: 33px; padding-top: 30px; border-top: 1px solid rgba(222, 202, 149, .2); }
  .section-heading h2, .interface-strip h2 { margin: 0; color: #efe1bc; font-family: 'Cormorant Garamond', serif; font-size: clamp(43px, 6vw, 72px); line-height: .86; }
  .section-heading > p { margin: 0; color: #9da9a1; font-size: 15px; line-height: 1.5; }
  .playing-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: clamp(12px, 2vw, 25px); }
  .playing-card { position: relative; overflow: hidden; aspect-ratio: 3 / 5; padding: clamp(7px, 1vw, 13px); border: clamp(4px, .6vw, 8px) solid var(--accent, #c9a95f); border-radius: clamp(12px, 1.7vw, 22px); background: var(--ink, #17251d); box-shadow: inset 0 0 0 2px rgba(249, 232, 188, .68), inset 0 0 0 6px var(--ink, #17251d), 0 18px 28px rgba(0, 0, 0, .32); }
  .playing-card::after { position: absolute; inset: 12px; z-index: 2; content: ''; border: 1px solid rgba(249, 232, 188, .55); border-radius: clamp(5px, 1vw, 12px); pointer-events: none; }
  .playing-art { width: 100%; height: 100%; overflow: hidden; border-radius: clamp(5px, 1vw, 11px); }
  .playing-art img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .card-rank { position: absolute; z-index: 3; display: grid; place-items: center; width: clamp(40px, 5vw, 68px); min-height: clamp(60px, 8vw, 101px); color: var(--ink, #17251d); background: var(--accent, #c9a95f); box-shadow: 0 4px 15px rgba(0, 0, 0, .32); }
  .card-rank.top { top: 0; left: 0; padding: 9px 5px 6px; border-radius: 0 0 15px 0; }
  .card-rank.bottom { right: 0; bottom: 0; min-height: clamp(40px, 5vw, 66px); transform: rotate(180deg); border-radius: 0 0 15px 0; }
  .card-rank strong { font-family: 'Cormorant Garamond', serif; font-size: clamp(25px, 4vw, 49px); line-height: .65; }
  .suit-icon { display: block; width: clamp(17px, 2.6vw, 32px); margin-top: 6px; line-height: 0; }
  .suit-icon svg { width: 100%; fill: currentColor; }
  .suit-name { position: absolute; z-index: 3; bottom: clamp(12px, 1.6vw, 23px); left: 50%; min-width: 58%; padding: 5px 11px; transform: translateX(-50%); border: 1px solid rgba(249, 232, 188, .68); border-radius: 999px; color: #fff3ce; background: color-mix(in srgb, var(--ink, #17251d) 88%, transparent); font-family: 'Cormorant Garamond', serif; font-size: clamp(14px, 2vw, 23px); font-weight: 700; text-align: center; }
  .frog-row { display: grid; grid-template-columns: minmax(190px, 310px) minmax(0, 550px); align-items: center; gap: clamp(28px, 6vw, 80px); margin-top: 55px; padding: clamp(25px, 4vw, 50px); border: 1px solid rgba(183, 215, 99, .25); border-radius: 24px; background: linear-gradient(115deg, rgba(69, 102, 42, .18), rgba(15, 30, 29, .65)); }
  .frog-card { --accent: #c5d873; --ink: #213e2c; width: 100%; }
  .frog-mark { color: #73a05a; }
  .frog-copy h3 { margin: 0; color: #eef4cf; font-family: 'Cormorant Garamond', serif; font-size: clamp(36px, 5vw, 62px); line-height: .95; }
  .frog-copy > p:not(.eyebrow) { max-width: 510px; margin: 20px 0; color: #b9c5b7; font-size: 17px; line-height: 1.5; }
  .rule-chip { display: inline-block; padding: 7px 11px; border: 1px solid rgba(197, 216, 115, .35); border-radius: 999px; color: #cfe189; font-size: 11px; font-weight: 700; letter-spacing: .08em; }
  .princess-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: clamp(14px, 2.5vw, 31px); }
  .princess-card { overflow: hidden; border: 2px solid rgba(247, 244, 228, .78); border-radius: 12px; background: #eae5d5; box-shadow: 0 19px 42px rgba(0, 0, 0, .34); }
  .princess-art { aspect-ratio: 4 / 4.2; overflow: hidden; }
  .princess-art img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center 29%; }
  .princess-copy { position: relative; min-height: 172px; padding: 20px 50px 20px 20px; color: #1d2a28; }
  .princess-copy p { margin: 0; color: #6d735c; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  .princess-copy h3 { margin: 3px 0 9px; color: #273a31; font-family: 'Cormorant Garamond', serif; font-size: clamp(24px, 2.8vw, 35px); line-height: .95; }
  .princess-copy span { display: block; color: #4a554f; font-size: 13px; line-height: 1.35; }
  .princess-copy i { position: absolute; top: 18px; right: 17px; display: grid; place-items: center; width: 31px; height: 31px; border-radius: 50%; color: #e7ecc7; background: #506641; font-size: 11px; font-style: normal; font-weight: 700; }
  .round-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: clamp(14px, 2.5vw, 30px); }
  .round-card { overflow: hidden; padding: 9px; border: 5px solid #bca678; border-radius: 16px; background: #e8ddbf; box-shadow: inset 0 0 0 2px #6f6042, 0 20px 40px rgba(0, 0, 0, .35); }
  .round-art { position: relative; aspect-ratio: 1.18; overflow: hidden; border-radius: 7px 7px 2px 2px; }
  .round-art img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .round-art strong { position: absolute; top: 9px; left: 10px; display: grid; place-items: center; min-width: 38px; height: 38px; padding: 0 8px; border: 1px solid #eadba9; border-radius: 50%; color: #f6e8bf; background: #263a34; font-family: 'Cormorant Garamond', serif; font-size: 25px; }
  .round-copy { min-height: 191px; padding: 17px 14px 10px; color: #29342f; }
  .round-copy > span { color: #776a4e; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  .round-copy h3 { margin: 2px 0 8px; font-family: 'Cormorant Garamond', serif; font-size: clamp(27px, 3vw, 38px); line-height: .95; }
  .round-copy p { min-height: 2.7em; margin: 0; color: #535b52; font-size: 13px; line-height: 1.35; }
  .pass-strip { display: flex; align-items: center; gap: 6px; margin-top: 16px; padding-top: 10px; border-top: 1px solid rgba(83, 71, 45, .3); }
  .pass-strip b { margin-right: auto; color: #6f6042; font-size: 9px; letter-spacing: .1em; }
  .pass-strip i { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; color: #f4e8c8; background: #59684e; font-size: 11px; font-style: normal; font-weight: 700; }
  .round-card.hourglass { border-color: #5c5a5a; background: #d8d0bd; box-shadow: inset 0 0 0 2px #242525, 0 20px 40px rgba(0, 0, 0, .35); }
  .round-card.hourglass .round-copy { background: linear-gradient(#d8d0bd 65%, #252a28 65%); }
  .economy-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)) minmax(300px, .9fr); gap: 18px; }
  .token-study, .bid-panel { min-height: 280px; border: 1px solid rgba(222, 202, 149, .22); border-radius: 18px; background: rgba(20, 35, 34, .75); }
  .token-study { display: grid; grid-template-columns: minmax(110px, .7fr) minmax(0, 1fr); align-items: center; gap: 8px; padding: 22px; }
  .token-image { aspect-ratio: 1; }
  .token-image img { display: block; width: 100%; height: 100%; object-fit: contain; }
  .token-image.coin img { transform: scale(1.22); }
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
  .phase-demo { padding: 22px; border: 1px solid rgba(222, 202, 149, .25); border-radius: 15px; background: rgba(8, 22, 21, .78); box-shadow: 0 20px 35px rgba(0, 0, 0, .25); }
  .phase-demo > span { color: #86978c; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; }
  .phase-demo > strong { display: block; margin: 3px 0 15px; color: #c9de78; font-family: 'Cormorant Garamond', serif; font-size: 37px; }
  .phase-demo ol { display: grid; grid-template-columns: repeat(4, 1fr); margin: 0; padding: 0; list-style: none; }
  .phase-demo li { padding: 7px 4px; border-bottom: 3px solid #3c4c46; color: #75877c; font-size: 11px; text-align: center; }
  .phase-demo li.done { border-color: #69814d; color: #aab99d; }
  .phase-demo li.active { border-color: #c5dd6d; color: #eaf2c8; }
  .phase-demo p { margin: 16px 0 0; color: #7d8e83; font-size: 11px; }
  .phase-demo p b { color: #c7d7ca; }
  footer { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 30px 0 46px; border-top: 1px solid rgba(222, 202, 149, .17); color: #71847a; font-size: 11px; }
  footer a { color: #b8cb76; text-decoration: none; }

  @media (max-width: 980px) {
    .playing-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .princess-grid, .round-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .princess-card:last-child, .round-card:last-child { grid-column: 1 / -1; width: calc(50% - 8px); justify-self: center; }
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
    .section-heading { display: block; }
    .section-heading > p { margin-top: 15px; }
    .playing-grid { gap: 10px; }
    .playing-card { border-width: 4px; border-radius: 12px; }
    .playing-card::after { inset: 7px; }
    .card-rank { width: 42px; min-height: 62px; }
    .card-rank.bottom { min-height: 42px; }
    .card-rank strong { font-size: 27px; }
    .suit-icon { width: 17px; }
    .frog-row { grid-template-columns: minmax(130px, .72fr) 1fr; gap: 18px; padding: 17px; }
    .frog-copy h3 { font-size: 30px; }
    .frog-copy > p:not(.eyebrow) { font-size: 12px; }
    .rule-chip { display: none; }
    .princess-grid, .round-grid, .economy-grid { grid-template-columns: 1fr; }
    .princess-card:last-child, .round-card:last-child { grid-column: auto; width: 100%; }
    .princess-card { display: grid; grid-template-columns: 43% 57%; }
    .princess-art { height: 100%; aspect-ratio: auto; }
    .princess-copy { min-height: 215px; padding: 17px 38px 17px 14px; }
    .princess-copy h3 { font-size: 27px; }
    .round-copy { min-height: 170px; }
    .token-study { min-height: 230px; }
    .bid-panel { grid-column: auto; }
    .interface-strip { display: block; padding: 26px 19px; }
    .phase-demo { margin-top: 28px; }
    footer { display: block; }
  }
  @media (max-width: 410px) {
    .masthead nav a:first-child { display: none; }
    .status span { display: none; }
    .frog-row { grid-template-columns: 125px 1fr; }
    .frog-copy .eyebrow { display: none; }
    .token-study { grid-template-columns: 105px 1fr; padding: 15px; }
  }
</style>
