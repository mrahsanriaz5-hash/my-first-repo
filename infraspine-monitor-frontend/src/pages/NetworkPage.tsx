import { useEffect, useRef, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import { monitorApi } from '../api/monitor.api';
import type { HealthData, SummaryData, HostsData, HostRecord, HostStatus } from '../types/monitor.types';
import Layout from '../components/Layout';
import Pagination from '../components/Pagination';
import { useTheme } from '../context/ThemeContext';
import { KpiCard, icons } from '../components/SummaryCards';

const REFRESH_INTERVAL_MS = 60_000;
const DEFAULT_PAGE_SIZE = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBps(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec === 0) return '0 bps';
  const bps = bytesPerSec * 8;
  const k = 1000;
  const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps'];
  const i = Math.floor(Math.log(Math.max(bps, 1)) / Math.log(k));
  return (bps / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

function formatBpsShort(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec === 0) return '0';
  const bps = bytesPerSec * 8;
  const k = 1000;
  const sizes = ['', 'K', 'M', 'G'];
  const i = Math.floor(Math.log(Math.max(bps, 1)) / Math.log(k));
  return (bps / Math.pow(k, i)).toFixed(1) + sizes[i];
}

interface FlatInterface {
  hostId: string;
  hostName: string;
  hostStatus: HostStatus;
  interfaceName: string;
  status: 'up' | 'down' | 'unknown';
  inBps: number;
  outBps: number;
  totalBps: number;
  inErrors: number;
  outErrors: number;
  inDropped: number;
  outDropped: number;
}

function flattenInterfaces(hosts: HostRecord[]): FlatInterface[] {
  return hosts.flatMap((h) =>
    (h.networkInterfaces ?? []).map((iface) => ({
      hostId: h.hostId,
      hostName: h.displayName || h.hostName,
      hostStatus: h.status,
      interfaceName: iface.interfaceName,
      status: iface.status,
      inBps: iface.inBps ?? 0,
      outBps: iface.outBps ?? 0,
      totalBps: (iface.inBps ?? 0) + (iface.outBps ?? 0),
      inErrors: iface.inErrors ?? 0,
      outErrors: iface.outErrors ?? 0,
      inDropped: iface.inDropped ?? 0,
      outDropped: iface.outDropped ?? 0,
    }))
  );
}

function IfaceStatusBadge({ status }: { status: 'up' | 'down' | 'unknown' }) {
  const map = {
    up:      { bg: 'rgba(16,185,129,0.1)',  color: '#10b981',  label: 'Up'      },
    down:    { bg: 'rgba(244,63,94,0.1)',  color: '#f43f5e', label: 'Down'    },
    unknown: { bg: 'rgba(100,116,139,0.1)', color: '#64748b',  label: 'Unknown' },
  };
  const s = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider" 
          style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

type SortCol = 'host' | 'iface' | 'status' | 'in' | 'out' | 'total' | 'errors' | 'drops';

function SortIcon({ col, sortBy, sortDir }: { col: SortCol; sortBy: SortCol; sortDir: 'asc' | 'desc' }) {
  if (sortBy !== col) return <span className="opacity-30 ml-1">↕</span>;
  return <span className="ml-1 text-indigo-600">{sortDir === 'asc' ? '↑' : '↓'}</span>;
}

interface State {
  loading: boolean;
  health: HealthData | null;
  summary: SummaryData | null;
  hosts: HostsData | null;
}

export default function NetworkPage() {
  const { theme } = useTheme();
  const [state, setState] = useState<State>({ loading: true, health: null, summary: null, hosts: null });
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [search, setSearch]     = useState('');
  const [sortBy, setSortBy]     = useState<SortCol>('total');
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('desc');
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [statusFilter, setStatusFilter] = useState<'all' | 'up' | 'down' | 'unknown'>('all');

  const fetchData = useCallback(async () => {
    setState((s) => ({ ...s, loading: s.hosts === null }));
    const [healthRes, summaryRes, hostsRes] = await Promise.allSettled([
      monitorApi.health(),
      monitorApi.summary(),
      monitorApi.hosts(),
    ]);
    setState({
      loading: false,
      health:  healthRes.status  === 'fulfilled' ? healthRes.value  : null,
      summary: summaryRes.status === 'fulfilled' ? summaryRes.value : null,
      hosts:   hostsRes.status   === 'fulfilled' ? hostsRes.value   : null,
    });
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    fetchData();
    timerRef.current = setInterval(fetchData, REFRESH_INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchData]);

  useEffect(() => { setPage(1); }, [search, sortBy, sortDir, statusFilter]);

  const { loading, health, summary, hosts } = state;
  const allHosts = hosts?.hosts ?? [];
  const allIfaces = flattenInterfaces(allHosts);

  const totalIfaces    = allIfaces.length;
  const upCount        = allIfaces.filter((i) => i.status === 'up').length;
  const downCount      = allIfaces.filter((i) => i.status !== 'up').length;
  const totalBandwidth = allIfaces.reduce((s, i) => s + i.totalBps, 0);

  const topBandwidth = [...allIfaces]
    .sort((a, b) => b.totalBps - a.totalBps)
    .slice(0, 10)
    .map((i) => ({
      label: `${i.hostName} / ${i.interfaceName}`,
      inBps: i.inBps,
      outBps: i.outBps,
    }));

  const unknownCount = allIfaces.filter((i) => i.status === 'unknown').length;
  const pieData = [
    { name: 'Up',      value: upCount,      fill: '#10b981'   },
    { name: 'Down',    value: allIfaces.filter((i) => i.status === 'down').length, fill: '#f43f5e' },
    { name: 'Unknown', value: unknownCount, fill: '#64748b'  },
  ].filter((d) => d.value > 0);

  const filtered = allIfaces
    .filter((i) => statusFilter === 'all' || i.status === statusFilter)
    .filter((i) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return i.hostName.toLowerCase().includes(q) || i.interfaceName.toLowerCase().includes(q);
    });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'host':   cmp = a.hostName.localeCompare(b.hostName); break;
      case 'iface':  cmp = a.interfaceName.localeCompare(b.interfaceName); break;
      case 'status': cmp = a.status.localeCompare(b.status); break;
      case 'in':     cmp = a.inBps - b.inBps; break;
      case 'out':    cmp = a.outBps - b.outBps; break;
      case 'total':  cmp = a.totalBps - b.totalBps; break;
      case 'errors': cmp = (a.inErrors + a.outErrors) - (b.inErrors + b.outErrors); break;
      case 'drops':  cmp = (a.inDropped + a.outDropped) - (b.inDropped + b.outDropped); break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated  = sorted.slice((page - 1) * pageSize, page * pageSize);

  function toggleSort(col: SortCol) {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir('desc'); }
  }

  const tooltipStyle = {
    background: theme === 'dark' ? '#1e293b' : '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    fontSize: 12,
  };

  const statusOptions = [
    { value: 'all',     label: 'All',      count: allIfaces.length },
    { value: 'up',      label: 'Up',       count: upCount },
    { value: 'down',    label: 'Down',     count: allIfaces.filter((i) => i.status === 'down').length },
    { value: 'unknown', label: 'Unknown',  count: unknownCount },
  ];

  return (
    <Layout
      zabbixUnreachable={health?.zabbixReachable === false}
      criticalCount={summary?.critical ?? 0}
      lastRefresh={lastRefresh}
    >
      <div className="bg-surface-0 min-h-screen -m-6 p-6">
        <div className="flex flex-col space-y-2 pb-6">
          
          {/* ── KPI cards ── */}
          <section className="flex overflow-x-auto snap-x snap-mandatory custom-scrollbar sm:grid sm:grid-cols-2 md:grid-cols-4 gap-3 pb-1 sm:pb-0 w-full">
            <KpiCard label="Total Interfaces" value={totalIfaces} accentColor="#6366f1" icon={icons.server} loading={loading} />
            <KpiCard label="Up" value={upCount} accentColor="#10b981" icon={icons.pulse} loading={loading} />
            <KpiCard label="Down / Unknown" value={downCount} accentColor="#f43f5e" icon={icons.alertTriangle} pulse={downCount > 0} loading={loading} />
            <KpiCard label="Total Bandwidth" stringValue={formatBps(totalBandwidth)} accentColor="#14b8a6" icon={icons.cpu} loading={loading} />
          </section>

          {/* ── Charts row ── */}
          <div className="flex overflow-x-auto snap-x snap-mandatory custom-scrollbar lg:grid lg:grid-cols-3 gap-3 pb-1 lg:pb-0 w-full">
            {/* Top bandwidth chart (Span 2 columns) */}
            <div className="lg:col-span-2 panel-card p-3 shrink-0 w-[90vw] sm:w-[500px] lg:w-auto lg:shrink snap-center h-full">
              <div className="text-sm font-bold text-text-primary mb-6">Top Interfaces by Bandwidth</div>
              {loading ? (
                <div className="h-[250px] bg-slate-50 animate-pulse rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={topBandwidth} layout="vertical" margin={{ left: 0, right: 30, top: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatBpsShort(v)} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} width={150} tickFormatter={(v) => typeof v === 'string' && v.length > 20 ? v.substring(0, 17) + '...' : v} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [formatBps(v), name === 'inBps' ? '↓ In' : '↑ Out']} />
                    <Bar dataKey="inBps" stackId="bw" fill="#3b82f6" />
                    <Bar dataKey="outBps" stackId="bw" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div className="flex justify-center gap-6 mt-4">
                 <span className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase"><span className="w-3 h-3 rounded-sm bg-[#3b82f6]" /> Inbound</span>
                 <span className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase"><span className="w-3 h-3 rounded-sm bg-[#06b6d4]" /> Outbound</span>
              </div>
            </div>

            {/* Status donut */}
            <div className="panel-card p-3 flex flex-col shrink-0 w-[90vw] sm:w-[350px] lg:w-auto lg:shrink snap-center h-full">
              <div className="text-sm font-bold text-text-primary mb-6">Interface Status</div>
              <div className="flex-1 min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} dataKey="value" paddingAngle={5}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ── Interface table ── */}
          <section className="panel-card overflow-hidden mb-10">
            <div className="p-5 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-text-primary">All Network Interfaces</span>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                  {sorted.length} Interfaces
                </span>
              </div>
              
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search host or interface..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full md:w-64 pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
                <svg className="absolute left-3 top-2.5 text-slate-400" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
              </div>
            </div>

            <div className="px-5 pt-2 flex gap-1 border-b border-slate-50 overflow-x-auto no-scrollbar">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value as any)}
                  className={`px-4 py-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                    statusFilter === opt.value 
                    ? 'border-indigo-500 text-indigo-600 bg-indigo-50/30' 
                    : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {opt.label} <span className="ml-2 opacity-60">{opt.count}</span>
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    {['host', 'iface', 'status', 'in', 'out', 'total', 'errors', 'drops'].map((col) => (
                      <th 
                        key={col}
                        onClick={() => toggleSort(col as SortCol)}
                        className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center">
                          {col.replace('iface', 'interface')}
                          <SortIcon col={col as SortCol} sortBy={sortBy} sortDir={sortDir} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        {[...Array(8)].map((_, j) => (
                          <td key={j} className="p-5"><div className="h-3 bg-slate-100 rounded w-full" /></td>
                        ))}
                      </tr>
                    ))
                  ) : sorted.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-20 text-center text-slate-400 font-medium italic">No interfaces found matching your search</td>
                    </tr>
                  ) : (
                    paginated.map((iface, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-5 py-4 font-bold text-slate-700">{iface.hostName}</td>
                        <td className="px-5 py-4 font-mono text-[11px] text-indigo-600 font-semibold bg-indigo-50/20 max-w-[200px] truncate" title={iface.interfaceName}>{iface.interfaceName}</td>
                        <td className="px-5 py-4"><IfaceStatusBadge status={iface.status} /></td>
                        <td className="px-5 py-4 text-right text-slate-600 font-medium">{iface.inBps > 0 ? formatBps(iface.inBps) : '—'}</td>
                        <td className="px-5 py-4 text-right text-slate-600 font-medium">{iface.outBps > 0 ? formatBps(iface.outBps) : '—'}</td>
                        <td className="px-5 py-4 text-right font-bold text-slate-800">{iface.totalBps > 0 ? formatBps(iface.totalBps) : '—'}</td>
                        <td className={`px-5 py-4 text-right font-bold ${iface.inErrors + iface.outErrors > 0 ? 'text-rose-500' : 'text-slate-300'}`}>
                          {iface.inErrors + iface.outErrors || '—'}
                        </td>
                        <td className={`px-5 py-4 text-right font-bold ${iface.inDropped + iface.outDropped > 0 ? 'text-amber-500' : 'text-slate-300'}`}>
                          {iface.inDropped + iface.outDropped || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!loading && sorted.length > 0 && (
              <div className="p-5 border-t border-slate-50 bg-slate-50/30">
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  totalItems={sorted.length}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </Layout>
  );
}