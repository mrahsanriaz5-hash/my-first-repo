import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { monitorApi } from '../api/monitor.api';
import type { HealthData, SummaryData, HostsData, HostRecord } from '../types/monitor.types';
import Layout from '../components/Layout';
import HostsTable from '../components/HostsTable';
import DiskStoragePanel from '../components/DiskStoragePanel';
import HostDetailDrawer from '../components/HostDetailDrawer';
import HostStatusPieChart from '../components/HostStatusPieChart';
import SummaryCards from '../components/SummaryCards';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

const REFRESH_INTERVAL_MS = 60_000;
const OS_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const CPU_THRESHOLD = 80;

export default function HostsPage() {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [hosts, setHosts] = useState<HostsData | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selectedHost, setSelectedHost] = useState<HostRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>(['all']);
  const [searchTerm, setSearchTerm] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- LOGIC: API Fetching ---
  const fetchAll = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [h, s, ho] = await Promise.allSettled([
        monitorApi.health(),
        monitorApi.summary(),
        monitorApi.hosts()
      ]);
      if (h.status === 'fulfilled') setHealth(h.value);
      if (s.status === 'fulfilled') setSummary(s.value);
      if (ho.status === 'fulfilled') setHosts(ho.value);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    timerRef.current = setInterval(() => fetchAll(true), REFRESH_INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchAll]);

  // --- LOGIC: Memoized Data ---
  const allHosts = useMemo(() => hosts?.hosts ?? [], [hosts]);
  
  const calculatedHighCpuCount = useMemo(() =>
    allHosts.filter(h => (h.cpuUtil ?? 0) >= CPU_THRESHOLD).length,
    [allHosts]);

  // --- LOGIC: Filtering ---
  const filteredHosts = useMemo(() => {
    return allHosts.filter((host: HostRecord) => {
      const searchLower = searchTerm.toLowerCase().trim();
      const matchesSearch = host.displayName?.toLowerCase().includes(searchLower) || 
                           host.inventory?.ip?.includes(searchTerm);
      
      if (!matchesSearch) return false;
      if (statusFilter.includes('all') || statusFilter.length === 0) return true;
      
      return statusFilter.some(filter => {
        if (filter === 'highcpu') return (host.cpuUtil ?? 0) >= CPU_THRESHOLD;
        const s = String(host.status);
        if (filter === 'online') return s === '1' || s.toLowerCase() === 'online';
        if (filter === 'offline') return s === '0' || s.toLowerCase() === 'offline';
        if (filter === 'warning') return host.hasWarning === true;
        if (filter === 'critical') return host.hasCritical === true;
        return false;
      });
    });
  }, [allHosts, statusFilter, searchTerm]);

  const osData = useMemo(() => {
    const map = new Map<string, number>();
    allHosts.forEach(h => {
      const os = h.inventory?.osName?.split(' ')[0] ?? 'Unknown';
      map.set(os, (map.get(os) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([os, count]) => ({ os, count }))
      .sort((a, b) => b.count - a.count);
  }, [allHosts]);

  return (
    <Layout
      zabbixUnreachable={health?.zabbixReachable === false}
      criticalCount={summary?.critical ?? 0}
      lastRefresh={lastRefresh}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      onRefresh={() => fetchAll(true)}
    > 
    <div className="bg-surface-0 min-h-screen -m-6 p-6">
      <div className="grid grid-cols-1 min-w-0 w-full space-y-4 pt-0 pb-6">


        {/* Summary Section */}
        <SummaryCards
          data={summary ? { ...summary, highCpuCount: calculatedHighCpuCount } : null}
          loading={loading}
        />

        {/* Device Inventory Table Section - FIXED SCROLL */}
        <div className="panel-card overflow-hidden min-w-0">

          <div className="w-full overflow-hidden">
            <HostsTable
              data={{ hosts: filteredHosts, total: hosts?.total ?? 0, lastSync: hosts?.lastSync ?? '' }}
              loading={loading}
              totalHosts={allHosts.length}
              onHostClick={setSelectedHost}
              statusFilter={statusFilter}
              onFilterChange={setStatusFilter}
              className="hosts-table"
            />
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 min-w-0">
          {/* Status Chart */}
          <div className="panel-card p-3 overflow-hidden min-h-[250px]">
            <h3 className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest opacity-90 mb-2">
              Status Distribution
            </h3>
            <div className="flex justify-center items-center h-[180px]">
              <HostStatusPieChart online={summary?.online ?? 0} offline={summary?.offline ?? 0} unknown={0} />
            </div>
          </div>

          {/* OS Chart */}
          <div className="panel-card p-3 overflow-hidden min-h-[250px]">
            <h3 className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest opacity-90 mb-2">
              OS Distribution
            </h3>
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={osData} layout="vertical" margin={{ left: -10, right: 20, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" strokeOpacity={0.5} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="os" type="category" tick={{ fontSize: 9, fill: '#6b7280' }} width={70} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: '#f9fafb' }}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '11px' }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                    {osData.map((_, i) => (
                      <Cell key={i} fill={OS_COLORS[i % OS_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Disk Storage Panel */}
        <div className="panel-card overflow-hidden min-w-0">
          <DiskStoragePanel hosts={filteredHosts} loading={loading} />
        </div>
      </div>
    </div>
      

      {selectedHost && <HostDetailDrawer host={selectedHost} onClose={() => setSelectedHost(null)} />}
    </Layout>
  );
}
