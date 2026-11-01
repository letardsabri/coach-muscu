/**
 * Graphiques (Chart.js). Une seule série par graphique, couleur d'accent ; le titre de la carte
 * nomme la série, une éventuelle ligne de référence (objectif) est en pointillés gris.
 * Survol / toucher : info-bulle sur le point le plus proche.
 */
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Filler);

const ACCENT = '#ff5a1f';
const GRID = 'rgba(255,255,255,0.06)';
const TICK = '#6e6e73';
const REF = '#8e8e93';

function baseOptions(unit: string, decimals: number): ChartOptions<'line' | 'bar'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#2a2a2e',
        titleColor: '#f5f5f7',
        bodyColor: '#f5f5f7',
        borderColor: '#3a3a3f',
        borderWidth: 1,
        padding: 10,
        displayColors: false,
        callbacks: {
          label: (ctx) => {
            const v = ctx.parsed.y;
            if (v === null || v === undefined) return '';
            const name = ctx.dataset.label ? `${ctx.dataset.label} : ` : '';
            return `${name}${v.toLocaleString('fr-FR', { maximumFractionDigits: decimals })}${unit ? ` ${unit}` : ''}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: GRID },
        ticks: { color: TICK, maxRotation: 0, autoSkip: true, maxTicksLimit: 5, font: { size: 11 } },
      },
      y: {
        grid: { color: GRID },
        border: { display: false },
        ticks: { color: TICK, maxTicksLimit: 5, font: { size: 11 }, precision: decimals === 0 ? 0 : undefined },
      },
    },
  };
}

export function LineChart(props: {
  labels: string[];
  /** null = pas de donnée ce jour-là (la ligne relie les points voisins). */
  values: (number | null)[];
  unit?: string;
  decimals?: number;
  reference?: { value: number; label: string };
  height?: number;
  seriesLabel?: string;
}) {
  const datasets = [
    {
      label: props.seriesLabel ?? '',
      data: props.values,
      borderColor: ACCENT,
      backgroundColor: 'rgba(255,90,31,0.10)',
      borderWidth: 2,
      pointRadius: props.values.length > 40 ? 0 : 3,
      pointHoverRadius: 6,
      pointBackgroundColor: ACCENT,
      pointBorderColor: '#161618',
      pointBorderWidth: 2,
      tension: 0.25,
      fill: true,
      spanGaps: true,
    },
  ];
  if (props.reference) {
    datasets.push({
      label: props.reference.label,
      data: props.labels.map(() => props.reference!.value),
      borderColor: REF,
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 0,
      pointBackgroundColor: REF,
      pointBorderColor: REF,
      pointBorderWidth: 0,
      tension: 0,
      fill: false,
      spanGaps: true,
      borderDash: [5, 5],
    } as (typeof datasets)[number]);
  }
  return (
    <div style={{ height: props.height ?? 200 }}>
      <Line data={{ labels: props.labels, datasets }} options={baseOptions(props.unit ?? '', props.decimals ?? 1) as ChartOptions<'line'>} />
    </div>
  );
}

export function BarChart(props: { labels: string[]; values: number[]; unit?: string; height?: number; seriesLabel?: string }) {
  return (
    <div style={{ height: props.height ?? 200 }}>
      <Bar
        data={{
          labels: props.labels,
          datasets: [
            {
              label: props.seriesLabel ?? '',
              data: props.values,
              backgroundColor: ACCENT,
              borderRadius: 4,
              borderSkipped: 'bottom',
              maxBarThickness: 22,
            },
          ],
        }}
        options={baseOptions(props.unit ?? '', 1) as ChartOptions<'bar'>}
      />
    </div>
  );
}

export { Delta } from './Delta';
