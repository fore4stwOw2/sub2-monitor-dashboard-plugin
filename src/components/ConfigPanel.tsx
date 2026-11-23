import type { FormEvent } from 'react';
import type { HeatmapConfig, TableOption, FieldOption } from '../types';

interface ConfigPanelProps {
  tables: TableOption[];
  fields: FieldOption[];
  numberFields: FieldOption[];
  dataRanges: Array<{ value: string; label: string }>;
  config: HeatmapConfig;
  loading: boolean;
  onChange: (patch: Partial<HeatmapConfig>) => void;
  onSave: () => void;
}

export function ConfigPanel({
  tables,
  fields,
  numberFields,
  dataRanges,
  config,
  loading,
  onChange,
  onSave,
}: ConfigPanelProps) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave();
  }

  return (
    <aside className="config-panel">
      <h2>配置</h2>
      <form onSubmit={submit}>
        <label>
          <span>数据表</span>
          <select
            value={config.tableId}
            onChange={(event) => onChange({ tableId: event.target.value })}
          >
            {tables.map((table) => (
              <option key={table.tableId} value={table.tableId}>
                {table.tableName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>数据范围</span>
          <select
            value={config.dataRange}
            onChange={(event) => onChange({ dataRange: event.target.value })}
          >
            {dataRanges.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>纵向分组</span>
          <select
            value={config.rowFieldId}
            onChange={(event) => onChange({ rowFieldId: event.target.value })}
          >
            {fields.map((field) => (
              <option key={field.fieldId} value={field.fieldId}>
                {field.fieldName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>横向分组</span>
          <select
            value={config.columnFieldId}
            onChange={(event) => onChange({ columnFieldId: event.target.value })}
          >
            {fields.map((field) => (
              <option key={field.fieldId} value={field.fieldId}>
                {field.fieldName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>数值字段</span>
          <select
            value={config.metricFieldId ?? ''}
            onChange={(event) =>
              onChange({
                metricFieldId: event.target.value || undefined,
              })
            }
          >
            <option value="">按记录数</option>
            {numberFields.map((field) => (
              <option key={field.fieldId} value={field.fieldId}>
                {field.fieldName}（求和）
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={loading}>
          {loading ? '正在更新' : '保存配置'}
        </button>
      </form>
    </aside>
  );
}
