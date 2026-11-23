import { useEffect, useMemo, useState } from 'react';
import {
  DashboardState,
  SourceType,
  bitable,
  dashboard,
  type IData,
  type IDataCondition,
  type IDataRange,
} from '@lark-base-open/js-sdk';
import { ConfigPanel } from './components/ConfigPanel';
import { Heatmap } from './components/Heatmap';
import { buildCondition, conditionToConfig, toHeatmapModel } from './lib/heatmap';
import { mockMatrix } from './lib/demo';
import type { HeatmapConfig, TableOption, FieldOption } from './types';

const EMPTY_CONFIG: HeatmapConfig = {
  tableId: '',
  rowFieldId: '',
  columnFieldId: '',
  dataRange: JSON.stringify({ type: SourceType.ALL }),
};

function stateName() {
  try {
    return dashboard.state;
  } catch {
    return undefined;
  }
}

export function App() {
  const currentState = stateName();
  const isEmbedded = window.parent !== window;
  const isDemoConfig =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get('preview') === 'config';
  const isHosted =
    isEmbedded &&
    Object.values(DashboardState).includes(currentState as DashboardState);
  const isConfigState =
    isDemoConfig ||
    currentState === DashboardState.Create ||
    currentState === DashboardState.Config;
  const [tables, setTables] = useState<TableOption[]>([]);
  const [fields, setFields] = useState<FieldOption[]>([]);
  const [dataRanges, setDataRanges] = useState<Array<{ value: string; label: string }>>([]);
  const [config, setConfig] = useState<HeatmapConfig>({ ...EMPTY_CONFIG });
  const [renderData, setRenderData] = useState<IData>(isHosted ? [] : mockMatrix);
  const [loading, setLoading] = useState(isConfigState);
  const [hostReady, setHostReady] = useState(false);
  const model = useMemo(() => toHeatmapModel(renderData), [renderData]);

  async function loadTableOptions() {
    const tableList = await bitable.base.getTableList();
    const options = await Promise.all(
      tableList.map(async (table) => ({
        tableId: table.id,
        tableName: await table.getName(),
      })),
    );
    setTables(options);
    return options;
  }

  async function loadFieldOptions(tableId: string) {
    const categories = await dashboard.getCategories(tableId);
    const options = categories.map((field) => ({
      fieldId: field.fieldId,
      fieldName: field.fieldName,
    }));
    setFields(options);
    return options;
  }

  async function loadRanges(tableId: string) {
    const ranges: IDataRange[] = await dashboard.getTableDataRange(tableId);
    const options = ranges.map((range) => ({
      value: JSON.stringify(range),
      label: range.type === SourceType.ALL ? '全部数据' : range.viewName,
    }));
    setDataRanges(options);
    return options;
  }

  function defaultFields(
    options: FieldOption[],
  ): Pick<HeatmapConfig, 'rowFieldId' | 'columnFieldId'> {
    const row = options.find((field) => field.fieldName === '模型') ?? options[0];
    const column =
      options.find((field) => field.fieldName === '账号') ??
      options.find((field) => field.fieldId !== row?.fieldId) ??
      row;
    return {
      rowFieldId: row?.fieldId ?? '',
      columnFieldId: column?.fieldId ?? '',
    };
  }

  async function resolveConfig(nextConfig: HeatmapConfig): Promise<HeatmapConfig> {
    const tableOptions = tables.length ? tables : await loadTableOptions();
    let tableId = nextConfig.tableId;
    if (!tableId) {
      tableId =
        tableOptions.find((table) => table.tableName === '异常明细')?.tableId ??
        tableOptions[0]?.tableId ??
        '';
    }

    const rangeOptions = dataRanges.length ? dataRanges : await loadRanges(tableId);
    const range = rangeOptions[0]?.value ?? JSON.stringify({ type: SourceType.ALL });
    const fieldOptions = fields.length ? fields : await loadFieldOptions(tableId);
    const defaults = defaultFields(fieldOptions);

    return {
      tableId,
      dataRange: nextConfig.dataRange || range,
      rowFieldId: nextConfig.rowFieldId || defaults.rowFieldId,
      columnFieldId: nextConfig.columnFieldId || defaults.columnFieldId,
    };
  }

  async function preview(nextConfig: HeatmapConfig) {
    setLoading(true);
    try {
      setRenderData(await dashboard.getPreviewData(buildCondition(nextConfig)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isConfigState) return;
    let disposed = false;

    async function init() {
      if (isDemoConfig) {
        const demoFields: FieldOption[] = [
          { fieldId: 'model', fieldName: '模型' },
          { fieldId: 'account', fieldName: '账号' },
          { fieldId: 'status', fieldName: '状态码' },
        ];
        const demoConfig: HeatmapConfig = {
          tableId: 'tbl-events-demo',
          dataRange: JSON.stringify({ type: SourceType.ALL }),
          rowFieldId: 'model',
          columnFieldId: 'account',
        };
        setTables([{ tableId: 'tbl-events-demo', tableName: '异常明细' }]);
        setFields(demoFields);
        setDataRanges([
          {
            value: JSON.stringify({ type: SourceType.ALL }),
            label: '全部数据',
          },
        ]);
        setConfig(demoConfig);
        setRenderData(mockMatrix);
        setHostReady(true);
        setLoading(false);
        return;
      }

      const configResult =
        currentState === DashboardState.Config
          ? await dashboard.getConfig()
          : { dataConditions: [] };
      if (disposed) return;
      const hostCondition: IDataCondition | undefined = configResult.dataConditions?.[0];
      const resolved = await resolveConfig(
        hostCondition ? conditionToConfig(hostCondition, EMPTY_CONFIG) : EMPTY_CONFIG,
      );
      if (disposed) return;
      setConfig(resolved);
      setHostReady(true);
      setRenderData(await dashboard.getPreviewData(buildCondition(resolved)));
      if (!disposed) setLoading(false);
    }

    init().finally(() => {
      if (!disposed && !isDemoConfig) dashboard.setRendered();
    });
    return () => {
      disposed = true;
    };
  }, [isConfigState, isDemoConfig]);

  useEffect(() => {
    if (isConfigState || !isHosted) return;
    let disposed = false;

    async function load() {
      const data = await dashboard.getData();
      if (disposed) return;
      setRenderData(data);
      await dashboard.setRendered();
    }

    load();
    const off = dashboard.onDataChange(({ data }) => setRenderData(data));
    return () => {
      disposed = true;
      off();
    };
  }, [isConfigState, isHosted]);

  async function changeConfig(patch: Partial<HeatmapConfig>) {
    let next = { ...config, ...patch };
    if (patch.tableId !== undefined) {
      const rangeOptions = await loadRanges(patch.tableId);
      const fieldOptions = await loadFieldOptions(patch.tableId);
      const defaults = defaultFields(fieldOptions);
      next = {
        ...next,
        dataRange: rangeOptions[0]?.value ?? JSON.stringify({ type: SourceType.ALL }),
        ...defaults,
      };
    }
    setConfig(next);
    await preview(next);
  }

  async function saveConfig() {
    setLoading(true);
    try {
      await dashboard.saveConfig({
        dataConditions: [buildCondition(config)],
        customConfig: {
          rows: config.rowFieldId,
          columns: config.columnFieldId,
        },
      });
    } finally {
      setLoading(false);
    }
  }

  if (isConfigState) {
    return (
      <main className="plugin-shell plugin-shell--config">
        <Heatmap model={model} title="模型 × 账号异常热力" />
        {hostReady ? (
          <ConfigPanel
            tables={tables}
            fields={fields}
            dataRanges={dataRanges}
            config={config}
            loading={loading}
            onChange={changeConfig}
            onSave={saveConfig}
          />
        ) : null}
      </main>
    );
  }

  return (
    <main className="plugin-shell">
      <Heatmap model={model} title="模型 × 账号异常热力" />
    </main>
  );
}
