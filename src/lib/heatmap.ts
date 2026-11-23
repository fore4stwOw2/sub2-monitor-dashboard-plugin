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

export function toHeatmapModel(data: IData, topN = TOP_N): HeatmapModel {
  const header = data[0] ?? [];
  const body = data.slice(1);
  const allColumns = header.slice(1).map(cellLabel);
  const allRows = body.map((row) => cellLabel(row[0]));

  const rowTotals = body.map((row, index) => ({
    index,
    name: allRows[index],
    total: row.slice(1).reduce((sum, cell) => sum + cellNumber(cell), 0),
  }));
  const columnTotals = allColumns.map((name, index) => ({
    index,
    name,
    total: body.reduce((sum, row) => sum + cellNumber(row[index + 1]), 0),
  }));

  const keptRows = rowTotals
    .filter((item) => item.name)
    .sort((a, b) => b.total - a.total)
    .slice(0, topN);
  const keptColumns = columnTotals
    .filter((item) => item.name)
    .sort((a, b) => b.total - a.total)
    .slice(0, topN);

  const values: Array<[number, number, number]> = [];
  let maxValue = 0;
  let total = 0;

  keptRows.forEach((row, y) => {
    keptColumns.forEach((column, x) => {
      const value = cellNumber(body[row.index]?.[column.index + 1]);
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
    truncated: keptRows.length < allRows.length || keptColumns.length < allColumns.length,
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
