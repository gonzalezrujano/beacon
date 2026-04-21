<script lang="ts">
  import type { TimeseriesData, StreamThresholds } from '@beacon/contract';
  import { DEFAULT_CONFIG, COLOR_MAP, filterByWindow, computeAgg } from '../../lib/widgetConfig';
  import type { WidgetConfig } from '../../lib/widgetConfig';

  let {
    data,
    unit = '',
    thresholds,
    config = DEFAULT_CONFIG,
  }: {
    data: TimeseriesData;
    unit?: string;
    thresholds?: StreamThresholds;
    config?: WidgetConfig;
  } = $props();

  let wrap = $state<HTMLDivElement | undefined>(undefined);
  let W = $state(400);
  let H = $state(180);
  let hoverIdx = $state<number | null>(null);

  const PAD = { t: 14, r: 14, b: 28, l: 44 };

  const colors = $derived(COLOR_MAP[config.colorScheme]);

  const pts   = $derived(filterByWindow(data?.points ?? [], config.timeWindow));
  const times = $derived(pts.map(p => new Date(p.t).getTime()));
  const vals  = $derived(pts.map(p => p.v));

  const plotW = $derived(W - PAD.l - PAD.r);
  const plotH = $derived(H - PAD.t - PAD.b);

  const minT = $derived(times.length ? times[0] : 0);
  const maxT = $derived(times.length ? times[times.length - 1] : 1);
  const ranT = $derived(Math.max(maxT - minT, 1));

  const threshVals = $derived([
    ...(thresholds?.warn !== undefined ? [thresholds.warn] : []),
    ...(thresholds?.crit !== undefined ? [thresholds.crit] : []),
  ]);
  const minV  = $derived(vals.length ? Math.min(...vals, ...threshVals) : 0);
  const maxV  = $derived(vals.length ? Math.max(...vals, ...threshVals) : 1);
  const ranV  = $derived(Math.max(maxV - minV, 0.001));
  const padV  = $derived(ranV * 0.14);
  const loV   = $derived(minV - padV);
  const spanV = $derived(ranV + padV * 2);

  function sx(t: number) { return PAD.l + ((t - minT) / ranT) * plotW; }
  function sy(v: number) { return PAD.t + plotH - ((v - loV) / spanV) * plotH; }

  function curvePath(coords: [number, number][]): string {
    if (coords.length < 2) return '';
    let d = `M${f(coords[0][0])},${f(coords[0][1])}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[Math.max(0, i - 1)];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[Math.min(coords.length - 1, i + 2)];
      d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)}`
        + ` ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)}`
        + ` ${f(p2[0])},${f(p2[1])}`;
    }
    return d;
  }

  function f(n: number) { return n.toFixed(1); }

  const coords   = $derived(pts.map((p, i) => [sx(times[i]), sy(p.v)] as [number, number]));
  const linePath = $derived(curvePath(coords));
  const areaPath = $derived(
    linePath && coords.length >= 2
      ? `${linePath} L${f(coords.at(-1)![0])},${f(PAD.t + plotH)} L${f(coords[0][0])},${f(PAD.t + plotH)} Z`
      : ''
  );

  const barW = $derived(pts.length > 1 ? (plotW / pts.length) * 0.6 : plotW * 0.1);

  const aggValue = $derived(computeAgg(vals, config.aggregation));

  const yTicks = $derived(Array.from({ length: 5 }, (_, i) => {
    const v = loV + spanV * i / 4;
    return { y: sy(v), label: fmt(v) };
  }));

  const xTicks = $derived((() => {
    if (!pts.length) return [];
    const n = Math.min(5, pts.length);
    return Array.from({ length: n }, (_, i) => {
      const idx = n > 1 ? Math.round(i * (pts.length - 1) / (n - 1)) : 0;
      return { x: sx(times[idx]), label: fmtT(pts[idx].t) };
    });
  })());

  function fmt(v: number): string {
    const a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return (v / 1e3).toFixed(1) + 'k';
    return v % 1 === 0 ? String(Math.round(v)) : v.toFixed(1);
  }
  function fmtT(iso: string): string {
    const d = new Date(iso);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function onMove(e: MouseEvent) {
    if (!pts.length || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (W / rect.width);
    if (mx < PAD.l || mx > PAD.l + plotW) { hoverIdx = null; return; }
    const tx = minT + ((mx - PAD.l) / plotW) * ranT;
    let best = 0, bestD = Infinity;
    times.forEach((t, i) => { const d = Math.abs(t - tx); if (d < bestD) { bestD = d; best = i; } });
    hoverIdx = best;
  }

  $effect(() => {
    if (!wrap) return;
    const ro = new ResizeObserver(es => {
      W = es[0].contentRect.width || 400;
      H = Math.max(es[0].contentRect.height, 120) || 180;
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  });

  const threshLines = $derived((() => {
    if (!thresholds) return [];
    const lines: { y: number; value: number; color: string }[] = [];
    if (thresholds.warn !== undefined)
      lines.push({ y: sy(thresholds.warn), value: thresholds.warn, color: '#fbbf24' });
    if (thresholds.crit !== undefined)
      lines.push({ y: sy(thresholds.crit), value: thresholds.crit, color: '#f87171' });
    return lines;
  })());

  const uid = Math.random().toString(36).slice(2, 7);
</script>

<div
  class="wrap"
  bind:this={wrap}
  bind:clientWidth={W}
  bind:clientHeight={H}
  onmousemove={onMove}
  onmouseleave={() => hoverIdx = null}
  role="img"
  aria-label="{data?.field ?? 'timeseries'} chart"
>
  {#if pts.length < 2}
    <p class="empty">{(data?.points?.length ?? 0) > 0 ? 'no data in window' : 'waiting for data…'}</p>
  {:else}
    <svg viewBox="0 0 {W} {H}" class="svg">
      <defs>
        <linearGradient id="ag{uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color={colors.area} stop-opacity="0.30"/>
          <stop offset="100%" stop-color={colors.area} stop-opacity="0.00"/>
        </linearGradient>
        <filter id="gf{uid}" x="-30%" y="-80%" width="160%" height="260%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="b"/>
          <feColorMatrix in="b" type="matrix"
            values="0 0 0 0 {colors.r}  0 0 0 0 {colors.g}  0 0 0 0 {colors.b}  0 0 0 .9 0" result="c"/>
          <feMerge><feMergeNode in="c"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <!-- Y grid + labels -->
      {#each yTicks as tick}
        <line class="gl" x1={PAD.l} y1={tick.y} x2={PAD.l + plotW} y2={tick.y}/>
        <text class="al al-y" x={PAD.l - 7} y={tick.y} text-anchor="end" dominant-baseline="middle">
          {tick.label}
        </text>
      {/each}

      <!-- Threshold lines -->
      {#each threshLines as tl}
        <line class="tline" x1={PAD.l} y1={f(tl.y)} x2={PAD.l + plotW} y2={f(tl.y)} stroke={tl.color}/>
        <text class="tal" x={PAD.l + 4} y={tl.y - 3} fill={tl.color}>{fmt(tl.value)}{unit ? ' ' + unit : ''}</text>
      {/each}

      <!-- Aggregation annotation line -->
      {#if aggValue !== null}
        {@const ay = f(sy(aggValue))}
        <line class="agg-line" x1={PAD.l} y1={ay} x2={PAD.l + plotW} y2={ay} stroke={colors.line}/>
        <text class="tal" x={PAD.l + 4} y={Number(ay) - 3} fill={colors.line}>
          {config.aggregation.toUpperCase()}: {fmt(aggValue)}{unit ? ' ' + unit : ''}
        </text>
      {/if}

      <!-- Chart body: bar or line/area -->
      {#if config.chartType === 'bar'}
        {#each pts as p, i}
          <rect
            x={f(sx(times[i]) - barW / 2)}
            y={f(sy(p.v))}
            width={f(Math.max(1, barW))}
            height={f(Math.max(0, PAD.t + plotH - sy(p.v)))}
            fill={colors.line}
            opacity="0.72"
            rx="2"
          />
        {/each}
      {:else}
        {#if areaPath && config.chartType === 'area'}
          <path d={areaPath} fill="url(#ag{uid})"/>
        {/if}
        {#if linePath}
          <path class="line" d={linePath} filter="url(#gf{uid})" style:stroke={colors.line}/>
        {/if}
      {/if}

      <!-- X labels -->
      {#each xTicks as tick}
        <text class="al al-x" x={tick.x} y={H - 5} text-anchor="middle">{tick.label}</text>
      {/each}

      <!-- Hover crosshair -->
      {#if hoverIdx !== null}
        {@const hx = sx(times[hoverIdx])}
        {@const hy = sy(vals[hoverIdx])}
        {@const tx = hx + 96 > W ? hx - 102 : hx + 10}
        {@const ty = Math.max(hy - 18, PAD.t + 2)}

        <line class="xhair" x1={hx} y1={PAD.t} x2={hx} y2={PAD.t + plotH}/>
        <circle class="hdot" cx={hx} cy={hy} r="4.5" fill={colors.dot}/>

        <g transform="translate({tx},{ty})">
          <rect class="tip-bg" width="92" height="34" rx="5"/>
          <text class="tip-v" x="9" y="14">{fmt(vals[hoverIdx])}{unit ? ' ' + unit : ''}</text>
          <text class="tip-t" x="9" y="27">{fmtT(pts[hoverIdx].t)}</text>
        </g>
      {/if}
    </svg>
  {/if}
</div>

<style>
  .wrap {
    width: 100%;
    height: 100%;
    min-height: 130px;
    position: relative;
    cursor: crosshair;
  }
  .svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .gl   { stroke: rgba(255,255,255,0.035); stroke-width: 1; }
  .al   { fill: #353960; font-size: 10px; font-family: 'JetBrains Mono', ui-monospace, monospace; }
  .al-y {}
  .al-x {}
  .line {
    fill: none;
    stroke-width: 2.2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .tline     { stroke-width: 1; stroke-dasharray: 5 3; opacity: 0.65; }
  .agg-line  { stroke-width: 1.2; stroke-dasharray: 6 3; opacity: 0.85; }
  .tal       { font-size: 9px; font-family: 'JetBrains Mono', ui-monospace, monospace; opacity: 0.75; }
  .xhair     { stroke: rgba(255,255,255,0.10); stroke-width: 1; stroke-dasharray: 4 3; }
  .hdot      { stroke: #0d0e1e; stroke-width: 2.5; }
  .tip-bg    { fill: #191b32; stroke: rgba(255,255,255,0.10); stroke-width: 1; }
  .tip-v {
    fill: #e2e8f0;
    font-size: 12px;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-weight: 500;
  }
  .tip-t {
    fill: #353960;
    font-size: 10px;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
  }
  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 100px;
    color: #353960;
    font-size: 12px;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
  }
</style>
