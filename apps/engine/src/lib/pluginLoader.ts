import type { StreamKind } from '@beacon/contract';
import type { WidgetRenderProps, WidgetMount, WidgetMeta } from './widgetRegistry';
import { register } from './widgetRegistry';
import CustomWidgetHost from '../components/widgets/CustomWidgetHost.svelte';

export interface PluginManifest {
  kind: StreamKind;
  name: string;
  icon?: string;
  compatibleKinds?: StreamKind[];
  version?: string;
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  mount: (element: HTMLElement, props: WidgetRenderProps) => WidgetMount;
}

export async function loadPluginFromFile(file: File): Promise<LoadedPlugin> {
  const buffer = await file.arrayBuffer();
  const entries = await parseZip(buffer);

  const manifestRaw = entries.get('manifest.json');
  if (!manifestRaw) throw new Error('manifest.json not found in ZIP');
  const manifest: PluginManifest = JSON.parse(new TextDecoder().decode(manifestRaw));
  validateManifest(manifest);

  const widgetRaw = entries.get('widget.js');
  if (!widgetRaw) throw new Error('widget.js not found in ZIP');

  const blob = new Blob([widgetRaw], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);

  let mod: { mount?: LoadedPlugin['mount'] };
  try {
    mod = await import(/* @vite-ignore */ url);
  } finally {
    URL.revokeObjectURL(url);
  }

  if (typeof mod.mount !== 'function') {
    throw new Error('widget.js must export a mount(element, props) function');
  }

  return { manifest, mount: mod.mount };
}

export function registerPlugin(plugin: LoadedPlugin): void {
  const { manifest, mount } = plugin;
  const meta: WidgetMeta = {
    name: manifest.name,
    icon: manifest.icon ?? '🔌',
    compatibleKinds: manifest.compatibleKinds ?? [manifest.kind],
    hasDisplayConfig: false,
    hasTransformConfig: false,
  };
  register(manifest.kind, {
    component: CustomWidgetHost,
    meta,
    buildProps: (data, stream, config, thresholds) => ({
      mountFn: mount,
      data,
      stream,
      config,
      thresholds,
    }),
  });
}

function validateManifest(m: unknown): asserts m is PluginManifest {
  if (typeof m !== 'object' || m === null) throw new Error('manifest.json must be a JSON object');
  const obj = m as Record<string, unknown>;
  if (typeof obj.kind !== 'string') throw new Error('manifest.json missing required field "kind"');
  if (typeof obj.name !== 'string') throw new Error('manifest.json missing required field "name"');
}

async function parseZip(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const dec = new TextDecoder();
  const entries = new Map<string, Uint8Array>();

  let eocd = -1;
  const searchFrom = Math.max(0, buffer.byteLength - 65558);
  for (let i = buffer.byteLength - 22; i >= searchFrom; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error('Not a valid ZIP file (EOCD not found)');

  const totalEntries = view.getUint16(eocd + 10, true);
  const cdOffset    = view.getUint32(eocd + 16, true);

  let pos = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (view.getUint32(pos, true) !== 0x02014b50) break;

    const compression    = view.getUint16(pos + 10, true);
    const compressedSize = view.getUint32(pos + 20, true);
    const fnLen          = view.getUint16(pos + 28, true);
    const extraLen       = view.getUint16(pos + 30, true);
    const commentLen     = view.getUint16(pos + 32, true);
    const localOffset    = view.getUint32(pos + 42, true);
    const filename       = dec.decode(bytes.subarray(pos + 46, pos + 46 + fnLen));
    pos += 46 + fnLen + extraLen + commentLen;

    if (filename.endsWith('/')) continue;

    if (view.getUint32(localOffset, true) !== 0x04034b50) continue;
    const localFnLen    = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart     = localOffset + 30 + localFnLen + localExtraLen;

    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
    const data = compression === 0 ? compressed.slice() : await inflateRaw(compressed);

    const basename = filename.split('/').pop() ?? filename;
    entries.set(filename, data);
    entries.set(basename, data);
  }

  return entries;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  await writer.write(data);
  await writer.close();

  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}