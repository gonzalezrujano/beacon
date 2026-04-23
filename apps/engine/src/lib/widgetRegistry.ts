import type { StreamKind, StreamData, Stream, StreamThresholds } from '@beacon/contract';
import type { WidgetConfig } from './widgetConfig';
import type { Component } from 'svelte';

export interface WidgetRenderProps {
  data: StreamData;
  stream: Stream;
  config: WidgetConfig;
  thresholds: StreamThresholds | undefined;
}

export interface WidgetMount {
  update: (props: WidgetRenderProps) => void;
  destroy: () => void;
}

export interface WidgetMeta {
  name: string;
  icon: string;
  compatibleKinds: StreamKind[];
  hasDisplayConfig: boolean;
  hasTransformConfig: boolean;
}

export interface WidgetDef {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: Component<any>;
  meta: WidgetMeta;
  buildProps: (
    data: StreamData,
    stream: Stream,
    config: WidgetConfig,
    thresholds: StreamThresholds | undefined
  ) => Record<string, unknown>;
}

const registry = new Map<StreamKind, WidgetDef>();

export function register(kind: StreamKind, def: WidgetDef): void {
  registry.set(kind, def);
}

export function getWidget(kind: StreamKind): WidgetDef | undefined {
  return registry.get(kind);
}

export function listWidgets(): Array<{ kind: StreamKind; meta: WidgetMeta }> {
  return [...registry.entries()].map(([kind, def]) => ({ kind, meta: def.meta }));
}

export function compatibleWidgets(streamKind: StreamKind): Array<{ kind: StreamKind; meta: WidgetMeta }> {
  return listWidgets().filter(({ meta }) => meta.compatibleKinds.includes(streamKind));
}