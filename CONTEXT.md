# Beacon — Context

## What is Beacon
Universal dashboard engine that consumes data sources implementing `@beacon/contract` and auto-renders real-time dashboards.

## Stack
- Svelte 5 (runes only: `$state`, `$derived`, `$effect`)
- Vite 6 + TypeScript strict
- pnpm workspaces (Node >=20)

## Project Structure
```
beacon/
├── apps/engine/          # Main SPA
│   └── src/
│       ├── App.svelte
│       ├── lib/
│       │   ├── store.svelte.ts      # Global reactive state
│       │   └── adapters/            # shelby.ts, poll.ts, transform.ts
│       └── components/widgets/     # Scalar, Timeseries, StatusGrid, Table, RawJson
└── packages/contract/    # @beacon/contract types
```

## Key Concepts

**Contract**: `BeaconContract` = metadata + `StreamDefinition[]`
- Each stream has: `id`, `label`, `kind`, `unit`, `transport`, `endpoint`, `interval`, `span`, `range`, `schema`, `description`
- `StreamKind`: `scalar` | `timeseries` | `status_grid` | `table` | `raw_json`
- `TransportKind`: `poll` | `ws` | `sse` (only `poll` implemented)

**Data Flow**: Data Source → Adapter → Transform → Store → Widget render

**Connection**: URL bar input, `?src=<url>` param, or quick-connect (mock/local Shelby)

## Commands
```bash
pnpm dev          # start engine dev server
pnpm build        # build
pnpm typecheck    # tsc --noEmit
```

## Design
- Dark theme, indigo `#6366f1` + cyan `#22d3ee` accent
- Status colors: ok=green, fail=red, warn=amber, unknown=gray
- 4-col desktop, 2-col tablet, 1-col mobile
- Fonts: Inter (UI), JetBrains Mono (data/code)
