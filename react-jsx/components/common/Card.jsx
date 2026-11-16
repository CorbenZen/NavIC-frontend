import { cx } from './cx';

export function Card({ actions, children, className, bodyClassName, flush = false, footer = null, style }) {
  return (
    <section className={cx('card', className)} style={style}>
      {actions ? (
        <div className="card-head">
          <div className="card-head-actions">{actions}</div>
        </div>
      ) : null}
      <div className={cx('card-body', flush && 'flush', bodyClassName)}>{children}</div>
      {footer ? <div className="card-foot">{footer}</div> : null}
    </section>
  );
}
