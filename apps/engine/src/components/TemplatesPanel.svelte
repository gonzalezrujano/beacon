<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { exportTemplate, parseTemplateFile } from '../lib/templates';

  let { onclose }: { onclose: () => void } = $props();

  let saveName = $state('');
  let saveDesc = $state('');
  let saveError = $state('');
  let importError = $state('');

  function handleSave() {
    const name = saveName.trim();
    if (!name) { saveError = 'Name required'; return; }
    store.saveTemplate(name, saveDesc.trim());
    saveName = '';
    saveDesc = '';
    saveError = '';
  }

  async function handleImport(e: Event) {
    importError = '';
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const t = await parseTemplateFile(file);
      store.importTemplate(t);
    } catch {
      importError = 'Invalid template file';
    }
    (e.target as HTMLInputElement).value = '';
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
</script>

<!-- backdrop -->
<button class="backdrop" onclick={onclose} aria-label="Close"></button>

<aside class="panel">
  <div class="panel-head">
    <span class="panel-title">Templates</span>
    <button class="close-btn" onclick={onclose} aria-label="Close panel">
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path d="M1 1l11 11M12 1L1 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
  </div>

  <!-- Save current -->
  <section class="section">
    <div class="section-label">Save current dashboard</div>
    <div class="save-form">
      <input
        class="t-input"
        type="text"
        placeholder="Template name"
        bind:value={saveName}
        onkeydown={(e) => { if (e.key === 'Enter') handleSave(); }}
      />
      <input
        class="t-input"
        type="text"
        placeholder="Description (optional)"
        bind:value={saveDesc}
      />
      {#if saveError}
        <span class="field-error">{saveError}</span>
      {/if}
      <button class="btn-save" onclick={handleSave}>Save template</button>
    </div>
  </section>

  <!-- Template list -->
  <section class="section section--list">
    <div class="section-label">Saved templates ({store.templates.length})</div>

    {#if store.templates.length === 0}
      <div class="empty">No templates yet. Save the current dashboard to create one.</div>
    {:else}
      <ul class="t-list">
        {#each store.templates as t (t.id)}
          <li class="t-row">
            <div class="t-info">
              <span class="t-name">{t.name}</span>
              {#if t.description}
                <span class="t-desc">{t.description}</span>
              {/if}
              <span class="t-date">{fmt(t.createdAt)}</span>
            </div>
            <div class="t-actions">
              <button class="t-btn t-btn--apply" onclick={() => { store.applyTemplate(t); onclose(); }}>
                Apply
              </button>
              <button class="t-btn" title="Export JSON" onclick={() => exportTemplate(t)}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2v9M4 8l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M2 14h12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                </svg>
              </button>
              <button class="t-btn t-btn--del" title="Delete" onclick={() => store.deleteTemplate(t.id)}>
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <!-- Import -->
  <section class="section">
    <div class="section-label">Import template</div>
    {#if importError}
      <div class="field-error" style="margin-bottom:6px">{importError}</div>
    {/if}
    <label class="import-btn">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <path d="M8 11V2M4 5l4-4 4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2 14h12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      </svg>
      Import from JSON
      <input type="file" accept=".json" style="display:none" onchange={handleImport} />
    </label>
  </section>
</aside>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 99;
    border: none;
    cursor: default;
  }

  .panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 320px;
    background: var(--bg-card);
    border-left: 1px solid var(--bd-strong);
    z-index: 100;
    display: flex;
    flex-direction: column;
    box-shadow: -12px 0 40px rgba(0,0,0,0.5);
  }

  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
  }

  .panel-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--tx);
    letter-spacing: -0.01em;
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
  }
  .close-btn:hover { background: var(--bg-card-h); color: var(--tx-2); }

  .section {
    padding: 16px;
    border-bottom: 1px solid var(--bd);
    flex-shrink: 0;
  }

  .section--list {
    flex: 1;
    overflow-y: auto;
    flex-shrink: 1;
    min-height: 0;
  }

  .section-label {
    font-size: 10.5px;
    font-weight: 600;
    color: var(--tx-3);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 10px;
  }

  .save-form {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .t-input {
    background: var(--bg-input);
    border: 1px solid var(--bd-input);
    border-radius: var(--r-md);
    color: var(--tx);
    font-size: 12px;
    padding: 7px 10px;
    outline: none;
    font-family: inherit;
    width: 100%;
    box-sizing: border-box;
  }
  .t-input:focus { border-color: var(--bd-accent); }
  .t-input::placeholder { color: var(--tx-3); }

  .field-error {
    font-size: 11px;
    color: var(--fail);
  }

  .btn-save {
    background: var(--accent);
    border: none;
    border-radius: var(--r-md);
    color: white;
    font-size: 12px;
    font-weight: 500;
    padding: 7px 14px;
    cursor: pointer;
    align-self: flex-start;
    font-family: inherit;
  }
  .btn-save:hover { background: var(--accent-2); }

  .empty {
    font-size: 12px;
    color: var(--tx-3);
    line-height: 1.5;
  }

  .t-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .t-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 10px;
    background: var(--bg-surface);
    border: 1px solid var(--bd);
    border-radius: var(--r-md);
  }
  .t-row:hover { border-color: var(--bd-strong); }

  .t-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .t-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--tx);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .t-desc {
    font-size: 11px;
    color: var(--tx-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .t-date {
    font-size: 10px;
    color: var(--tx-3);
    font-family: var(--font-mono);
  }

  .t-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .t-btn {
    background: none;
    border: 1px solid var(--bd);
    border-radius: var(--r-sm);
    color: var(--tx-3);
    cursor: pointer;
    padding: 4px 6px;
    font-size: 11px;
    font-family: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .t-btn:hover { background: var(--bg-card-h); color: var(--tx-2); border-color: var(--bd-strong); }

  .t-btn--apply {
    color: var(--accent-2);
    border-color: rgba(99,102,241,0.4);
    padding: 4px 8px;
  }
  .t-btn--apply:hover { background: rgba(99,102,241,0.1); border-color: var(--accent); color: var(--accent-2); }

  .t-btn--del:hover { color: var(--fail); border-color: var(--fail-bd); background: var(--fail-dim); }

  .import-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: none;
    border: 1px solid var(--bd);
    border-radius: var(--r-md);
    color: var(--tx-2);
    font-size: 12px;
    padding: 7px 12px;
    cursor: pointer;
    font-family: inherit;
  }
  .import-btn:hover { background: var(--bg-card-h); border-color: var(--bd-strong); color: var(--tx); }
</style>
