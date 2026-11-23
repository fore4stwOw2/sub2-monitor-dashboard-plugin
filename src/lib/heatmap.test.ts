import { describe, expect, it } from 'vitest';
import type { IData } from '@lark-base-open/js-sdk';
import { buildCondition, toHeatmapModel } from './heatmap';

const matrix: IData = [
  [
    { value: '模型 / 账号', text: '模型 / 账号' },
    { value: 'account-a', text: 'account-a' },
    { value: 'account-b', text: 'account-b' },
  ],
  [
    { value: 'model-a', text: 'model-a' },
    { value: 7, text: '7' },
    { value: 2, text: '2' },
  ],
  [
    { value: 'model-b', text: 'model-b' },
    { value: 1, text: '1' },
    { value: 0, text: '0' },
  ],
];

describe('toHeatmapModel', () => {
  it('keeps row and column labels with numeric cells', () => {
    const model = toHeatmapModel(matrix);
    expect(model.rows).toEqual(['model-a', 'model-b']);
    expect(model.columns).toEqual(['account-a', 'account-b']);
    expect(model.values).toEqual([
      [0, 0, 7],
      [1, 0, 2],
      [0, 1, 1],
      [1, 1, 0],
    ]);
    expect(model.maxValue).toBe(7);
    expect(model.total).toBe(10);
    expect(model.truncated).toBe(false);
  });

  it('limits both axes by descending totals', () => {
    const model = toHeatmapModel(matrix, 1);
    expect(model.rows).toEqual(['model-a']);
    expect(model.columns).toEqual(['account-a']);
    expect(model.truncated).toBe(true);
  });

  it('uses a numeric field sum when configured', () => {
    const condition = buildCondition({
      tableId: 'daily',
      rowFieldId: 'date',
      columnFieldId: 'status',
      dataRange: JSON.stringify({ type: 'ALL' }),
      metricFieldId: 'count',
    });
    expect(condition.series).toEqual([{ fieldId: 'count', rollup: 'SUM' }]);
  });

  it('aggregates timestamp labels into daily cells', () => {
    const dailyMatrix: IData = [
      [
        { value: '发生时间 / 状态码', text: '发生时间 / 状态码' },
        { value: '400', text: '400' },
        { value: '502', text: '502' },
      ],
      [
        { value: '2026-11-23T10:00:00+08:00', text: '2026-11-23T10:00:00+08:00' },
        { value: 2, text: '2' },
        { value: 0, text: '0' },
      ],
      [
        { value: '2026-11-23T14:00:00+08:00', text: '2026-11-23T14:00:00+08:00' },
        { value: 1, text: '1' },
        { value: 3, text: '3' },
      ],
    ];
    const model = toHeatmapModel(dailyMatrix);
    expect(model.rows).toEqual(['2026-11-23']);
    expect(model.values).toEqual([
      [0, 0, 3],
      [1, 0, 3],
    ]);
  });

  it('orders daily rows chronologically even when totals differ', () => {
    const chronological: IData = [
      [
        { value: 'date / status', text: 'date / status' },
        { value: '200', text: '200' },
      ],
      [
        { value: '2026-11-23', text: '2026-11-23' },
        { value: 100, text: '100' },
      ],
      [
        { value: '2026-11-22', text: '2026-11-22' },
        { value: 1, text: '1' },
      ],
    ];
    expect(toHeatmapModel(chronological).rows).toEqual([
      '2026-11-22',
      '2026-11-23',
    ]);
  });

  it('formats zoned timestamps in Asia/Taipei before grouping', () => {
    const zoned: IData = [
      [
        { value: 'date / status', text: 'date / status' },
        { value: '503', text: '503' },
      ],
      [
        { value: '2026-11-23T10:00:00+08:00', text: '2026-11-23T10:00:00+08:00' },
        { value: 1, text: '1' },
      ],
      [
        { value: '2026-11-23T23:30:00Z', text: '2026-11-23T23:30:00Z' },
        { value: 2, text: '2' },
      ],
    ];
    expect(toHeatmapModel(zoned).rows).toEqual([
      '2026-11-23',
      '2026-11-24',
    ]);
  });

  it('keeps the newest ten daily rows instead of the highest-volume dates', () => {
    const dailyRows: IData = [
      [
        { value: 'date / status', text: 'date / status' },
        { value: '503', text: '503' },
      ],
      ...Array.from({ length: 11 }, (_, index) => {
        const date = `2026-11-${String(index + 10).padStart(2, '0')}`;
        return [
          { value: date, text: date },
          { value: index === 0 ? 1000 : index, text: String(index) },
        ];
      }),
    ];
    const model = toHeatmapModel(dailyRows);
    expect(model.rows[0]).toBe('2026-11-11');
    expect(model.rows.at(-1)).toBe('2026-11-20');
    expect(model.rows).not.toContain('2026-11-10');
  });
});
