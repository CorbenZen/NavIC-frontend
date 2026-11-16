import { Search } from 'lucide-react';
import { cx } from '../common/cx';

export function SearchInput({ value, onChange, placeholder = 'Search…', ariaLabel, className, inputRef, autoComplete }) {
  return (
    <div className={cx('search-input-wrapper', className)}>
      <Search className="search-input-icon" aria-hidden="true" focusable="false" />
      <input
        ref={inputRef}
        className="input"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder.replace(/…$/, '')}
        autoComplete={autoComplete}
      />
    </div>
  );
}
