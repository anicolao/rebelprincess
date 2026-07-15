<script lang="ts">
  import '@fontsource/atkinson-hyperlegible/latin-400.css';
  import '@fontsource/atkinson-hyperlegible/latin-700.css';
  import '@fontsource/cormorant-garamond/latin-600.css';
  import '@fontsource/cormorant-garamond/latin-700.css';
  import { onMount } from 'svelte';
  import suitAtlas from '../../assets/generated/suited-card-families.png';
  import { probeFirebase } from '$lib/firebase';

  let connection: 'checking' | 'synced' | 'error' = 'checking';
  let connectionLabel = 'Checking Firebase…';

  const build = import.meta.env.VITE_GIT_HASH ?? 'local';

  onMount(async () => {
    try {
      const target = await probeFirebase();
      connection = 'synced';
      connectionLabel = target === 'emulator' ? 'Firebase emulator ready' : 'Firebase ready';
    } catch {
      connection = 'error';
      connectionLabel = 'Firebase unavailable';
    }
  });
</script>

<svelte:head>
  <title>Rebel Princess — Live card play</title>
</svelte:head>

<main data-e2e-layout>
  <header class="masthead">
    <a class="wordmark" href="./" aria-label="Rebel Princess home">
      <span>Rebel</span>
      <strong>Princess</strong>
    </a>
    <div class="status" role="status" aria-live="polite" data-status={connection}>
      <span class="status-dot" aria-hidden="true"></span>
      {connectionLabel}
    </div>
  </header>

  <section class="hero" aria-labelledby="hero-title">
    <div class="copy">
      <p class="eyebrow">Five nights. Four suits. Zero unwanted proposals.</p>
      <h1 id="hero-title">The ball is almost ready.</h1>
      <p class="lede">
        A live trick-taking game for three to six fiercely independent princesses.
        Create a room, invite the court, and keep those princes at arm's length.
      </p>
      <div class="actions" aria-label="Game availability">
        <button type="button" disabled>Create a game</button>
        <span>Room play arrives in the next increment.</span>
      </div>
    </div>

    <figure class="atlas-card">
      <img
        src={suitAtlas}
        alt="Original card illustrations for Fairies, Queens, Princes, and Pets"
      />
      <figcaption>
        <span>Fairies</span><span>Queens</span><span>Princes</span><span>Pets</span>
      </figcaption>
    </figure>
  </section>

  <section class="promise" aria-label="Game principles">
    <article>
      <span class="number">01</span>
      <h2>Play together</h2>
      <p>One room stays synchronized across every phone, tablet, and laptop.</p>
    </article>
    <article>
      <span class="number">02</span>
      <h2>Trust the table</h2>
      <p>The client shows the right hand while friends share one event history.</p>
    </article>
    <article>
      <span class="number">03</span>
      <h2>Rewrite the tale</h2>
      <p>Princess powers and changing round rules make every ball play differently.</p>
    </article>
  </section>

  <footer>
    <span>GPLv3 · Original artwork</span>
    <span data-testid="build-marker">Build {build}</span>
  </footer>
</main>

<style>
  :global(*) {
    box-sizing: border-box;
  }

  :global(html) {
    color-scheme: dark;
    background: #140d1e;
    font-family: 'Atkinson Hyperlegible', sans-serif;
  }

  :global(body) {
    margin: 0;
    min-width: 320px;
    min-height: 100vh;
    background:
      radial-gradient(circle at 77% 9%, rgba(149, 91, 184, 0.25), transparent 31rem),
      linear-gradient(145deg, #160e22 0%, #251638 48%, #101c24 100%);
  }

  :global(button),
  :global(a) {
    font: inherit;
  }

  main {
    width: min(1180px, calc(100% - 48px));
    min-height: 100vh;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
  }

  .masthead {
    min-height: 104px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255, 239, 199, 0.22);
  }

  .wordmark {
    color: #fff4d0;
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-family: 'Cormorant Garamond', serif;
    font-size: 26px;
    text-decoration: none;
    letter-spacing: 0.01em;
  }

  .wordmark strong {
    color: #ffc75f;
    font-size: 35px;
  }

  .status {
    color: #d8d1dc;
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 14px;
  }

  .status-dot {
    width: 9px;
    height: 9px;
    border: 1px solid #ffe2a3;
    border-radius: 50%;
    background: #816f8d;
  }

  [data-status='synced'] .status-dot {
    background: #7de2a7;
    box-shadow: 0 0 0 4px rgba(125, 226, 167, 0.12);
  }

  [data-status='error'] .status-dot {
    background: #ff7b75;
  }

  .hero {
    flex: 1;
    display: grid;
    grid-template-columns: minmax(0, 0.88fr) minmax(460px, 1.12fr);
    align-items: center;
    gap: clamp(38px, 7vw, 92px);
    padding: 72px 0 64px;
  }

  .copy {
    position: relative;
    z-index: 1;
  }

  .eyebrow {
    margin: 0 0 18px;
    color: #ffc75f;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h1 {
    max-width: 600px;
    margin: 0;
    color: #fff5dc;
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(54px, 6.3vw, 88px);
    font-weight: 600;
    letter-spacing: -0.045em;
    line-height: 0.88;
  }

  .lede {
    max-width: 520px;
    margin: 28px 0 0;
    color: #cfc4d4;
    font-size: 18px;
    line-height: 1.55;
  }

  .actions {
    margin-top: 34px;
    display: flex;
    align-items: center;
    gap: 18px;
  }

  button {
    min-height: 48px;
    padding: 0 23px;
    border: 1px solid rgba(255, 226, 163, 0.38);
    border-radius: 3px;
    color: #54415d;
    background: #b8a9b9;
    font-weight: 700;
  }

  .actions span {
    max-width: 180px;
    color: #9f93a5;
    font-size: 13px;
    line-height: 1.35;
  }

  .atlas-card {
    position: relative;
    margin: 0;
    border: 1px solid rgba(255, 226, 163, 0.35);
    border-radius: 12px;
    overflow: hidden;
    background: #09070c;
    box-shadow: 0 36px 80px rgba(0, 0, 0, 0.45);
    transform: rotate(1.2deg);
  }

  .atlas-card::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    box-shadow: inset 0 0 80px rgba(8, 4, 15, 0.45);
  }

  .atlas-card img {
    display: block;
    width: 100%;
    aspect-ratio: 1.874 / 1;
    object-fit: cover;
  }

  figcaption {
    position: absolute;
    inset: auto 0 0;
    z-index: 1;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    padding: 12px 10px 10px;
    color: #fff6da;
    background: linear-gradient(transparent, rgba(6, 5, 8, 0.9));
    font-family: 'Cormorant Garamond', serif;
    font-size: 17px;
    text-align: center;
  }

  .promise {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border-top: 1px solid rgba(255, 239, 199, 0.22);
    border-bottom: 1px solid rgba(255, 239, 199, 0.22);
  }

  .promise article {
    padding: 30px clamp(20px, 3vw, 40px) 32px;
  }

  .promise article + article {
    border-left: 1px solid rgba(255, 239, 199, 0.16);
  }

  .number {
    color: #b88cdf;
    font-size: 12px;
    font-weight: 700;
  }

  h2 {
    margin: 7px 0 6px;
    color: #f9edcf;
    font-family: 'Cormorant Garamond', serif;
    font-size: 24px;
  }

  .promise p {
    margin: 0;
    color: #a99dac;
    font-size: 14px;
    line-height: 1.45;
  }

  footer {
    min-height: 74px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #7f7485;
    font-size: 12px;
    letter-spacing: 0.04em;
  }

  @media (max-width: 760px) {
    main {
      width: min(100% - 28px, 520px);
    }

    .masthead {
      min-height: 76px;
      align-items: flex-start;
      padding-top: 14px;
    }

    .wordmark {
      flex-direction: column;
      gap: 0;
      font-size: 16px;
      line-height: 0.85;
    }

    .wordmark strong {
      font-size: 27px;
    }

    .status {
      padding-top: 9px;
      font-size: 12px;
    }

    .hero {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 30px;
      padding: 36px 0 32px;
    }

    .eyebrow {
      max-width: 290px;
      margin-bottom: 14px;
      font-size: 11px;
      line-height: 1.4;
    }

    h1 {
      max-width: 350px;
      font-size: clamp(48px, 15vw, 64px);
    }

    .lede {
      margin-top: 19px;
      font-size: 15px;
      line-height: 1.48;
    }

    .actions {
      margin-top: 23px;
      gap: 12px;
    }

    button {
      min-height: 44px;
      padding: 0 16px;
      font-size: 14px;
    }

    .actions span {
      max-width: 155px;
      font-size: 11px;
    }

    .atlas-card {
      transform: none;
    }

    figcaption {
      padding-bottom: 7px;
      font-size: 12px;
    }

    .promise {
      display: block;
    }

    .promise article {
      display: grid;
      grid-template-columns: 28px 1fr;
      padding: 17px 4px;
    }

    .promise article + article {
      border-top: 1px solid rgba(255, 239, 199, 0.16);
      border-left: 0;
    }

    .number {
      grid-row: 1 / 3;
      padding-top: 5px;
    }

    h2 {
      margin: 0 0 2px;
      font-size: 20px;
    }

    .promise p {
      font-size: 12px;
    }

    footer {
      min-height: 58px;
    }
  }
</style>
