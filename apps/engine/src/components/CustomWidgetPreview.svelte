<script lang="ts">
  import type { StreamData, Stream, StreamKind, TimeseriesData, ScalarData, StatusData, TableData, LogData, RawData } from '@beacon/contract';
  import type { WidgetConfig } from '../../lib/widgetConfig';

  let {
    streamKind,
    onLoad,
  }: {
    streamKind: StreamKind;
    onLoad: (manifest: unknown, mountFn: unknown) => void;
  } = $props();

  let activeTab = $state<'code' | 'preview'>('code');
  let code = $state(generateTemplate(streamKind));
  let error = $state<string | null>(null);
  let previewEl = $state<HTMLDivElement | undefined>();

  function generateTemplate(kind: StreamKind): string {
    const templates: Record<StreamKind, string> = {
      scalar: `// Scalar Widget Template
export function mount(element, props) {
  const { data, config } = props;

  // Validate data kind
  if (data.kind !== 'scalar') {
    element.innerHTML = '<div style="color:#f87171;padding:16px;">Requires scalar data</div>';
    return { update() {}, destroy() {} };
  }

  const color = config.colorScheme === 'cyan' ? '#22d3ee'
              : config.colorScheme === 'green' ? '#34d399'
              : '#6366f1';

  // Render
  element.innerHTML = \`
    <div style="
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      height: 100%; gap: 8px;
      font-family: var(--font-mono, monospace);
    ">
      <div style="
        font-size: 36px; font-weight: 700; color: var(--tx);
      ">\${data.value}<span style="font-size:18px;color:var(--tx-3);">\${data.unit ?? ''}</span></div>
      \${data.trend ? \`<span style="font-size:12px;color:\${color};">\${data.trend === 'up' ? '↑' : data.trend === 'down' ? '↓' : '→'} \${data.change?.toFixed(1) ?? 0}%</span>\` : ''}
    </div>
  \`;

  return {
    update(newProps) { mount(element, newProps); },
    destroy() { element.innerHTML = ''; }
  };
}`,
      timeseries: `// Timeseries Widget Template
export function mount(element, props) {
  const { data, config } = props;

  if (data.kind !== 'timeseries') {
    element.innerHTML = '<div style="color:#f87171;padding:16px;">Requires timeseries data</div>';
    return { update() {}, destroy() {} };
  }

  const color = config.colorScheme === 'cyan' ? '#22d3ee'
              : config.colorScheme === 'green' ? '#34d399'
              : '#6366f1';

  const points = data.points.slice(-20);
  const max = Math.max(...points.map(p => p.v), 1);

  element.innerHTML = \`
    <div style="display:flex;flex-direction:column;height:100%;gap:4px;padding:8px;font-family:var(--font-mono,monospace);">
      \${points.map((p, i) => {
        const width = (p.v / max) * 100;
        const time = new Date(p.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return \`
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:10px;color:#6b7280;width:40px;text-align:right;">\${time}</span>
            <div style="flex:1;height:8px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden;">
              <div style="width:\${width}%;height:100%;background:\${color};border-radius:2px;"></div>
            </div>
            <span style="font-size:10px;color:#9ca3af;width:50px;">\${p.v.toFixed(1)}\${data.unit ?? ''}</span>
          </div>
        \`;
      }).join('')}
    </div>
  \`;

  return {
    update(newProps) { mount(element, newProps); },
    destroy() { element.innerHTML = ''; }
  };
}`,
      status: `// Status Widget Template
export function mount(element, props) {
  const { data } = props;

  if (data.kind !== 'status') {
    element.innerHTML = '<div style="color:#f87171;padding:16px;">Requires status data</div>';
    return { update() {}, destroy() {} };
  }

  const s = data.summary ?? { ok: 0, fail: 0, warn: 0, total: data.points.length };
  const okRate = s.total > 0 ? ((s.ok / s.total) * 100).toFixed(1) : '0.0';

  element.innerHTML = \`
    <div style="
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      height:100%;gap:12px;font-family:var(--font-sans,sans-serif);
    ">
      <div style="display:flex;gap:24px;font-size:13px;font-weight:500;">
        <span style="color:#34d399;">● \${s.ok} ok</span>
        <span style="color:#f87171;">● \${s.fail} fail</span>
        \${s.warn > 0 ? \`<span style="color:#f59e0b;">● \${s.warn} warn</span>\` : ''}
      </div>
      <div style="
        font-size:32px;font-weight:700;font-family:var(--font-mono,monospace);
        color:\${s.fail > 0 ? '#f87171' : '#34d399'};
      ">\${okRate}%</div>
      <div style="font-size:11px;color:#6b7280;">success rate</div>
    </div>
  \`;

  return {
    update(newProps) { mount(element, newProps); },
    destroy() { element.innerHTML = ''; }
  };
}`,
      table: `// Table Widget Template
export function mount(element, props) {
  const { data } = props;

  if (data.kind !== 'table') {
    element.innerHTML = '<div style="color:#f87171;padding:16px;">Requires table data</div>';
    return { update() {}, destroy() {} };
  }

  const cols = data.rows.length > 0 ? Object.keys(data.rows[0]) : [];
  const colWidth = 100 / Math.max(cols.length, 1);

  element.innerHTML = \`
    <div style="height:100%;overflow:auto;font-family:var(--font-mono,monospace);">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="border-bottom:1px solid var(--bd);">
            \${cols.map(c => \`<th style="padding:8px;text-align:left;color:var(--tx-3);font-weight:500;width:\${colWidth}%;">\${c}</th>\`).join('')}
          </tr>
        </thead>
        <tbody>
          \${data.rows.map(row => \`
            <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
              \${cols.map(c => \`<td style="padding:8px;color:var(--tx-2);">\${String(row[c] ?? '')}</td>\`).join('')}
            </tr>
          \`).join('')}
        </tbody>
      </table>
    </div>
  \`;

  return {
    update(newProps) { mount(element, newProps); },
    destroy() { element.innerHTML = ''; }
  };
}`,
      log: `// Log Widget Template
export function mount(element, props) {
  const { data } = props;

  if (data.kind !== 'log') {
    element.innerHTML = '<div style="color:#f87171;padding:16px;">Requires log data</div>';
    return { update() {}, destroy() {} };
  }

  const levelColors = { info: '#22d3ee', warn: '#f59e0b', error: '#f87171', debug: '#6b7280' };

  element.innerHTML = \`
    <div style="height:100%;overflow:auto;font-family:var(--font-mono,monospace);padding:8px;display:flex;flex-direction:column;gap:4px;">
      \${data.lines.map(line => \`
        <div style="display:flex;gap:8px;font-size:11px;line-height:1.4;">
          <span style="color:#6b7280;flex-shrink:0;">\${new Date(line.t).toLocaleTimeString()}</span>
          <span style="color:\${levelColors[line.level] ?? '#6b7280'};flex-shrink:0;text-transform:uppercase;font-size:10px;">\${line.level}</span>
          <span style="color:var(--tx-2);word-break:break-all;">\${line.msg}</span>
        </div>
      \`).join('')}
    </div>
  \`;

  return {
    update(newProps) { mount(element, newProps); },
    destroy() { element.innerHTML = ''; }
  };
}`,
      raw: `// Raw JSON Widget Template
export function mount(element, props) {
  const { data } = props;

  if (data.kind !== 'raw') {
    element.innerHTML = '<div style="color:#f87171;padding:16px;">Requires raw data</div>';
    return { update() {}, destroy() {} };
  }

  const json = JSON.stringify(data.data, null, 2);

  element.innerHTML = \`
    <div style="height:100%;overflow:auto;padding:12px;">
      <pre style="
        margin:0;font-family:var(--font-mono,monospace);
        font-size:11px;color:var(--tx-2);line-height:1.5;
        white-space:pre-wrap;word-break:break-all;
      ">\${json}</pre>
    </div>
  \`;

  return {
    update(newProps) { mount(element, newProps); },
    destroy() { element.innerHTML = ''; }
  };
}`,
    };
    return templates[kind] ?? templates.raw;
  }

  function mockData(kind: StreamKind): StreamData {
    switch (kind) {
      case 'scalar':
        return { kind: 'scalar', value: 94.3, unit: '%', trend: 'up', change: 2.1 } satisfies ScalarData;
      case 'timeseries':
        const now = Date.now();
        return {
          kind: 'timeseries',
          unit: 'ms',
          points: Array.from({ length: 20 }, (_, i) => ({
            t: new Date(now - (20 - i) * 12_000).toISOString(),
            v: 80 + Math.random() * 40,
          })),
        } satisfies TimeseriesData;
      case 'status': {
        const statuses: Array<'ok' | 'fail'> = Array.from({ length: 20 }, () =>
          Math.random() > 0.1 ? 'ok' : 'fail'
        );
        const now = Date.now();
        return {
          kind: 'status',
          points: statuses.map((status, i) => ({
            id: `r_${i}`,
            status,
            timestamp: new Date(now - (20 - i) * 60_000).toISOString(),
          })),
          summary: {
            ok: statuses.filter(s => s === 'ok').length,
            fail: statuses.filter(s => s === 'fail').length,
            warn: 0,
            total: statuses.length,
          },
        } satisfies StatusData;
      }
      case 'table':
        return {
          kind: 'table',
          rows: Array.from({ length: 5 }, (_, i) => ({
            run_id: `run_${i.toString(16).padStart(4, '0')}`,
            status: i === 2 ? 'fail' : 'ok',
            duration: `${Math.floor(Math.random() * 200 + 10)}ms`,
            records: Math.floor(Math.random() * 1000),
          })),
        } satisfies TableData;
      case 'log':
        return {
          kind: 'log',
          lines: Array.from({ length: 8 }, (_, i) => ({
            t: new Date(Date.now() - i * 5_000).toISOString(),
            level: i === 3 ? 'warn' : i === 6 ? 'error' : 'info',
            msg: i === 3 ? 'Slow query detected (200ms)' : i === 6 ? 'Connection timeout' : `Processing batch ${i}`,
          })),
        } satisfies LogData;
      case 'raw':
        return {
          kind: 'raw',
          data: { pipeline: 'example', status: 'ok', runs: 48, metrics: { avg_ms: 134, p95_ms: 210 } },
        } satisfies RawData;
      default:
        return { kind: 'raw', data: null } satisfies RawData;
    }
  }

  let currentMount: { update: (props: unknown) => void; destroy: () => void } | null = null;

  function runPreview() {
    if (!previewEl) return;
    error = null;

    try {
      const blob = new Blob([code], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);

      import(/* @vite-ignore */ url)
        .then((mod) => {
          if (typeof mod.mount !== 'function') {
            error = 'widget.js must export a mount(element, props) function';
            return;
          }

          if (currentMount) {
            currentMount.destroy();
          }

          const mockProps = {
            data: mockData(streamKind),
            stream: { id: 'preview', label: 'Preview', kind: streamKind },
            config: { chartType: 'line' as const, colorScheme: 'indigo' as const },
            thresholds: undefined,
          };

          currentMount = mod.mount(previewEl, mockProps);
        })
        .catch((err) => {
          error = `Import error: ${err.message}`;
        })
        .finally(() => {
          URL.revokeObjectURL(url);
        });
    } catch (err) {
      error = `Syntax error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  function handleLoad() {
    const manifest = {
      kind: streamKind,
      name: 'Custom Widget',
      compatibleKinds: [streamKind],
    };
    const blob = new Blob([code], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);

    import(/* @vite-ignore */ url)
      .then((mod) => {
        if (typeof mod.mount !== 'function') {
          error = 'widget.js must export a mount(element, props) function';
          return;
        }
        onLoad(manifest, mod.mount);
      })
      .catch((err) => {
        error = `Import error: ${err.message}`;
      });
  }

  $effect(() => {
    if (activeTab === 'preview' && previewEl) {
      runPreview();
    }
  });
</script>

<div class="preview-container">
  <div class="preview-tabs">
    <button
      class="tab"
      class:tab--active={activeTab === 'code'}
      onclick={() => { activeTab = 'code'; }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M3 4L1 6l2 2M9 4l2 2-2 2M5 9l2-6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Code
    </button>
    <button
      class="tab"
      class:tab--active={activeTab === 'preview'}
      onclick={() => { activeTab = 'preview'; }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M1 6s2-4 5-4 5 4 5 4-2 4-5 4-5-4-5-4z" stroke="currentColor" stroke-width="1.3"/>
        <circle cx="6" cy="6" r="1.5" fill="currentColor"/>
      </svg>
      Preview
    </button>
  </div>

  {#if activeTab === 'code'}
    <div class="code-editor">
      <textarea
        class="code-textarea"
        bind:value={code}
        spellcheck="false"
        placeholder="// Write your widget code here..."
      ></textarea>
      {#if error}
        <div class="error-banner">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" stroke="#f87171" stroke-width="1.2"/>
            <path d="M6 3v4M6 8v1" stroke="#f87171" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
          {error}
        </div>
      {/if}
    </div>
  {:else}
    <div class="preview-area">
      {#if error}
        <div class="error-inline">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#f87171" stroke-width="1.3"/>
            <path d="M8 4v5M8 10.5v1" stroke="#f87171" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>{error}</span>
        </div>
      {/if}
      <div bind:this={previewEl} class="preview-target"></div>
    </div>
  {/if}

  <div class="preview-actions">
    <button class="action-btn action-btn--secondary" onclick={() => { activeTab = 'preview'; runPreview(); }}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M1 6s2-4 5-4 5 4 5 4-2 4-5 4-5-4-5-4z" stroke="currentColor" stroke-width="1.3"/>
        <circle cx="6" cy="6" r="1.5" fill="currentColor"/>
      </svg>
      Test
    </button>
    <button class="action-btn action-btn--primary" onclick={handleLoad}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M6 1v7M3 5l3 3 3-3M2 10h8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Load Widget
    </button>
  </div>
</div>

<style>
  .preview-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-card);
    border: 1px solid var(--bd);
    border-radius: var(--r-lg);
    overflow: hidden;
  }

  .preview-tabs {
    display: flex;
    gap: 4px;
    padding: 8px 8px 0;
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 5px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--tx-3);
    font-size: 12px;
    font-weight: 500;
    padding: 6px 10px;
    cursor: pointer;
    margin-bottom: -1px;
    transition: color 0.15s;
  }

  .tab:hover { color: var(--tx-2); }
  .tab--active {
    color: var(--accent-2);
    border-bottom-color: var(--accent);
  }

  .code-editor {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .code-textarea {
    flex: 1;
    background: var(--bg);
    border: none;
    color: var(--tx);
    font-family: var(--font-mono, monospace);
    font-size: 12px;
    line-height: 1.5;
    padding: 12px;
    resize: none;
    outline: none;
    tab-size: 2;
  }

  .code-textarea::placeholder {
    color: var(--tx-3);
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(248, 113, 113, 0.1);
    border-top: 1px solid rgba(248, 113, 113, 0.2);
    color: #f87171;
    font-size: 11px;
    padding: 8px 12px;
  }

  .preview-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    position: relative;
  }

  .error-inline {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(248, 113, 113, 0.1);
    border: 1px solid rgba(248, 113, 113, 0.3);
    border-radius: var(--r-md);
    color: #f87171;
    font-size: 12px;
    padding: 12px 16px;
    z-index: 10;
  }

  .preview-target {
    flex: 1;
    min-height: 0;
  }

  .preview-actions {
    display: flex;
    gap: 8px;
    padding: 10px;
    border-top: 1px solid var(--bd);
    flex-shrink: 0;
  }

  .action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 1px solid var(--bd);
    border-radius: var(--r-md);
    font-size: 12px;
    font-weight: 500;
    padding: 8px 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .action-btn--secondary {
    background: var(--bg-surface);
    color: var(--tx-2);
  }

  .action-btn--secondary:hover {
    background: var(--bg-card-h);
    color: var(--tx);
  }

  .action-btn--primary {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }

  .action-btn--primary:hover {
    background: var(--accent-2);
    border-color: var(--accent-2);
  }
</style>
