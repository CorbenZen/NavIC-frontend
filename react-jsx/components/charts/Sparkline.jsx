export function Sparkline({ values = [], color = '#0d9488', height = 52 }) {
  const width = 180;
  const max = Math.max(1, ...values.map((value) => Number(value) || 0));
  const min = Math.min(0, ...values.map((value) => Number(value) || 0));
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = values.length <= 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((Number(value) || 0) - min) / span * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  if (!values.length) return <div className="small muted">No recent observations</div>;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height }} role="img" aria-label="Trend">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
