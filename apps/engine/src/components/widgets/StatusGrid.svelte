<script lang="ts">
  import type { StatusData, StatusPoint } from '@beacon/contract';

  let { data }: { data: StatusData } = $props();

  let tooltip = $state<{ x: number; y: number; point: StatusPoint } | null>(null);

  const s = $derived(data.summary ?? (() => {
    const ok   = data.points.filter(p => p.status === 'ok').length;
    const fail = data.points.filter(p => p.status === 'fail').length;
    const warn = data.points.filter(p => p.status === 'warn').length;
    return { ok, fail, warn, total: data.points.length };
  })());

  const rate = $derived(s.total ? Math.round(s.ok / s.total * 100) : 0);

  function color(status: StatusPoint['status']): string {
    return status === 'ok'   ? 'var(--ok)'   :
           status === 'fail' ? 'var(--fail)'  :
           status === 'warn' ? 'var(--warn)'  :
           'var(--tx-3)';
  }

  function bgColor(status: StatusPoint['status']): string {
    return status === 'ok'   ? 'var(--ok-dim)'   :
           status === 'fail' ? 'var(--fail-dim)'  :
           status === 'warn' ? 'var(--warn-dim)'  :
           'rgba(255,255,255,0.03)';
  }

  function fmtAgo(iso: string): string {
    const d = Date.now() - new Date(iso).getTime();
    if (d < 60_000)       return `${Math.floor(d / 1000)}s ago`;
    if (d < 3_600_000)    return `${Math.floor(d / 60_000)}m ago`;
    if (d < 86_400_000)   return `${Math.floor(d / 3_600_000)}h ago`;
    return `${Math.floor(d / 86_400_000)}d ago`;
  }

  function onDotEnter(e: MouseEvent, point: StatusPoint) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const parent = (e.currentTarget as HTMLElement).closest('.status-widget')!.getBoundingClientRect();
    tooltip = {
      x: rect.left - parent.left + rect.width / 2,
      y: rect.top  - parent.top,
      point,
    };
  }
</script>

<div class="status-widget">
  <!-- Summary bar -->
  <div class="summary">
    <div class="stat">
      <span class="stat-n" style:color="var(--ok)">{s.ok}</span>
      <span class="stat-l">ok</span>
    </div>
    <div class="stat">
      <span class="stat-n" style:color="var(--fail)">{s.fail}</span>
      <span class="stat-l">fail</span>
    </div>
    {#if s.warn > 0}
    <div class="stat">
      <span class="stat-n" style:color="var(--warn)">{s.warn}</span>
      <span class="stat-l">warn</span>
    </div>
    {/if}
    <div class="rate-bar-wrap">
      <div class="rate-bar">
        <div class="rate-fill" style:width="{rate}%"></div>
      </div>
      <span class="rate-label">{rate}%</span>
    </div>
  </div>

  <!-- Dot grid -->
  <div
    class="grid"
    role="list"
    onmouseleave={() => tooltip = null}
  >
    {#each data.points as pt}
      <div
        class="dot"
        role="listitem"
        style:background={bgColor(pt.status)}
        style:box-shadow="inset 0 0 0 1px {color(pt.status)}22"
        onmouseenter={(e) => onDotEnter(e, pt)}
        title="{pt.status} · {fmtAgo(pt.timestamp)}{pt.duration ? ' · ' + pt.duration : ''}"
      >
        <span class="dot-inner" style:background={color(pt.status)}></span>
      </div>
    {/each}
  </div>

  <!-- Tooltip -->
  {#if tooltip}
    {@const tp = tooltip}
    <div
      class="tip"
      style:left="{tp.x}px"
      style:top="{tp.y - 60}px"
    >
      <span class="tip-status" style:color={color(tp.point.status)}>{tp.point.status}</span>
      <span class="tip-time">{fmtAgo(tp.point.timestamp)}</span>
      {#if tp.point.duration}
        <span class="tip-dur">{tp.point.duration}</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .status-widget {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    position: relative;
  }

  /* Summary */
  .summary {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .stat {
    display: flex;
    align-items: baseline;
    gap: 4px;
    flex-shrink: 0;
  }
  .stat-n { font-family: var(--font-mono); font-size: 20px; font-weight: 500; line-height: 1; }
  .stat-l { font-size: 10px; color: var(--tx-3); text-transform: uppercase; letter-spacing: 0.07em; }

  .rate-bar-wrap {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }
  .rate-bar {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: rgba(255,255,255,0.06);
    overflow: hidden;
  }
  .rate-fill {
    height: 100%;
    border-radius: 2px;
    background: linear-gradient(90deg, var(--ok) 0%, #22d3ee 100%);
  }
  .rate-label {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ok);
    flex-shrink: 0;
  }

  /* Grid */
  .grid {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-content: flex-start;
  }

  .dot {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    cursor: default;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.1s;
  }
  .dot:hover { transform: scale(1.3); z-index: 1; }

  .dot-inner {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    opacity: 0.8;
  }

  /* Tooltip */
  .tip {
    position: absolute;
    transform: translateX(-50%);
    background: #191b32;
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 6px;
    padding: 6px 10px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    pointer-events: none;
    z-index: 10;
    white-space: nowrap;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  }
  .tip-status { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  .tip-time, .tip-dur {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--tx-3);
  }
</style>
