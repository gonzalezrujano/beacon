import { register } from './widgetRegistry';
import Timeseries from '../components/widgets/Timeseries.svelte';
import Scalar from '../components/widgets/Scalar.svelte';
import StatusGrid from '../components/widgets/StatusGrid.svelte';
import Table from '../components/widgets/Table.svelte';
import RawJson from '../components/widgets/RawJson.svelte';
import LogFeed from '../components/widgets/LogFeed.svelte';

register('timeseries', {
  component: Timeseries,
  meta: {
    name: 'Timeseries',
    icon: '📈',
    compatibleKinds: ['timeseries'],
    hasDisplayConfig: true,
    hasTransformConfig: true,
  },
  buildProps: (data, stream, config, thresholds) => ({
    data,
    unit: stream.unit ?? '',
    thresholds,
    config,
  }),
});

register('scalar', {
  component: Scalar,
  meta: {
    name: 'Scalar',
    icon: '🔢',
    compatibleKinds: ['scalar'],
    hasDisplayConfig: true,
    hasTransformConfig: false,
  },
  buildProps: (data, _stream, config, thresholds) => ({ data, thresholds, config }),
});

register('status', {
  component: StatusGrid,
  meta: {
    name: 'Status Grid',
    icon: '🟢',
    compatibleKinds: ['status'],
    hasDisplayConfig: false,
    hasTransformConfig: false,
  },
  buildProps: (data) => ({ data }),
});

register('table', {
  component: Table,
  meta: {
    name: 'Table',
    icon: '⊞',
    compatibleKinds: ['table'],
    hasDisplayConfig: true,
    hasTransformConfig: true,
  },
  buildProps: (data) => ({ data }),
});

register('log', {
  component: LogFeed,
  meta: {
    name: 'Log Feed',
    icon: '📋',
    compatibleKinds: ['log'],
    hasDisplayConfig: false,
    hasTransformConfig: false,
  },
  buildProps: (data) => ({ data }),
});

register('raw', {
  component: RawJson,
  meta: {
    name: 'Raw JSON',
    icon: '{}',
    compatibleKinds: ['timeseries', 'scalar', 'table', 'status', 'log', 'raw'],
    hasDisplayConfig: false,
    hasTransformConfig: false,
  },
  buildProps: (data, stream) => ({
    data: { kind: 'raw' as const, data, label: stream.label },
  }),
});