interface Props {
  page: number;         // 1-based current page
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export default function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: Props) {
  if (totalPages <= 1 && !onPageSizeChange) return null;

  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, totalItems);

  // Build page window: always show first, last, current ±2
  const pages: (number | '…')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    const left  = Math.max(2, page - 1);
    const right = Math.min(totalPages - 1, page + 1);
    pages.push(1);
    if (left > 2)          pages.push('…');
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push('…');
    pages.push(totalPages);
  }

  const btnBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 30, height: 28, padding: '0 6px',
    borderRadius: 6, border: '1px solid var(--border)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    background: 'var(--surface-1)', color: 'var(--text-secondary)',
    transition: 'background 0.15s, color 0.15s',
  };

  const btnActive: React.CSSProperties = {
    ...btnBase,
    background: 'var(--accent)',
    color: '#fff',
    borderColor: 'var(--accent)',
  };

  const btnDisabled: React.CSSProperties = {
    ...btnBase,
    opacity: 0.35,
    cursor: 'not-allowed',
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 8,
      padding: '10px 18px',
      borderTop: '1px solid var(--border)',
      background: 'var(--surface-1)',
    }}>
      {/* Left: showing X–Y of Z */}
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
        {totalItems === 0 ? 'No results' : `Showing ${from}–${to} of ${totalItems}`}
      </span>

      {/* Center: page buttons */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {/* Prev */}
          <button
            style={page === 1 ? btnDisabled : btnBase}
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            ‹
          </button>

          {pages.map((p, i) =>
            p === '…' ? (
              <span key={`ellipsis-${i}`} style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '0 4px' }}>…</span>
            ) : (
              <button
                key={p}
                style={p === page ? btnActive : btnBase}
                onClick={() => onPageChange(p as number)}
                onMouseEnter={(e) => { if (p !== page) (e.currentTarget.style.background = 'var(--surface-2)'); }}
                onMouseLeave={(e) => { if (p !== page) (e.currentTarget.style.background = 'var(--surface-1)'); }}
              >
                {p}
              </button>
            )
          )}

          {/* Next */}
          <button
            style={page === totalPages ? btnDisabled : btnBase}
            disabled={page === totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      )}

      {/* Right: page size selector */}
      {onPageSizeChange && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Per page</span>
          <select
            value={pageSize}
            onChange={(e) => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
            style={{
              fontSize: 11, fontWeight: 600,
              background: 'var(--surface-2)', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', borderRadius: 6,
              padding: '3px 8px', cursor: 'pointer', outline: 'none',
            }}
          >
            {pageSizeOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
