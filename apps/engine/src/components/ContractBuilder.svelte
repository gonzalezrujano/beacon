<script lang="ts">
  import type { Stream, BeaconContract, StreamKind } from '@beacon/contract';
  import { store } from '../lib/store.svelte';
  import {
    fetchShelbyPipelines,
    fetchPipelineFields,
    applyContract,
    type DiscoveredField,
    type ShelbyPipelineInfo,
  } from '../lib/adapters/shelby';

  const { baseUrl, onclose }: { baseUrl: string; onclose: () => void } = $props();

  // ── Left panel ─────────────────────────────────────────────────────────────
  let pipelines        = $state<ShelbyPipelineInfo[]>([]);
  let selectedSlug     = $state<string | null>(null);
  let fieldCache       = $state<Record<string, DiscoveredField[]>>({});
  let loadingPipelines = $state(true);
  let loadingFields    = $state(false);

  const currentFields    = $derived(selectedSlug ? (fieldCache[selectedSlug] ?? []) : []);
  const selectedPipeline = $derived(pipelines.find(p => p.slug === selectedSlug) ?? null);

  $effect(() => {
    fetchShelbyPipelines(baseUrl)
      .then(ps => {
        pipelines = ps;
        loadingPipelines = false;
        if (ps.length > 0) void selectPipeline(ps[0].slug);
      })
      .catch(() => { loadingPipelines = false; });
  });

  async function selectPipeline(slug: string) {
    selectedSlug = slug;
    if (!fieldCache[slug]) {
      loadingFields = true;
      try {
        const fields = await fetchPipelineFields(baseUrl, slug);
        fieldCache = { ...fieldCache, [slug]: fields };
      } finally {
        loadingFields = false;
      }
    }
  }

  // ── Right panel ────────────────────────────────────────────────────────────
  let draftStreams  = $state<Stream[]>(JSON.parse(JSON.stringify(store.contract?.streams ?? [])));
  let selectedId   = $state<string | null>(draftStreams[0]?.id ?? null);
  let mappingActive = $state(false);
  let tableMappingActive = $state(false);
  let tableMappingHint = $state(false);

  const selectedStream = $derived(draftStreams.find(s => s.id === selectedId) ?? null);

  function selectStream(id: string) {
    selectedId = id;
    mappingActive = false;
    tableMappingActive = false;
  }

  function patchSelected(patch: Partial<Stream>) {
    if (!selectedId) return;
    draftStreams = draftStreams.map(s => s.id === selectedId ? { ...s, ...patch } : s);
  }

  function removeStream(id: string) {
    draftStreams = draftStreams.filter(s => s.id !== id);
    if (selectedId === id) {
      selectedId = draftStreams[0]?.id ?? null;
      mappingActive = false;
    }
  }

  function handleFieldClick(f: DiscoveredField) {
    if (!selectedPipeline) return;

    if (mappingActive && selectedStream?.kind === 'timeseries') {
      patchSelected({
        endpoint: `${baseUrl}/api/pipelines/${selectedPipeline.slug}/series?field=${encodeURIComponent(f.field)}&limit=60`,
        unit: f.unit,
        ...(f.range ? { range: f.range } : {}),
      });
      mappingActive = false;
      return;
    }

    if (tableMappingActive && (selectedStream?.kind === 'table' || selectedStream?.kind === 'log')) {
      const current = selectedStream.fields ?? [];
      const next = current.includes(f.field)
        ? current.filter(x => x !== f.field)
        : [...current, f.field];
      patchSelected({ fields: next.length ? next : undefined });
      return;
    }

    if (f.valueType === 'number') {
      const s: Stream = {
        id: crypto.randomUUID(),
        label: `${selectedPipeline.name} · ${f.field}`,
        kind: 'timeseries',
        transport: 'poll',
        endpoint: `${baseUrl}/api/pipelines/${selectedPipeline.slug}/series?field=${encodeURIComponent(f.field)}&limit=60`,
        interval: 10_000,
        span: 2,
        ...(f.unit !== undefined ? { unit: f.unit } : {}),
        ...(f.range !== undefined ? { range: f.range } : {}),
      };
      draftStreams = [...draftStreams, s];
      selectedId = s.id;
    } else {
      // Non-numeric field: hint user to use Table → or Log →
      tableMappingHint = true;
      setTimeout(() => { tableMappingHint = false; }, 2500);
    }
  }

  function addPreset(kind: 'status' | 'table') {
    if (!selectedPipeline) return;
    const s: Stream = kind === 'status'
      ? {
          id: crypto.randomUUID(),
          label: `${selectedPipeline.name} · Runs`,
          kind: 'status',
          transport: 'poll',
          endpoint: `${baseUrl}/api/pipelines/${selectedPipeline.slug}/runs?limit=72`,
          interval: 10_000,
          span: 2,
        }
      : {
          id: crypto.randomUUID(),
          label: `${selectedPipeline.name} · History`,
          kind: 'table',
          transport: 'poll',
          endpoint: `${baseUrl}/api/pipelines/${selectedPipeline.slug}/runs?limit=15`,
          interval: 10_000,
          span: 2,
        };
    draftStreams = [...draftStreams, s];
    selectedId = s.id;
  }

  function addBlankTimeseries() {
    if (!selectedPipeline) return;
    const s: Stream = {
      id: crypto.randomUUID(),
      label: `${selectedPipeline.name} · metric`,
      kind: 'timeseries',
      transport: 'poll',
      endpoint: '',
      interval: 10_000,
      span: 2,
    };
    draftStreams = [...draftStreams, s];
    selectedId = s.id;
    mappingActive = true;
    tableMappingActive = false;
  }

  function addBlankTable() {
    if (!selectedPipeline) return;
    const s: Stream = {
      id: crypto.randomUUID(),
      label: `${selectedPipeline.name} · output`,
      kind: 'table',
      transport: 'poll',
      endpoint: `${baseUrl}/api/pipelines/${selectedPipeline.slug}/runs?limit=15`,
      interval: 10_000,
      span: 4,
      fields: [],
    };
    draftStreams = [...draftStreams, s];
    selectedId = s.id;
    tableMappingActive = true;
    mappingActive = false;
  }

  function addBlankLog() {
    if (!selectedPipeline) return;
    const s: Stream = {
      id: crypto.randomUUID(),
      label: `${selectedPipeline.name} · log`,
      kind: 'log',
      transport: 'poll',
      endpoint: `${baseUrl}/api/pipelines/${selectedPipeline.slug}/runs?limit=50`,
      interval: 10_000,
      span: 4,
      fields: [],
    };
    draftStreams = [...draftStreams, s];
    selectedId = s.id;
    tableMappingActive = true;
    mappingActive = false;
  }

  function resetToSuggested() {
    if (!store.autoDiscoveredContract) return;
    draftStreams = JSON.parse(JSON.stringify(store.autoDiscoveredContract.streams));
    selectedId = draftStreams[0]?.id ?? null;
    mappingActive = false;
  }

  function apply() {
    const contract: BeaconContract = {
      version: '1',
      meta: store.contract?.meta ?? { name: 'Shelby' },
      streams: draftStreams,
    };
    store.saveCustomContract(baseUrl, contract);
    applyContract(contract);
    onclose();
  }

  function getStreamField(s: Stream): string {
    const m = s.endpoint.match(/[?&]field=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  const KIND_OPTIONS: { value: StreamKind; label: string }[] = [
    { value: 'timeseries', label: 'Timeseries' },
    { value: 'status',     label: 'Status' },
    { value: 'table',      label: 'Table' },
    { value: 'scalar',     label: 'Scalar' },
    { value: 'raw',        label: 'Raw' },
    { value: 'log',        label: 'Log Feed' },
  ];

  const KIND_COLOR: Record<StreamKind, string> = {
    timeseries: '#22d3ee',
    status:     '#34d399',
    table:      '#a78bfa',
    scalar:     '#f59e0b',
    raw:        '#6b7280',
    log:        '#34d399',
  };
</script>

<div class="backdrop" role="presentation" onclick={() => onclose()}>
  <div class="panel" role="dialog" aria-label="Contract Builder" onclick={(e) => e.stopPropagation()}>

    <!-- Header -->
    <div class="panel-header">
      <span class="panel-title">Contract Builder</span>
      <div class="panel-actions">
        {#if store.autoDiscoveredContract}
          <button class="btn-ghost" onclick={resetToSuggested}>Reset to suggested</button>
        {/if}
        <button class="close-btn" onclick={() => onclose()}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
            <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="panel-body">

      <!-- ── Left: pipeline explorer ──────────────────────────────────────── -->
      <div class="explorer" class:explorer--mapping={mappingActive}>

        <div class="explorer-pipelines">
          {#if loadingPipelines}
            <span class="muted">Loading…</span>
          {:else}
            {#each pipelines as p (p.slug)}
              <button
                class="pipeline-tab"
                class:pipeline-tab--active={selectedSlug === p.slug}
                onclick={() => void selectPipeline(p.slug)}
              >{p.name}</button>
            {/each}
          {/if}
        </div>

        <div class="fields-scroll">
          {#if mappingActive}
            <div class="mapping-banner">← Click a field to map</div>
          {:else if tableMappingActive}
            <div class="mapping-banner mapping-banner--table">← Toggle columns for table/log</div>
          {:else if tableMappingHint}
            <div class="mapping-banner mapping-banner--hint">Use + Table → or + Log → first</div>
          {/if}

          {#if loadingFields}
            <span class="muted pad">Sampling runs…</span>
          {:else if currentFields.length === 0 && !loadingPipelines}
            <span class="muted pad">No fields in latest runs</span>
          {:else}
            {#each currentFields as f (f.field)}
              <button
                class="field-row"
                class:field-row--mappable={mappingActive && f.valueType === 'number'}
                class:field-row--table-pick={tableMappingActive}
                class:field-row--selected={tableMappingActive && (selectedStream?.fields ?? []).includes(f.field)}
                onclick={() => handleFieldClick(f)}
                title={mappingActive && f.valueType === 'number' ? 'Add as timeseries stream' : tableMappingActive ? 'Toggle column' : `${f.valueType} — activate Table → or Log → to use`}
              >
                <span class="field-dot" style:background={
                  f.valueType === 'number'  ? '#22d3ee' :
                  f.valueType === 'string'  ? '#f59e0b' :
                  f.valueType === 'boolean' ? '#34d399' : '#6b7280'
                }></span>
                <span class="field-name">{f.field}</span>
                {#if f.unit}<span class="field-unit">{f.unit}</span>{/if}
                <span class="field-type">{f.valueType === 'number' ? 'num' : f.valueType === 'string' ? 'str' : f.valueType === 'boolean' ? 'bool' : '?'}</span>
                <span class="field-sample">{String(f.sampleValue).slice(0, 10)}</span>
              </button>
            {/each}
          {/if}
        </div>

        <div class="quick-add">
          <button class="quick-btn" disabled={!selectedPipeline} onclick={() => addPreset('status')}>+ Status</button>
          <button class="quick-btn" disabled={!selectedPipeline} onclick={() => addPreset('table')}>+ History</button>
          <button class="quick-btn quick-btn--ts" disabled={!selectedPipeline} onclick={() => addBlankTimeseries()}>+ Series →</button>
          <button class="quick-btn quick-btn--tbl" disabled={!selectedPipeline} onclick={() => addBlankTable()}>+ Table →</button>
          <button class="quick-btn quick-btn--log" disabled={!selectedPipeline} onclick={() => addBlankLog()}>+ Log →</button>
        </div>

      </div>

      <!-- ── Right: streams ───────────────────────────────────────────────── -->
      <div class="streams-panel">

        <div class="stream-list">
          {#each draftStreams as s (s.id)}
            <div
              class="stream-row"
              class:stream-row--active={selectedId === s.id}
              role="button"
              tabindex="0"
              onclick={() => selectStream(s.id)}
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectStream(s.id); }}
            >
              <span class="kind-dot" style:background={KIND_COLOR[s.kind]}></span>
              <span class="stream-row-label">{s.label}</span>
              <span class="stream-row-span">×{s.span ?? 2}</span>
              <button
                class="stream-del"
                onclick={(e) => { e.stopPropagation(); removeStream(s.id); }}
                title="Remove"
              >×</button>
            </div>
          {/each}
          {#if draftStreams.length === 0}
            <span class="muted pad">Click a numeric field on the left to add a stream</span>
          {/if}
        </div>

        {#if selectedStream}
          <div class="stream-editor">

            <div class="form-row">
              <label class="form-label">Label</label>
              <input
                class="form-input"
                value={selectedStream.label}
                oninput={(e) => patchSelected({ label: (e.currentTarget as HTMLInputElement).value })}
              />
            </div>

            <div class="form-row">
              <label class="form-label">Kind</label>
              <select
                class="form-select"
                value={selectedStream.kind}
                onchange={(e) => {
                  patchSelected({ kind: (e.currentTarget as HTMLSelectElement).value as StreamKind });
                  mappingActive = false;
                }}
              >
                {#each KIND_OPTIONS as opt}
                  <option value={opt.value}>{opt.label}</option>
                {/each}
              </select>
            </div>

            {#if selectedStream.kind === 'timeseries'}
              <div class="form-row">
                <label class="form-label">Field</label>
                <button
                  class="map-btn"
                  class:map-btn--active={mappingActive}
                  onclick={() => { mappingActive = !mappingActive; tableMappingActive = false; }}
                  title="Click then pick a field from the left panel"
                >
                  <span class="map-field">{getStreamField(selectedStream) || 'none'}</span>
                  <span class="map-hint">{mappingActive ? '← select' : '↖ map'}</span>
                </button>
              </div>
            {/if}

            {#if selectedStream.kind === 'table' || selectedStream.kind === 'log'}
              <div class="form-row form-row--top">
                <label class="form-label">{selectedStream.kind === 'log' ? 'Fields' : 'Columns'}</label>
                <div class="col-editor">
                  <button
                    class="map-btn"
                    class:map-btn--active={tableMappingActive}
                    onclick={() => { tableMappingActive = !tableMappingActive; mappingActive = false; }}
                  >
                    <span class="map-hint">{tableMappingActive ? '← toggle' : '↖ pick output fields'}</span>
                  </button>
                  {#if (selectedStream.fields ?? []).length > 0}
                    <div class="col-chips">
                      {#each selectedStream.fields ?? [] as f}
                        <span class="col-chip">
                          {f}
                          <button class="chip-del" onclick={() => {
                            const next = (selectedStream.fields ?? []).filter(x => x !== f);
                            patchSelected({ fields: next.length ? next : undefined });
                          }}>×</button>
                        </span>
                      {/each}
                    </div>
                  {:else}
                    <span class="col-hint">{selectedStream.kind === 'log' ? 'pick a field as message' : 'no custom columns — shows run history'}</span>
                  {/if}
                </div>
              </div>
            {/if}

            <div class="form-row">
              <label class="form-label">Span</label>
              <div class="span-ctrl">
                {#each [1, 2, 3, 4] as sp}
                  <button
                    class="span-btn"
                    class:span-btn--active={(selectedStream.span ?? 2) === sp}
                    onclick={() => patchSelected({ span: sp as 1 | 2 | 3 | 4 })}
                  >{sp}</button>
                {/each}
              </div>
            </div>

            <div class="form-row">
              <label class="form-label">Poll ms</label>
              <input
                class="form-input form-input--sm"
                type="number"
                min="1000"
                step="1000"
                value={selectedStream.interval ?? 10000}
                oninput={(e) => patchSelected({ interval: Number((e.currentTarget as HTMLInputElement).value) })}
              />
            </div>

            {#if selectedStream.kind === 'timeseries' || selectedStream.kind === 'scalar'}
              <div class="form-row">
                <label class="form-label">Unit</label>
                <input
                  class="form-input form-input--sm"
                  placeholder="ms, %, B…"
                  value={selectedStream.unit ?? ''}
                  oninput={(e) => {
                    const v = (e.currentTarget as HTMLInputElement).value;
                    patchSelected({ unit: v || undefined });
                  }}
                />
              </div>
            {/if}

          </div>
        {:else}
          <div class="editor-empty">
            {#if draftStreams.length > 0}
              <span class="muted">Select a stream to edit</span>
            {:else}
              <span class="muted">Click a numeric field on the left,<br>or use the quick-add buttons.</span>
            {/if}
          </div>
        {/if}

        <div class="streams-footer">
          <button class="apply-btn" onclick={apply} disabled={draftStreams.length === 0}>
            Apply Contract
          </button>
        </div>

      </div>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .panel {
    background: var(--bg-card);
    border: 1px solid var(--bd-strong);
    border-radius: var(--r-xl);
    width: min(920px, calc(100vw - 40px));
    height: min(640px, calc(100vh - 40px));
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255,255,255,0.04);
  }

  /* ── Header ─────────────────────────────────────────────────────────────── */

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
  }

  .panel-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--tx);
    letter-spacing: -0.01em;
  }

  .panel-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-ghost {
    background: none;
    border: 1px solid var(--bd);
    border-radius: var(--r-sm);
    color: var(--tx-3);
    font-size: 11px;
    padding: 4px 10px;
    cursor: pointer;
  }
  .btn-ghost:hover { background: var(--bg-card-h); color: var(--tx-2); }

  .close-btn {
    background: none;
    border: none;
    color: var(--tx-3);
    cursor: pointer;
    padding: 6px;
    border-radius: var(--r-sm);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .close-btn:hover { background: var(--bg-card-h); color: var(--tx); }

  /* ── Body ────────────────────────────────────────────────────────────────── */

  .panel-body {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  /* ── Left: explorer ─────────────────────────────────────────────────────── */

  .explorer {
    width: 230px;
    flex-shrink: 0;
    border-right: 1px solid var(--bd);
    display: flex;
    flex-direction: column;
    transition: background 0.15s;
  }

  .explorer--mapping {
    background: rgba(99, 102, 241, 0.03);
  }

  .explorer-pipelines {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
  }

  .pipeline-tab {
    background: none;
    border: 1px solid var(--bd);
    border-radius: var(--r-sm);
    color: var(--tx-3);
    font-size: 11px;
    padding: 3px 8px;
    cursor: pointer;
  }
  .pipeline-tab:hover { color: var(--tx-2); border-color: var(--bd-strong); }
  .pipeline-tab--active {
    background: rgba(99, 102, 241, 0.12);
    border-color: var(--accent);
    color: var(--accent-2);
  }

  .mapping-banner {
    background: rgba(99, 102, 241, 0.12);
    border-bottom: 1px solid rgba(99, 102, 241, 0.2);
    color: var(--accent-2);
    font-size: 11px;
    font-weight: 500;
    padding: 6px 12px;
    flex-shrink: 0;
  }
  .mapping-banner--table {
    background: rgba(167, 139, 250, 0.1);
    border-bottom-color: rgba(167, 139, 250, 0.25);
    color: #a78bfa;
  }
  .mapping-banner--hint {
    background: rgba(245, 158, 11, 0.08);
    border-bottom-color: rgba(245, 158, 11, 0.2);
    color: var(--warn);
  }

  .fields-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }

  .field-row {
    width: 100%;
    background: none;
    border: none;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    cursor: pointer;
    text-align: left;
  }
  .field-row:hover { background: var(--bg-card-h); }
  .field-row--mappable { cursor: crosshair; }
  .field-row--mappable:hover { background: rgba(99, 102, 241, 0.1); }
  .field-row--table-pick { cursor: pointer; }
  .field-row--table-pick:hover { background: rgba(167, 139, 250, 0.08); }
  .field-row--selected { background: rgba(167, 139, 250, 0.12); }
  .field-row--selected .field-name { color: #a78bfa; }
  .field-row--selected::after { content: '✓'; font-size: 10px; color: #a78bfa; margin-left: auto; padding-right: 4px; }

  .field-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .field-name {
    font-size: 12px;
    font-family: var(--font-mono);
    color: var(--tx);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .field-unit {
    font-size: 10px;
    color: var(--accent-2);
    font-family: var(--font-mono);
    flex-shrink: 0;
  }

  .field-type {
    font-size: 9px;
    color: var(--tx-3);
    font-family: var(--font-mono);
    flex-shrink: 0;
    opacity: 0.6;
  }

  .field-sample {
    font-size: 10px;
    color: var(--tx-3);
    font-family: var(--font-mono);
    flex-shrink: 0;
  }

  .quick-add {
    display: flex;
    gap: 4px;
    padding: 8px 10px;
    border-top: 1px solid var(--bd);
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .quick-btn {
    flex: 1;
    background: var(--bg-surface);
    border: 1px solid var(--bd);
    border-radius: var(--r-sm);
    color: var(--tx-3);
    font-size: 10.5px;
    padding: 4px 6px;
    cursor: pointer;
    white-space: nowrap;
  }
  .quick-btn:hover:not(:disabled) { background: var(--bg-card-h); color: var(--tx-2); }
  .quick-btn:disabled { opacity: 0.35; cursor: default; }
  .quick-btn--ts { color: var(--accent-2); border-color: rgba(99,102,241,0.3); }
  .quick-btn--ts:hover:not(:disabled) { background: rgba(99,102,241,0.08); }
  .quick-btn--tbl { color: #a78bfa; border-color: rgba(167,139,250,0.3); }
  .quick-btn--tbl:hover:not(:disabled) { background: rgba(167,139,250,0.08); }
  .quick-btn--log { color: #34d399; border-color: rgba(52,211,153,0.3); }
  .quick-btn--log:hover:not(:disabled) { background: rgba(52,211,153,0.08); }

  /* ── Right: streams ─────────────────────────────────────────────────────── */

  .streams-panel {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .stream-list {
    flex-shrink: 0;
    max-height: 190px;
    overflow-y: auto;
    border-bottom: 1px solid var(--bd);
    padding: 4px 0;
  }

  .stream-row {
    width: 100%;
    background: none;
    border: none;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 16px;
    cursor: pointer;
    text-align: left;
  }
  .stream-row:hover { background: var(--bg-card-h); }
  .stream-row--active { background: rgba(99, 102, 241, 0.07); }

  .kind-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .stream-row-label {
    flex: 1;
    font-size: 12.5px;
    color: var(--tx);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .stream-row-span {
    font-size: 10.5px;
    color: var(--tx-3);
    font-family: var(--font-mono);
  }

  .stream-del {
    background: none;
    border: none;
    color: var(--tx-3);
    cursor: pointer;
    font-size: 15px;
    line-height: 1;
    padding: 0 2px;
    opacity: 0;
    transition: opacity 0.1s;
  }
  .stream-row:hover .stream-del { opacity: 1; }
  .stream-del:hover { color: var(--fail); }

  /* ── Editor ──────────────────────────────────────────────────────────────── */

  .stream-editor {
    flex: 1;
    padding: 16px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 11px;
  }

  .editor-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 24px;
  }

  .form-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .form-label {
    font-size: 10.5px;
    font-weight: 500;
    color: var(--tx-3);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    width: 56px;
    flex-shrink: 0;
  }

  .form-input {
    flex: 1;
    background: var(--bg-input);
    border: 1px solid var(--bd-input);
    border-radius: var(--r-sm);
    color: var(--tx);
    font-size: 12.5px;
    padding: 6px 10px;
    outline: none;
    min-width: 0;
    font-family: inherit;
  }
  .form-input:focus { border-color: var(--bd-accent); }
  .form-input--sm { max-width: 120px; font-family: var(--font-mono); flex: none; }

  .form-select {
    max-width: 150px;
    background: var(--bg-input);
    border: 1px solid var(--bd-input);
    border-radius: var(--r-sm);
    color: var(--tx);
    font-size: 12.5px;
    padding: 6px 10px;
    outline: none;
    cursor: pointer;
  }
  .form-select:focus { border-color: var(--bd-accent); }

  .map-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-input);
    border: 1px solid var(--bd-input);
    border-radius: var(--r-sm);
    padding: 6px 10px;
    cursor: pointer;
    text-align: left;
    min-width: 0;
  }
  .map-btn:hover { border-color: var(--bd-accent); }
  .map-btn--active {
    border-color: var(--accent);
    background: rgba(99, 102, 241, 0.08);
  }

  .map-field {
    font-size: 12px;
    font-family: var(--font-mono);
    color: var(--tx);
  }

  .map-hint {
    font-size: 10px;
    color: var(--accent-2);
  }

  .span-ctrl { display: flex; gap: 4px; }

  .span-btn {
    width: 32px;
    height: 28px;
    background: var(--bg-surface);
    border: 1px solid var(--bd);
    border-radius: var(--r-sm);
    color: var(--tx-3);
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .span-btn:hover { border-color: var(--bd-strong); color: var(--tx-2); }
  .span-btn--active {
    background: rgba(99, 102, 241, 0.15);
    border-color: var(--accent);
    color: var(--accent-2);
    font-weight: 600;
  }

  /* ── Footer ──────────────────────────────────────────────────────────────── */

  .streams-footer {
    flex-shrink: 0;
    padding: 12px 16px;
    border-top: 1px solid var(--bd);
    display: flex;
    justify-content: flex-end;
  }

  .apply-btn {
    background: var(--accent);
    border: none;
    border-radius: var(--r-md);
    color: white;
    font-size: 13px;
    font-weight: 500;
    padding: 8px 20px;
    cursor: pointer;
  }
  .apply-btn:hover { background: var(--accent-2); }
  .apply-btn:disabled { opacity: 0.35; cursor: default; }

  .form-row--top { align-items: flex-start; }

  .col-editor {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .col-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .col-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(167, 139, 250, 0.1);
    border: 1px solid rgba(167, 139, 250, 0.25);
    border-radius: var(--r-sm);
    color: #a78bfa;
    font-size: 11px;
    font-family: var(--font-mono);
    padding: 2px 6px;
  }

  .chip-del {
    background: none;
    border: none;
    color: #a78bfa;
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    padding: 0;
    opacity: 0.6;
  }
  .chip-del:hover { opacity: 1; color: var(--fail); }

  .col-hint {
    font-size: 11px;
    color: var(--tx-3);
    font-style: italic;
  }

  /* ── Utilities ───────────────────────────────────────────────────────────── */

  .muted { font-size: 11.5px; color: var(--tx-3); }
  .pad { display: block; padding: 12px; }
</style>
