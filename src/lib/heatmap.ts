import type { IData, IDataCondition, IDataRange } from '@lark-base-open/js-sdk';
import {
  DATA_SOURCE_SORT_TYPE,
  GroupMode,
  ORDER,
  Rollup,
  SourceType,
} from '@lark-base-open/js-sdk';
import type { HeatmapConfig, HeatmapModel } from '../types';

export const TOP_N = 10;

function cellLabel(cell: IData[number][number] | undefined): string {
  if (!cell) return '';
  return String(cell.text ?? cell.value ?? '').trim();
}

function cellNumber(cell: IData[number][number] | undefined): number {
  const value = Number(cell?.value ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function normalizeLabel(label: string): string {
  const match = label.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s][0-2]\d:[0-5]\d(?::[0-5]\d)?(?:\S+)?)?$/,
  );
  if (!match) return label;
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

export function toHeatmapModel(data: IData, topN = TOP_N): HeatmapModel {
  const header = data[0] ?? [];
  const body = data.slice(1);
  const allColumns = header.slice(1).map((cell) => normalizeLabel(cellLabel(cell)));
  const rowLabels = body.map((row) => normalizeLabel(cellLabel(row[0])));
  const aggregated = new Map<string, number>();

  body.forEach((row, rowIndex) => {
    const rowName = rowLabels[rowIndex];
    row.slice(1).forEach((cell, columnIndex) => {
      const columnName = allColumns[columnIndex];
      const key = `${rowName}\u0000${columnName}`;
      aggregated.set(key, (aggregated.get(key) ?? 0) + cellNumber(cell));
    });
  });

  const uniqueRows = [...new Set(rowLabels.filter(Boolean))];
  const uniqueColumns = [...new Set(allColumns.filter(Boolean))];
  const rowTotals = uniqueRows.map((name) => ({
    name,
    total: uniqueColumns.reduce(
      (sum, column) => sum + (aggregated.get(`${name}\u0000${column}`) ?? 0),
      0,
    ),
  }));
  const columnTotals = uniqueColumns.map((name) => ({
    name,
    total: uniqueRows.reduce(
      (sum, row) => sum + (aggregated.get(`${row}\u0000${name}`) ?? 0),
      0,
    ),
  }));

  const rowsAreDates = uniqueRows.every((name) => /^\d{4}-\d{2}-\d{2}$/.test(name));
  const columnsAreDates = uniqueColumns.every((name) =>
    /^\d{4}-\d{2}-\d{2}$/.test(name),
  );
  const keptRows = rowTotals
    .filter((item) => item.name)
    .sort((a, b) =>
      rowsAreDates ? a.name.localeCompare(b.name) : b.total - a.total,
    )
    .slice(0, topN);
  const keptColumns = columnTotals
    .filter((item) => item.name)
    .sort((a, b) =>
      columnsAreDates ? a.name.localeCompare(b.name) : b.total - a.total,
    )
    .slice(0, topN);

  const values: Array<[number, number, number]> = [];
  let maxValue = 0;
  let total = 0;

  keptRows.forEach((row, y) => {
    keptColumns.forEach((column, x) => {
      const value = aggregated.get(`${row.name}\u0000${column.name}`) ?? 0;
      values.push([x, y, value]);
      maxValue = Math.max(maxValue, value);
      total += value;
    });
  });

  return {
    columns: keptColumns.map((item) => item.name),
    rows: keptRows.map((item) => item.name),
    values,
    maxValue,
    total,
    truncated:
      keptRows.length < uniqueRows.length ||
      keptColumns.length < uniqueColumns.length,
  };
}

export function parseDataRange(serialized: string): IDataRange {
  try {
    const parsed = JSON.parse(serialized) as IDataRange;
    if (parsed?.type) return parsed;
  } catch {
    // Invalid serialized values are replaced by ALL below.
  }
  return { type: SourceType.ALL };
}

export function buildCondition(config: HeatmapConfig): IDataCondition {
  return {
    tableId: config.tableId,
    dataRange: parseDataRange(config.dataRange),
    series: config.metricFieldId
      ? [{ fieldId: config.metricFieldId, rollup: Rollup.SUM }]
      : 'COUNTA',
    groups: [
      {
        fieldId: config.rowFieldId,
        mode: GroupMode.INTEGRATED,
        sort: { order: ORDER.DESCENDING, sortType: DATA_SOURCE_SORT_TYPE.VALUE },
      },
      {
        fieldId: config.columnFieldId,
        mode: GroupMode.INTEGRATED,
        sort: { order: ORDER.DESCENDING, sortType: DATA_SOURCE_SORT_TYPE.VALUE },
      },
    ],
  };
}

export function conditionToConfig(
  condition: IDataCondition,
  fallback: HeatmapConfig,
): HeatmapConfig {
  return {
    tableId: condition.tableId || fallback.tableId,
    rowFieldId: condition.groups?.[0]?.fieldId || fallback.rowFieldId,
    columnFieldId: condition.groups?.[1]?.fieldId || fallback.columnFieldId,
    dataRange: JSON.stringify(condition.dataRange ?? { type: SourceType.ALL }),
    metricFieldId: Array.isArray(condition.series)
      ? condition.series[0]?.fieldId
      : undefined,
  };
}
