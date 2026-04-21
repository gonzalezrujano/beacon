<script lang="ts">
  import type { Stream } from '@beacon/contract';
  import { store, type WidgetInstance } from '../lib/store.svelte';

  let { instance, stream, onclose }: {
    instance: WidgetInstance;
    stream: Stream;
    onclose: () => void;
  } = $props();

  const pollMeta  = $derived(store.pollMeta[stream.id]);
  const rawData   = $derived(store.streams[stream.id]);
  const config    = $derived(store.getWidgetConfig(instance.id));
  const span      = $derived(store.layout.spans[instance.id] ?? stream.span ?? (stream.kind === 'scalar' ? 1 : 2));
  const isHidden  = $derived(store.hiddenInstances.has(instance.id));

  function relativeTime(ts: number | null): string {
    if (ts === null) return '—';
    const diff = Date.now() - ts;
    if (diff < 1000) return 'just now';
    if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    return new Date(ts).toLocaleTimeString();
  }

  // Re-derive relative time on every tick so it stays fresh
  let now = $state(Date.now());
  $effect(() => {
    const id = setInterval(() => { now = Date.now(); }, 1000);
    return () => clearInterval(id);
  });

  const lastFetchRel = $derived((() => {
    void now;
    return relativeTime(pollMeta?.lastFetchAt ?? null);
  })());
</script>

<!-- Backdrop -->
<button class="backdrop" onclick={onclose} aria-label="Close inspect panel"></button>

<aside class="drawer">
  <div class="drawer-header">
    <div class="drawer-title">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/>
        <line x1="8" y1="5" x2="8" y2="8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="8" cy="11" r="0.8" fill="currentColor"/>
      </svg>
      Inspect
    </div>
    <button class="close-btn" onclick={onclose} aria-label="Close">
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
  </div>

  <div class="drawer-body">

    <!-- Stream -->
    <section class="section">
      <div class="section-title">Stream</div>
      <div class="kv-grid">
        <span class="kv-key">id</span>
        <span class="kv-val kv-mono">{stream.id}</span>
        <span class="kv-key">label</span>
        <span class="kv-val">{stream.label}</span>
        <span class="kv-key">kind</span>
        <span class="kv-val kv-mono">{stream.kind}</span>
        <span class="kv-key">transport</span>
        <span class="kv-val kv-mono">{stream.transport}</span>
        <span class="kv-key">endpoint</span>
        <span class="kv-val kv-mono kv-break">{stream.endpoint}</span>
        <span class="kv-key">interval</span>
        <span class="kv-val kv-mono">{stream.interval != null ? `${stream.interval}ms` : '10000ms'}</span>
        {#if stream.unit}
          <span class="kv-key">unit</span>
          <span class="kv-val kv-mono">{stream.unit}</span>
        {/if}
        {#if stream.description}
          <span class="kv-key">desc</span>
          <span class="kv-val kv-dimmed">{stream.description}</span>
        {/if}
        {#if stream.thresholds}
          <span class="kv-key">thresholds</span>
          <span class="kv-val kv-mono">{JSON.stringify(stream.thresholds)}</span>
        {/if}
      </div>
    </section>

    <!-- Instance -->
    <section class="section">
      <div class="section-title">Instance</div>
      <div class="kv-grid">
        <span class="kv-key">id</span>
        <span class="kv-val kv-mono kv-dimmed">{instance.id}</span>
        <span class="kv-key">stream</span>
        <span class="kv-val kv-mono kv-dimmed">{instance.streamId}</span>
        <span class="kv-key">kind override</span>
        <span class="kv-val kv-mono">{instance.widgetKind ?? '—'}</span>
        <span class="kv-key">span</span>
        <span class="kv-val kv-mono">{span}</span>
        <span class="kv-key">hidden</span>
        <span class="kv-val kv-mono" class:kv-warn={isHidden}>{isHidden ? 'yes' : 'no'}</span>
      </div>
    </section>

    <!-- Poll status -->
    <section class="section">
      <div class="section-title">Poll Status</div>
      <div class="kv-grid">
        <span class="kv-key">last fetch</span>
        <span class="kv-val">{lastFetchRel}</span>
        <span class="kv-key">count</span>
        <span class="kv-val kv-mono">{pollMeta?.fetchCount ?? 0}</span>
        <span class="kv-key">latency</span>
        <span class="kv-val kv-mono">{pollMeta?.latencyMs != null ? `${pollMeta.latencyMs}ms` : '—'}</span>
        <span class="kv-key">last error</span>
        <span class="kv-val kv-mono" class:kv-error={!!pollMeta?.lastError}>{pollMeta?.lastError ?? '—'}</span>
      </div>
    </section>

    <!-- Widget config -->
    <section class="section">
      <div class="section-title">Widget Config</div>
      <pre class="json-block">{JSON.stringify(config, null, 2)}</pre>
    </section>

    <!-- Raw data -->
    <section class="section">
      <div class="section-title">Latest Data</div>
      {#if rawData}
        <pre class="json-block">{JSON.stringify(rawData, null, 2)}</pre>
      {:else}
        <div class="no-data">no data yet</div>
      {/if}
    </section>

  </div>
</aside>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgba(0, 0, 0, 0.35);
    border: none;
    cursor: default;
    backdrop-filter: blur(1px);
  }

  .drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 50;
    width: 340px;
    background: var(--bg-card);
    border-left: 1px solid var(--bd-strong);
    display: flex;
    flex-direction: column;
    box-shadow: -8px 0 32px rgba(0, 0, 0, 0.4);
    animation: slide-in 0.18s ease-out;
  }

  @keyframes slide-in {
    from { transform: translateX(100%); }
    to   { transform: translateX(0); }
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
  }

  .drawer-title {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--tx-2);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--tx-3);
    cursor: pointer;
    padding: 4px;
    border-radius: var(--r-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s, background 0.15s;
  }

  .close-btn:hover { background: var(--bg-card-h); color: var(--tx-2); }

  .drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 0 0 24px;
    scrollbar-width: thin;
    scrollbar-color: var(--bd) transparent;
  }

  .section {
    padding: 14px 16px 0;
    border-bottom: 1px solid var(--bd);
    padding-bottom: 14px;
  }

  .section-title {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--tx-3);
    margin-bottom: 9px;
  }

  .kv-grid {
    display: grid;
    grid-template-columns: 5rem 1fr;
    gap: 3px 10px;
    align-items: baseline;
  }

  .kv-key {
    font-size: 10px;
    color: var(--tx-3);
    white-space: nowrap;
    padding-top: 1px;
  }

  .kv-val {
    font-size: 11px;
    color: var(--tx-2);
    word-break: break-word;
  }

  .kv-mono {
    font-family: var(--font-mono);
    font-size: 10.5px;
  }

  .kv-break { word-break: break-all; }

  .kv-dimmed { color: var(--tx-3); }

  .kv-warn { color: var(--warn); }

  .kv-error { color: var(--fail); }

  .json-block {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--tx-3);
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid var(--bd);
    border-radius: var(--r-sm);
    padding: 8px 10px;
    margin: 0;
    overflow-x: auto;
    white-space: pre;
    max-height: 280px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--bd) transparent;
  }

  .no-data {
    font-size: 11px;
    color: var(--tx-3);
    font-style: italic;
  }
</style>
