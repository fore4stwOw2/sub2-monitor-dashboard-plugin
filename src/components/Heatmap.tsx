import { useEffect, useId, useMemo, useRef } from 'react';
import type { EChartsCoreOption } from 'echarts/core';
import * as echarts from 'echarts/core';
import { HeatmapChart } from 'echarts/charts';
import {
  AriaComponent,
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { HeatmapModel } from '../types';

echarts.use([
  HeatmapChart,
  AriaComponent,
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

interface HeatmapProps {
  model: HeatmapModel;
  title: string;
}

const numberFormat = new Intl.NumberFormat('zh-CN');
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] ?? character,
  );

export function Heatmap({ model, title }: HeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const summaryId = useId();

  const summary = useMemo(() => {
    if (!model.rows.length || !model.columns.length) {
      return `${title}：暂无数据。`;
    }
    const top = model.values.reduce(
      (best, current) => (current[2] > best[2] ? current : best),
      model.values[0] ?? [0, 0, 0],
    );
    const row = model.rows[top[1]];
    const column = model.columns[top[0]];
    return `${title}：显示 ${model.rows.length} 个纵向分组、${model.columns.length} 个横向分组，最高数值为 ${numberFormat.format(
      top[2],
    )}，位于 ${row} / ${column}。`;
  }, [model, title]);

  const topPairs = useMemo(
    () =>
      model.values
        .filter(([, , count]) => count > 0)
        .sort((a, b) => b[2] - a[2])
        .slice(0, 8)
        .map(([x, y, count]) => ({
          model: model.rows[y],
          account: model.columns[x],
          count,
        })),
    [model],
  );

  const matrixValue = (x: number, y: number) =>
    model.values.find(([cellX, cellY]) => cellX === x && cellY === y)?.[2] ?? 0;

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !model.rows.length || !model.columns.length) return;

    const chart = echarts.init(element, undefined, { renderer: 'canvas' });
    const max = Math.max(model.maxValue, 1);
    const option: EChartsCoreOption = {
      animationDuration: 280,
      animationDurationUpdate: 180,
      aria: {
        enabled: true,
        description: summary,
      },
      grid: {
        left: 132,
        right: 64,
        top: 20,
        bottom: 72,
      },
      tooltip: {
        confine: true,
        formatter: (params: unknown) => {
          const value = (params as { value: [number, number, number] }).value;
          const [x, y, count] = value;
          return `${escapeHtml(model.rows[y])}<br>${escapeHtml(model.columns[x])}<br><b>${numberFormat.format(count)}</b>`;
        },
      },
      xAxis: {
        type: 'category',
        data: model.columns,
        axisLabel: {
          interval: 0,
          rotate: 35,
          width: 108,
          overflow: 'truncate',
          color: '#566274',
          fontSize: 11,
        },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#dfe4ea' } },
        splitArea: { show: false },
      },
      yAxis: {
        type: 'category',
        data: model.rows,
        inverse: true,
        axisLabel: {
          width: 120,
          overflow: 'truncate',
          color: '#344054',
          fontSize: 11,
        },
        axisTick: { show: false },
        axisLine: { show: false },
        splitArea: { show: false },
      },
      visualMap: {
        min: 0,
        max,
        calculable: false,
        orient: 'vertical',
        right: 6,
        top: 'middle',
        itemWidth: 10,
        itemHeight: 112,
        text: ['高', '低'],
        textStyle: { color: '#667085', fontSize: 10 },
        inRange: {
          color: ['#edf7f4', '#91cbbf', '#2c8577', '#0f4c45'],
        },
      },
      series: [
        {
          name: title,
          type: 'heatmap',
          data: model.values,
          itemStyle: {
            borderColor: '#f8fafb',
            borderWidth: 2,
            borderRadius: 2,
          },
          emphasis: {
            itemStyle: {
              borderColor: '#d97706',
              borderWidth: 2,
              shadowBlur: 8,
              shadowColor: 'rgba(180, 83, 9, 0.18)',
            },
          },
        },
      ],
    };

    chart.setOption(option);

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(element);

    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [model, summary, title]);

  return (
    <figure className="heatmap" aria-labelledby={summaryId}>
      <div className="heatmap__heading">
        <div>
          <h2>{title}</h2>
          <p id={summaryId} className="heatmap__summary">
            {summary}
          </p>
        </div>
        <div className="heatmap__facts" aria-label="矩阵统计">
          <span>{numberFormat.format(model.total)}</span>
          <small>矩阵合计</small>
        </div>
      </div>
      {model.rows.length && model.columns.length ? (
        <>
          <div ref={containerRef} className="heatmap__canvas" aria-hidden="true" />
          <ol className="heatmap__mobile" aria-label="高频异常组合">
            {topPairs.map((pair) => (
              <li key={`${pair.model}|${pair.account}`}>
                <div className="heatmap__mobile-main">
                  <strong>{pair.model}</strong>
                  <span>{pair.account}</span>
                </div>
                <b>{numberFormat.format(pair.count)}</b>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <div className="heatmap__empty">当前无数据</div>
      )}
      <figcaption className="heatmap__note">
        {model.truncated ? '按异常总量保留前 10 个纵向分组与前 10 个横向分组。' : null}
      </figcaption>
      <div className="visually-hidden">
        <table aria-label={`${title}数据表`}>
          <caption>{title}数据表</caption>
          <thead>
            <tr>
              <th scope="col">纵向分组</th>
              {model.columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row, y) => (
              <tr key={row}>
                <th scope="row">{row}</th>
                {model.columns.map((column, x) => (
                  <td key={`${row}|${column}`}>
                    {numberFormat.format(matrixValue(x, y))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
