import { useState } from 'react';
import type { HostRecord, HostsData, HostStatus } from '../types/monitor.types';
import Pagination from './Pagination';
import { icons } from './SummaryCards';

const DEFAULT_PAGE_SIZE = 10;

// ── Metric Cell: Compact Stacked Design (Foolproof fixed alignment) ─────────
function MetricCell({ pct, color, label }: { pct: number; color: string, label: string }) {
  return (
    <div className="flex flex-col gap-1 w-full max-w-[120px]">
      <div className="flex justify-between items-center text-[10px] font-bold px-0.5">
        <span className="text-text-tertiary/60 uppercase tracking-wider">{label}</span>
        <span className="tabular-nums" style={{ color: pct >= 75 ? color : 'var(--text-secondary)' }}>
          {Math.round(pct)}%
        </span>
      </div>
      <div className="w-full rounded-full overflow-hidden bg-surface-2/80 shadow-inner" style={{ height: 5 }}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${Math.min(pct, 100)}%`, background: color, boxShadow: pct >= 75 ? `0 0 6px ${color}80` : 'none' }}
        />
      </div>
    </div>
  );
}

const metricColor = (pct: number) => pct >= 90 ? '#ef4444' : pct >= 75 ? '#f97316' : '#10b981';

// ── Status Pill ───────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: HostStatus }) {
  const isOnline = status === 'online';
  const color = isOnline ? '#10b981' : status === 'offline' ? '#f43f5e' : '#94a3b8';
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider border"
      style={{ borderColor: `${color}35`, background: `${color}12`, color }}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOnline ? 'animate-pulse' : ''}`}
        style={{ background: color, boxShadow: isOnline ? `0 0 5px ${color}` : 'none' }}
      />
      {status}
    </span>
  );
}

// ── Problem Badge ─────────────────────────────────────────────────────────────
function ProblemBadge({ count, hasCritical }: { count: number; hasCritical: boolean; hasWarning: boolean }) {
  if (count === 0) return <span className="text-text-tertiary/30 font-mono font-bold text-[12px] select-none text-left block w-full">—</span>;
  const color = hasCritical ? '#f43f5e' : '#f59e0b';
  return (
    <div className="flex justify-start w-full">
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider border whitespace-nowrap"
        style={{ borderColor: `${color}35`, background: `${color}12`, color }}
      >
        <span
          className="min-w-[16px] h-4 px-1 rounded text-[9px] text-white font-bold flex items-center justify-center tabular-nums"
          style={{ background: color }}
        >
          {count}
        </span>
        {hasCritical ? 'Critical' : 'Warning'}
      </span>
    </div>
  );
}

// ── Main Table ────────────────────────────────────────────────────────────────
interface Props {
  data: HostsData | null;
  loading: boolean;
  onHostClick?: (host: HostRecord) => void;
  statusFilter?: string[];
  onFilterChange?: (filter: string[] | ((prev: string[]) => string[])) => void;
  totalHosts?: number;
  className?: string;
}

type SortCol = 'name' | 'status' | 'cpu' | 'mem' | 'disk' | 'problems';

export default function HostsTable({ data, loading, onHostClick, statusFilter = ['all'], onFilterChange, totalHosts, className }: Props) {
  const [sortBy, setSortBy] = useState<SortCol>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const allHosts = data?.hosts ?? [];

  const sorted = [...allHosts].sort((a, b) => {
    let aVal: any, bVal: any;
    if (sortBy === 'name')     [aVal, bVal] = [a.displayName,       b.displayName];
    else if (sortBy === 'status')   [aVal, bVal] = [a.status,            b.status];
    else if (sortBy === 'problems') [aVal, bVal] = [a.problemCount,      b.problemCount];
    else if (sortBy === 'cpu')      [aVal, bVal] = [a.cpuUtil ?? -1,     b.cpuUtil ?? -1];
    else if (sortBy === 'mem')      [aVal, bVal] = [a.memUtil ?? -1,     b.memUtil ?? -1];
    else if (sortBy === 'disk')     [aVal, bVal] = [a.diskUsedPct ?? -1, b.diskUsedPct ?? -1];
    if (aVal === bVal) return 0;
    return (aVal > bVal ? 1 : -1) * (sortDir === 'asc' ? 1 : -1);
  });

  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));

  const handleSort = (col: SortCol) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const Th = ({ col, label, align = 'left', className = '' }: { col: SortCol; label: string; align?: 'left' | 'center' | 'right'; className?: string }) => (
    <th
      className={`px-3 py-3 border border-border/20 text-${align} text-[10px] font-extrabold uppercase tracking-widest text-text-tertiary cursor-pointer select-none hover:text-[var(--accent)] transition-colors group whitespace-nowrap ${className}`}
      onClick={() => handleSort(col)}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end w-full' : align === 'center' ? 'justify-center w-full' : ''}`}>
        {label}
        <span className={`transition-opacity text-[8px] ${sortBy === col ? 'opacity-100 text-[var(--accent)]' : 'opacity-0 group-hover:opacity-40'}`}>
          {sortBy === col && sortDir === 'desc' ? '▼' : '▲'}
        </span>
      </span>
    </th>
  );

  return (
    <section className={`panel-card flex flex-col overflow-hidden shadow-sm ${className || ''}`}>
      {/* ── Header ── */}
      <div className="px-5 py-3 border-b border-border/50 bg-surface-1/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-black text-text-primary tracking-tight">Host Inventory</h2>
            <div className="px-1.5 py-0.5 bg-surface-2/80 border border-border/40 rounded text-[9px] font-bold text-text-tertiary tabular-nums shadow-sm">
              {loading ? 'SYNC...' : `${sorted.length} / ${totalHosts ?? sorted.length} Nodes`}
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all',      label: 'All',      icon: icons.server },
              { id: 'online',   label: 'Online',   icon: icons.pulse },
              { id: 'offline',  label: 'Offline',  icon: icons.powerOff },
              { id: 'highcpu',  label: 'High CPU', icon: icons.cpu },
              { id: 'critical', label: 'Critical', icon: icons.alertTriangle },
              { id: 'warning',  label: 'Warning',  icon: icons.alertCircle },
            ].map((f) => {
              const isActive = statusFilter.includes(f.id);
              return (
                <button
                  key={f.id}
                  onClick={() => {
                    if (!onFilterChange) return;
                    onFilterChange(prev => {
                      if (f.id === 'all') return ['all'];
                      const next = prev.filter(id => id !== 'all');
                      if (isActive) {
                        const final = next.filter(id => id !== f.id);
                        return final.length === 0 ? ['all'] : final;
                      }
                      return [...next, f.id];
                    });
                  }}
                  className={`flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded-lg text-[10px] font-bold transition-all duration-200 border ${
                    isActive
                      ? 'bg-emerald-50/50 border-emerald-500/50 text-emerald-700 shadow-sm'
                      : 'bg-surface-1/60 border-border/50 text-text-tertiary hover:bg-surface-2 hover:border-border'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 border rounded flex items-center justify-center transition-all duration-200 ${
                    isActive ? 'bg-emerald-50 border-emerald-500' : 'border-border/80 bg-surface-1'
                  }`}>
                    {isActive && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span className="hidden sm:inline opacity-80 scale-90">{f.icon}</span>
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto w-full custom-scrollbar bg-surface-0">
        <table className="w-full min-w-[800px] border-collapse table-fixed border border-border/20">
          <thead>
            <tr className="bg-surface-1/50">
              <th className="border border-border/20 w-[50px] px-3 py-3 text-left text-[10px] font-extrabold uppercase tracking-widest text-text-tertiary">Sr#</th>
              <Th col="name" label="Host Name" className="text-left" align="left" />
              <Th col="status" label="Status" className="text-left" align="left" />
              <Th col="cpu" label="CPU" className="text-left" align="left" />
              <Th col="mem" label="Memory" className="text-left" align="left" />
              <Th col="disk" label="Disk" className="text-left" align="left" />
              <Th col="problems" label="Problems" className="text-left" align="left" />
            </tr>
          </thead>

          <tbody>
            {!loading && paginated.map((h, i) => (
              <tr
                key={h.hostId}
                className="border-b border-border/20 cursor-pointer group transition-colors duration-150 hover:bg-surface-2/40"
                onClick={() => onHostClick?.(h)}
              >
                {/* Sr# */}
                <td className="px-3 py-3.5 border border-border/20 text-left">
                  <span className="font-mono text-[10px] font-bold text-text-tertiary/40 tabular-nums">
                    {(page - 1) * pageSize + i + 1}
                  </span>
                </td>

                {/* Host Name */}
                <td className="px-3 py-3.5 border border-border/20">
                  <span className="font-mono font-bold text-[11px] text-text-primary group-hover:text-[var(--accent)] transition-colors truncate block">
                    {h.displayName}
                  </span>
                </td>

                {/* Status */}
                <td className="px-3 py-3.5 border border-border/20">
                  <StatusPill status={h.status} />
                </td>

                {/* CPU */}
                <td className="px-3 py-3.5 border border-border/20">
                  <MetricCell pct={h.cpuUtil ?? 0} color={metricColor(h.cpuUtil ?? 0)} label="CPU" />
                </td>

                {/* Memory */}
                <td className="px-3 py-3.5 border border-border/20">
                  <MetricCell pct={h.memUtil ?? 0} color={metricColor(h.memUtil ?? 0)} label="RAM" />
                </td>

                {/* Disk */}
                <td className="px-3 py-3.5 border border-border/20">
                  <MetricCell pct={h.diskUsedPct ?? 0} color={metricColor(h.diskUsedPct ?? 0)} label="DSK" />
                </td>

                {/* Problems */}
                <td className="px-3 py-3.5 border border-border/20 text-left">
                  <ProblemBadge count={h.problemCount} hasCritical={h.hasCritical} hasWarning={h.hasWarning} />
                </td>
              </tr>
            ))}

            {/* Skeleton */}
            {loading && Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-border/10 animate-pulse">
                <td className="px-3 py-3.5"><div className="h-2 w-4 mx-auto bg-surface-3 rounded-full opacity-30" /></td>
                <td className="px-3 py-3.5"><div className="h-2.5 w-32 bg-surface-3 rounded-full opacity-40" /></td>
                <td className="px-3 py-3.5"><div className="h-5 w-16 bg-surface-3 rounded-md opacity-30" /></td>
                <td className="px-3 py-3.5"><div className="h-5 w-24 bg-surface-3 rounded-md opacity-20" /></td>
                <td className="px-3 py-3.5"><div className="h-5 w-24 bg-surface-3 rounded-md opacity-20" /></td>
                <td className="px-3 py-3.5"><div className="h-5 w-24 bg-surface-3 rounded-md opacity-20" /></td>
                <td className="px-3 py-3.5"><div className="h-5 w-20 ml-auto bg-surface-3 rounded-md opacity-25" /></td>
              </tr>
            ))}

            {/* Empty state */}
            {!loading && paginated.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-text-tertiary text-[12px] font-bold uppercase tracking-widest">
                  No hosts match your search criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer ── */}
      {!loading && (
        <div className="px-5 py-3 border-t border-border/50 bg-surface-1/40 flex flex-col sm:flex-row items-center justify-between gap-3 mt-auto">
          <Pagination page={page} totalPages={totalPages} totalItems={sorted.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
          <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest px-2.5 py-1 rounded-md bg-surface-2/60 border border-border/60 shadow-sm">
            Last Sync: {data ? new Date(data.lastSync).toLocaleTimeString() : '--:--'}
          </span>
        </div>
      )}
    </section>
  );
}