import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : page * pageSize + 1;
  const last = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="pagination">
      <span>
        Showing <b>{first}</b>–<b>{last}</b> of <b>{total}</b>
      </span>
      <div className="pages">
        {onPageSizeChange ? (
          <select className="input" style={{ width: 'auto', minHeight: 29, padding: '3px 7px' }} value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} aria-label="Rows per page">
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        ) : null}
        <button type="button" className="btn btn-sm" onClick={() => onPageChange(0)} disabled={page <= 0} aria-label="First page">
          First
        </button>
        <button type="button" className="btn btn-sm" onClick={() => onPageChange(page - 1)} disabled={page <= 0} aria-label="Previous page">
          <ChevronLeft />
        </button>
        <span>
          {page + 1} / {pages}
        </span>
        <button type="button" className="btn btn-sm" onClick={() => onPageChange(page + 1)} disabled={page >= pages - 1} aria-label="Next page">
          <ChevronRight />
        </button>
        <button type="button" className="btn btn-sm" onClick={() => onPageChange(pages - 1)} disabled={page >= pages - 1} aria-label="Last page">
          Last
        </button>
      </div>
    </div>
  );
}
