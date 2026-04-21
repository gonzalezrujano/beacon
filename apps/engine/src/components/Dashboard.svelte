<script lang="ts">
  import type { Stream } from '@beacon/contract';
  import type { StreamKind } from '@beacon/contract';
  import { store, type WidgetInstance } from '../lib/store.svelte';
  import WidgetCard from './WidgetCard.svelte';
  import InspectDrawer from './InspectDrawer.svelte';

  interface DashboardItem {
    instance: WidgetInstance;
    stream: Stream;
  }

  // ── Ordered instances ─────────────────────────────────────────────────────

  const orderedItems = $derived((() => {
    const streamMap = new Map(store.contract?.streams.map(s => [s.id, s]) ?? []);

    if (store.layoutMode === 'auto' || !store.layout.instances.length) {
      return (store.contract?.streams ?? []).map(s => ({
        instance: { id: s.id, streamId: s.id } as WidgetInstance,
        stream: s,
      }));
    }

    return store.layout.instances
      .map(inst => {
        const stream = streamMap.get(inst.streamId);
        return stream ? { instance: inst, stream } : null;
      })
      .filter((x): x is DashboardItem => x != null);
  })());

  const displayItems = $derived(
    store.isEditing
      ? orderedItems
      : orderedItems.filter(item => !store.hiddenInstances.has(item.instance.id))
  );

  function defaultSpan(kind: string): number {
    return kind === 'scalar' ? 1 : 2;
  }

  function getSpan(instanceId: string, stream: Stream): number {
    if (resizeId === instanceId && resizeLiveSpan !== null) return resizeLiveSpan;
    if (store.layoutMode === 'custom') {
      const custom = store.layout.spans[instanceId];
      if (custom != null) return custom;
    }
    return stream.span ?? defaultSpan(stream.kind);
  }

  // ── Drag to reorder ───────────────────────────────────────────────────────

  let dragId    = $state<string | null>(null);
  let dragIndex = $state(-1);
  let dropIndex = $state(-1);

  function startDrag(e: PointerEvent, instanceId: string, idx: number) {
    e.preventDefault();
    dragId    = instanceId;
    dragIndex = idx;
    dropIndex = idx;

    function onUp() {
      if (dragIndex !== dropIndex && dropIndex !== -1) {
        store.reorderInstances(dragIndex, dropIndex);
      }
      dragId    = null;
      dragIndex = -1;
      dropIndex = -1;
      window.removeEventListener('pointerup', onUp);
    }

    window.addEventListener('pointerup', onUp);
  }

  // ── Resize colSpan ────────────────────────────────────────────────────────

  let resizeId        = $state<string | null>(null);
  let resizeLiveSpan  = $state<number | null>(null);
  let resizeStartX    = 0;
  let resizeStartSpan = 1;

  function startResize(e: PointerEvent, instanceId: string, currentSpan: number) {
    e.preventDefault();
    e.stopPropagation();
    resizeId        = instanceId;
    resizeStartX    = e.clientX;
    resizeStartSpan = currentSpan;
    resizeLiveSpan  = currentSpan;

    const grid      = document.querySelector<HTMLElement>('.grid');
    const cellWidth = (grid?.offsetWidth ?? 800) / 4;

    function onMove(ev: PointerEvent) {
      const spanDelta = Math.round((ev.clientX - resizeStartX) / cellWidth);
      resizeLiveSpan = Math.max(1, Math.min(4, resizeStartSpan + spanDelta));
    }

    function onUp() {
      if (resizeLiveSpan !== null) store.setWidgetSpan(instanceId, resizeLiveSpan);
      resizeId       = null;
      resizeLiveSpan = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  // ── Add Widget ────────────────────────────────────────────────────────────

  let addOpen     = $state(false);
  let addStreamId = $state('');
  let addKind     = $state<StreamKind | ''>('');

  // ── Inspect drawer ────────────────────────────────────────────────────────

  let inspectItem = $state<{ instance: WidgetInstance; stream: Stream } | null>(null);

  function handleAdd() {
    if (!addStreamId) return;
    store.addInstance(addStreamId, addKind || undefined);
    addOpen     = false;
    addStreamId = '';
    addKind     = '';
  }
</script>

<div class="grid" class:edit-mode={store.isEditing} class:is-dragging={dragId !== null}>
  {#each displayItems as item, idx (item.instance.id)}
    {@const { instance, stream } = item}
    {@const isHidden = store.hiddenInstances.has(instance.id)}
    <div
      class="cell"
      class:cell--hidden={isHidden}
      class:dragging={dragId === instance.id}
      class:drop-target={dropIndex === idx && dragId !== null && dragId !== instance.id}
      style:--span={isHidden ? 1 : getSpan(instance.id, stream)}
      onpointerenter={() => { if (dragId !== null && dragId !== instance.id) dropIndex = idx; }}
    >
      {#if store.isEditing && !isHidden}
        <!-- Drag handle -->
        <button
          class="drag-handle"
          title="Drag to reorder"
          onpointerdown={(e) => startDrag(e, instance.id, idx)}
        >
          <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
            <circle cx="3"  cy="2"  r="1.4"/>
            <circle cx="7"  cy="2"  r="1.4"/>
            <circle cx="3"  cy="7"  r="1.4"/>
            <circle cx="7"  cy="7"  r="1.4"/>
            <circle cx="3"  cy="12" r="1.4"/>
            <circle cx="7"  cy="12" r="1.4"/>
          </svg>
        </button>

        <!-- Resize handle -->
        <button
          class="resize-handle"
          title="Drag to resize"
          onpointerdown={(e) => startResize(e, instance.id, getSpan(instance.id, stream))}
        >
          <svg width="4" height="20" viewBox="0 0 4 20" fill="currentColor" aria-hidden="true">
            <rect x="0" y="2"  width="1.5" height="16" rx="0.75"/>
            <rect x="2.5" y="2" width="1.5" height="16" rx="0.75"/>
          </svg>
        </button>

        <!-- Inspect button -->
        <button
          class="inspect-handle"
          title="Inspect widget"
          onclick={() => { inspectItem = { instance, stream }; }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/>
            <line x1="8" y1="5" x2="8" y2="8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="8" cy="11" r="0.8" fill="currentColor"/>
          </svg>
        </button>

        <!-- Hide button -->
        <button
          class="hide-handle"
          title="Hide widget"
          onclick={() => store.toggleInstanceVisibility(instance.id)}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
            <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.4"/>
            <line x1="2.5" y1="2.5" x2="13.5" y2="13.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        </button>

        <!-- Remove button -->
        <button
          class="remove-handle"
          title="Remove widget"
          onclick={() => store.removeInstance(instance.id)}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        </button>
      {/if}

      {#if isHidden}
        <!-- Ghost placeholder for hidden widget in edit mode -->
        <div class="ghost-card">
          <span class="ghost-label">{stream.label}{instance.widgetKind ? ` · ${instance.widgetKind}` : ''}</span>
          <button
            class="ghost-restore"
            title="Show widget"
            onclick={() => store.toggleInstanceVisibility(instance.id)}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
              <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.4"/>
            </svg>
            Show
          </button>
        </div>
      {:else}
        <WidgetCard {instance} {stream} data={store.streams[instance.streamId]} />
      {/if}
    </div>
  {/each}

  {#if inspectItem}
    <InspectDrawer
      instance={inspectItem.instance}
      stream={inspectItem.stream}
      onclose={() => { inspectItem = null; }}
    />
  {/if}

  <!-- Add Widget cell -->
  {#if store.isEditing}
    <div class="cell cell--add" style:--span={1}>
      {#if addOpen}
        <div class="add-card">
          <div class="add-row">
            <select class="add-sel" bind:value={addStreamId}>
              <option value="">— stream —</option>
              {#each store.contract?.streams ?? [] as s}
                <option value={s.id}>{s.label}</option>
              {/each}
            </select>
            <select class="add-sel" bind:value={addKind}>
              <option value="">auto</option>
              <option value="timeseries">Timeseries</option>
              <option value="scalar">Scalar</option>
              <option value="status">Status</option>
              <option value="table">Table</option>
              <option value="raw">Raw JSON</option>
            </select>
          </div>
          <div class="add-actions">
            <button
              class="add-confirm"
              disabled={!addStreamId}
              onclick={handleAdd}
            >Add</button>
            <button class="add-cancel" onclick={() => { addOpen = false; addStreamId = ''; addKind = ''; }}>
              Cancel
            </button>
          </div>
        </div>
      {:else}
        <button class="add-trigger" onclick={() => addOpen = true}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          Add Widget
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    padding: 20px 24px;
    align-content: start;
  }

  .cell {
    position: relative;
    grid-column: span min(var(--span), 4);
    transition: opacity 0.15s, box-shadow 0.15s;
  }

  /* ── Edit mode ── */
  .edit-mode .cell {
    border-radius: 10px;
    outline: 1px dashed rgba(99,102,241,0.25);
    outline-offset: 2px;
  }

  .edit-mode .cell:hover {
    outline-color: rgba(99,102,241,0.5);
  }

  .cell.dragging {
    opacity: 0.4;
    z-index: 10;
  }

  .cell.drop-target {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(99,102,241,0.15);
  }

  /* ── Drag handle ── */
  .drag-handle {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 20;
    background: rgba(15,16,26,0.85);
    border: 1px solid var(--bd);
    border-radius: 5px;
    color: var(--tx-3);
    cursor: grab;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 28px;
    padding: 0;
    opacity: 0;
    transition: opacity 0.12s, color 0.12s;
    backdrop-filter: blur(4px);
  }

  .edit-mode .cell:hover .drag-handle,
  .drag-handle:focus-visible {
    opacity: 1;
  }

  .drag-handle:hover {
    color: var(--tx);
    border-color: var(--bd-strong);
  }

  .drag-handle:active { cursor: grabbing; }

  .cell.dragging .drag-handle { opacity: 0.5; }

  /* ── Resize handle ── */
  .resize-handle {
    position: absolute;
    top: 50%;
    right: -6px;
    transform: translateY(-50%);
    z-index: 20;
    background: rgba(15,16,26,0.85);
    border: 1px solid var(--bd);
    border-radius: 4px;
    color: var(--tx-3);
    cursor: col-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 32px;
    padding: 0;
    opacity: 0;
    transition: opacity 0.12s, color 0.12s;
    backdrop-filter: blur(4px);
  }

  .edit-mode .cell:hover .resize-handle,
  .resize-handle:focus-visible {
    opacity: 1;
  }

  .resize-handle:hover {
    color: var(--accent-2);
    border-color: var(--accent);
  }

  /* ── Inspect handle ── */
  .inspect-handle {
    position: absolute;
    top: 8px;
    right: 36px;
    z-index: 20;
    background: rgba(15,16,26,0.85);
    border: 1px solid var(--bd);
    border-radius: 5px;
    color: var(--tx-3);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    opacity: 0;
    transition: opacity 0.12s, color 0.12s;
    backdrop-filter: blur(4px);
  }

  .edit-mode .cell:hover .inspect-handle,
  .inspect-handle:focus-visible {
    opacity: 1;
  }

  .inspect-handle:hover {
    color: var(--accent-2);
    border-color: rgba(99,102,241,0.4);
  }

  /* ── Hide handle ── */
  .hide-handle {
    position: absolute;
    top: 8px;
    right: 64px;
    z-index: 20;
    background: rgba(15,16,26,0.85);
    border: 1px solid var(--bd);
    border-radius: 5px;
    color: var(--tx-3);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    opacity: 0;
    transition: opacity 0.12s, color 0.12s;
    backdrop-filter: blur(4px);
  }

  .edit-mode .cell:hover .hide-handle,
  .hide-handle:focus-visible {
    opacity: 1;
  }

  .hide-handle:hover {
    color: var(--warn);
    border-color: rgba(251,191,36,0.4);
  }

  /* ── Remove handle ── */
  .remove-handle {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 20;
    background: rgba(15,16,26,0.85);
    border: 1px solid var(--bd);
    border-radius: 5px;
    color: var(--tx-3);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    opacity: 0;
    transition: opacity 0.12s, color 0.12s;
    backdrop-filter: blur(4px);
  }

  .edit-mode .cell:hover .remove-handle,
  .remove-handle:focus-visible {
    opacity: 1;
  }

  .remove-handle:hover {
    color: var(--fail);
    border-color: var(--fail-bd);
  }

  /* ── Ghost cell (hidden widget in edit mode) ── */
  .cell--hidden {
    outline-color: rgba(99,102,241,0.12) !important;
  }

  .ghost-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 14px;
    height: 48px;
    background: rgba(255,255,255,0.02);
    border: 1px dashed rgba(99,102,241,0.2);
    border-radius: var(--r-lg);
  }

  .ghost-label {
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--tx-3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .ghost-restore {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: none;
    border: 1px solid var(--bd);
    border-radius: var(--r-sm);
    color: var(--tx-3);
    font-size: 10.5px;
    font-weight: 500;
    padding: 3px 9px;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }

  .ghost-restore:hover {
    color: var(--accent-2);
    border-color: var(--accent);
    background: rgba(99,102,241,0.08);
  }

  /* ── Add Widget cell ── */
  .cell--add {
    outline: none !important;
  }

  .add-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    width: 100%;
    height: 100%;
    min-height: 60px;
    background: rgba(99,102,241,0.04);
    border: 1.5px dashed rgba(99,102,241,0.3);
    border-radius: var(--r-lg);
    color: var(--tx-3);
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }

  .add-trigger:hover {
    background: rgba(99,102,241,0.08);
    border-color: var(--accent);
    color: var(--accent-2);
  }

  .add-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: var(--bg-card);
    border: 1px solid var(--bd-strong);
    border-radius: var(--r-lg);
    min-height: 60px;
  }

  .add-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .add-sel {
    flex: 1;
    min-width: 0;
    background: var(--bg-input);
    border: 1px solid var(--bd-input);
    border-radius: var(--r-sm);
    color: var(--tx-2);
    font-family: var(--font-mono);
    font-size: 11px;
    padding: 4px 6px;
    cursor: pointer;
    outline: none;
  }

  .add-sel:focus { border-color: var(--bd-accent); color: var(--tx); }

  .add-actions {
    display: flex;
    gap: 6px;
  }

  .add-confirm {
    flex: 1;
    background: var(--accent);
    border: none;
    border-radius: var(--r-sm);
    color: white;
    font-size: 11px;
    font-weight: 500;
    font-family: inherit;
    padding: 5px 10px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .add-confirm:hover:not(:disabled) { background: var(--accent-2); }
  .add-confirm:disabled { opacity: 0.4; cursor: not-allowed; }

  .add-cancel {
    background: none;
    border: 1px solid var(--bd);
    border-radius: var(--r-sm);
    color: var(--tx-3);
    font-size: 11px;
    font-family: inherit;
    padding: 5px 10px;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }

  .add-cancel:hover { color: var(--tx-2); border-color: var(--bd-strong); }

  /* Prevent text selection during drag/resize */
  .is-dragging {
    user-select: none;
  }

  /* ── Responsive ── */
  @media (max-width: 900px) {
    .grid { grid-template-columns: repeat(2, 1fr); }
    .cell { grid-column: span min(var(--span), 2); }
    .resize-handle { display: none; }
  }

  @media (max-width: 560px) {
    .grid { grid-template-columns: 1fr; padding: 12px; gap: 12px; }
    .cell { grid-column: span 1; }
    .drag-handle, .resize-handle { display: none; }
  }
</style>
