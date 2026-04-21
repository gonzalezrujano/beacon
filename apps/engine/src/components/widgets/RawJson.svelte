<script lang="ts">
  import type { RawData } from '@beacon/contract';

  let { data }: { data: RawData } = $props();

  function renderVal(v: unknown, depth = 0): string {
    if (v === null)            return `<span class="nl">null</span>`;
    if (typeof v === 'boolean') return `<span class="bl">${v}</span>`;
    if (typeof v === 'number')  return `<span class="nm">${v}</span>`;
    if (typeof v === 'string') {
      const esc = v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return `<span class="st">"${esc}"</span>`;
    }
    if (Array.isArray(v)) {
      if (!v.length) return `<span class="muted">[]</span>`;
      if (depth > 3) return `<span class="muted">Array[${v.length}]</span>`;
      return renderObj(v, true, depth + 1);
    }
    if (typeof v === 'object') {
      const ks = Object.keys(v as object);
      if (!ks.length) return `<span class="muted">{}</span>`;
      if (depth > 3)  return `<span class="muted">{${ks.slice(0,3).join(', ')}${ks.length > 3 ? '…' : ''}}</span>`;
      return renderObj(v as Record<string,unknown>, false, depth + 1);
    }
    return String(v);
  }

  function renderObj(obj: unknown, isArr: boolean, depth: number): string {
    const keys = Object.keys(obj as object);
    const prev = isArr ? `Array[${keys.length}]` : `{${keys.slice(0,3).join(', ')}${keys.length > 3 ? '…' : ''}}`;
    const items = keys.map(k => {
      const kl = isArr
        ? `<span class="nm">${k}</span>`
        : `<span class="ky">${k}</span>`;
      return `<li>${kl}<span class="col">:</span>${renderVal((obj as Record<string,unknown>)[k], depth)}</li>`;
    }).join('');
    return `<details open><summary><span class="muted">${prev}</span></summary><ul>${items}</ul></details>`;
  }
</script>

<div class="raw-wrap">
  <div class="tree">
    {@html renderObj(data.data as Record<string,unknown>, false, 0)}
  </div>
</div>

<style>
  .raw-wrap {
    overflow-y: auto;
    height: 100%;
    padding: 12px 14px;
  }

  .tree :global(ul) {
    padding-left: 18px;
    list-style: none;
  }
  .tree :global(li) {
    line-height: 1.8;
    font-size: 12px;
    font-family: var(--font-mono);
  }
  .tree :global(.ky)   { color: #9cdcfe; }
  .tree :global(.col)  { color: var(--tx-3); margin: 0 4px; }
  .tree :global(.st)   { color: #ce9178; }
  .tree :global(.nm)   { color: #b5cea8; }
  .tree :global(.bl)   { color: #569cd6; }
  .tree :global(.nl)   { color: var(--tx-3); }
  .tree :global(.muted){ color: var(--tx-3); }

  .tree :global(details > summary) {
    list-style: none;
    cursor: pointer;
    outline: none;
  }
  .tree :global(details > summary::marker) { display: none; }
  .tree :global(details > summary::-webkit-details-marker) { display: none; }
  .tree :global(details > summary::before) {
    content: '▶ ';
    color: var(--tx-3);
    font-size: 9px;
  }
  .tree :global(details[open] > summary::before) {
    content: '▼ ';
  }
</style>
