<script lang="ts">
  import type { Stream, StreamData, StreamThresholds } from '@beacon/contract';
  import { store, type WidgetInstance } from '../lib/store.svelte';
  import type { WidgetConfig, WidgetTransformConfig } from '../lib/widgetConfig';
  import { applyTransforms, hasTransforms } from '../lib/transforms';
  import { getWidget } from '../lib/widgetRegistry';

  let { instance, stream, data }: { instance: WidgetInstance; stream: Stream; data: StreamData | undefined } = $props();

  let configOpen = $state(false);
  let activeTab = $state<'display' | 'transforms'>('display');

  const effectiveKind = $derived(instance.widgetKind ?? stream.kind);

  const config = $derived(store.getWidgetConfig(instance.id));

  const widgetDef = $derived(getWidget(effectiveKind));

  const hasConfig = $derived(
    !!widgetDef && (widgetDef.meta.hasDisplayConfig || widgetDef.meta.hasTransformConfig)
  );

  const effectiveThresholds = $derived<StreamThresholds | undefined>(
    config.thresholds ?? stream.thresholds
  );

  const transformedData = $derived<StreamData | undefined>(
    data && config.transforms && hasTransforms(config.transforms)
      ? applyTransforms(data, config.transforms)
      : data
  );

  const transformActive = $derived(hasTransforms(config.transforms));

  const renderedProps = $derived(
    widgetDef && transformedData
      ? widgetDef.buildProps(transformedData, stream, config, effectiveThresholds)
      : undefined
  );

  function set<K extends keyof WidgetConfig>(key: K, val: WidgetConfig[K]) {
    store.setWidgetConfig(instance.id, { [key]: val } as Partial<WidgetConfig>);
  }

  function setThreshold(field: 'warn' | 'crit', raw: string) {
    const v = raw === '' ? undefined : Number(raw);
    const t: StreamThresholds = { ...config.thresholds ?? stream.thresholds };
    if (v === undefined) delete t[field]; else t[field] = v;
    set('thresholds', Object.keys(t).length ? t : undefined);
  }

  function setTransformNum(key: keyof WidgetTransformConfig, raw: string) {
    const v = raw === '' ? undefined : Number(raw);
    const tc: WidgetTransformConfig = { ...config.transforms, [key]: v };
    if (v === undefined) delete tc[key];
    set('transforms', Object.keys(tc).length ? tc : undefined);
  }

  function setTransformStr(key: keyof WidgetTransformConfig, val: string) {
    const v = val === '' ? undefined : val;
    const tc: WidgetTransformConfig = { ...config.transforms, [key]: v };
    if (v === undefined) delete tc[key];
    set('transforms', Object.keys(tc).length ? tc : undefined);
  }

  function clearTransforms() {
    set('transforms', undefined);
  }
</script>

<div class="card">
  <div class="card-header">
    <div class="card-title-row">
      <span class="card-title">{stream.label}</span>
      {#if instance.widgetKind && instance.widgetKind !== stream.kind}
        <span class="kind-badge">{instance.widgetKind}</span>
      {/if}
      {#if stream.unit}
        <span class="unit-badge">{stream.unit}</span>
      {/if}
    </div>
    <div class="card-header-right">
      {#if !data}
        <span class="loading-dot"></span>
      {/if}
      {#if hasConfig}
        <button
          class="cfg-btn"
          class:cfg-btn--open={configOpen}
          onclick={() => configOpen = !configOpen}
          title="Widget settings"
          aria-label="Widget settings"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <line x1="2" y1="4"  x2="14" y2="4"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="5"  cy="4"  r="2" fill="var(--bg-card)" stroke="currentColor" stroke-width="1.5"/>
            <line x1="2" y1="8"  x2="14" y2="8"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="11" cy="8"  r="2" fill="var(--bg-card)" stroke="currentColor" stroke-width="1.5"/>
            <line x1="2" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="7"  cy="12" r="2" fill="var(--bg-card)" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </button>
      {/if}
    </div>
  </div>

  {#if configOpen && hasConfig}
    <div class="cfg-tabs">
      <button
        class="cfg-tab"
        class:cfg-tab--active={activeTab === 'display'}
        onclick={() => activeTab = 'display'}
      >Display</button>
      <button
        class="cfg-tab"
        class:cfg-tab--active={activeTab === 'transforms'}
        class:cfg-tab--active-indicator={transformActive}
        onclick={() => activeTab = 'transforms'}
      >Transforms{#if transformActive}<span class="tab-dot"></span>{/if}</button>
    </div>

    {#if activeTab === 'display'}
      <div class="cfg-panel">
        {#if effectiveKind === 'timeseries'}
          <label class="cfg-item">
            <span class="cfg-label">Chart</span>
            <select class="cfg-sel" value={config.chartType}
              onchange={(e) => set('chartType', (e.currentTarget as HTMLSelectElement).value as never)}>
              <option value="area">Area</option>
              <option value="line">Line</option>
              <option value="bar">Bar</option>
            </select>
          </label>
        {/if}

        {#if effectiveKind !== 'table'}
          <label class="cfg-item">
            <span class="cfg-label">Color</span>
            <select class="cfg-sel" value={config.colorScheme}
              onchange={(e) => set('colorScheme', (e.currentTarget as HTMLSelectElement).value as never)}>
              <option value="indigo">Indigo</option>
              <option value="cyan">Cyan</option>
              <option value="green">Green</option>
              <option value="amber">Amber</option>
            </select>
          </label>
        {/if}

        {#if effectiveKind === 'timeseries'}
          <label class="cfg-item">
            <span class="cfg-label">Window</span>
            <select class="cfg-sel" value={config.timeWindow}
              onchange={(e) => set('timeWindow', (e.currentTarget as HTMLSelectElement).value as never)}>
              <option value="all">All</option>
              <option value="5m">5 min</option>
              <option value="15m">15 min</option>
              <option value="1h">1 hour</option>
              <option value="6h">6 hours</option>
              <option value="24h">24 hours</option>
            </select>
          </label>
        {/if}

        {#if effectiveKind !== 'table'}
          <label class="cfg-item">
            <span class="cfg-label">Agg</span>
            <select class="cfg-sel" value={config.aggregation}
              onchange={(e) => set('aggregation', (e.currentTarget as HTMLSelectElement).value as never)}>
              <option value="none">None</option>
              <option value="avg">Avg</option>
              <option value="max">Max</option>
              <option value="p95">P95</option>
            </select>
          </label>
        {/if}

        {#if effectiveKind === 'scalar'}
          <label class="cfg-item">
            <span class="cfg-label">Warn</span>
            <input
              class="cfg-num"
              type="number"
              placeholder={stream.thresholds?.warn?.toString() ?? '—'}
              value={config.thresholds?.warn ?? ''}
              oninput={(e) => setThreshold('warn', (e.currentTarget as HTMLInputElement).value)}
            />
          </label>
          <label class="cfg-item">
            <span class="cfg-label">Crit</span>
            <input
              class="cfg-num"
              type="number"
              placeholder={stream.thresholds?.crit?.toString() ?? '—'}
              value={config.thresholds?.crit ?? ''}
              oninput={(e) => setThreshold('crit', (e.currentTarget as HTMLInputElement).value)}
            />
          </label>
        {/if}
      </div>
    {:else}
      <div class="cfg-panel cfg-panel--transforms">
        {#if effectiveKind === 'timeseries'}
          <div class="cfg-section-label">Filter by value</div>
          <label class="cfg-item">
            <span class="cfg-label">Min</span>
            <input
              class="cfg-num"
              type="number"
              placeholder="—"
              value={config.transforms?.rangeMin ?? ''}
              oninput={(e) => setTransformNum('rangeMin', (e.currentTarget as HTMLInputElement).value)}
            />
          </label>
          <label class="cfg-item">
            <span class="cfg-label">Max</span>
            <input
              class="cfg-num"
              type="number"
              placeholder="—"
              value={config.transforms?.rangeMax ?? ''}
              oninput={(e) => setTransformNum('rangeMax', (e.currentTarget as HTMLInputElement).value)}
            />
          </label>
          <div class="cfg-section-label">Scale</div>
          <label class="cfg-item">
            <span class="cfg-label">× Factor</span>
            <input
              class="cfg-num cfg-num--wide"
              type="number"
              step="0.01"
              placeholder="1"
              value={config.transforms?.scaleFactor ?? ''}
              oninput={(e) => setTransformNum('scaleFactor', (e.currentTarget as HTMLInputElement).value)}
            />
          </label>
        {/if}

        {#if effectiveKind === 'table'}
          <div class="cfg-section-label">Filter rows</div>
          <label class="cfg-item">
            <span class="cfg-label">Field</span>
            <input
              class="cfg-num cfg-num--wide"
              type="text"
              placeholder="column"
              value={config.transforms?.filterField ?? ''}
              oninput={(e) => setTransformStr('filterField', (e.currentTarget as HTMLInputElement).value)}
            />
          </label>
          <label class="cfg-item">
            <select class="cfg-sel"
              value={config.transforms?.filterCond ?? 'contains'}
              onchange={(e) => setTransformStr('filterCond', (e.currentTarget as HTMLSelectElement).value)}>
              <option value="contains">contains</option>
              <option value="eq">= equals</option>
              <option value="gt">&gt; greater</option>
              <option value="lt">&lt; less</option>
            </select>
          </label>
          <label class="cfg-item">
            <input
              class="cfg-num cfg-num--wide"
              type="text"
              placeholder="value"
              value={config.transforms?.filterValue ?? ''}
              oninput={(e) => setTransformStr('filterValue', (e.currentTarget as HTMLInputElement).value)}
            />
          </label>
          <div class="cfg-section-label">Sort rows</div>
          <label class="cfg-item">
            <span class="cfg-label">By</span>
            <input
              class="cfg-num cfg-num--wide"
              type="text"
              placeholder="column"
              value={config.transforms?.sortField ?? ''}
              oninput={(e) => setTransformStr('sortField', (e.currentTarget as HTMLInputElement).value)}
            />
          </label>
          <label class="cfg-item">
            <select class="cfg-sel"
              value={config.transforms?.sortDir ?? 'asc'}
              onchange={(e) => setTransformStr('sortDir', (e.currentTarget as HTMLSelectElement).value)}>
              <option value="asc">↑ asc</option>
              <option value="desc">↓ desc</option>
            </select>
          </label>
        {/if}

        {#if transformActive}
          <button class="cfg-clear-btn" onclick={clearTransforms}>Clear all</button>
        {/if}
      </div>
    {/if}
  {/if}

  <div class="card-body">
    {#if !transformedData}
      <div class="skeleton"></div>
    {:else if widgetDef && renderedProps}
      <svelte:component this={widgetDef.component} {...renderedProps} />
    {:else}
      <div class="empty">incompatible</div>
    {/if}
  </div>
</div>

<style>
  .card {
    background: var(--bg-card);
    border: 1px solid var(--bd);
    border-radius: var(--r-lg);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: border-color 0.2s, box-shadow 0.2s;
    height: 100%;
    min-height: 0;
  }
  .card:hover { border-color: var(--bd-strong); }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 13px 16px 11px;
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
    gap: 8px;
  }

  .card-title-row {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }

  .card-title {
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--tx-2);
    white-space: nowrap;
  }

  .kind-badge {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--accent-2);
    background: rgba(99,102,241,0.1);
    border: 1px solid rgba(99,102,241,0.3);
    border-radius: 4px;
    padding: 1px 5px;
  }

  .unit-badge {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--tx-3);
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--bd);
    border-radius: 4px;
    padding: 1px 5px;
  }

  .card-header-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .loading-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--tx-3);
    flex-shrink: 0;
    animation: pulse 1.6s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }

  .cfg-btn {
    background: none;
    border: none;
    color: var(--tx-3);
    cursor: pointer;
    padding: 3px 4px;
    border-radius: var(--r-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s, background 0.15s;
  }
  .cfg-btn:hover { background: var(--bg-card-h); color: var(--tx-2); }
  .cfg-btn--open { color: var(--accent); }

  /* ── Config tabs ── */
  .cfg-tabs {
    display: flex;
    border-bottom: 1px solid var(--bd);
    background: rgba(255,255,255,0.01);
  }

  .cfg-tab {
    position: relative;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--tx-3);
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    padding: 5px 12px 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: color 0.15s, border-color 0.15s;
  }
  .cfg-tab:hover { color: var(--tx-2); }
  .cfg-tab--active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .tab-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent);
    flex-shrink: 0;
  }

  /* ── Config panel ── */
  .cfg-panel {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 12px;
    padding: 8px 14px;
    border-bottom: 1px solid var(--bd);
    background: rgba(255,255,255,0.015);
  }

  .cfg-panel--transforms {
    align-items: center;
  }

  .cfg-section-label {
    width: 100%;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--tx-3);
    margin-top: 2px;
  }
  .cfg-section-label:first-child { margin-top: 0; }

  .cfg-clear-btn {
    margin-left: auto;
    background: none;
    border: 1px solid var(--bd-input);
    border-radius: var(--r-sm);
    color: var(--tx-3);
    font-size: 10px;
    padding: 2px 7px;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }
  .cfg-clear-btn:hover { color: var(--tx); border-color: var(--bd-strong); }

  .cfg-item {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .cfg-label {
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--tx-3);
    white-space: nowrap;
  }

  .cfg-sel {
    background: var(--bg-input);
    border: 1px solid var(--bd-input);
    border-radius: var(--r-sm);
    color: var(--tx-2);
    font-family: var(--font-mono);
    font-size: 11px;
    padding: 2px 5px;
    cursor: pointer;
    outline: none;
  }
  .cfg-sel:focus { border-color: var(--bd-accent); color: var(--tx); }

  .cfg-num {
    background: var(--bg-input);
    border: 1px solid var(--bd-input);
    border-radius: var(--r-sm);
    color: var(--tx-2);
    font-family: var(--font-mono);
    font-size: 11px;
    padding: 2px 5px;
    outline: none;
    width: 60px;
  }
  .cfg-num--wide { width: 90px; }
  .cfg-num:focus { border-color: var(--bd-accent); color: var(--tx); }

  /* ── Card body ── */
  .card-body {
    flex: 1;
    min-height: 0;
    position: relative;
  }

  .skeleton {
    width: 100%;
    height: 100%;
    min-height: 120px;
    background: linear-gradient(90deg,
      rgba(255,255,255,0.02) 25%,
      rgba(255,255,255,0.05) 50%,
      rgba(255,255,255,0.02) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.8s infinite;
  }

  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 80px;
    color: var(--tx-3);
    font-size: 12px;
  }
</style>
