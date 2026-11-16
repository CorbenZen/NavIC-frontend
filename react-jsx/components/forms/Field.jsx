import { cx } from '../common/cx';

export function Field({ label, hint, children, className, htmlFor }) {
  return (
    <label className={cx('field', className)} htmlFor={htmlFor}>
      <span>{label}</span>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}
