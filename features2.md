Ideas concretas, no hype:

---

## El problema actual

Auto-layout hoy = algoritmo determinista. Widget type → posición fija. No sabe nada del contexto.

---

## Cómo entra IA

### 1. Layout generation desde intención

Usuario escribe: *"quiero monitorear latencia y errores juntos, CPU secundario"*

Llamas Claude API con:
- El contrato completo (widgets disponibles, sus tipos, nombres)
- La intención del usuario

Claude devuelve JSON de layout. Beacon lo renderiza.

```ts
// Input al modelo
{
  availableWidgets: ContractWidget[],  // del @beacon/contract
  userIntent: string,
  currentLayout?: Layout              // para refinamientos
}

// Output esperado
{
  grid: LayoutItem[],
  reasoning: string  // opcional, para debug/UI
}
```

**Costo real:** 1 llamada por layout generado. Barato.

---

### 2. Layout refinamiento conversacional

Chat pequeño embebido en el builder:

> "pon las métricas críticas arriba"  
> "agrupa todo lo de red junto"  
> "este dashboard es para mobile"

Cada mensaje → Claude recibe layout actual + instrucción → devuelve layout modificado. Stateless, contexto mínimo.

---

### 3. Anomaly highlighting automático

Más interesante: IA que *lee los datos en tiempo real* y reorganiza el layout para destacar lo que importa ahora.

- Serie con spike → sube al top automáticamente
- Todo estable → layout compacto
- Umbral superado → widget expande, ocupa más espacio

No necesitas LLM para esto — modelo local ligero o reglas heurísticas simples bastan.

---

### 4. Dashboard desde descripción (zero-config mejorado)

Usuario conecta servidor. En vez de auto-render dumb, Claude analiza el contrato completo y genera:
- Nombre sugerido para el dashboard
- Agrupaciones lógicas (infra vs app vs negocio)
- Layout con jerarquía visual correcta

**Esto es el wow real.** Conectas cualquier server → tienes dashboard inteligente en segundos.

---

## Arquitectura recomendada

```
@beacon/contract spec
       ↓
  Claude API (Sonnet)
       ↓
  Layout JSON (validated with zod)
       ↓
  Beacon engine renderiza
```

Validar output del modelo contra schema estricto antes de renderizar. Nunca confiar en JSON crudo del LLM directo al DOM.

---

**El move más impactante:** punto 4 + punto 2 juntos. Zero-config inteligente + refinamiento conversacional. Nadie más hace eso en dashboards personales.

¿Arrancamos con cuál?