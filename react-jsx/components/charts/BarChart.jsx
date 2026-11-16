import { niceMax, shortLabel } from './helpers';

export function BarChart({
  data = [],
  xKey = 'label',
  series = [{ key: 'value', label: 'Value', color: '#0d9488' }],
  height = 220,
  formatValue = (value) => String(value ?? 0),
  emptyLabel = 'No data for this period',
}) {
  const width = 640;
  const pad = { top: 18, right: 12, bottom: 34, left: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  if (!data.length) {
    return (
      <div className="empty-state" style={{ padding: '34px 12px' }}>
        <b>{emptyLabel}</b>
        <p>Charts are generated only from persisted telemetry.</p>
      </div>
    );
  }

  const max = niceMax(
    Math.max(
      ...data.flatMap((row) => series.map((item) => Number(row[item.key]) || 0)),
      1,
    ),
  );
  const groupWidth = innerW / data.length;
  const barSpace = Math.min(26, groupWidth * 0.64);
  const barWidth = Math.max(3, barSpace / series.length);
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Bar chart">
        {ticks.map((tick) => {
          const y = pad.top + innerH - tick * innerH;
          return (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#eef2f7" strokeWidth="1" />
              <text x={pad.left - 8} y={y + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
                {formatValue(max * tick)}
              </text>
            </g>
          );
        })}
        {data.map((row, index) => {
          const groupX = pad.left + index * groupWidth + groupWidth / 2;
          return (
            <g key={row[xKey] ?? index}>
              {series.map((item, seriesIndex) => {
                const value = Number(row[item.key]) || 0;
                const barHeight = Math.max(value > 0 ? 2 : 0, (value / max) * innerH);
                const x = groupX - (barWidth * series.length) / 2 + seriesIndex * barWidth;
                const y = pad.top + innerH - barHeight;
                return (
                  <rect
                    key={item.key}
                    x={x + 1}
                    y={y}
                    width={Math.max(2, barWidth - 2)}
                    height={barHeight}
                    rx={Math.min(4, barWidth / 3)}
                    fill={item.color}
                    opacity={0.92}
                  >
                    <title>{`${shortLabel(row[xKey])} · ${item.label}: ${formatValue(value)}`}</title>
                  </rect>
                );
              })}
              {data.length <= 14 || index % Math.ceil(data.length / 10) === 0 ? (
                <text x={groupX} y={height - 12} textAnchor="middle" fontSize="9" fill="#94a3b8">
                  {shortLabel(row[xKey])}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="chart-legend">
        {series.map((item) => (
          <span key={item.key}>
            <i style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
