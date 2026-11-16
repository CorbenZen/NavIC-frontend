import { cx } from '../common/cx';

export function StatCard({ label, value, hint, icon: Icon, tone = 'slate', suffix }) {
  return (
    <div className={cx('stat-card', `tone-${tone}`)}>
      {Icon ? (
        <div className="stat-icon">
          <Icon />
        </div>
      ) : null}
      <div className="stat-main">
        <div className="stat-label">{label}</div>
        <div className="stat-value">
          {value}
          {suffix ? <small>{suffix}</small> : null}
        </div>
        {hint ? <div className="stat-hint">{hint}</div> : null}
      </div>
    </div>
  );
}
