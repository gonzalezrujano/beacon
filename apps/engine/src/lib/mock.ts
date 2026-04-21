import { store } from './store.svelte';
import type {
  BeaconContract, TimeseriesData, ScalarData, StatusData, TableData,
} from '@beacon/contract';

function timeseries(n: number, base: number, variance: number): TimeseriesData['points'] {
  const now = Date.now();
  let v = base;
  return Array.from({ length: n }, (_, i) => {
    v = Math.max(1, v + (Math.random() - 0.48) * variance);
    return { t: new Date(now - (n - i) * 12_000).toISOString(), v: Math.round(v * 10) / 10 };
  });
}

function randHex(len = 8) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

export function loadMock() {
  const contract: BeaconContract = {
    version: '1',
    meta: { name: 'System Monitor', description: 'Realtime pipeline metrics — demo mode' },
    streams: [
      { id: 'success_rate', label: 'Success Rate',   kind: 'scalar',     unit: '%',  transport: 'poll', endpoint: '', span: 1, thresholds: { warn: 95, crit: 90, dir: 'below' } },
      { id: 'avg_latency',  label: 'Avg Duration',   kind: 'scalar',     unit: 'ms', transport: 'poll', endpoint: '', span: 1, thresholds: { warn: 150, crit: 300 } },
      { id: 'latency',      label: 'Response Time',  kind: 'timeseries', unit: 'ms', transport: 'poll', endpoint: '', span: 2, thresholds: { warn: 150, crit: 300 } },
      { id: 'cpu',          label: 'CPU Usage',      kind: 'timeseries', unit: '%',  transport: 'poll', endpoint: '', span: 2, thresholds: { warn: 60, crit: 80 } },
      { id: 'run_history',  label: 'Run History',    kind: 'status',                 transport: 'poll', endpoint: '', span: 2 },
      { id: 'recent_runs',  label: 'Recent Runs',    kind: 'table',                  transport: 'poll', endpoint: '', span: 2 },
    ],
  };

  store.setContract(contract);
  store.setStatus('connected');

  // Scalars
  store.updateStream('success_rate', {
    kind: 'scalar', value: 98.4, unit: '%', trend: 'up', change: 0.2,
    sparkline: Array.from({ length: 14 }, () => 90 + Math.random() * 10),
  });
  store.updateStream('avg_latency', {
    kind: 'scalar', value: 134, unit: 'ms', trend: 'down', change: -8.1,
    sparkline: Array.from({ length: 14 }, () => 100 + Math.random() * 80),
  });

  // Timeseries
  store.updateStream('latency', { kind: 'timeseries', unit: 'ms', points: timeseries(60, 130, 35) });
  store.updateStream('cpu',     { kind: 'timeseries', unit: '%',  points: timeseries(60, 42,  18) });

  // Status grid
  const now = Date.now();
  const statuses = Array.from({ length: 72 }, () =>
    Math.random() > 0.04 ? ('ok' as const) : ('fail' as const)
  );
  const points = statuses.map((status, i) => ({
    id: `r_${randHex()}`,
    status,
    timestamp: new Date(now - (72 - i) * 600_000).toISOString(),
    duration: `${Math.floor(Math.random() * 180 + 20)}ms`,
  }));
  const okCount = points.filter(p => p.status === 'ok').length;
  store.updateStream('run_history', {
    kind: 'status', points,
    summary: { ok: okCount, fail: points.length - okCount, warn: 0, total: points.length },
  });

  // Table
  store.updateStream('recent_runs', {
    kind: 'table',
    rows: Array.from({ length: 10 }, (_, i) => ({
      run_id:     `r_${randHex()}`,
      status:     Math.random() > 0.05 ? 'ok' : 'fail',
      started_at: new Date(now - i * 12_000).toISOString(),
      duration:   `${Math.floor(Math.random() * 180 + 20)}ms`,
      steps:      `${Math.floor(Math.random() * 3 + 1)}/${Math.floor(Math.random() * 3 + 3)}`,
    })),
  });
}

// Live mock: randomly nudge data every 10s
export function startMockLive() {
  let t = setInterval(() => {
    const s = store.streams;

    // Nudge scalars
    const sr = s['success_rate'] as ScalarData | undefined;
    if (sr) {
      const v = Math.min(100, Math.max(85, sr.value + (Math.random() - 0.5) * 0.5));
      store.updateStream('success_rate', {
        ...sr, value: Math.round(v * 10) / 10,
        sparkline: [...(sr.sparkline ?? []).slice(1), v],
      });
    }

    const al = s['avg_latency'] as ScalarData | undefined;
    if (al) {
      const v = Math.max(40, al.value + (Math.random() - 0.5) * 10);
      store.updateStream('avg_latency', {
        ...al, value: Math.round(v),
        sparkline: [...(al.sparkline ?? []).slice(1), v],
      });
    }

    // Append to timeseries
    const lat = s['latency'] as TimeseriesData | undefined;
    if (lat) {
      const last = lat.points.at(-1)!.v;
      const newV = Math.max(10, last + (Math.random() - 0.48) * 25);
      store.updateStream('latency', {
        ...lat,
        points: [...lat.points.slice(-79), { t: new Date().toISOString(), v: Math.round(newV) }],
      });
    }

    const cpu = s['cpu'] as TimeseriesData | undefined;
    if (cpu) {
      const last = cpu.points.at(-1)!.v;
      const newV = Math.min(100, Math.max(1, last + (Math.random() - 0.48) * 12));
      store.updateStream('cpu', {
        ...cpu,
        points: [...cpu.points.slice(-79), { t: new Date().toISOString(), v: Math.round(newV * 10) / 10 }],
      });
    }
  }, 5000);

  return () => clearInterval(t);
}
