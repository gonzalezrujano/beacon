Voy a explorar el código actual para entender la arquitectura antes de planear.

Arquitectura actual: **1 stream = 1 widget**. Todo lo que pides requiere cambiar a **instancias de widget** (muchos widgets → 1 stream).

---

**Plan en 3 fases:**

**Fase 1 — Widget Instances (base de todo)**
- Nuevo tipo `WidgetInstance { id, streamId, widgetKind?, config }`
- Store pasa de `layout.order: string[]` a `instances: WidgetInstance[]`
- UI "Add Widget": seleccionar stream → seleccionar tipo → crea instancia
- Mismo stream puede tener 2 instancias con tipos distintos (ej: Timeseries + RawJson del mismo dato)

**Fase 2 — Inspect / Debug panel**
- Botón "Inspect" en cada widget en edit mode
- Drawer lateral: datos crudos del último poll, config del stream, estado de polling

**Fase 3 — Custom Widget foundation**
- `WidgetRegistry`: `Map<kind, SvelteComponent>`
- WidgetCard deja de tener `{#if stream.kind === 'X'}` hardcoded
- Cada widget registrado expone metadata (nombre, ícono, kinds compatibles)
- Estructura lista para cargar widgets externos via dynamic import

---

Fase 1 es el refactor más grande (toca store, Dashboard, WidgetCard). Fases 2 y 3 son aditivas.

¿Arrancamos con Fase 1 completa, o quieres algo más acotado primero?