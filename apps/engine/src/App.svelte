<script lang="ts">
  import { onMount } from 'svelte';
  import Dashboard from './components/Dashboard.svelte';
  import BeaconLogo from './components/ui/BeaconLogo.svelte';
  import TemplatesPanel from './components/TemplatesPanel.svelte';
  import DashboardBuilder from './components/DashboardBuilder.svelte';
  import PluginManager from './components/PluginManager.svelte';
  import { store } from './lib/store.svelte';
  import './lib/widgetRegistrations';
  import { loadMock, startMockLive } from './lib/mock';
  import { connectShelby, connectContract, stopShelby } from './lib/adapters/shelby';

  let srcInput = $state('');
  let showTemplates = $state(false);
  let showDashboardBuilder = $state(false);
  let showPluginManager = $state(false);

  onMount(() => {
    const src = new URLSearchParams(location.search).get('src') ?? '';
    if (src) {
      srcInput = src;
      void connect(src);
    } else {
      loadMock();
      startMockLive();
    }
  });

  async function connect(src: string) {
    src = src.trim();
    if (!src) { loadMock(); startMockLive(); return; }
    if (src === 'mock') { loadMock(); startMockLive(); return; }

    // /beacon/contract endpoint → generic contract adapter
    if (src.endsWith('/beacon/contract') || src.includes('/beacon/contract?')) {
      await connectContract(src);
      return;
    }

    // Plain base URL → Shelby discovery
    const base = src.replace(/\/$/, '');
    await connectShelby(base);
  }

  const statusColor = $derived(
    store.status === 'connected'  ? 'var(--ok)'   :
    store.status === 'connecting' ? 'var(--warn)'  :
    store.status === 'error'      ? 'var(--fail)'  :
    'var(--tx-3)'
  );

  const statusLabel = $derived(
    store.status === 'connected'  ? 'live' :
    store.status === 'connecting' ? 'connecting…' :
    store.status === 'error'      ? 'error' :
    'offline'
  );
</script>

{#if store.contract}
  <div class="shell">
    <!-- ── Top bar ───────────────────────────────── -->
    <header class="bar">
      <div class="bar-left">
        <BeaconLogo size={18} />
        <span class="bar-sep">/</span>
        <span class="bar-name">{store.contract.meta.name}</span>
        {#if store.contract.meta.description}
          <span class="bar-desc">{store.contract.meta.description}</span>
        {/if}
      </div>

      <div class="bar-right">
        <div class="status-pill" style:--dot-color={statusColor}>
          <span class="status-dot"></span>
          <span class="status-label">{statusLabel}</span>
        </div>

        {#if store.isEditing}
          {#if store.hiddenInstances.size > 0}
            <span class="hidden-badge">{store.hiddenInstances.size} hidden</span>
          {/if}
          <button class="layout-btn layout-btn--active" title="Exit edit mode" onclick={() => store.exitEditMode()}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M1 1l11 11M12 1L1 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            Done
          </button>
          <button class="icon-btn" title="Reset layout" onclick={() => store.resetLayout()}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 8a6 6 0 1 0 1.5-3.9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              <path d="M2 3.5V8h4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        {:else}
          <button class="icon-btn" title="Edit layout" onclick={() => store.enterEditMode()}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
              <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
              <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
              <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
            </svg>
          </button>
        {/if}

        {#if store.currentBaseUrl}
          <button
            class="icon-btn"
            class:icon-btn--active={showDashboardBuilder}
            title="Dashboard Builder"
            onclick={() => showDashboardBuilder = !showDashboardBuilder}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="4" cy="4" r="1.5" stroke="currentColor" stroke-width="1.3"/>
              <circle cx="4" cy="12" r="1.5" stroke="currentColor" stroke-width="1.3"/>
              <circle cx="12" cy="8" r="1.5" stroke="currentColor" stroke-width="1.3"/>
              <path d="M5.5 4h7M5.5 12h7M1 8h9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
          </button>
        {/if}

        <button class="icon-btn" class:icon-btn--active={showTemplates} title="Templates" onclick={() => showTemplates = !showTemplates}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2 3h12M2 8h12M2 13h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        </button>

        {#if store.contract}
          <button class="icon-btn" class:icon-btn--active={showPluginManager} title="Plugin Manager" onclick={() => showPluginManager = !showPluginManager}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/>
              <rect x="9.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/>
              <rect x="1.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/>
              <circle cx="12" cy="12" r="2.5" stroke="currentColor" stroke-width="1.3"/>
              <path d="M12 10.5v1.5M12 13.5v.5M10.5 12h1.5M13.5 12h.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
            </svg>
          </button>
        {/if}
      </div>
    </header>

    <!-- ── Dashboard ─────────────────────────────── -->
    <main class="content">
      <Dashboard />
    </main>
  </div>

  {#if showTemplates}
    <TemplatesPanel onclose={() => showTemplates = false} />
  {/if}

  {#if showDashboardBuilder && store.currentBaseUrl}
    <DashboardBuilder baseUrl={store.currentBaseUrl} onclose={() => showDashboardBuilder = false} />
  {/if}

  {#if showPluginManager}
    <PluginManager onclose={() => showPluginManager = false} />
  {/if}

{:else}
  <!-- ── Landing / connect screen ──────────────── -->
  <div class="landing">
    <div class="card setup-card">
      <div class="setup-logo">
        <BeaconLogo size={40} glow />
        <h1 class="setup-title">Beacon</h1>
        <p class="setup-sub">Universal dashboard engine</p>
      </div>

      <div class="setup-form">
        <label class="form-label" for="src-input">Data source</label>
        <div class="input-row">
          <input
            id="src-input"
            class="text-input"
            type="text"
            placeholder="http://localhost:8080/beacon/contract"
            bind:value={srcInput}
            onkeydown={(e) => { if (e.key === 'Enter') loadMock(); }}
          />
          <button class="btn-primary" onclick={() => void connect(srcInput)}>Connect</button>
        </div>

        <div class="presets">
          <button class="preset-btn" onclick={() => void connect('mock')}>
            <span class="preset-icon">◈</span>
            Demo data
          </button>
          <button class="preset-btn" onclick={() => { srcInput = 'http://localhost:8080'; void connect('http://localhost:8080'); }}>
            <span class="preset-icon">⬡</span>
            Local Shelby
          </button>
        </div>
      </div>

      {#if store.error}
        <div class="error-msg">{store.error}</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* ── Shell ── */
  .shell {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ── Top bar ── */
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    height: 44px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--bd);
    background: rgba(7, 8, 15, 0.7);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .bar-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .bar-sep {
    color: var(--tx-3);
    font-size: 15px;
    font-weight: 300;
    flex-shrink: 0;
  }

  .bar-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--tx);
    white-space: nowrap;
    letter-spacing: -0.01em;
  }

  .bar-desc {
    font-size: 11px;
    color: var(--tx-3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bar-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.03);
    font-size: 11px;
    color: var(--tx-2);
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--dot-color);
    box-shadow: 0 0 6px var(--dot-color);
  }

  .status-label { font-family: var(--font-mono); font-size: 10.5px; }

  .icon-btn {
    background: none;
    border: none;
    color: var(--tx-3);
    cursor: pointer;
    padding: 5px;
    border-radius: var(--r-sm);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .icon-btn:hover { background: var(--bg-card-h); color: var(--tx-2); }
  .icon-btn--active { color: var(--accent-2); background: rgba(99,102,241,0.1); }

  .layout-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: none;
    border: 1px solid var(--bd);
    border-radius: var(--r-sm);
    color: var(--tx-3);
    font-size: 11.5px;
    font-weight: 500;
    padding: 4px 10px;
    cursor: pointer;
  }
  .layout-btn:hover { background: var(--bg-card-h); color: var(--tx-2); }

  .layout-btn--active {
    border-color: var(--accent);
    color: var(--accent-2);
    background: rgba(99,102,241,0.08);
  }
  .layout-btn--active:hover { background: rgba(99,102,241,0.15); }

  .hidden-badge {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--tx-3);
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--bd);
    border-radius: 999px;
    padding: 2px 9px;
  }

  /* ── Main content ── */
  .content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* ── Landing ── */
  .landing {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .card {
    background: var(--bg-card);
    border: 1px solid var(--bd-strong);
    border-radius: var(--r-xl);
  }

  .setup-card {
    width: 100%;
    max-width: 460px;
    padding: 40px;
    display: flex;
    flex-direction: column;
    gap: 32px;
    box-shadow: 0 0 60px rgba(99,102,241,0.08), 0 20px 60px rgba(0,0,0,0.5);
  }

  .setup-logo {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
  }

  .setup-title {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--tx);
    margin-top: 4px;
  }

  .setup-sub {
    font-size: 13px;
    color: var(--tx-2);
  }

  .setup-form { display: flex; flex-direction: column; gap: 12px; }

  .form-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--tx-3);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .input-row { display: flex; gap: 8px; }

  .text-input {
    flex: 1;
    background: var(--bg-input);
    border: 1px solid var(--bd-input);
    border-radius: var(--r-md);
    color: var(--tx);
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 9px 12px;
    outline: none;
    min-width: 0;
  }
  .text-input:focus { border-color: var(--bd-accent); }
  .text-input::placeholder { color: var(--tx-3); }

  .btn-primary {
    background: var(--accent);
    border: none;
    border-radius: var(--r-md);
    color: white;
    font-size: 13px;
    font-weight: 500;
    padding: 9px 18px;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .btn-primary:hover { background: var(--accent-2); }

  .presets { display: flex; gap: 8px; }

  .preset-btn {
    flex: 1;
    background: var(--bg-surface);
    border: 1px solid var(--bd);
    border-radius: var(--r-md);
    color: var(--tx-2);
    font-size: 12px;
    padding: 8px 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .preset-btn:hover { background: var(--bg-card-h); border-color: var(--bd-strong); color: var(--tx); }

  .preset-icon { color: var(--accent-2); font-size: 14px; }

  .error-msg {
    background: var(--fail-dim);
    border: 1px solid var(--fail-bd);
    border-radius: var(--r-md);
    color: var(--fail);
    font-size: 12px;
    padding: 10px 14px;
  }
</style>
