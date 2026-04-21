# Beacon — CLAUDE.md

## What is Beacon

Universal dashboard engine. Consumes any data source that implements the `@beacon/contract` spec and auto-renders a real-time dashboard. Zero config needed once a compatible source is connected.

## Monorepo Layout

```
beacon/
├── apps/
│   └── engine/          # Main SPA (Svelte 5 + Vite)
│       └── src/
│           ├── App.svelte
│           ├── lib/
│           │   ├── store.svelte.ts      # Global reactive state
│           │   └── adapters/
│           │       ├── shelby.ts        # Auto-discovery for Shelby
│           │       ├── poll.ts          # Fetch-on-interval transport
│           │       └── transform.ts     # Raw → StreamData normalization
│           └── components/
│               └── widgets/             # Scalar, Timeseries, StatusGrid, Table, RawJson
└── packages/
    └── contract/        # @beacon/contract — canonical type definitions
        └── src/index.ts
```

## Tech Stack

- **Svelte 5** — reactive state via `$state` / `$derived` (no stores, no Svelte 4 patterns)
- **Vite 6** + **TypeScript** strict mode
- **pnpm workspaces** (Node >=20, pnpm >=9)
- No external UI component libraries — all widgets are SVG/HTML primitives

## Key Commands

```bash
pnpm dev          # start engine dev server (from repo root)
pnpm build        # build engine
pnpm typecheck    # tsc --noEmit
```

Run from repo root (`/beacon`). Workspace scripts are defined in root `package.json`.

## Architecture

**Data flow:** Data Source → Adapter → Transform → Store → Widget render

**Adapters** hit endpoints and push normalized `StreamData` into the Svelte store.  
**Widgets** read from the store reactively — they never fetch directly.

### Contract (`@beacon/contract`)

`BeaconContract` = metadata + `StreamDefinition[]`  
Each stream has: `id`, `label`, `kind`, `unit`, `transport`, `endpoint`, `interval`, `span`, `range`, `schema`, `description`

`StreamKind`: `scalar` | `timeseries` | `status_grid` | `table` | `raw_json`  
`TransportKind`: `poll` | `ws` | `sse` (only `poll` implemented)

### Discovery Modes

1. **Direct contract** — GET `/beacon/contract` → `BeaconContract` JSON
2. **Shelby auto-discovery** — introspects `/api/pipelines`, builds contract on-the-fly
3. **Mock** — `mock.ts` generates demo data, auto-loads when no `?src` param

### Connection Entry Points

- URL bar in landing screen
- `?src=<url>` query param auto-connects on load
- Quick-connect buttons (mock, local Shelby)

## Visual Design Conventions

- Dark theme, indigo accent `#6366f1`, cyan `#22d3ee`
- Status colors: ok=green, fail=red, warn=amber, unknown=gray
- 4-col desktop grid, 2-col tablet, 1-col mobile
- Widget `span` prop (1–4) controls column width
- Fonts: Inter (UI), JetBrains Mono (data/code)

## Coding Conventions

- Svelte 5 runes only (`$state`, `$derived`, `$effect`) — no legacy `writable`/`readable`
- TypeScript strict — no `any`, no non-null assertions unless unavoidable
- CSS in `<style>` blocks scoped to component; global tokens via CSS variables
- Charts rendered as inline SVG — no chart libraries
- All endpoints resolved relative to base URL (CORS-free by design)

## What NOT to Do

- Don't add UI component libraries (no shadcn, no daisyUI, etc.)
- Don't introduce WS/SSE transport until poll is fully stable
- Don't couple widgets to specific data sources — widgets only know `StreamData`
