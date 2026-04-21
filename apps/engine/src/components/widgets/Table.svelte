<script lang="ts">
  import type { TableData } from '@beacon/contract';

  let { data }: { data: TableData } = $props();

  const rows = $derived(data?.rows ?? []);
  const cols = $derived(rows.length ? Object.keys(rows[0]) : []);

  function fmtVal(v: unknown): string {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'string') {
      // ISO timestamp
      if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return fmtTs(v);
      return v;
    }
    return String(v);
  }

  function fmtTs(iso: string): string {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000)       return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3_600_000)    return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000)   return `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleDateString();
  }

  function isStatus(col: string): boolean {
    return col === 'status';
  }

  function statusCls(v: unknown): string {
    if (v === 'ok')   return 'badge badge-ok';
    if (v === 'fail') return 'badge badge-fail';
    if (v === 'warn') return 'badge badge-warn';
    return 'badge';
  }
</script>

<div class="table-wrap">
  {#if rows.length === 0}
    <p class="empty">no data</p>
  {:else}
    <table>
      <thead>
        <tr>
          {#each cols as col}
            <th>{col.replace(/_/g, ' ')}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each rows as row}
          <tr>
            {#each cols as col}
              <td>
                {#if isStatus(col)}
                  <span class={statusCls(row[col])}>{String(row[col])}</span>
                {:else if col === 'run_id' || col === 'id'}
                  <span class="mono run-id">{String(row[col]).slice(0, 11)}…</span>
                {:else}
                  <span class:mono={col === 'duration'}>{fmtVal(row[col])}</span>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .table-wrap {
    overflow-y: auto;
    height: 100%;
    max-height: 320px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  thead th {
    position: sticky;
    top: 0;
    background: var(--bg-card);
    padding: 8px 16px;
    text-align: left;
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--tx-3);
    border-bottom: 1px solid var(--bd);
    white-space: nowrap;
    z-index: 1;
  }

  tbody tr {
    border-bottom: 1px solid rgba(255,255,255,0.025);
    transition: background 0.1s;
  }
  tbody tr:hover { background: var(--bg-card-h); }
  tbody tr:last-child { border-bottom: none; }

  td {
    padding: 8px 16px;
    font-size: 12px;
    color: var(--tx-2);
    white-space: nowrap;
    vertical-align: middle;
  }

  .mono { font-family: var(--font-mono); font-size: 11px; }
  .run-id { color: var(--tx-3); }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border: 1px solid transparent;
  }
  .badge::before {
    content: '';
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .badge-ok   { color: var(--ok);   background: var(--ok-dim);   border-color: var(--ok-bd); }
  .badge-ok::before   { background: var(--ok);   }
  .badge-fail { color: var(--fail); background: var(--fail-dim); border-color: var(--fail-bd); }
  .badge-fail::before { background: var(--fail); }
  .badge-warn { color: var(--warn); background: var(--warn-dim); }
  .badge-warn::before { background: var(--warn); }

  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100px;
    color: var(--tx-3);
    font-size: 12px;
  }
</style>
