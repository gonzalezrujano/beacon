import type { StreamThresholds } from '@beacon/contract';
import type { WidgetTransformConfig } from './transforms';

export type ChartType    = 'line' | 'area' | 'bar';
export type ColorScheme  = 'indigo' | 'cyan' | 'green' | 'amber';
export type TimeWindow   = 'all' | '5m' | '15m' | '1h' | '6h' | '24h';
export type Aggregation  = 'none' | 'avg' | 'max' | 'p95';

export type { WidgetTransformConfig };

export interface WidgetConfig {
  chartType:    ChartType;
  colorScheme:  ColorScheme;
  timeWindow:   TimeWindow;
  aggregation:  Aggregation;
  thresholds?:  StreamThresholds;
  transforms?:  WidgetTransformConfig;
}

export const DEFAULT_CONFIG: WidgetConfig = {
  chartType:   'area',
  colorScheme: 'indigo',
  timeWindow:  'all',
  aggregation: 'none',
};

export const COLOR_MAP: Record<ColorScheme, {
  line: string; area: string; dot: string;
  r: string; g: string; b: string;
}> = {
  indigo: { line: '#6366f1', area: '#6366f1', dot: '#818cf8', r: '.388', g: '.400', b: '.945' },
  cyan:   { line: '#22d3ee', area: '#22d3ee', dot: '#67e8f9', r: '.133', g: '.827', b: '.933' },
  green:  { line: '#4ade80', area: '#4ade80', dot: '#86efac', r: '.290', g: '.871', b: '.502' },
  amber:  { line: '#fbbf24', area: '#fbbf24', dot: '#fcd34d', r: '.984', g: '.749', b: '.141' },
};

const WINDOW_MS: Record<TimeWindow, number | null> = {
  all:  null,
  '5m':  5 * 60_000,
  '15m': 15 * 60_000,
  '1h':  60 * 60_000,
  '6h':  6 * 60 * 60_000,
  '24h': 24 * 60 * 60_000,
};

export function filterByWindow<T extends { t: string }>(points: T[], window: TimeWindow): T[] {
  const ms = WINDOW_MS[window];
  if (!ms) return points;
  const cutoff = Date.now() - ms;
  return points.filter(p => new Date(p.t).getTime() >= cutoff);
}

export function computeAgg(values: number[], agg: Aggregation): number | null {
  if (agg === 'none' || !values.length) return null;
  if (agg === 'avg') return values.reduce((a, b) => a + b, 0) / values.length;
  if (agg === 'max') return Math.max(...values);
  if (agg === 'p95') {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
  }
  return null;
}
