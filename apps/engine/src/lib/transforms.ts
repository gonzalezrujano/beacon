import type { StreamData, TimeseriesData, TableData } from '@beacon/contract';

export interface WidgetTransformConfig {
  // timeseries
  rangeMin?: number;
  rangeMax?: number;
  scaleFactor?: number;
  // table
  filterField?: string;
  filterCond?: 'gt' | 'lt' | 'eq' | 'contains';
  filterValue?: string;
  sortField?: string;
  sortDir?: 'asc' | 'desc';
}

function applyToTimeseries(data: TimeseriesData, tc: WidgetTransformConfig): TimeseriesData {
  let { points } = data;

  if (tc.rangeMin !== undefined || tc.rangeMax !== undefined) {
    points = points.filter(p =>
      (tc.rangeMin === undefined || p.v >= tc.rangeMin) &&
      (tc.rangeMax === undefined || p.v <= tc.rangeMax)
    );
  }

  if (tc.scaleFactor !== undefined && tc.scaleFactor !== 1 && tc.scaleFactor !== 0) {
    points = points.map(p => ({ ...p, v: p.v * tc.scaleFactor! }));
  }

  return points === data.points ? data : { ...data, points };
}

function applyToTable(data: TableData, tc: WidgetTransformConfig): TableData {
  let { rows } = data;

  if (tc.filterField && tc.filterValue !== undefined && tc.filterValue !== '') {
    const field = tc.filterField;
    const cond = tc.filterCond ?? 'contains';
    const val = tc.filterValue;
    rows = rows.filter(row => {
      const v = row[field];
      if (cond === 'gt') return typeof v === 'number' && v > Number(val);
      if (cond === 'lt') return typeof v === 'number' && v < Number(val);
      if (cond === 'eq') return String(v ?? '') === val;
      if (cond === 'contains') return String(v ?? '').toLowerCase().includes(val.toLowerCase());
      return true;
    });
  }

  if (tc.sortField) {
    const field = tc.sortField;
    const dir = tc.sortDir ?? 'asc';
    rows = [...rows].sort((a, b) => {
      const av = a[field] as string | number;
      const bv = b[field] as string | number;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return dir === 'asc' ? cmp : -cmp;
    });
  }

  return rows === data.rows ? data : { ...data, rows };
}

export function applyTransforms(data: StreamData, tc: WidgetTransformConfig): StreamData {
  if (data.kind === 'timeseries') return applyToTimeseries(data, tc);
  if (data.kind === 'table') return applyToTable(data, tc);
  return data;
}

export function hasTransforms(tc: WidgetTransformConfig | undefined): boolean {
  if (!tc) return false;
  return (
    tc.rangeMin !== undefined ||
    tc.rangeMax !== undefined ||
    (tc.scaleFactor !== undefined && tc.scaleFactor !== 1) ||
    (tc.filterField !== undefined && tc.filterValue !== undefined && tc.filterValue !== '') ||
    tc.sortField !== undefined
  );
}
