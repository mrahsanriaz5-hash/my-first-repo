import { useState } from 'react';
import type { EventRecord } from '../types/monitor.types';
import { SEVERITY_BADGE } from '../types/monitor.types';
import Pagination from './Pagination';

const DEFAULT_PAGE_SIZE = 10;

interface Props {
  events: EventRecord[];
  loading: boolean;
}

export default function EventsTable({ events, loading }: Props) {
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  if (loading) {
    return (
      <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ height: 36, background: 'var(--surface-2)', borderRadius: 6, animation: 'pulse 1.5s ease infinite', opacity: 1 - i * 0.15 }} />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
        No events in the last 24 hours
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(events.length / pageSize));
  const paginated  = events.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="panel-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="bg-surface-2/50 dark:bg-surface-2/20 border-b border-border/50">
              {['Host', 'Severity', 'Event', 'Time', 'Ack'].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-bold text-text-tertiary uppercase tracking-widest whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {paginated.map((e) => (
              <tr key={e.eventId} className="hover:bg-surface-2/30 transition-colors group">
                <td className="px-5 py-3 font-semibold text-text-primary whitespace-nowrap">
                  {e.hostName}
                </td>
                <td className="px-5 py-3">
                  <span className={`severity-badge ${SEVERITY_BADGE[e.severity] ?? 'severity-0'} text-[10px]`}>
                    {e.severityLabel}
                  </span>
                </td>
                <td className="px-5 py-3 text-text-secondary max-w-[340px] truncate">
                  {e.name}
                </td>
                <td className="px-5 py-3 text-text-tertiary whitespace-nowrap tabular-nums">
                  {new Date(e.clock * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-5 py-3">
                  {e.acknowledged ? (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-500">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Ack
                    </span>
                  ) : (
                    <span className="text-[10px] text-text-tertiary">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={events.length}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
      />
    </div>
  );
}
