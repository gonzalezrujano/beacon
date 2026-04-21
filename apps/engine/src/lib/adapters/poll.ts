// Generic poll adapter.
// Starts a fetch-on-interval loop for one stream and updates the store.

import type { Stream } from '@beacon/contract';
import { store } from '../store.svelte';
import { transform } from './transform';

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
      const raw = await res.json();
      const data = transform(stream.kind, raw);
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
