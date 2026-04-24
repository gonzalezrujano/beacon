# Custom Widget Generation Guide

Use this guide to generate valid custom widgets for Beacon dashboard engine.

## Architecture Overview

Custom widgets are ESM modules that export a `mount(element, props)` function. The engine calls `mount` with a DOM element and render props, then expects a `WidgetMount` object with `update()` and `destroy()` methods.

```
Data Source → Adapter → Transform → Store → Custom Widget
                                                      ↓
                                              mount(element, props)
                                                      ↓
                                              WidgetMount { update, destroy }
```

## File Structure

A custom widget is distributed as a ZIP containing:

```
widget.zip
├── manifest.json    # Widget metadata
└── widget.js        # ESM module with mount export
```

## manifest.json Schema

```json
{
  "kind": "scalar",           // Primary StreamKind this widget renders
  "name": "My Widget",        // Display name
  "icon": "📊",               // Optional icon (emoji)
  "compatibleKinds": ["scalar", "timeseries"],  // Optional additional kinds
  "version": "1.0.0"          // Optional version
}
```

**Valid `kind` values:** `scalar`, `timeseries`, `table`, `status`, `log`, `raw`

## widget.js Contract

```javascript
/**
 * @param {HTMLElement} element - Container DOM element (already mounted in the DOM)
 * @param {WidgetRenderProps} props - Render properties
 * @returns {WidgetMount}
 */
export function mount(element, props) {
  // element is the container - you own it, do whatever you want with it

  // Initialize your widget
  const container = element;

  return {
    update(newProps) {
      // Called whenever props change (data updates, config changes)
      // Re-render with new data
    },
    destroy() {
      // Cleanup - remove event listeners, cancel timers, etc.
    }
  };
}
```

### WidgetRenderProps

```typescript
interface WidgetRenderProps {
  data: StreamData;      // The actual stream data
  stream: Stream;        // Stream definition (label, kind, unit, etc.)
  config: WidgetConfig;   // Widget display config (colorScheme, thresholds, etc.)
  thresholds: StreamThresholds | undefined;
}
```

## StreamData Types

All data shapes have a `kind` discriminator:

### ScalarData
```typescript
{
  kind: 'scalar';
  value: number;
  unit?: string;
  trend?: 'up' | 'down' | 'flat';
  change?: number;        // Percentage change
  sparkline?: number[];  // Array of historical values
}
```

### TimeseriesData
```typescript
{
  kind: 'timeseries';
  points: Array<{ t: string; v: number }>;  // ISO timestamp + value
  unit?: string;
}
```

### StatusData
```typescript
{
  kind: 'status';
  points: Array<{
    id: string;
    status: 'ok' | 'fail' | 'warn';
    timestamp: string;
    duration?: string;
  }>;
  summary?: { ok: number; fail: number; warn: number; total: number };
}
```

### TableData
```typescript
{
  kind: 'table';
  rows: Record<string, unknown>[];  // Array of row objects
}
```

### LogData
```typescript
{
  kind: 'log';
  lines: Array<{
    t: string;      // ISO timestamp
    level: 'info' | 'warn' | 'error' | 'debug';
    msg: string;
  }>;
}
```

### RawData
```typescript
{
  kind: 'raw';
  data: unknown;  // Arbitrary JSON
}
```

## WidgetConfig

```typescript
interface WidgetConfig {
  chartType: 'line' | 'area' | 'bar';
  colorScheme: 'indigo' | 'cyan' | 'green' | 'amber';
  timeWindow: 'all' | '5m' | '15m' | '1h' | '6h' | '24h';
  aggregation: 'none' | 'avg' | 'max' | 'p95';
  thresholds?: StreamThresholds;
  transforms?: WidgetTransformConfig;
}
```

## Complete Examples

### Example 1: Simple Gauge Widget (Scalar)

```javascript
export function mount(element, props) {
  const { data, config } = props;

  if (data.kind !== 'scalar') {
    element.innerHTML = '<div style="color:#f87171">Requires scalar data</div>';
    return { update() {}, destroy() {} };
  }

  const color = config.colorScheme === 'cyan' ? '#22d3ee'
              : config.colorScheme === 'green' ? '#34d399'
              : '#6366f1';

  const percent = Math.min(100, Math.max(0, data.value));

  element.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 8px;
      font-family: var(--font-mono, monospace);
    ">
      <div style="position: relative; width: 80px; height: 80px;">
        <svg viewBox="0 0 36 36" style="transform: rotate(-90deg);">
          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="3"/>
          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none" stroke="${color}" stroke-width="3"
            stroke-dasharray="${percent}, 100"/>
        </svg>
        <div style="
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700; color: var(--tx);
        ">
          ${data.value}${data.unit ?? ''}
        </div>
      </div>
      ${data.trend ? `<span style="font-size:11px;color:${data.trend === 'up' ? '#34d399' : data.trend === 'down' ? '#f87171' : '#6b7280'}">${data.trend === 'up' ? '↑' : data.trend === 'down' ? '↓' : '→'} ${data.change?.toFixed(1) ?? 0}%</span>` : ''}
    </div>
  `;

  return {
    update(newProps) {
      // For a simple gauge, full re-render is fine
      mount(element, newProps);
    },
    destroy() {
      element.innerHTML = '';
    }
  };
}
```

### Example 2: Horizontal Bar Chart (Timeseries)

```javascript
export function mount(element, props) {
  const { data, config } = props;

  if (data.kind !== 'timeseries') {
    element.innerHTML = '<div style="color:#f87171">Requires timeseries data</div>';
    return { update() {}, destroy() {} };
  }

  const color = config.colorScheme === 'cyan' ? '#22d3ee'
              : config.colorScheme === 'green' ? '#34d399'
              : '#6366f1';

  const max = Math.max(...data.points.map(p => p.v));
  const barHeight = 8;

  element.innerHTML = `
    <div style="
      display: flex; flex-direction: column;
      height: 100%; gap: 4px; padding: 8px;
      font-family: var(--font-mono, monospace);
    ">
      ${data.points.slice(-20).map((p, i) => {
        const width = max > 0 ? (p.v / max) * 100 : 0;
        return `
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size:10px;color:#6b7280;width:40px;text-align:right;">
              ${new Date(p.t).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
            </span>
            <div style="flex:1;height:${barHeight}px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden;">
              <div style="width:${width}%;height:100%;background:${color};border-radius:2px;transition:width 0.3s;"></div>
            </div>
            <span style="font-size:10px;color:#9ca3af;width:50px;">${p.v.toFixed(1)}${data.unit ?? ''}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;

  return {
    update(newProps) {
      mount(element, newProps);
    },
    destroy() {
      element.innerHTML = '';
    }
  };
}
```

### Example 3: Status Summary Card (Status)

```javascript
export function mount(element, props) {
  const { data } = props;

  if (data.kind !== 'status') {
    element.innerHTML = '<div style="color:#f87171">Requires status data</div>';
    return { update() {}, destroy() {} };
  }

  const s = data.summary ?? { ok: 0, fail: 0, warn: 0, total: data.points.length };
  const okRate = s.total > 0 ? ((s.ok / s.total) * 100).toFixed(1) : '0.0';

  element.innerHTML = `
    <div style="
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      height: 100%; gap: 12px;
      font-family: var(--font-sans, sans-serif);
    ">
      <div style="
        display: flex; gap: 24px;
        font-size: 13px; font-weight: 500;
      ">
        <span style="color: #34d399;">● ${s.ok} ok</span>
        <span style="color: #f87171;">● ${s.fail} fail</span>
        ${s.warn > 0 ? `<span style="color: #f59e0b;">● ${s.warn} warn</span>` : ''}
      </div>
      <div style="
        font-size: 32px; font-weight: 700; font-family: var(--font-mono, monospace);
        color: ${s.fail > 0 ? '#f87171' : '#34d399'};
      ">${okRate}%</div>
      <div style="font-size: 11px; color: #6b7280;">success rate</div>
    </div>
  `;

  return {
    update(newProps) {
      mount(element, newProps);
    },
    destroy() {
      element.innerHTML = '';
    }
  };
}
```

## Testing Your Widget

Before loading a widget into Beacon, test it in isolation:

```javascript
// Simulate the render environment
const mockElement = document.createElement('div');

// Mock props matching WidgetRenderProps
const mockProps = {
  data: {
    kind: 'scalar',
    value: 94.3,
    unit: '%',
    trend: 'up',
    change: 2.1
  },
  stream: {
    id: 'test',
    label: 'Success Rate',
    kind: 'scalar'
  },
  config: {
    chartType: 'line',
    colorScheme: 'indigo'
  },
  thresholds: undefined
};

// Mount and test
const { update, destroy } = mount(mockElement, mockProps);

// Verify it rendered
console.assert(mockElement.innerHTML.length > 0, 'Widget should render content');

// Simulate data update
mockProps.data.value = 95.5;
update(mockProps);

// Clean up
destroy();
```

## Security Considerations

- **Never use `innerHTML` with user-provided data** — use `textContent` or sanitize
- **Avoid `eval()` or `Function()`** — widgets run in the main thread
- **Don't access `window` or `document` outside the provided element** — scope your DOM access
- **Clean up all resources in `destroy()`** — timers, event listeners, observers

## Common Mistakes

### ❌ Wrong: Ignoring the data kind
```javascript
export function mount(element, props) {
  // Always check data.kind!
  element.innerHTML = `<div>${props.data.value}</div>`; // CRASH if data is timeseries
}
```

### ✅ Right: Handling all cases
```javascript
export function mount(element, props) {
  if (props.data.kind === 'scalar') {
    // handle scalar
  } else if (props.data.kind === 'timeseries') {
    // handle timeseries
  }
  // ...
}
```

### ❌ Wrong: Memory leaks
```javascript
let timer;
export function mount(element, props) {
  timer = setInterval(() => update(), 1000); // Never cleared!
}
```

### ✅ Right: Cleanup
```javascript
let timer;
export function mount(element, props) {
  timer = setInterval(() => update(), 1000);
  return {
    update,
    destroy() {
      clearInterval(timer);
    }
  };
}
```

### ❌ Wrong: Breaking the container
```javascript
export function mount(element, props) {
  element.style = 'position: fixed; inset: 0;'; // Takes over the page!
}
```

### ✅ Right: Stay contained
```javascript
export function mount(element, props) {
  // Only style within your container
  element.innerHTML = '<div style="width:100%;height:100%;...">...</div>';
}
```

## CSS Variables Available

Widgets can use these CSS variables for theming:

```css
--bg: #0f1117;           /* Background */
--bg-card: #1a1d27;      /* Card background */
--bg-surface: #242836;   /* Surface */
--tx: #f1f5f9;           /* Primary text */
--tx-2: #cbd5e1;         /* Secondary text */
--tx-3: #64748b;          /* Muted text */
--accent: #6366f1;        /* Primary accent */
--accent-2: #818cf8;     /* Accent variant */
--ok: #34d399;            /* Success */
--fail: #f87171;          /* Error */
--warn: #f59e0b;          /* Warning */
--bd: #2e3347;            /* Border */
--bd-strong: #3e4560;     /* Strong border */
--r-sm: 6px;             /* Small radius */
--r-md: 8px;             /* Medium radius */
--r-lg: 12px;            /* Large radius */
--font-mono: 'JetBrains Mono', monospace;
```

## Build Tools

For complex widgets, consider using a bundler:

```javascript
// widget.js - using pre-bundled code
import { Gauge } from './gauge-component.js';
import './styles.css';

export function mount(element, props) {
  const gauge = new Gauge(element, props);
  return {
    update(newProps) { gauge.update(newProps); },
    destroy() { gauge.destroy(); }
  };
}
```

Bundle with: `esbuild widget.js --bundle --outdir=dist/`
