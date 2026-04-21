# Beacon Roadmap

## Status Legend
- `[ ]` not started
- `[~]` in progress
- `[x]` done

---

## Phase 1 — Foundation (Current)

- [x] `@beacon/contract` package with full type definitions
- [x] Engine SPA with Svelte 5 + Vite
- [x] Poll transport adapter
- [x] Shelby auto-discovery adapter
- [x] Mock data generator with realistic variance
- [x] Scalar widget (value, trend, sparkline)
- [x] Timeseries widget (SVG, Catmull-Rom, hover tooltip)
- [x] Status Grid widget (dot matrix, summary counts)
- [x] Table widget (sortable, formatted cells)
- [x] RawJson widget (collapsible tree)
- [x] Landing / connection screen
- [x] `?src=` query param auto-connect
- [x] Responsive grid layout (1/2/4 col)
- [x] Connection status badge (live/connecting/error/offline)
- [x] Dark theme with design tokens

---

## Phase 2 — Stability & DX

- [ ] **Error boundaries per widget** — one failing stream doesn't break whole dashboard
- [ ] **Retry logic in poll adapter** — exponential backoff on fetch failures
- [ ] **Stream-level loading skeletons** — pulsing placeholder while first data loads
- [ ] **URL persistence** — save last connected source to `localStorage`, restore on revisit
- [ ] **Manual refresh button** — force-poll all streams on demand
- [ ] **Connection health indicator** — show last-updated timestamp per stream
- [ ] **TypeScript strict audit** — eliminate remaining `any` / loose types
- [ ] **Unit tests for transform.ts** — critical normalization logic needs coverage
- [ ] **Unit tests for adapters** — mock fetch, assert store updates

---

## Phase 3 — Transport Expansion

- [ ] **WebSocket transport** — implement `ws` kind in adapters, handle reconnect
- [ ] **SSE transport** — implement `sse` kind, EventSource with fallback
- [ ] **Transport selector in contract** — engine picks correct adapter per stream `transport` field
- [ ] **Mixed-transport dashboards** — poll + ws + sse streams coexist on same dashboard

---

## Phase 4 — Dashboard UX

- [ ] **Widget header with description tooltip** — show `stream.description` on hover
- [ ] **Fullscreen widget mode** — expand single widget to fill viewport
- [ ] **Time range selector** — override `range` per timeseries widget from UI
- [ ] **Dashboard title / branding** — show `contract.name` and `contract.description` in top bar
- [ ] **Drag-to-reorder widgets** — persist order to `localStorage`
- [ ] **Widget visibility toggle** — hide/show streams without disconnecting
- [ ] **Pinned/favorited streams** — surface important widgets to top of grid
- [ ] **Theme toggle** — light / dark / system

---

## Phase 5 — Multi-Source & Discovery

- [ ] **Multiple simultaneous sources** — connect more than one data source, merge streams
- [ ] **Source management panel** — add/remove/pause sources at runtime
- [ ] **Generic REST auto-discovery** — probe unknown URLs for common API shapes (not just Shelby)
- [ ] **Source health dashboard** — meta-view showing all connected sources and their status

---

## Phase 6 — Contract Ecosystem

- [ ] **Contract validator CLI** — `npx @beacon/contract validate <url>` checks server compliance
- [ ] **Example server implementations** — Node/Express, Python/FastAPI reference implementations
- [ ] **Contract versioning** — `contract.version` field, engine handles backward compat
- [ ] **Publish `@beacon/contract` to npm** — proper semver, changelog, README
- [ ] **Contract playground** — browser tool to paste JSON and preview resulting dashboard

---

## Phase 7 — Production Readiness

- [ ] **Embed mode** — `<iframe>`-friendly, `?embed=1` hides top bar and chrome
- [ ] **Shareable dashboard URLs** — encode config (src, layout, theme) in URL hash
- [ ] **PWA / offline support** — service worker caches last data, shows stale indicator
- [ ] **Accessibility audit** — keyboard nav, ARIA labels on all interactive elements
- [ ] **Performance profiling** — identify re-render bottlenecks with many streams
- [ ] **Bundle size audit** — ensure engine stays lean (<200KB gzip target)
- [ ] **Docker / self-host guide** — single container serving engine as static files

---

## Icebox (Someday / Maybe)

- [ ] Plugin system for custom widget types
- [ ] Alerting / threshold annotations on timeseries
- [ ] CSV / PNG export per widget
- [ ] Dashboard-to-dashboard linking (drill-down)
- [ ] Auth layer for protected data sources (API key / OAuth token passthrough)
- [ ] Mobile native app (Capacitor wrapper)
