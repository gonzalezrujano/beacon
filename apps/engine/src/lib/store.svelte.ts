import type { BeaconContract, StreamData, StreamKind } from '@beacon/contract';
import { DEFAULT_CONFIG, type WidgetConfig } from './widgetConfig';
import { loadTemplates, saveTemplates, type DashboardTemplate } from './templates';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface PollMeta {
  lastFetchAt: number | null;
  fetchCount: number;
  lastError: string | null;
  latencyMs: number | null;
}

export interface WidgetInstance {
  id: string;
  streamId: string;
  widgetKind?: StreamKind;
}

export interface DashboardLayout {
  instances: WidgetInstance[];
  spans: Record<string, number>;
}

interface LegacyLayout {
  order: string[];
  spans: Record<string, number>;
}

function loadWidgetConfigs(): Record<string, Partial<WidgetConfig>> {
  try { return JSON.parse(localStorage.getItem('beacon:widgetConfigs') ?? '{}'); }
  catch { return {}; }
}

function loadLayout(): DashboardLayout | null {
  try {
    const raw = JSON.parse(localStorage.getItem('beacon:layout') ?? 'null');
    if (!raw) return null;
    if (Array.isArray(raw.order)) {
      const legacy = raw as LegacyLayout;
      return {
        instances: legacy.order.map(streamId => ({ id: crypto.randomUUID(), streamId })),
        spans: {},
      };
    }
    return raw as DashboardLayout;
  }
  catch { return null; }
}

function loadHiddenInstances(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem('beacon:hiddenInstances') ?? '[]')); }
  catch { return new Set(); }
}

class BeaconStore {
  contract         = $state<BeaconContract | null>(null);
  streams          = $state<Record<string, StreamData>>({});
  pollMeta         = $state<Record<string, PollMeta>>({});
  status           = $state<ConnectionStatus>('disconnected');
  error            = $state<string | null>(null);
  widgetConfigs    = $state<Record<string, Partial<WidgetConfig>>>(loadWidgetConfigs());
  layoutMode       = $state<'auto' | 'custom'>('auto');
  isEditing        = $state(false);
  layout           = $state<DashboardLayout>({ instances: [], spans: {} });
  templates        = $state<DashboardTemplate[]>(loadTemplates());
  hiddenInstances  = $state<Set<string>>(loadHiddenInstances());

  setContract(c: BeaconContract) {
    this.contract = c;
    const streamIds = new Set(c.streams.map(s => s.id));
    const saved = loadLayout();

    if (saved?.instances.length) {
      const knownStreamIds = new Set(saved.instances.map(i => i.streamId));
      const validInstances = saved.instances.filter(i => streamIds.has(i.streamId));
      const newInstances: WidgetInstance[] = c.streams
        .filter(s => !knownStreamIds.has(s.id))
        .map(s => ({ id: crypto.randomUUID(), streamId: s.id }));
      this.layout = { instances: [...validInstances, ...newInstances], spans: saved.spans };
      this.layoutMode = 'custom';
    } else {
      this.layout = {
        instances: c.streams.map(s => ({ id: crypto.randomUUID(), streamId: s.id })),
        spans: {},
      };
    }
  }

  setStatus(s: ConnectionStatus) { this.status = s; }
  setError(e: string | null)     { this.error = e; }

  updateStream(id: string, data: StreamData) {
    this.streams = { ...this.streams, [id]: data };
  }

  recordPollSuccess(streamId: string, latencyMs: number) {
    const prev = this.pollMeta[streamId];
    this.pollMeta = {
      ...this.pollMeta,
      [streamId]: {
        lastFetchAt: Date.now(),
        fetchCount: (prev?.fetchCount ?? 0) + 1,
        lastError: null,
        latencyMs,
      },
    };
  }

  recordPollError(streamId: string, error: string) {
    const prev = this.pollMeta[streamId];
    this.pollMeta = {
      ...this.pollMeta,
      [streamId]: {
        lastFetchAt: Date.now(),
        fetchCount: prev?.fetchCount ?? 0,
        lastError: error,
        latencyMs: prev?.latencyMs ?? null,
      },
    };
  }

  enterEditMode() {
    const streamIds = new Set(this.contract?.streams.map(s => s.id) ?? []);
    const knownStreamIds = new Set(this.layout.instances.map(i => i.streamId));
    const newInstances: WidgetInstance[] = (this.contract?.streams ?? [])
      .filter(s => !knownStreamIds.has(s.id))
      .map(s => ({ id: crypto.randomUUID(), streamId: s.id }));
    this.layout = {
      instances: [...this.layout.instances.filter(i => streamIds.has(i.streamId)), ...newInstances],
      spans: this.layout.spans,
    };
    this.layoutMode = 'custom';
    this.isEditing = true;
  }

  exitEditMode() {
    this.isEditing = false;
    this.saveLayout();
  }

  addInstance(streamId: string, widgetKind?: StreamKind) {
    const instance: WidgetInstance = {
      id: crypto.randomUUID(),
      streamId,
      ...(widgetKind ? { widgetKind } : {}),
    };
    this.layout = { ...this.layout, instances: [...this.layout.instances, instance] };
    this.saveLayout();
  }

  removeInstance(id: string) {
    this.layout = {
      instances: this.layout.instances.filter(i => i.id !== id),
      spans: Object.fromEntries(Object.entries(this.layout.spans).filter(([k]) => k !== id)),
    };
    const next = new Set(this.hiddenInstances);
    next.delete(id);
    this.hiddenInstances = next;
    this.saveLayout();
    this.saveHiddenInstances();
  }

  reorderInstances(from: number, to: number) {
    const instances = [...this.layout.instances];
    const [item] = instances.splice(from, 1);
    instances.splice(to, 0, item);
    this.layout = { ...this.layout, instances };
    this.saveLayout();
  }

  setWidgetSpan(id: string, span: number) {
    this.layout = { ...this.layout, spans: { ...this.layout.spans, [id]: span } };
    this.saveLayout();
  }

  resetLayout() {
    this.layout = {
      instances: this.contract?.streams.map(s => ({ id: crypto.randomUUID(), streamId: s.id })) ?? [],
      spans: {},
    };
    this.hiddenInstances = new Set();
    this.layoutMode = 'auto';
    this.saveLayout();
    this.saveHiddenInstances();
  }

  toggleInstanceVisibility(id: string) {
    const next = new Set(this.hiddenInstances);
    if (next.has(id)) next.delete(id); else next.add(id);
    this.hiddenInstances = next;
    this.saveHiddenInstances();
  }

  setWidgetConfig(id: string, patch: Partial<WidgetConfig>) {
    this.widgetConfigs = { ...this.widgetConfigs, [id]: { ...this.widgetConfigs[id], ...patch } };
    try { localStorage.setItem('beacon:widgetConfigs', JSON.stringify(this.widgetConfigs)); } catch {}
  }

  getWidgetConfig(id: string): WidgetConfig {
    return { ...DEFAULT_CONFIG, ...this.widgetConfigs[id] };
  }

  saveTemplate(name: string, description: string): DashboardTemplate {
    const t: DashboardTemplate = {
      id: crypto.randomUUID(),
      name,
      description,
      createdAt: new Date().toISOString(),
      layout: { instances: [...this.layout.instances], spans: { ...this.layout.spans } },
      widgetConfigs: { ...this.widgetConfigs },
    };
    this.templates = [t, ...this.templates];
    saveTemplates(this.templates);
    return t;
  }

  applyTemplate(t: DashboardTemplate) {
    const streamIds = new Set(this.contract?.streams.map(s => s.id) ?? []);
    const validInstances = t.layout.instances.filter(i => streamIds.has(i.streamId));
    const knownStreamIds = new Set(validInstances.map(i => i.streamId));
    const newInstances: WidgetInstance[] = (this.contract?.streams ?? [])
      .filter(s => !knownStreamIds.has(s.id))
      .map(s => ({ id: crypto.randomUUID(), streamId: s.id }));
    this.layout = { instances: [...validInstances, ...newInstances], spans: { ...t.layout.spans } };
    this.widgetConfigs = { ...t.widgetConfigs };
    this.layoutMode = 'custom';
    this.saveLayout();
    try { localStorage.setItem('beacon:widgetConfigs', JSON.stringify(this.widgetConfigs)); } catch {}
  }

  importTemplate(t: DashboardTemplate) {
    const exists = this.templates.some(x => x.id === t.id);
    this.templates = exists
      ? this.templates.map(x => x.id === t.id ? t : x)
      : [t, ...this.templates];
    saveTemplates(this.templates);
  }

  deleteTemplate(id: string) {
    this.templates = this.templates.filter(t => t.id !== id);
    saveTemplates(this.templates);
  }

  private saveLayout() {
    try { localStorage.setItem('beacon:layout', JSON.stringify(this.layout)); } catch {}
  }

  private saveHiddenInstances() {
    try { localStorage.setItem('beacon:hiddenInstances', JSON.stringify([...this.hiddenInstances])); } catch {}
  }
}

export const store = new BeaconStore();
