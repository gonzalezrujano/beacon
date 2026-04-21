// Shelby discovery adapter.
// Connects to any running Shelby server WITHOUT requiring /beacon/contract.
// Introspects /api/pipelines → builds a BeaconContract → starts polling.

import type { BeaconContract, Stream } from '@beacon/contract';
import { store } from '../store.svelte';
import { pollStream, type StopFn } from './poll';

// Shelby API types (Go JSON has capitalized keys for pipelineView)
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

let stops: StopFn[] = [];

export function stopShelby() {
  stops.forEach(fn => fn());
  stops = [];
}

export async function connectShelby(baseUrl: string): Promise<void> {
  stopShelby();
  store.setStatus('connecting');
  store.setError(null);

  try {
    // 1. List pipelines
    const pipelines: ShelbyPipeline[] = await get(baseUrl, '/api/pipelines');

    if (!Array.isArray(pipelines) || pipelines.length === 0) {
      store.setStatus('error');
      store.setError('No pipelines registered in Shelby. Run `shelby add <pipeline.yml>` first.');
      return;
    }

    const streams: Stream[] = [];

    // 2. Discover each pipeline
    for (const p of pipelines) {
      const slug = p.Slug;
      const name = p.Name;

      // Get latest run to discover numeric output fields
      let numericFields: string[] = [];
      try {
        const runsResp: ShelbyRunsResp = await get(baseUrl, `/api/pipelines/${slug}/runs?limit=1`);
        const latestId = runsResp.runs?.[0]?.run_id;
        if (latestId) {
          const detail: ShelbyRunDetail = await get(baseUrl, `/api/pipelines/${slug}/runs/${latestId}`);
          numericFields = Object.entries(detail.output ?? {})
            .filter(([, v]) => isNumeric(v))
            .map(([k]) => k);
        }
      } catch { /* pipeline may have no runs yet */ }

      // Status grid
      streams.push({
        id:        `${slug}--status`,
        label:     `${name} · Runs`,
        kind:      'status',
        transport: 'poll',
        endpoint:  `${baseUrl}/api/pipelines/${slug}/runs?limit=72`,
        interval:  10_000,
        span:      2,
      });

      // Timeseries per numeric field
      for (const field of numericFields) {
        streams.push({
          id:        `${slug}--${field}`,
          label:     `${name} · ${field}`,
          kind:      'timeseries',
          transport: 'poll',
          endpoint:  `${baseUrl}/api/pipelines/${slug}/series?field=${encodeURIComponent(field)}&limit=60`,
          interval:  10_000,
          span:      2,
        });
      }

      // Run history table
      streams.push({
        id:        `${slug}--table`,
        label:     `${name} · History`,
        kind:      'table',
        transport: 'poll',
        endpoint:  `${baseUrl}/api/pipelines/${slug}/runs?limit=15`,
        interval:  10_000,
        span:      2,
      });
    }

    const n = pipelines.length;
    const contract: BeaconContract = {
      version: '1',
      meta: {
        name:        'Shelby',
        description: `${n} pipeline${n !== 1 ? 's' : ''}`,
      },
      streams,
    };

    store.setContract(contract);

    // 3. Start polling all streams (endpoints are already absolute URLs)
    stops = streams.map(s => pollStream(s));

    store.setStatus('connected');

  } catch (e) {
    store.setStatus('error');
    store.setError(`Cannot reach Shelby at ${baseUrl} — ${(e as Error).message}`);
  }
}

// Generic contract endpoint adapter (for servers that implement /beacon/contract)
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

    // Derive base URL from contractUrl for relative endpoints
    const base = new URL(contractUrl).origin;
    stops = contract.streams.map(s => pollStream(s, base));

    store.setStatus('connected');
  } catch (e) {
    store.setStatus('error');
    store.setError(`Contract error: ${(e as Error).message}`);
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function get<T>(base: string, path: string): Promise<T> {
  const res = await fetch(`${base}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

function isNumeric(v: unknown): boolean {
  if (typeof v === 'number') return true;
  if (typeof v === 'string') return v !== '' && !isNaN(Number(v));
  return false;
}
