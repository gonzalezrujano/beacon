Ideas para hacer Beacon obra maestra:

---

## 1. Dashboard Builder visual (drag & drop)

Ahora los dashboards se auto-renderizan desde el contrato. Poder **sobreescribir** ese auto-layout con un editor visual:

- Grid drag-and-drop (CSS Grid + pointer events, sin libs)
- Resize handles por widget
- Layout serializable a JSON → guardado en localStorage/URL
- "Auto mode" vs "Custom mode" toggle

El contrato sigue siendo fuente de verdad para los *datos*, pero tú controlas la *presentación*.

---

## 2. Widget config por instancia

Cada widget acepta overrides locales:

```ts
// Ejemplo concepto
{
  widgetId: "cpu_usage",
  override: {
    chartType: "area" | "bar" | "line",
    colorScale: [thresholds],
    aggregation: "avg" | "max" | "p95",
    timeWindow: "5m" | "1h" | "24h"
  }
}
```

Datos del servidor, visualización del usuario.

---

## 3. Transformaciones de datos en cliente

Pipeline de transformación antes de renderizar:

- Filtros (excluir filas, rangos)
- Derivadas (calcular % desde dos métricas)
- Combinaciones (merge dos series en una)

Esto es lo que separa "viewer" de "herramienta de análisis".

---

## 4. Alertas visuales con umbrales

Definir umbrales por métrica directamente en el dashboard:

- Scalar se pone rojo si `> 90%`
- Timeseries muestra banda de alerta
- Sin depender del servidor para definir qué es "malo"

---

## 5. Multi-source en un dashboard

Un dashboard puede mezclar datos de **múltiples servidores** (múltiples contratos). Shelby + otro servicio en la misma vista. Esto es lo que Grafana cobra dinero por hacer bien.

---

## 6. Dashboard templates / presets

Guardar, exportar e importar configuraciones completas como JSON. Compartibles. Uno para "sistema operativo", otro para "base de datos", etc.

---

**¿Qué resuena más?** El builder visual es el mayor wow-factor. Las transformaciones cliente-side son lo más potente para análisis. Los dos juntos es obra maestra.