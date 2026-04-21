// Generic poll adapter.
// Starts a fetch-on-interval loop for one stream and updates the store.

import type { Stream } from '@beacon/contract';
import { store } from '../store.svelte';
import { transform } from './transform';

function needsOutputEnrichment(stream: Stream): boolean {
  return (stream.kind === 'table' || stream.kind === 'log') && !!stream.fields?.length;
}

async function enrichWithOutput(runsUrl: string, raw: unknown): Promise<unknown> {
  if (!raw || typeof raw !== 'object') return raw;
  const d = raw as Record<string, unknown>;
  if (!Array.isArray(d.runs)) return raw;

  const baseRunUrl = runsUrl.split('?')[0];
  const runs = d.runs as Array<{ run_id: string }>;

  const enriched = await Promise.all(
    runs.map(async (run) => {
      try {
        const res = await fetch(`${baseRunUrl}/${run.run_id}`, { cache: 'no-store' });
        if (!res.ok) return run;
        const detail = await res.json() as Record<string, unknown>;
        return { ...run, output: detail.output ?? {} };
      } catch {
        return run;
      }
    })
  );

  return { ...d, runs: enriched };
}

export type StopFn = () => void;

export function pollStream(stream: Stream, baseUrl = ''): StopFn {
  const url = stream.endpoint.startsWith('http')
    ? stream.endpoint
    : `${baseUrl}${stream.endpoint}`;

  let active = true;

  async function tick() {
    if (!active) return;
    const t0 = Date.now();
    try {
      const res = await fetch(url, { cache: 'no-store' });
      const latencyMs = Date.now() - t0;
      if (!res.ok) {
        store.recordPollError(stream.id, `HTTP ${res.status}`);
        return;
      }
      let raw = await res.json();
      if (needsOutputEnrichment(stream)) raw = await enrichWithOutput(url, raw);
      const data = transform(stream, raw);
      if (data) store.updateStream(stream.id, data);
      store.recordPollSuccess(stream.id, latencyMs);
    } catch (e) {
      store.recordPollError(stream.id, e instanceof Error ? e.message : String(e));
    }
  }

  void tick(); // immediate first fetch

  const timer = setInterval(() => void tick(), stream.interval ?? 10_000);

  return () => {
    active = false;
    clearInterval(timer);
  };
}
