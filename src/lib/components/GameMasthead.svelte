<script lang="ts">
  export let homeHref: string;
  export let brand: string;
  export let assetsHref: string;
  export let assetsLabel = 'Asset review';
  export let showAssets = true;
  export let connection: 'checking' | 'synced' | 'error';
  export let connectionLabel: string;
  export let compact = false;
</script>

<header class:compact class="masthead">
  <a class="wordmark" href={homeHref} aria-label={`${brand} home`}>
    <span>{brand.split(' ')[0]}</span>
    <strong>{brand.split(' ').slice(1).join(' ')}</strong>
  </a>
  <div class="header-tools">
    {#if showAssets}<a class="asset-review-link" href={assetsHref}>{assetsLabel}</a>{/if}
    <slot name="tools" />
    <div class="status" role="status" aria-live="polite" data-status={connection}>
      <span class="status-dot" aria-hidden="true"></span>
      {connectionLabel}
    </div>
  </div>
</header>

<style>
  .masthead { display: flex; align-items: center; justify-content: space-between; min-height: 104px; border-bottom: 1px solid rgba(255, 239, 199, .22); }
  .masthead.compact { min-height: 54px; height: 54px; }
  .wordmark { display: flex; align-items: baseline; gap: 8px; color: #fff4d0; font-family: 'Cormorant Garamond', serif; font-size: 26px; letter-spacing: .01em; text-decoration: none; }
  .wordmark strong { color: #ffc75f; font-size: 35px; }
  .compact .wordmark { font-size: 18px; }
  .compact .wordmark strong { font-size: 24px; }
  .header-tools { position: relative; display: flex; align-items: center; gap: 16px; }
  .asset-review-link { padding: 7px 10px; border: 1px solid rgba(255, 226, 163, .28); border-radius: 999px; color: #d9cedd; font-size: 11px; text-decoration: none; }
  .asset-review-link:hover, .asset-review-link:focus-visible { border-color: #ffc75f; color: #ffc75f; }
  .status { display: flex; align-items: center; gap: 9px; color: #d8d1dc; font-size: 14px; }
  .status-dot { width: 9px; height: 9px; flex: 0 0 9px; border: 1px solid #ffe2a3; border-radius: 50%; background: #816f8d; }
  .status[data-status='synced'] .status-dot { background: #7de2a7; box-shadow: 0 0 0 4px rgba(125, 226, 167, .12); }
  .status[data-status='error'] .status-dot { background: #ff7b75; }
  @media (max-width: 760px) {
    .masthead { min-height: 76px; align-items: flex-start; padding-top: 14px; }
    .wordmark { flex-direction: column; gap: 0; font-size: 16px; line-height: .85; }
    .wordmark strong { font-size: 27px; }
    .header-tools { align-items: flex-end; flex-direction: column-reverse; gap: 3px; }
    .status { font-size: 12px; }
  }
</style>
