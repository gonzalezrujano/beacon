<script lang="ts">
  import { loadPluginFromFile, registerPlugin, type LoadedPlugin, type PluginManifest } from '../lib/pluginLoader';

  const { onclose }: { onclose: () => void } = $props();

  let loaded = $state<Array<{ plugin: LoadedPlugin; id: string }>>([]);
  let pending = $state<LoadedPlugin | null>(null);
  let error   = $state<string | null>(null);
  let loading = $state(false);
  let dragging = $state(false);

  let fileInput: HTMLInputElement;

  async function processFile(file: File) {
    if (!file.name.endsWith('.zip')) {
      error = 'File must be a .zip archive';
      return;
    }
    error = null;
    loading = true;
    try {
      pending = await loadPluginFromFile(file);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      pending = null;
    } finally {
      loading = false;
    }
  }

  function confirmLoad() {
    if (!pending) return;
    registerPlugin(pending);
    loaded = [...loaded, { plugin: pending, id: crypto.randomUUID() }];
    pending = null;
    error = null;
  }

  function cancelPending() {
    pending = null;
    error = null;
  }

  function removeLoaded(id: string) {
    loaded = loaded.filter(e => e.id !== id);
  }

  function onDrop(e: DragEvent) {
    dragging = false;
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file) void processFile(file);
  }

  function onInputChange(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (file) void processFile(file);
    (e.currentTarget as HTMLInputElement).value = '';
  }
</script>

<div class="backdrop" onclick={() => onclose()}>
  <div class="panel" role="dialog" aria-label="Plugin Manager" onclick={(e) => e.stopPropagation()}>

    <div class="panel-header">
      <div class="header-left">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M6 2H3a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1zM13 2h-3a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1zM6 9H3a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1zM13 11.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM11.5 9v1M11.5 14v1M9 11.5h1M14 11.5h1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        <span class="panel-title">Plugin Manager</span>
        {#if loaded.length > 0}
          <span class="count-badge">{loaded.length} loaded</span>
        {/if}
      </div>
      <button class="close-btn" onclick={() => onclose()} aria-label="Close">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <div class="panel-body">

      <div class="col-load">

        {#if pending}
          <div class="confirm-card">
            <div class="confirm-icon">{pending.manifest.icon ?? '🔌'}</div>
            <div class="confirm-info">
              <div class="confirm-name">{pending.manifest.name}</div>
              {#if pending.manifest.version}
                <div class="confirm-meta">v{pending.manifest.version}</div>
              {/if}
            </div>
            <div class="confirm-rows">
              <div class="confirm-row">
                <span class="confirm-label">Kind</span>
                <span class="badge badge--kind">{pending.manifest.kind}</span>
              </div>
              {#if pending.manifest.compatibleKinds && pending.manifest.compatibleKinds.length > 1}
                <div class="confirm-row">
                  <span class="confirm-label">Also renders</span>
                  <div class="badge-row">
                    {#each pending.manifest.compatibleKinds.filter(k => k !== pending!.manifest.kind) as k}
                      <span class="badge badge--compat">{k}</span>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
            <div class="confirm-warning">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1L11 10H1L6 1z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M6 5v2.5M6 9h.01" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
              This executes JavaScript from the ZIP. Only load plugins you trust.
            </div>
            <div class="confirm-actions">
              <button class="btn-cancel" onclick={cancelPending}>Cancel</button>
              <button class="btn-confirm" onclick={confirmLoad}>Load Plugin</button>
            </div>
          </div>

        {:else}
          <div
            class="drop-zone"
            class:drop-zone--over={dragging}
            class:drop-zone--loading={loading}
            ondragover={(e) => { e.preventDefault(); dragging = true; }}
            ondragleave={() => dragging = false}
            ondrop={onDrop}
            onclick={() => fileInput.click()}
          >
            <input
              bind:this={fileInput}
              type="file"
              accept=".zip"
              class="file-input"
              onchange={onInputChange}
            />
            {#if loading}
              <div class="drop-spinner"></div>
              <span class="drop-label">Parsing plugin…</span>
            {:else}
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" opacity="0.4" aria-hidden="true">
                <rect x="4" y="4" width="24" height="24" rx="3" stroke="currentColor" stroke-width="1.5"/>
                <path d="M16 10v12M10 16l6-6 6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span class="drop-label">Drop <code>.zip</code> plugin here</span>
              <span class="drop-sub">or click to browse</span>
            {/if}
          </div>

          {#if error}
            <div class="error-banner">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.2"/><path d="M6 4v2.5M6 8h.01" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
              {error}
            </div>
          {/if}

          <div class="format-hint">
            <div class="hint-title">Expected ZIP format</div>
            <pre class="hint-pre">plugin.zip
├── manifest.json
└── widget.js    ← ESM, exports mount()</pre>
          </div>
        {/if}
      </div>

      <div class="col-list">
        <div class="col-heading">Loaded plugins</div>

        {#if loaded.length === 0}
          <div class="list-empty">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" opacity="0.2" aria-hidden="true">
              <rect x="4" y="4" width="28" height="28" rx="4" stroke="currentColor" stroke-width="1.5"/>
              <path d="M12 18h12M18 12v12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <p>No plugins loaded yet.<br>Plugins are session-only — they reset on refresh.</p>
          </div>
        {:else}
          <div class="plugin-list">
            {#each loaded as { plugin, id } (id)}
              <div class="plugin-row">
                <span class="plugin-icon">{plugin.manifest.icon ?? '🔌'}</span>
                <div class="plugin-info">
                  <span class="plugin-name">{plugin.manifest.name}</span>
                  {#if plugin.manifest.version}
                    <span class="plugin-version">v{plugin.manifest.version}</span>
                  {/if}
                </div>
                <span class="badge badge--kind">{plugin.manifest.kind}</span>
                <button
                  class="plugin-remove"
                  onclick={() => removeLoaded(id)}
                  title="Remove plugin"
                  aria-label="Remove plugin"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
                </button>
              </div>
            {/each}
          </div>

          <div class="session-note">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" stroke-width="1.1"/><path d="M5.5 3.5v2.5M5.5 7.5h.01" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>
            Plugins are session-only and reset on refresh.
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
    width: min(700px, calc(100vw - 32px));
    max-height: calc(100vh - 64px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 32px 96px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,255,255,0.04);
  }

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
    color: var(--accent-2);
  }

  .panel-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--tx);
    letter-spacing: -0.02em;
  }

  .count-badge {
    font-size: 12px;
    color: var(--tx-3);
    background: rgba(255,255,255,0.05);
    border: 1px solid var(--bd);
    border-radius: 999px;
    padding: 1px 9px;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--tx-3);
    cursor: pointer;
    padding: 6px;
    border-radius: var(--r-sm);
    display: flex;
    align-items: center;
  }
  .close-btn:hover { background: var(--bg-card-h); color: var(--tx); }

  .panel-body {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .col-load {
    width: 320px;
    flex-shrink: 0;
    border-right: 1px solid var(--bd);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow-y: auto;
  }

  .drop-zone {
    border: 1.5px dashed var(--bd-strong);
    border-radius: var(--r-lg);
    padding: 36px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    user-select: none;
    text-align: center;
  }
  .drop-zone:hover { border-color: var(--accent); background: rgba(99,102,241,0.04); }
  .drop-zone--over { border-color: var(--accent); background: rgba(99,102,241,0.08); }
  .drop-zone--loading { cursor: default; pointer-events: none; }

  .file-input { display: none; }

  .drop-spinner {
    width: 28px;
    height: 28px;
    border: 2px solid rgba(99,102,241,0.2);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .drop-label {
    font-size: 13px;
    color: var(--tx-2);
    font-weight: 500;
  }
  .drop-label code {
    font-family: var(--font-mono);
    color: var(--accent-2);
    background: rgba(99,102,241,0.1);
    border-radius: 3px;
    padding: 0 4px;
  }

  .drop-sub {
    font-size: 12px;
    color: var(--tx-3);
  }

  .error-banner {
    display: flex;
    align-items: flex-start;
    gap: 7px;
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.25);
    border-radius: var(--r-md);
    color: var(--fail);
    font-size: 12.5px;
    padding: 10px 12px;
    line-height: 1.4;
  }
  .error-banner svg { flex-shrink: 0; margin-top: 1px; }

  .format-hint {
    border: 1px solid var(--bd);
    border-radius: var(--r-md);
    padding: 12px 14px;
    background: rgba(255,255,255,0.015);
  }

  .hint-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--tx-3);
    margin-bottom: 8px;
  }

  .hint-pre {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--tx-2);
    margin: 0;
    line-height: 1.7;
    white-space: pre;
  }

  .confirm-card {
    background: rgba(99,102,241,0.05);
    border: 1px solid rgba(99,102,241,0.2);
    border-radius: var(--r-lg);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .confirm-icon {
    font-size: 28px;
    line-height: 1;
  }

  .confirm-info {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .confirm-name {
    font-size: 18px;
    font-weight: 700;
    color: var(--tx);
    letter-spacing: -0.02em;
  }

  .confirm-meta {
    font-size: 12px;
    color: var(--tx-3);
    font-family: var(--font-mono);
  }

  .confirm-rows {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .confirm-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .confirm-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--tx-3);
    width: 80px;
    flex-shrink: 0;
  }

  .badge-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .badge {
    font-family: var(--font-mono);
    font-size: 10.5px;
    border-radius: 4px;
    padding: 2px 6px;
  }

  .badge--kind {
    color: var(--accent-2);
    background: rgba(99,102,241,0.12);
    border: 1px solid rgba(99,102,241,0.3);
  }

  .badge--compat {
    color: var(--tx-2);
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--bd);
  }

  .confirm-warning {
    display: flex;
    align-items: flex-start;
    gap: 7px;
    background: rgba(245,158,11,0.07);
    border: 1px solid rgba(245,158,11,0.2);
    border-radius: var(--r-md);
    color: var(--warn);
    font-size: 12px;
    padding: 9px 11px;
    line-height: 1.4;
  }
  .confirm-warning svg { flex-shrink: 0; margin-top: 1px; }

  .confirm-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .btn-cancel {
    background: none;
    border: 1px solid var(--bd);
    border-radius: var(--r-sm);
    color: var(--tx-3);
    font-size: 13px;
    padding: 7px 14px;
    cursor: pointer;
  }
  .btn-cancel:hover { color: var(--tx); border-color: var(--bd-strong); }

  .btn-confirm {
    background: var(--accent);
    border: none;
    border-radius: var(--r-sm);
    color: white;
    font-size: 13px;
    font-weight: 600;
    padding: 7px 16px;
    cursor: pointer;
  }
  .btn-confirm:hover { background: var(--accent-2); }

  .col-list {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .col-heading {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--tx-3);
    padding: 12px 16px 10px;
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
  }

  .list-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 32px 24px;
    text-align: center;
  }

  .list-empty p {
    font-size: 13px;
    color: var(--tx-3);
    line-height: 1.6;
  }

  .plugin-list {
    flex: 1;
    overflow-y: auto;
    padding: 6px 10px;
  }

  .plugin-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 8px;
    border-radius: var(--r-md);
    border: 1px solid transparent;
    margin-bottom: 2px;
  }
  .plugin-row:hover { background: var(--bg-card-h); border-color: var(--bd); }

  .plugin-icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  .plugin-info {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .plugin-name {
    font-size: 13.5px;
    font-weight: 500;
    color: var(--tx);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .plugin-version {
    font-size: 11px;
    color: var(--tx-3);
    font-family: var(--font-mono);
    flex-shrink: 0;
  }

  .plugin-remove {
    background: none;
    border: none;
    color: var(--tx-3);
    cursor: pointer;
    padding: 4px;
    border-radius: var(--r-sm);
    opacity: 0;
    display: flex;
    align-items: center;
    transition: opacity 0.1s;
    flex-shrink: 0;
  }
  .plugin-row:hover .plugin-remove { opacity: 1; }
  .plugin-remove:hover { color: var(--fail); }

  .session-note {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    border-top: 1px solid var(--bd);
    font-size: 11px;
    color: var(--tx-3);
    flex-shrink: 0;
  }
</style>