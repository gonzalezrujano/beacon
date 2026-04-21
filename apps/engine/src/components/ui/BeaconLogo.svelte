<script lang="ts">
  let { size = 20, glow = false }: { size?: number; glow?: boolean } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  class:glow
  aria-hidden="true"
>
  <!-- Outer ring, dashed -->
  <circle cx="12" cy="12" r="10" stroke="var(--accent)" stroke-width="1.2" stroke-dasharray="3 2" opacity="0.45"/>
  <!-- Signal arcs -->
  <path d="M6.5 17.5 A8 8 0 0 1 6.5 6.5"  stroke="var(--accent-2)" stroke-width="1.4" stroke-linecap="round" opacity="0.6"/>
  <path d="M17.5 6.5 A8 8 0 0 1 17.5 17.5" stroke="var(--accent-2)" stroke-width="1.4" stroke-linecap="round" opacity="0.6"/>
  <!-- Inner dot -->
  <circle cx="12" cy="12" r="2.8" fill="var(--accent)" opacity="0.95"/>
  <circle cx="12" cy="12" r="1.4" fill="white" opacity="0.9"/>
</svg>

<style>
  svg { display: block; flex-shrink: 0; }
  svg.glow {
    filter: drop-shadow(0 0 8px var(--accent-glow)) drop-shadow(0 0 16px var(--accent-glow));
  }
</style>
