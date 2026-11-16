import { useId } from 'react';

export function HorizontalBars({ items = [], formatValue = (value) => String(value ?? 0) }) {
  const max = Math.max(1, ...items.map((item) => Number(item.value) || 0));
  const gradientId = useId();
  return (
    <div className="stack" style={{ gap: 11 }}>
      {items.map((item) => {
        const value = Number(item.value) || 0;
        return (
          <div key={item.label}>
            <div className="row between" style={{ marginBottom: 5, fontSize: 11.5 }}>
              <span style={{ color: 'var(--ink-soft)' }}>{item.label}</span>
              <b style={{ color: 'var(--muted)' }}>{formatValue(value)}</b>
            </div>
            <div className="progress">
              <span
                style={{
                  width: `${Math.max(value > 0 ? 3 : 0, (value / max) * 100)}%`,
                  background: item.color || (gradientId ? 'var(--brand)' : undefined),
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
