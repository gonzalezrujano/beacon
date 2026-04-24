<script lang="ts">
  import type { Stream, BeaconContract, StreamKind, StreamData, TimeseriesData, ScalarData, StatusData, TableData, LogData, RawData } from '@beacon/contract';
  import { store } from '../lib/store.svelte';
  import {
    fetchShelbyPipelines,
    fetchPipelineFields,
    applyContract,
    type DiscoveredField,
    type ShelbyPipelineInfo,
  } from '../lib/adapters/shelby';
  import { listWidgets } from '../lib/widgetRegistry';
  import '../lib/widgetRegistrations';
  import Scalar from './widgets/Scalar.svelte';
  import Timeseries from './widgets/Timeseries.svelte';
  import StatusGrid from './widgets/StatusGrid.svelte';
  import Table from './widgets/Table.svelte';
  import LogFeed from './widgets/LogFeed.svelte';
  import RawJson from './widgets/RawJson.svelte';
  import CustomWidgetPreview from './CustomWidgetPreview.svelte';
  import { register } from '../lib/widgetRegistry';
  import CustomWidgetHost from './widgets/CustomWidgetHost.svelte';
  import type { WidgetMeta } from '../lib/widgetRegistry';

  const { baseUrl, onclose }: { baseUrl: string; onclose: () => void } = $props();

  // ── Pipeline explorer ──────────────────────────────────────────────────────
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

  // ── Widget list ────────────────────────────────────────────────────────────
  const initialStreams = JSON.parse(JSON.stringify(store.contract?.streams ?? [])) as Stream[];
  let draftStreams   = $state<Stream[]>(initialStreams);
  let selectedId     = $state<string | null>(initialStreams[0]?.id ?? null);
  let mappingActive  = $state(false);
  let tableMappingActive = $state(false);
  let tableMappingHint   = $state(false);
  let customWidgetActive = $state(false);
  let customWidgetCode = $state<string | null>(null);

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
      tableMappingHint = true;
      setTimeout(() => { tableMappingHint = false; }, 2500);
    }
  }

  function addPreset(kind: 'status' | 'table') {
    if (!selectedPipeline) return;
    const s: Stream = kind === 'status'
      ? {
          id: crypto.randomUUID(),
          label: `${selectedPipeline.name} · Run Status`,
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

  function handleCustomWidgetLoad(manifest: unknown, mountFn: unknown) {
    if (!selectedStream || !manifest || !mountFn) return;
    const m = manifest as { kind: StreamKind; name: string; icon?: string; compatibleKinds?: StreamKind[] };
    const meta: WidgetMeta = {
      name: m.name,
      icon: m.icon ?? '⚡',
      compatibleKinds: m.compatibleKinds ?? [m.kind],
      hasDisplayConfig: false,
      hasTransformConfig: false,
    };
    register(selectedStream.kind, {
      component: CustomWidgetHost,
      meta,
      buildProps: (data, stream, config, thresholds) => ({
        mountFn,
        data,
        stream,
        config,
        thresholds,
      }),
    });
    customWidgetCode = 'loaded';
    setTimeout(() => { customWidgetCode = null; }, 1500);
  }

  // ── Mock preview data ──────────────────────────────────────────────────────

  function mockTimeseries(n: number, base: number, variance: number) {
    const now = Date.now();
    let v = base;
    return Array.from({ length: n }, (_, i) => {
      v = Math.max(1, v + (Math.random() - 0.48) * variance);
      return { t: new Date(now - (n - i) * 12_000).toISOString(), v: Math.round(v * 10) / 10 };
    });
  }

  function randHex(len = 8) {
    return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  function mockPreviewData(stream: Stream): StreamData {
    const unit = stream.unit;
    switch (stream.kind) {
      case 'timeseries':
        return {
          kind: 'timeseries',
          unit,
          points: mockTimeseries(40, 80, 25),
        } satisfies TimeseriesData;

      case 'scalar': {
        const v = unit === '%' ? 94.3 : unit === 'ms' ? 134 : 1248;
        return {
          kind: 'scalar',
          value: v,
          unit,
          trend: 'up',
          change: 2.1,
          sparkline: Array.from({ length: 14 }, (_, i) => v * (0.88 + i * 0.01) + (Math.random() - 0.5) * v * 0.08),
        } satisfies ScalarData;
      }

      case 'status': {
        const now = Date.now();
        const statuses: Array<'ok' | 'fail'> = Array.from({ length: 48 }, () =>
          Math.random() > 0.05 ? 'ok' : 'fail'
        );
        const points = statuses.map((status, i) => ({
          id: `r_${randHex()}`,
          status,
          timestamp: new Date(now - (48 - i) * 600_000).toISOString(),
          duration: `${Math.floor(Math.random() * 180 + 20)}ms`,
        }));
        const ok = points.filter(p => p.status === 'ok').length;
        return {
          kind: 'status', points,
          summary: { ok, fail: points.length - ok, warn: 0, total: points.length },
        } satisfies StatusData;
      }

      case 'table': {
        const now = Date.now();
        return {
          kind: 'table',
          rows: Array.from({ length: 6 }, (_, i) => ({
            run_id:     `r_${randHex()}`,
            status:     Math.random() > 0.1 ? 'ok' : 'fail',
            started_at: new Date(now - i * 12_000).toISOString(),
            duration:   `${Math.floor(Math.random() * 180 + 20)}ms`,
          })),
        } satisfies TableData;
      }

      case 'log': {
        const levels = ['info', 'info', 'info', 'warn', 'error', 'debug'] as const;
        const msgs   = [
          'Pipeline started', 'Processing batch', 'Fetched 120 records',
          'Slow query detected', 'Connection timeout', 'Cache miss',
        ];
        return {
          kind: 'log',
          lines: Array.from({ length: 8 }, (_, i) => ({
            t:     new Date(Date.now() - i * 8_000).toISOString(),
            level: levels[Math.floor(Math.random() * levels.length)],
            msg:   msgs[Math.floor(Math.random() * msgs.length)],
          })),
        } satisfies LogData;
      }

      case 'raw':
        return {
          kind: 'raw',
          data: {
            pipeline: stream.label,
            status: 'ok',
            runs: 48,
            last_run: new Date().toISOString(),
            metrics: { avg_ms: 134, p95_ms: 210, error_rate: 0.02 },
          },
        } satisfies RawData;
    }
  }

  // Stable preview data — only regenerate when stream kind/unit changes
  let previewDataCache = $state<Record<string, StreamData>>({});

  const previewKey = $derived(
    selectedStream ? `${selectedStream.id}:${selectedStream.kind}:${selectedStream.unit ?? ''}` : null
  );

  $effect(() => {
    if (!selectedStream || !previewKey) return;
    if (!previewDataCache[previewKey]) {
      previewDataCache = { ...previewDataCache, [previewKey]: mockPreviewData(selectedStream) };
    }
  });

  const previewData = $derived(
    previewKey ? (previewDataCache[previewKey] ?? null) : null
  );

  const widgetKinds = $derived(listWidgets());
  const widgetMetaByKind = $derived(Object.fromEntries(widgetKinds.map(w => [w.kind, w.meta])));
</script>

<div class="backdrop" role="presentation" onclick={() => onclose()}>
  <div class="panel" role="dialog" aria-label="Dashboard Builder" onclick={(e) => e.stopPropagation()}>

    <!-- Header -->
    <div class="panel-header">
      <div class="header-left">
        <svg class="header-icon" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <rect x="1" y="1" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
          <rect x="10" y="1" width="7" height="4" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
          <rect x="1" y="10" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
          <rect x="10" y="7" width="7" height="10" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
        </svg>
        <span class="panel-title">Dashboard Builder</span>
        {#if draftStreams.length > 0}
          <span class="widget-count">{draftStreams.length} widget{draftStreams.length !== 1 ? 's' : ''}</span>
        {/if}
      </div>
      <div class="header-right">
        {#if store.autoDiscoveredContract}
          <button class="btn-ghost" onclick={resetToSuggested}>Reset to suggested</button>
        {/if}
        <button class="close-btn" onclick={() => onclose()} aria-label="Close">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="panel-body">

      <!-- ── Col 1: Pipeline explorer ───────────────────────────────────────── -->
      <div class="col-pipeline" class:col-pipeline--mapping={mappingActive}>

        <div class="col-heading">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="2.5" stroke="currentColor" stroke-width="1.3"/>
            <path d="M7 1v2M7 11v2M1 7h2M11 7h2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
          Data source
        </div>

        <div class="pipeline-tabs">
          {#if loadingPipelines}
            <span class="muted-sm">Loading…</span>
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

        {#if mappingActive}
          <div class="mapping-banner">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Click a numeric field to map
          </div>
        {:else if tableMappingActive}
          <div class="mapping-banner mapping-banner--table">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Toggle columns to include
          </div>
        {:else if tableMappingHint}
          <div class="mapping-banner mapping-banner--hint">
            Use + Table or + Log first
          </div>
        {/if}

        <div class="fields-scroll">
          {#if loadingFields}
            <span class="muted-sm pad">Sampling pipeline…</span>
          {:else if currentFields.length === 0 && !loadingPipelines}
            <span class="muted-sm pad">No fields found in latest runs</span>
          {:else}
            {#each currentFields as f (f.field)}
              {@const isNum = f.valueType === 'number'}
              {@const isStr = f.valueType === 'string'}
              {@const isBool = f.valueType === 'boolean'}
              <button
                class="field-row"
                class:field-row--mappable={mappingActive && isNum}
                class:field-row--table-pick={tableMappingActive}
                class:field-row--selected={tableMappingActive && (selectedStream?.fields ?? []).includes(f.field)}
                onclick={() => handleFieldClick(f)}
              >
                <span class="field-type-badge"
                  style:background={isNum ? 'rgba(34,211,238,0.15)' : isStr ? 'rgba(245,158,11,0.15)' : isBool ? 'rgba(52,211,153,0.15)' : 'rgba(107,114,128,0.15)'}
                  style:color={isNum ? '#22d3ee' : isStr ? '#f59e0b' : isBool ? '#34d399' : '#6b7280'}
                >{isNum ? 'num' : isStr ? 'str' : isBool ? 'bool' : '?'}</span>
                <span class="field-name">{f.field}</span>
                {#if f.unit}<span class="field-unit">{f.unit}</span>{/if}
                <span class="field-sample">{String(f.sampleValue ?? '').slice(0, 8)}</span>
                {#if tableMappingActive && (selectedStream?.fields ?? []).includes(f.field)}
                  <svg class="field-check" width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5l3 3 5-6" stroke="#a78bfa" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                {/if}
              </button>
            {/each}
          {/if}
        </div>

        <div class="quick-add">
          <div class="quick-add-label">Add widget</div>
          <div class="quick-add-btns">
            <button class="quick-btn" title="Run status grid" disabled={!selectedPipeline} onclick={() => addPreset('status')}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="2" cy="2" r="1.5" fill="#34d399"/><circle cx="6" cy="2" r="1.5" fill="#34d399"/><circle cx="10" cy="2" r="1.5" fill="var(--fail)"/><circle cx="2" cy="6" r="1.5" fill="#34d399"/><circle cx="6" cy="6" r="1.5" fill="#34d399"/><circle cx="10" cy="6" r="1.5" fill="#34d399"/></svg>
              Status
            </button>
            <button class="quick-btn" title="Run history table" disabled={!selectedPipeline} onclick={() => addPreset('table')}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="10" height="10" rx="1" stroke="#a78bfa" stroke-width="1.2"/><path d="M1 4h10M4 4v7" stroke="#a78bfa" stroke-width="1.2"/></svg>
              History
            </button>
            <button class="quick-btn quick-btn--ts" title="Add timeseries chart" disabled={!selectedPipeline} onclick={() => addBlankTimeseries()}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 9l3-4 2 2 3-5 2 3" stroke="#22d3ee" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Series →
            </button>
            <button class="quick-btn quick-btn--tbl" title="Add table widget" disabled={!selectedPipeline} onclick={() => addBlankTable()}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="10" height="10" rx="1" stroke="#a78bfa" stroke-width="1.2"/><path d="M1 4h10M4 4v7" stroke="#a78bfa" stroke-width="1.2"/></svg>
              Table →
            </button>
            <button class="quick-btn quick-btn--log" title="Add log feed" disabled={!selectedPipeline} onclick={() => addBlankLog()}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3h8M2 6h8M2 9h5" stroke="#34d399" stroke-width="1.3" stroke-linecap="round"/></svg>
              Log →
            </button>
          </div>
        </div>
      </div>

      <!-- ── Col 2: Widget list ──────────────────────────────────────────────── -->
      <div class="col-widgets">

        <div class="col-heading">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <rect x="1" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/>
            <rect x="7.5" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/>
            <rect x="1" y="7.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/>
            <rect x="7.5" y="7.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/>
          </svg>
          Widgets
        </div>

        <div class="widget-list">
          {#each draftStreams as s (s.id)}
            {@const meta = widgetMetaByKind[s.kind] ?? { name: s.kind, icon: '?', compatibleKinds: [s.kind], hasDisplayConfig: false, hasTransformConfig: false }}
            <div
              class="widget-row"
              class:widget-row--active={selectedId === s.id}
              role="button"
              tabindex="0"
              onclick={() => selectStream(s.id)}
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectStream(s.id); }}
            >
              <div class="widget-row-icon" style:background={`rgba(99,102,241,0.1)`} style:border-color={`rgba(99,102,241,0.2)`}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><text x="1.5" y="10.5" font-size="10" font-weight="700" fill="#a78bfa" font-family="monospace">{meta.icon}</text></svg>
              </div>
              <div class="widget-row-info">
                <span class="widget-row-name">{s.label}</span>
                <span class="widget-row-kind">{meta.name}</span>
              </div>
              <div class="widget-row-span">
                {#each [1,2,3,4] as b}
                  <span class="span-dot" class:span-dot--on={b <= (s.span ?? 2)}></span>
                {/each}
              </div>
              <button
                class="widget-del"
                onclick={(e) => { e.stopPropagation(); removeStream(s.id); }}
                title="Remove widget"
                aria-label="Remove widget"
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1L1 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
              </button>
            </div>
          {/each}

          {#if draftStreams.length === 0}
            <div class="widget-empty">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" opacity="0.3">
                <rect x="3" y="3" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/>
                <rect x="20" y="3" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/>
                <rect x="3" y="20" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/>
                <rect x="20" y="20" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/>
              </svg>
              <p>Click a numeric field or use the add buttons to build your dashboard</p>
            </div>
          {/if}
        </div>

        <div class="col-footer">
          <button class="apply-btn" onclick={apply} disabled={draftStreams.length === 0}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-7" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Build Dashboard
          </button>
        </div>

      </div>

      <!-- ── Col 3: Editor + Preview ────────────────────────────────────────── -->
      <div class="col-editor">
        {#if selectedStream}

          <div class="editor-scroll">

            <div class="editor-section">
              <div class="section-label">Widget name</div>
              <input
                class="name-input"
                placeholder="e.g. Response Time, CPU Usage…"
                value={selectedStream.label}
                oninput={(e) => patchSelected({ label: (e.currentTarget as HTMLInputElement).value })}
              />
            </div>

            <div class="editor-section">
              <div class="section-label">Widget type</div>
              <div class="kind-grid">
                {#each widgetKinds as { kind, meta }}
                  <button
                    class="kind-card"
                    class:kind-card--active={selectedStream.kind === kind && !customWidgetActive}
                    onclick={() => {
                      patchSelected({ kind });
                      customWidgetActive = false;
                      mappingActive = false;
                      tableMappingActive = false;
                      const newCache = { ...previewDataCache };
                      for (const key of Object.keys(newCache)) {
                        if (key.startsWith(selectedStream.id + ':')) delete newCache[key];
                      }
                      previewDataCache = newCache;
                    }}
                    title={meta.name}
                  >
                    <span class="kind-card-icon" style:color={'#22d3ee'}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text x="2" y="13" font-size="13" font-weight="800" fill="currentColor" font-family="monospace">{meta.icon}</text></svg>
                    </span>
                    <span class="kind-card-label">{meta.name}</span>
                  </button>
                {/each}
                <button
                  class="kind-card"
                  class:kind-card--active={customWidgetActive}
                  onclick={() => { customWidgetActive = true; }}
                  title="Custom Widget"
                >
                  <span class="kind-card-icon" style:color={'#a78bfa'}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><text x="2" y="13" font-size="13" font-weight="800" fill="currentColor" font-family="monospace">⚡</text></svg>
                  </span>
                  <span class="kind-card-label">Custom</span>
                </button>
              </div>
            </div>

            {#if selectedStream.kind === 'timeseries'}
              <div class="editor-section">
                <div class="section-label">Data field</div>
                <button
                  class="map-btn"
                  class:map-btn--active={mappingActive}
                  onclick={() => { mappingActive = !mappingActive; tableMappingActive = false; }}
                  title="Click then pick a field from the left panel"
                >
                  <span class="map-field">{getStreamField(selectedStream) || 'none selected'}</span>
                  <span class="map-hint">{mappingActive ? '← click field' : 'click to map →'}</span>
                </button>
              </div>
            {/if}

            {#if selectedStream.kind === 'table' || selectedStream.kind === 'log'}
              <div class="editor-section">
                <div class="section-label">{selectedStream.kind === 'log' ? 'Log fields' : 'Columns'}</div>
                <button
                  class="map-btn"
                  class:map-btn--active={tableMappingActive}
                  onclick={() => { tableMappingActive = !tableMappingActive; mappingActive = false; }}
                >
                  <span class="map-hint">{tableMappingActive ? '← toggle columns' : 'click to pick columns →'}</span>
                </button>
                {#if (selectedStream.fields ?? []).length > 0}
                  <div class="col-chips">
                    {#each selectedStream.fields ?? [] as f}
                      <span class="col-chip">
                        {f}
                        <button class="chip-del" onclick={() => {
                          const next = (selectedStream.fields ?? []).filter(x => x !== f);
                          patchSelected({ fields: next.length ? next : undefined });
                        }} aria-label="Remove column">×</button>
                      </span>
                    {/each}
                  </div>
                {:else}
                  <span class="field-hint">{selectedStream.kind === 'log' ? 'No fields picked — shows all' : 'No columns picked — shows all'}</span>
                {/if}
              </div>
            {/if}

            <div class="editor-row">
              <div class="editor-section editor-section--half">
                <div class="section-label">Width</div>
                <div class="span-ctrl">
                  {#each [1, 2, 3, 4] as sp}
                    <button
                      class="span-btn"
                      class:span-btn--active={(selectedStream.span ?? 2) === sp}
                      onclick={() => patchSelected({ span: sp as 1 | 2 | 3 | 4 })}
                      title={`${sp} column${sp > 1 ? 's' : ''}`}
                    >{sp}</button>
                  {/each}
                </div>
              </div>

              <div class="editor-section editor-section--half">
                <div class="section-label">Poll interval</div>
                <div class="poll-row">
                  <input
                    class="form-input"
                    type="number"
                    min="1000"
                    step="1000"
                    value={selectedStream.interval ?? 10000}
                    oninput={(e) => patchSelected({ interval: Number((e.currentTarget as HTMLInputElement).value) })}
                  />
                  <span class="poll-unit">ms</span>
                </div>
              </div>
            </div>

            {#if selectedStream.kind === 'timeseries' || selectedStream.kind === 'scalar'}
              <div class="editor-section">
                <div class="section-label">Unit label</div>
                <input
                  class="form-input"
                  placeholder="ms, %, B, req/s…"
                  value={selectedStream.unit ?? ''}
                  oninput={(e) => {
                    const v = (e.currentTarget as HTMLInputElement).value;
                    patchSelected({ unit: v || undefined });
                  }}
                />
              </div>
            {/if}

          </div>

          <!-- Preview -->
          <div class="preview-section">
            {#if customWidgetActive}
              <div class="preview-header">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4L1 6l2 2M9 4l2 2-2 2M5 9l2-6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Custom Widget Preview
                {#if customWidgetCode === 'loaded'}
                  <span class="preview-note" style="color:#34d399;">Loaded!</span>
                {:else}
                  <span class="preview-note">test before loading</span>
                {/if}
              </div>
              <div class="preview-widget">
                <CustomWidgetPreview
                  streamKind={selectedStream.kind}
                  onLoad={handleCustomWidgetLoad}
                />
              </div>
            {:else}
              <div class="preview-header">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 6s2-4 5-4 5 4 5 4-2 4-5 4-5-4-5-4z" stroke="currentColor" stroke-width="1.3"/><circle cx="6" cy="6" r="1.5" fill="currentColor"/></svg>
                Preview
                <span class="preview-note">sample data</span>
              </div>
              <div class="preview-widget">
                {#if previewData}
                  {#if previewData.kind === 'scalar'}
                    <Scalar data={previewData} />
                  {:else if previewData.kind === 'timeseries'}
                    <Timeseries data={previewData} unit={selectedStream.unit} />
                  {:else if previewData.kind === 'status'}
                    <StatusGrid data={previewData} />
                  {:else if previewData.kind === 'table'}
                    <Table data={previewData} />
                  {:else if previewData.kind === 'log'}
                    <LogFeed data={previewData} />
                  {:else if previewData.kind === 'raw'}
                    <RawJson data={previewData} />
                  {/if}
                {/if}
              </div>
            {/if}
          </div>

        {:else}
          <div class="editor-empty">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.2">
              <path d="M24 12v6M24 30v6M12 24h6M30 24h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <circle cx="24" cy="24" r="8" stroke="currentColor" stroke-width="2"/>
            </svg>
            <p>Select a widget to configure it,<br>or add one from the left panel.</p>
          </div>
        {/if}
      </div>

    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }

  .panel {
    background: var(--bg-card);
    border: 1px solid var(--bd-strong);
    border-radius: var(--r-xl);
    width: min(1060px, calc(100vw - 32px));
    height: min(700px, calc(100vh - 32px));
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 32px 96px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,255,255,0.04);
  }

  /* ── Header ── */
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-icon {
    color: var(--accent-2);
    flex-shrink: 0;
  }

  .panel-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--tx);
    letter-spacing: -0.02em;
  }

  .widget-count {
    font-size: 12px;
    color: var(--tx-3);
    background: rgba(255,255,255,0.05);
    border: 1px solid var(--bd);
    border-radius: 999px;
    padding: 1px 9px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-ghost {
    background: none;
    border: 1px solid var(--bd);
    border-radius: var(--r-sm);
    color: var(--tx-3);
    font-size: 12px;
    padding: 5px 12px;
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

  /* ── Body ── */
  .panel-body {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  /* ── Shared column heading ── */
  .col-heading {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--tx-3);
    padding: 10px 14px 8px;
    flex-shrink: 0;
  }

  /* ── Col 1: Pipeline ── */
  .col-pipeline {
    width: 248px;
    flex-shrink: 0;
    border-right: 1px solid var(--bd);
    display: flex;
    flex-direction: column;
    transition: background 0.15s;
  }

  .col-pipeline--mapping {
    background: rgba(99, 102, 241, 0.025);
  }

  .pipeline-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 0 12px 10px;
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
  }

  .pipeline-tab {
    background: none;
    border: 1px solid var(--bd);
    border-radius: var(--r-sm);
    color: var(--tx-3);
    font-size: 12px;
    padding: 4px 10px;
    cursor: pointer;
  }
  .pipeline-tab:hover { color: var(--tx-2); border-color: var(--bd-strong); }
  .pipeline-tab--active {
    background: rgba(99, 102, 241, 0.12);
    border-color: var(--accent);
    color: var(--accent-2);
  }

  .mapping-banner {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(99, 102, 241, 0.1);
    border-bottom: 1px solid rgba(99, 102, 241, 0.2);
    color: var(--accent-2);
    font-size: 12px;
    font-weight: 500;
    padding: 7px 14px;
    flex-shrink: 0;
  }
  .mapping-banner--table {
    background: rgba(167, 139, 250, 0.08);
    border-bottom-color: rgba(167, 139, 250, 0.2);
    color: #a78bfa;
  }
  .mapping-banner--hint {
    background: rgba(245, 158, 11, 0.07);
    border-bottom-color: rgba(245, 158, 11, 0.18);
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
    padding: 7px 12px;
    cursor: pointer;
    text-align: left;
  }
  .field-row:hover { background: var(--bg-card-h); }
  .field-row--mappable { cursor: crosshair; }
  .field-row--mappable:hover { background: rgba(99, 102, 241, 0.08); }
  .field-row--table-pick { cursor: pointer; }
  .field-row--table-pick:hover { background: rgba(167, 139, 250, 0.07); }
  .field-row--selected { background: rgba(167, 139, 250, 0.1); }

  .field-type-badge {
    font-size: 9px;
    font-weight: 600;
    font-family: var(--font-mono);
    border-radius: 3px;
    padding: 1px 5px;
    flex-shrink: 0;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .field-name {
    font-size: 12.5px;
    font-family: var(--font-mono);
    color: var(--tx);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .field-unit {
    font-size: 10.5px;
    color: var(--accent-2);
    font-family: var(--font-mono);
    flex-shrink: 0;
  }

  .field-sample {
    font-size: 10.5px;
    color: var(--tx-3);
    font-family: var(--font-mono);
    flex-shrink: 0;
  }

  .field-check { flex-shrink: 0; }

  .quick-add {
    border-top: 1px solid var(--bd);
    padding: 10px 12px;
    flex-shrink: 0;
  }

  .quick-add-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--tx-3);
    margin-bottom: 7px;
  }

  .quick-add-btns {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .quick-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    background: var(--bg-surface);
    border: 1px solid var(--bd);
    border-radius: var(--r-sm);
    color: var(--tx-3);
    font-size: 11.5px;
    padding: 5px 8px;
    cursor: pointer;
  }
  .quick-btn:hover:not(:disabled) { background: var(--bg-card-h); color: var(--tx-2); }
  .quick-btn:disabled { opacity: 0.3; cursor: default; }
  .quick-btn--ts { color: #22d3ee; border-color: rgba(34,211,238,0.25); }
  .quick-btn--ts:hover:not(:disabled) { background: rgba(34,211,238,0.06); }
  .quick-btn--tbl { color: #a78bfa; border-color: rgba(167,139,250,0.25); }
  .quick-btn--tbl:hover:not(:disabled) { background: rgba(167,139,250,0.06); }
  .quick-btn--log { color: #34d399; border-color: rgba(52,211,153,0.25); }
  .quick-btn--log:hover:not(:disabled) { background: rgba(52,211,153,0.06); }

  /* ── Col 2: Widget list ── */
  .col-widgets {
    width: 240px;
    flex-shrink: 0;
    border-right: 1px solid var(--bd);
    display: flex;
    flex-direction: column;
  }

  .widget-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 8px;
  }

  .widget-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 10px;
    border-radius: var(--r-md);
    cursor: pointer;
    margin-bottom: 2px;
  }
  .widget-row:hover { background: var(--bg-card-h); }
  .widget-row--active { background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99,102,241,0.15); }
  .widget-row:not(.widget-row--active) { border: 1px solid transparent; }

  .widget-row-icon {
    width: 30px;
    height: 30px;
    border-radius: var(--r-sm);
    border: 1px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .widget-row-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .widget-row-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--tx);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .widget-row-kind {
    font-size: 10.5px;
    color: var(--tx-3);
  }

  .widget-row-span {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .span-dot {
    width: 5px;
    height: 5px;
    border-radius: 1px;
    background: var(--bd-strong);
    transition: background 0.1s;
  }

  .span-dot--on { background: var(--accent-2); opacity: 0.6; }

  .widget-del {
    background: none;
    border: none;
    color: var(--tx-3);
    cursor: pointer;
    padding: 3px;
    border-radius: var(--r-sm);
    opacity: 0;
    display: flex;
    align-items: center;
    transition: opacity 0.1s;
    flex-shrink: 0;
  }
  .widget-row:hover .widget-del { opacity: 1; }
  .widget-del:hover { color: var(--fail); }

  .widget-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 40px 20px;
    text-align: center;
  }

  .widget-empty p {
    font-size: 13px;
    color: var(--tx-3);
    line-height: 1.5;
  }

  .col-footer {
    padding: 12px;
    border-top: 1px solid var(--bd);
    flex-shrink: 0;
  }

  .apply-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    background: var(--accent);
    border: none;
    border-radius: var(--r-md);
    color: white;
    font-size: 14px;
    font-weight: 600;
    padding: 10px 20px;
    cursor: pointer;
    letter-spacing: -0.01em;
  }
  .apply-btn:hover { background: var(--accent-2); }
  .apply-btn:disabled { opacity: 0.3; cursor: default; }

  /* ── Col 3: Editor + Preview ── */
  .col-editor {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .editor-scroll {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
    flex: 0 0 auto;
    max-height: 380px;
  }

  .editor-section {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .editor-section--half { flex: 1; }

  .editor-row {
    display: flex;
    gap: 16px;
  }

  .section-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--tx-3);
  }

  .name-input {
    background: var(--bg-input);
    border: 1px solid var(--bd-input);
    border-radius: var(--r-md);
    color: var(--tx);
    font-size: 15px;
    font-weight: 500;
    padding: 9px 12px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
    font-family: inherit;
  }
  .name-input:focus { border-color: var(--bd-accent); }
  .name-input::placeholder { color: var(--tx-3); font-weight: 400; font-size: 13px; }

  .kind-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .kind-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    background: var(--bg-surface);
    border: 1px solid var(--bd);
    border-radius: var(--r-md);
    padding: 10px 6px 8px;
    cursor: pointer;
    transition: border-color 0.1s, background 0.1s;
  }
  .kind-card:hover { background: var(--bg-card-h); border-color: var(--bd-strong); }
  .kind-card--active {
    background: rgba(99, 102, 241, 0.08);
    border-color: var(--accent);
  }

  .kind-card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 20px;
  }

  .kind-card-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--tx-2);
    white-space: nowrap;
  }

  .kind-card--active .kind-card-label { color: var(--accent-2); }

  .map-btn {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    background: var(--bg-input);
    border: 1px solid var(--bd-input);
    border-radius: var(--r-md);
    padding: 8px 12px;
    cursor: pointer;
    text-align: left;
    width: 100%;
    box-sizing: border-box;
  }
  .map-btn:hover { border-color: var(--bd-accent); }
  .map-btn--active {
    border-color: var(--accent);
    background: rgba(99, 102, 241, 0.07);
  }

  .map-field {
    font-size: 13px;
    font-family: var(--font-mono);
    color: var(--tx);
  }

  .map-hint {
    font-size: 11.5px;
    color: var(--accent-2);
    flex-shrink: 0;
  }

  .col-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 2px;
  }

  .col-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(167, 139, 250, 0.1);
    border: 1px solid rgba(167, 139, 250, 0.25);
    border-radius: var(--r-sm);
    color: #a78bfa;
    font-size: 12px;
    font-family: var(--font-mono);
    padding: 3px 8px;
  }

  .chip-del {
    background: none;
    border: none;
    color: #a78bfa;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 0;
    opacity: 0.6;
  }
  .chip-del:hover { opacity: 1; color: var(--fail); }

  .field-hint {
    font-size: 12px;
    color: var(--tx-3);
    font-style: italic;
  }

  .span-ctrl { display: flex; gap: 5px; }

  .span-btn {
    width: 36px;
    height: 32px;
    background: var(--bg-surface);
    border: 1px solid var(--bd);
    border-radius: var(--r-sm);
    color: var(--tx-3);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .span-btn:hover { border-color: var(--bd-strong); color: var(--tx-2); }
  .span-btn--active {
    background: rgba(99, 102, 241, 0.14);
    border-color: var(--accent);
    color: var(--accent-2);
    font-weight: 700;
  }

  .poll-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .form-input {
    background: var(--bg-input);
    border: 1px solid var(--bd-input);
    border-radius: var(--r-sm);
    color: var(--tx);
    font-size: 13px;
    padding: 7px 10px;
    outline: none;
    font-family: var(--font-mono);
    width: 100px;
  }
  .form-input:focus { border-color: var(--bd-accent); }

  .poll-unit {
    font-size: 12px;
    color: var(--tx-3);
    font-family: var(--font-mono);
  }

  /* ── Preview ── */
  .preview-section {
    flex: 1;
    min-height: 0;
    border-top: 1px solid var(--bd);
    display: flex;
    flex-direction: column;
  }

  .preview-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 9px 16px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--tx-3);
    flex-shrink: 0;
  }

  .preview-note {
    font-size: 10px;
    color: var(--tx-3);
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--bd);
    border-radius: 999px;
    padding: 1px 7px;
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
  }

  .preview-widget {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    padding: 0 16px 16px;
    display: flex;
    flex-direction: column;
  }

  .preview-widget > :global(*) {
    flex: 1;
    min-height: 0;
  }

  /* ── Empty editor ── */
  .editor-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 24px;
    text-align: center;
  }

  .editor-empty p {
    font-size: 14px;
    color: var(--tx-3);
    line-height: 1.6;
  }

  /* ── Utilities ── */
  .muted-sm { font-size: 12px; color: var(--tx-3); }
  .pad { display: block; padding: 14px; }
</style>
