// Maps raw API responses → canonical StreamData shapes.
// Handles both Beacon-native responses and Shelby API format.

import type {
  StreamKind, StreamData,
  TimeseriesData, StatusData, TableData, ScalarData, RawData,
} from '@beacon/contract';

type ShelbyRun = {
  run_id: string;
  started_at: string;
  finished_at?: string;
  duration?: string;
  status: string;
  steps_ok?: number;
  steps_total?: number;
  error?: string;
};

export function transform(kind: StreamKind, raw: unknown): StreamData | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;

  // ── Already Beacon-shaped ─────────────────────────────────────────────────

  if (d.kind === 'timeseries' && Array.isArray(d.points)) {
    return d as unknown as TimeseriesData;
  }

  // ── Shelby RunsResponse { pipeline, slug, runs[] } ────────────────────────

  if (Array.isArray(d.runs)) {
    const runs = d.runs as ShelbyRun[];

    if (kind === 'status') {
      const ok   = runs.filter(r => r.status === 'ok').length;
      const fail = runs.filter(r => r.status !== 'ok').length;
      const data: StatusData = {
        kind: 'status',
        points: runs.map(r => ({
          id:        r.run_id,
          status:    r.status === 'ok' ? 'ok' : 'fail',
          timestamp: r.started_at,
          duration:  r.duration,
        })),
        summary: { ok, fail, warn: 0, total: runs.length },
      };
      return data;
    }

    if (kind === 'table') {
      const data: TableData = {
        kind: 'table',
        rows: runs.map(r => ({
          run_id:     r.run_id,
          status:     r.status,
          started_at: r.started_at,
          duration:   r.duration ?? '—',
          steps:      r.steps_total !== undefined
                        ? `${r.steps_ok ?? '?'}/${r.steps_total}`
                        : '—',
          ...(r.error ? { error: r.error } : {}),
        })),
        total: runs.length,
      };
      return data;
    }
  }

  // ── Shelby RunDetail { run_id, output{}, steps[] } ────────────────────────

  if (typeof d.run_id === 'string' && d.output) {
    const output = d.output as Record<string, unknown>;
    // Single numeric field → scalar
    const keys = Object.keys(output);
    if (keys.length === 1 && typeof output[keys[0]] === 'number') {
      const data: ScalarData = {
        kind:  'scalar',
        value: output[keys[0]] as number,
        label: keys[0],
      };
      return data;
    }
    // Otherwise raw
    const data: RawData = { kind: 'raw', data: output };
    return data;
  }

  // ── Shelby /api/pipelines list ─────────────────────────────────────────────
  // (array of pipelineView) — not a stream kind, handled upstream

  return null;
}
