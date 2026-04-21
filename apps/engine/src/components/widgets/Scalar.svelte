<script lang="ts">
  import type { ScalarData, StreamThresholds } from '@beacon/contract';
  import { DEFAULT_CONFIG, COLOR_MAP, computeAgg } from '../../lib/widgetConfig';
  import type { WidgetConfig } from '../../lib/widgetConfig';

  let {
    data,
    thresholds,
    config = DEFAULT_CONFIG,
  }: {
    data: ScalarData;
    thresholds?: StreamThresholds;
    config?: WidgetConfig;
  } = $props();

  const colors = $derived(COLOR_MAP[config.colorScheme]);

  function fmt(v: number, unit?: string): string {
    const a = Math.abs(v);
    let s: string;
    if (a >= 1e6)      s = (v / 1e6).toFixed(2) + 'M';
    else if (a >= 1e3) s = (v / 1e3).toFixed(1) + 'k';
    else if (v % 1 === 0) s = String(v);
    else s = v.toFixed(1);
    return unit ? `${s} ${unit}` : s;
  }

  const trendIcon = $derived(
    data.trend === 'up'   ? '↑' :
    data.trend === 'down' ? '↓' : '→'
  );

  const trendColor = $derived(
    data.trend === 'up'   ? 'var(--ok)'   :
    data.trend === 'down' ? 'var(--fail)'  :
    'var(--tx-3)'
  );

  const alertLevel = $derived((() => {
    if (!thresholds) return 'none' as const;
    const dir = thresholds.dir ?? 'above';
    const v = data.value;
    if (dir === 'above') {
      if (thresholds.crit !== undefined && v >= thresholds.crit) return 'crit' as const;
      if (thresholds.warn !== undefined && v >= thresholds.warn) return 'warn' as const;
    } else {
      if (thresholds.crit !== undefined && v <= thresholds.crit) return 'crit' as const;
      if (thresholds.warn !== undefined && v <= thresholds.warn) return 'warn' as const;
    }
    return 'none' as const;
  })());

  const valueColor = $derived(
    alertLevel === 'crit' ? 'var(--fail)' :
    alertLevel === 'warn' ? 'var(--warn)' :
    'var(--tx)'
  );

  const spark = $derived(data.sparkline ?? []);
  const sparkMax   = $derived(spark.length ? Math.max(...spark) : 1);
  const sparkMin   = $derived(spark.length ? Math.min(...spark) : 0);
  const sparkRange = $derived(Math.max(sparkMax - sparkMin, 0.001));

  const aggValue = $derived(computeAgg(spark, config.aggregation));
  const aggLabel = $derived(
    aggValue !== null
      ? `${config.aggregation.toUpperCase()}: ${fmt(aggValue)}${data.unit ? ' ' + data.unit : ''}`
      : null
  );
</script>

<div class="scalar" class:is-warn={alertLevel === 'warn'} class:is-crit={alertLevel === 'crit'}>
  <div class="value-row">
    <span class="value mono" style:color={valueColor}>{fmt(data.value)}</span>
    {#if data.unit}
      <span class="unit">{data.unit}</span>
    {/if}
  </div>

  {#if data.change !== undefined}
    <div class="trend-row" style:color={trendColor}>
      <span class="trend-icon">{trendIcon}</span>
      <span class="trend-val">{Math.abs(data.change).toFixed(1)}%</span>
    </div>
  {/if}

  {#if aggLabel}
    <div class="agg-row" style:color={colors.line}>{aggLabel}</div>
  {/if}

  {#if spark.length > 1}
    <div class="sparkline" aria-hidden="true">
      {#each spark as v, i}
        {@const h = Math.max(2, ((v - sparkMin) / sparkRange) * 32)}
        <span
          class="bar"
          style:height="{h}px"
          style:background={colors.line}
          style:opacity={i === spark.length - 1 ? '1' : '0.4'}
        ></span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .scalar {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    padding: 20px 20px 16px;
    gap: 6px;
    height: 100%;
    min-height: 100px;
  }

  .value-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
    line-height: 1;
  }

  .value {
    font-family: var(--font-mono);
    font-size: 38px;
    font-weight: 500;
    color: var(--tx);
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .unit {
    font-family: var(--font-mono);
    font-size: 15px;
    color: var(--tx-3);
    font-weight: 400;
  }

  .trend-row {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .trend-icon { font-size: 13px; }
  .trend-val  { font-family: var(--font-mono); }

  .agg-row {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
    opacity: 0.85;
  }

  .sparkline {
    display: flex;
    align-items: flex-end;
    gap: 2.5px;
    height: 32px;
    margin-top: 4px;
  }

  .bar {
    width: 4px;
    border-radius: 2px 2px 0 0;
    flex-shrink: 0;
  }

  .is-warn { background: rgba(251,191,36,0.04); }
  .is-crit { background: rgba(248,113,113,0.05); }
</style>
