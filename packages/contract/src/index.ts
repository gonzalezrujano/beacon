// Beacon Canonical Contract v1
// Any data source that implements this contract gets dashboards for free.

export type StreamKind = 'timeseries' | 'scalar' | 'table' | 'status' | 'raw';
export type TransportKind = 'poll' | 'ws' | 'sse';

export interface StreamSchema {
  [field: string]: 'string' | 'number' | 'boolean' | 'timestamp' | 'duration' | `enum:${string}`;
}

export interface StreamThresholds {
  warn?: number;
  crit?: number;
  dir?: 'above' | 'below';
}

export interface Stream {
  id: string;
  label: string;
  kind: StreamKind;
  unit?: string;
  range?: [number, number];
  schema?: StreamSchema;
  transport: TransportKind;
  endpoint: string;
  interval?: number;
  description?: string;
  span?: 1 | 2 | 3 | 4;
  thresholds?: StreamThresholds;
}

export interface BeaconContract {
  version: '1';
  meta: {
    name: string;
    description?: string;
    icon?: string;
  };
  streams: Stream[];
}

// ── Data shapes ───────────────────────────────────────────────────────────────

export interface TimeseriesPoint {
  t: string;
  v: number;
  run_id?: string;
}

export interface TimeseriesData {
  kind: 'timeseries';
  field?: string;
  unit?: string;
  points: TimeseriesPoint[];
}

export interface TableRow {
  [key: string]: unknown;
}

export interface TableData {
  kind: 'table';
  rows: TableRow[];
  total?: number;
}

export interface ScalarData {
  kind: 'scalar';
  value: number;
  unit?: string;
  trend?: 'up' | 'down' | 'flat';
  change?: number;
  sparkline?: number[];
  label?: string;
}

export interface StatusPoint {
  id: string;
  status: 'ok' | 'fail' | 'warn' | 'unknown';
  timestamp: string;
  duration?: string;
  label?: string;
}

export interface StatusData {
  kind: 'status';
  points: StatusPoint[];
  summary?: { ok: number; fail: number; warn: number; total: number };
}

export interface RawData {
  kind: 'raw';
  data: unknown;
  label?: string;
}

export type StreamData = TimeseriesData | TableData | ScalarData | StatusData | RawData;
