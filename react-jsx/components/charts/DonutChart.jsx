export function DonutChart({ segments = [], centerLabel = 'Total', centerValue, size = 146 }) {
  const total = segments.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label={`${centerLabel} breakdown`}>
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#eef2f7" strokeWidth="15" />
        {total > 0
          ? segments.map((item) => {
              const value = Number(item.value) || 0;
              const length = (value / total) * circumference;
              const dash = `${Math.max(0, length - 2)} ${Math.max(0, circumference - length + 2)}`;
              const element = (
                <circle
                  key={item.label}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="15"
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  strokeLinecap="round"
                  transform="rotate(-90 70 70)"
                >
                  <title>{`${item.label}: ${value}`}</title>
                </circle>
              );
              offset += length;
              return element;
            })
          : null}
        <text className="donut-center" x="70" y="68" textAnchor="middle" fontSize="24">
          {centerValue ?? total}
        </text>
        <text className="donut-label" x="70" y="84" textAnchor="middle">
          {centerLabel}
        </text>
      </svg>
      <div className="donut-legend">
        {segments.map((item) => (
          <div className="donut-legend-row" key={item.label}>
            <i style={{ background: item.color }} />
            <span>{item.label}</span>
            <b>{Number(item.value) || 0}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
