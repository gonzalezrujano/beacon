// Shelby discovery adapter.
// Connects to any running Shelby server WITHOUT requiring /beacon/contract.
// Introspects /api/pipelines → builds a BeaconContract → starts polling.

import type { BeaconContract, Stream } from '@beacon/contract';
import { store } from '../store.svelte';
import { pollStream, type StopFn } from './poll';

// ── Shelby API types ──────────────────────────────────────────────────────────

type ShelbyPipeline = {
  Slug: string;
  Name: string;
  Status: string;
  RunID: string;
};

type ShelbyRunsResp = {
  runs: Array<{ run_id: string; status: string }>;
};

type ShelbyRunDetail = {
  run_id: string;
  output: Record<string, unknown>;
};

// ── Public types ──────────────────────────────────────────────────────────────

export type DiscoveredField = {
  field: string;
  valueType: 'number' | 'string' | 'boolean' | 'unknown';
  sampleValue: unknown;
  unit?: string;
  range?: [number, number];
};

export type ShelbyPipelineInfo = {
  slug: string;
  name: string;
  status: string;
};

// ── Polling state ─────────────────────────────────────────────────────────────

let stops: StopFn[] = [];

export function stopShelby() {
  stops.forEach(fn => fn());
  stops = [];
}

// ── Public API ────────────────────────────────────────────────────────────────

export function applyContract(contract: BeaconContract): void {
  stopShelby();
  store.setContract(contract);
  stops = contract.streams.map(s => pollStream(s));
  store.setStatus('connected');
}

export async function fetchShelbyPipelines(baseUrl: string): Promise<ShelbyPipelineInfo[]> {
  const pipelines: ShelbyPipeline[] = await get(baseUrl, '/api/pipelines');
  if (!Array.isArray(pipelines)) return [];
  return pipelines.map(p => ({ slug: p.Slug, name: p.Name, status: p.Status }));
}

export async function fetchPipelineFields(baseUrl: string, slug: string): Promise<DiscoveredField[]> {
  const runsResp: ShelbyRunsResp = await get(baseUrl, `/api/pipelines/${slug}/runs?limit=5`);
  const runs = runsResp.runs ?? [];
  if (runs.length === 0) return [];

  const fieldCounts = new Map<string, number>();
  const fieldValues = new Map<string, unknown[]>();

  for (const run of runs) {
    try {
      const detail: ShelbyRunDetail = await get(baseUrl, `/api/pipelines/${slug}/runs/${run.run_id}`);
      for (const [k, v] of Object.entries(detail.output ?? {})) {
        fieldCounts.set(k, (fieldCounts.get(k) ?? 0) + 1);
        const arr = fieldValues.get(k) ?? [];
        arr.push(v);
        fieldValues.set(k, arr);
      }
    } catch { /* run may have no output */ }
  }

  const minCount = Math.max(1, Math.ceil(runs.length * 0.6));
  return Array.from(fieldCounts.entries())
    .filter(([, count]) => count >= minCount)
    .map(([field]) => {
      const sample = fieldValues.get(field)?.[0];
      return { field, valueType: inferValueType(sample), sampleValue: sample, ...classifyField(field) };
    });
}

export async function connectShelby(baseUrl: string): Promise<void> {
  stopShelby();
  store.setStatus('connecting');
  store.setError(null);

  try {
    const pipelineInfos = await fetchShelbyPipelines(baseUrl);

    if (pipelineInfos.length === 0) {
      store.setStatus('error');
      store.setError('No pipelines registered in Shelby. Run `shelby add <pipeline.yml>` first.');
      return;
    }

    const streams: Stream[] = [];

    for (const { slug, name } of pipelineInfos) {
      let fields: DiscoveredField[] = [];
      try { fields = await fetchPipelineFields(baseUrl, slug); } catch {}

      const numericFields = fields.filter(f => f.valueType === 'number');
      const tsSpan: 1 | 2 | 3 | 4 = numericFields.length === 1 ? 4 : 2;

      streams.push({
        id: `${slug}--status`,
        label: `${name} · Runs`,
        kind: 'status',
        transport: 'poll',
        endpoint: `${baseUrl}/api/pipelines/${slug}/runs?limit=72`,
        interval: 10_000,
        span: 2,
      });

      for (const f of numericFields) {
        streams.push({
          id: `${slug}--${f.field}`,
          label: `${name} · ${f.field}`,
          kind: 'timeseries',
          transport: 'poll',
          endpoint: `${baseUrl}/api/pipelines/${slug}/series?field=${encodeURIComponent(f.field)}&limit=60`,
          interval: 10_000,
          span: tsSpan,
          ...(f.unit !== undefined ? { unit: f.unit } : {}),
          ...(f.range !== undefined ? { range: f.range } : {}),
        });
      }

      streams.push({
        id: `${slug}--table`,
        label: `${name} · History`,
        kind: 'table',
        transport: 'poll',
        endpoint: `${baseUrl}/api/pipelines/${slug}/runs?limit=15`,
        interval: 10_000,
        span: 2,
      });
    }

    const n = pipelineInfos.length;
    const autoContract: BeaconContract = {
      version: '1',
      meta: { name: 'Shelby', description: `${n} pipeline${n !== 1 ? 's' : ''}` },
      streams,
    };

    store.setAutoDiscoveredContract(autoContract);
    store.setBaseUrl(baseUrl);

    const saved = store.loadCustomContract(baseUrl);
    const contract = saved ?? autoContract;

    store.setContract(contract);
    stops = contract.streams.map(s => pollStream(s));
    store.setStatus('connected');

  } catch (e) {
    store.setStatus('error');
    store.setError(`Cannot reach Shelby at ${baseUrl} — ${(e as Error).message}`);
  }
}

export async function connectContract(contractUrl: string): Promise<void> {
  stopShelby();
  store.setStatus('connecting');
  store.setError(null);

  try {
    const res = await fetch(contractUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

    const contract: BeaconContract = await res.json();
    if (contract.version !== '1') throw new Error('Unsupported contract version');

    store.setContract(contract);
    store.setBaseUrl(null);

    const base = new URL(contractUrl).origin;
    stops = contract.streams.map(s => pollStream(s, base));

    store.setStatus('connected');
  } catch (e) {
    store.setStatus('error');
    store.setError(`Contract error: ${(e as Error).message}`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function get<T>(base: string, path: string): Promise<T> {
  const res = await fetch(`${base}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

function inferValueType(v: unknown): 'number' | 'string' | 'boolean' | 'unknown' {
  if (typeof v === 'number') return 'number';
  if (typeof v === 'string' && v !== '' && !isNaN(Number(v))) return 'number';
  if (typeof v === 'string') return 'string';
  if (typeof v === 'boolean') return 'boolean';
  return 'unknown';
}

function classifyField(field: string): { unit?: string; range?: [number, number] } {
  const f = field.toLowerCase();
  if (/_ms$|latency|_duration/.test(f)) return { unit: 'ms' };
  if (/_pct$|_rate$|_ratio$|percent/.test(f)) return { unit: '%', range: [0, 100] };
  if (/_bytes$|_mb$|_gb$/.test(f)) return { unit: 'B' };
  return {};
}
