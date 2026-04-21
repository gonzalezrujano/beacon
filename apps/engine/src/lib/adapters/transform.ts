// Maps raw API responses → canonical StreamData shapes.
// Handles both Beacon-native responses and Shelby API format.

import type {
  Stream, StreamData,
  TimeseriesData, StatusData, TableData, ScalarData, RawData, LogData, LogLine,
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

export function transform(stream: Stream, raw: unknown): StreamData | null {
  if (!raw || typeof raw !== 'object') return null;
  const { kind, fields } = stream;
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

    if (kind === 'log' && fields?.length) {
      const msgField = fields[0];
      const levelField = fields[1] as string | undefined;
      const lines: LogLine[] = runs
        .filter(r => (r as Record<string, unknown>).output != null)
        .map(r => {
          const output = (r as Record<string, unknown>).output as Record<string, unknown>;
          const msg = output[msgField] != null ? String(output[msgField]) : '';
          const rawLevel = levelField ? String(output[levelField] ?? '') : msg;
          return {
            t: r.started_at,
            level: inferLogLevel(rawLevel),
            msg,
            run_id: r.run_id,
          };
        })
        .filter(l => l.msg !== '')
        .reverse();
      return { kind: 'log', lines } satisfies LogData;
    }

    if (kind === 'table') {
      const rows = fields?.length
        ? runs.map(r => {
            const output = (r as Record<string, unknown>).output as Record<string, unknown> ?? {};
            const row: Record<string, unknown> = { run_id: r.run_id, started_at: r.started_at };
            for (const f of fields) row[f] = output[f] ?? null;
            return row;
          })
        : runs.map(r => ({
            run_id:     r.run_id,
            status:     r.status,
            started_at: r.started_at,
            duration:   r.duration ?? '—',
            steps:      r.steps_total !== undefined
                          ? `${r.steps_ok ?? '?'}/${r.steps_total}`
                          : '—',
            ...(r.error ? { error: r.error } : {}),
          }));
      const data: TableData = { kind: 'table', rows, total: runs.length };
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

function inferLogLevel(s: string): LogLine['level'] {
  const l = s.toLowerCase();
  if (/\berror\b|fail|exception|critical|crit/.test(l)) return 'error';
  if (/\bwarn/.test(l)) return 'warn';
  if (/\bdebug\b|trace|verbose/.test(l)) return 'debug';
  return 'info';
}
