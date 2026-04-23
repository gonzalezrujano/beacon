<script lang="ts">
  import type { StreamData, Stream, StreamThresholds } from '@beacon/contract';
  import type { WidgetConfig } from '../../lib/widgetConfig';
  import type { WidgetMount } from '../../lib/widgetRegistry';

  let {
    mountFn,
    data,
    stream,
    config,
    thresholds,
  }: {
    mountFn: (el: HTMLElement, props: { data: StreamData; stream: Stream; config: WidgetConfig; thresholds: StreamThresholds | undefined }) => WidgetMount;
    data: StreamData;
    stream: Stream;
    config: WidgetConfig;
    thresholds: StreamThresholds | undefined;
  } = $props();

  let el = $state<HTMLDivElement | undefined>();

  $effect(() => {
    if (!el) return;
    const inst = mountFn(el, { data, stream, config, thresholds });
    return () => { inst.destroy(); };
  });
</script>

<div bind:this={el} class="host"></div>

<style>
  .host {
    width: 100%;
    height: 100%;
    overflow: auto;
  }
</style>