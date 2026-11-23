import type { FieldType, IData, IDataCondition } from '@lark-base-open/js-sdk';

export interface FieldOption {
  fieldId: string;
  fieldName: string;
  fieldType: FieldType;
}

export interface TableOption {
  tableId: string;
  tableName: string;
}

export interface HeatmapConfig {
  tableId: string;
  rowFieldId: string;
  columnFieldId: string;
  dataRange: string;
  /** undefined means “not configured yet”; null means explicitly use record count. */
  metricFieldId?: string | null;
}

export interface HeatmapModel {
  columns: string[];
  rows: string[];
  values: Array<[number, number, number]>;
  maxValue: number;
  total: number;
  truncated: boolean;
}

export interface ConfigContext {
  tables: TableOption[];
  fields: FieldOption[];
  dataRanges: Array<{ value: string; label: string }>;
  condition: IDataCondition | null;
}

export type MatrixData = IData;
