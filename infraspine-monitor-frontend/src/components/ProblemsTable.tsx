import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { ProblemRecord, ProblemsData } from '../types/monitor.types';
import { SEVERITY_BADGE } from '../types/monitor.types';
import Pagination from './Pagination';

function formatClock(unix: number): string {
  return new Date(unix * 1000).toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SeverityBadge({ severity, label }: { severity: number; label: string }) {
  const cls = SEVERITY_BADGE[severity] ?? 'severity-badge-default';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide uppercase ${cls}`}>
      {label}
    </span>
  );
}

function severityAccent(severity: number): string {
  if (severity >= 4) return 'var(--color-critical)';
  if (severity >= 2) return 'var(--color-warning-accent, var(--color-warning))';
  return 'var(--text-tertiary)';
}

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <tr key={i}>
          {[180, 80, 260, 120, 70].map((w, j) => (
            <td key={j} className="py-3 px-4">
              <div
                className="h-3.5 rounded animate-pulse"
                style={{ width: w, background: 'var(--surface-3)' }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

const DEFAULT_PAGE_SIZE = 10;

interface Props {
  data: ProblemsData | null;
  loading: boolean;
  showAck?: boolean;
  title?: string;
  headerRight?: ReactNode;
  showHeader?: boolean;
}

export default function ProblemsTable({
  data,
  loading,
  showAck = false,
  title = 'Latest Problems',
  headerRight,
  showHeader = true,
}: Props) {
  const problems: ProblemRecord[] = data?.problems ?? [];

  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => { setPage(1); }, [showAck]);

  const totalPages = Math.max(1, Math.ceil(problems.length / pageSize));
  const paginated  = problems.slice((page - 1) * pageSize, page * pageSize);

  return (
    <section className="panel-card overflow-hidden">
      {showHeader && (
        /* Header */
        <div className="px-5 py-4 flex items-center justify-between border-b border-border/50">
          <h2 className="panel-heading flex items-center gap-2">
            <span>⚠️</span> {title}
          </h2>
          <div className="flex items-center gap-4">
            {data && (
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {`${data.total} active problem${data.total !== 1 ? 's' : ''}`}
              </span>
            )}
            {headerRight}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="problems-table w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider bg-surface-2/30 text-text-tertiary">
              <th className="px-5 py-3 font-semibold text-[11px]">Host</th>
              <th className="px-5 py-3 font-semibold text-[11px]">Severity</th>
              <th className="px-5 py-3 font-semibold text-[11px]">Problem</th>
              <th className="px-5 py-3 font-semibold text-[11px]">Time</th>
              <th className="px-5 py-3 font-semibold text-[11px]">Status</th>
              {showAck && <th className="px-5 py-3 font-medium">Ack</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {loading ? (
              <SkeletonRows />
            ) : problems.length === 0 ? (
              <tr>
                <td colSpan={showAck ? 6 : 5} className="py-12 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  ✅ No active problems detected.
                </td>
              </tr>
            ) : (
              paginated.map((p) => (
                <tr
                  key={p.eventId}
                  className={[
                    p.severity >= 4 ? 'problem-row-critical' : p.severity >= 2 ? 'problem-row-warning' : '',
                    'transition-shadow duration-150',
                    'hover:shadow-card-hover',
                  ].join(' ')}
                  style={{ opacity: p.acknowledged ? 0.7 : 1 }}
                >
                  <td className="py-3 px-5 font-mono font-bold text-[12px] max-w-[180px] truncate text-text-primary">
                    {p.hostName}
                  </td>
                  <td className="py-3 px-5">
                    <SeverityBadge severity={p.severity} label={p.severityLabel} />
                  </td>
                  <td className="py-3 px-5 max-w-[320px] text-text-secondary">
                    {p.description}
                  </td>
                  <td className="py-3 px-5 whitespace-nowrap text-[11px] text-text-tertiary font-mono tabular-nums">
                    {formatClock(p.clock)}
                  </td>
                  <td className="py-3 px-5">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: severityAccent(p.severity) }}>
                      <span
                        className="w-1.5 h-1.5 rounded-full animate-pulse inline-block dot-glow"
                        style={{ backgroundColor: severityAccent(p.severity), color: severityAccent(p.severity) }}
                      />
                      Active
                    </span>
                  </td>
                  {showAck && (
                    <td className="py-3 px-5">
                      {p.acknowledged ? (
                        <span className="inline-flex items-center gap-3 text-[11px] font-bold text-[var(--color-online)]">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          {p.acknowledgedBy ?? 'Yes'}
                        </span>
                      ) : (
                        <span className="text-[11px] text-text-tertiary">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && problems.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={problems.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      )}
    </section>
  );
}
