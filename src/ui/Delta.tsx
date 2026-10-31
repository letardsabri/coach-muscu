/** Petit indicateur de tendance : « +12 % » vert, « −4 % » rouge. Séparé des graphiques pour ne pas charger Chart.js. */
export function Delta({ from, to, unit = '%' }: { from: number; to: number; unit?: '%' | 'abs' }) {
  if (!from) return null;
  const v = unit === '%' ? ((to - from) / from) * 100 : to - from;
  const sign = v > 0 ? '+' : v < 0 ? '−' : '±';
  const color = v > 0.05 ? 'var(--ok)' : v < -0.05 ? 'var(--danger)' : 'var(--text-2)';
  return (
    <span className="num" style={{ color, fontWeight: 700 }}>
      {sign}
      {Math.abs(v).toLocaleString('fr-FR', { maximumFractionDigits: unit === '%' ? 0 : 1 })}
      {unit === '%' ? ' %' : ''}
    </span>
  );
}
