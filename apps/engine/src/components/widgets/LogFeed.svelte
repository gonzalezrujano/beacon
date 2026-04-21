<script lang="ts">
  import type { LogData } from '@beacon/contract';

  let { data }: { data: LogData } = $props();

  const lines = $derived(data?.lines ?? []);

  function fmtTime(iso: string): string {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000)    return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function levelCls(level: string | undefined): string {
    if (level === 'error') return 'lvl lvl-error';
    if (level === 'warn')  return 'lvl lvl-warn';
    if (level === 'debug') return 'lvl lvl-debug';
    return 'lvl lvl-info';
  }
</script>

<div class="feed">
  {#if lines.length === 0}
    <p class="empty">no entries</p>
  {:else}
    {#each lines as line, i (i)}
      <div class="line">
        <span class="ts">{fmtTime(line.t)}</span>
        <span class={levelCls(line.level)}>{(line.level ?? 'info').slice(0, 4).toUpperCase()}</span>
        <span class="msg">{line.msg}</span>
      </div>
    {/each}
  {/if}
</div>

<style>
  .feed {
    overflow-y: auto;
    height: 100%;
    padding: 6px 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .line {
    display: grid;
    grid-template-columns: 56px 38px 1fr;
    align-items: baseline;
    gap: 8px;
    padding: 4px 14px;
    border-radius: 3px;
    transition: background 0.1s;
  }
  .line:hover { background: rgba(255,255,255,0.03); }

  .ts {
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--tx-3);
    white-space: nowrap;
    text-align: right;
  }

  .lvl {
    font-size: 9.5px;
    font-family: var(--font-mono);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-align: center;
    padding: 1px 4px;
    border-radius: 3px;
    white-space: nowrap;
  }
  .lvl-info  { color: #94a3b8; background: rgba(148,163,184,0.08); }
  .lvl-warn  { color: var(--warn); background: rgba(245,158,11,0.1); }
  .lvl-error { color: var(--fail); background: rgba(239,68,68,0.12); }
  .lvl-debug { color: var(--tx-3); background: rgba(255,255,255,0.04); }

  .msg {
    font-size: 12px;
    font-family: var(--font-mono);
    color: var(--tx-2);
    word-break: break-word;
    line-height: 1.5;
  }

  .line:has(.lvl-error) .msg { color: rgba(239,68,68,0.85); }
  .line:has(.lvl-warn)  .msg { color: rgba(245,158,11,0.85); }
  .line:has(.lvl-debug) .msg { color: var(--tx-3); }

  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100px;
    color: var(--tx-3);
    font-size: 12px;
  }
</style>
