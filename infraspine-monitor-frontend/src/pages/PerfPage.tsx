import { useEffect, useRef, useState, useCallback } from 'react';
import { monitorApi } from '../api/monitor.api';
import type { HealthData, SummaryData, HostsData, TopUsageData, ProxiesData } from '../types/monitor.types';
import Layout from '../components/Layout';
import TopUsageTable from '../components/TopUsageTable';
import MetricHistogram from '../components/MetricHistogram';
import ProxyStatusPanel from '../components/ProxyStatusPanel';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { KpiCard, icons } from '../components/SummaryCards';

const REFRESH_INTERVAL_MS = 60_000;

function bpsToStr(bps: number): string {
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(1)} Gbps`;
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mbps`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} Kbps`;
  return `${bps} bps`;
}

export default function PerfPage() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [hosts, setHosts] = useState<HostsData | null>(null);
  const [topCpu, setTopCpu] = useState<TopUsageData | null>(null);
  const [topMemory, setTopMemory] = useState<TopUsageData | null>(null);
  const [topDisk, setTopDisk] = useState<TopUsageData | null>(null);
  const [proxies, setProxies] = useState<ProxiesData | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [h, s, ho, tc, tm, td, pr] = await Promise.allSettled([
        monitorApi.health(),
        monitorApi.summary(),
        monitorApi.hosts(),
        monitorApi.topCpu(),
        monitorApi.topMemory(),
        monitorApi.topDisk(),
        monitorApi.proxies(),
      ]);
      setHealth(h.status === 'fulfilled' ? h.value : null);
      setSummary(s.status === 'fulfilled' ? s.value : null);
      setHosts(ho.status === 'fulfilled' ? ho.value : null);
      setTopCpu(tc.status === 'fulfilled' ? tc.value : null);
      setTopMemory(tm.status === 'fulfilled' ? tm.value : null);
      setTopDisk(td.status === 'fulfilled' ? td.value : null);
      setProxies(pr.status === 'fulfilled' ? pr.value : null);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    timerRef.current = setInterval(fetchAll, REFRESH_INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchAll]);

  const allHosts = hosts?.hosts ?? [];

  const tooltipStyle = {
    background: theme === 'dark' ? '#1e293b' : '#fff',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    fontSize: 12,
  };

  const topNetwork = allHosts
    .filter((h) => h.networkInterfaces && h.networkInterfaces.length > 0)
    .map((h) => {
      const totalBps = (h.networkInterfaces ?? []).reduce(
        (a, iface) => a + (iface.inBps ?? 0) + (iface.outBps ?? 0), 0
      );
      return { hostName: h.displayName || h.hostName, totalBps };
    })
    .filter((h) => h.totalBps > 0)
    .sort((a, b) => b.totalBps - a.totalBps)
    .slice(0, 5);

  const hostsWithCpu = allHosts.filter((h) => h.cpuUtil !== undefined);
  const hostsWithMem = allHosts.filter((h) => h.memUtil !== undefined);
  const avgCpu = hostsWithCpu.length > 0
    ? Math.round(hostsWithCpu.reduce((a, h) => a + (h.cpuUtil ?? 0), 0) / hostsWithCpu.length * 10) / 10
    : null;
  const avgMem = hostsWithMem.length > 0
    ? Math.round(hostsWithMem.reduce((a, h) => a + (h.memUtil ?? 0), 0) / hostsWithMem.length * 10) / 10
    : null;
  const highCpuCount = allHosts.filter((h) => (h.cpuUtil ?? 0) >= 80).length;
  const highMemCount = allHosts.filter((h) => (h.memUtil ?? 0) >= 80).length;

  return (
    <Layout
      zabbixUnreachable={health?.zabbixReachable === false}
      criticalCount={summary?.critical ?? 0}
      lastRefresh={lastRefresh}
    >
      <div className="bg-surface-0 min-h-screen -m-6 p-6">
        <div className="flex flex-col space-y-2 pb-6">
          
          {/* ── Performance Stats Row ── */}
          <section className="flex overflow-x-auto snap-x snap-mandatory custom-scrollbar sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 pb-1 sm:pb-0 w-full">
            <KpiCard label="Avg CPU" stringValue={avgCpu !== null ? `${avgCpu}%` : '—'} accentColor="#0ea5e9" icon={icons.cpu} loading={loading} />
            <KpiCard label="Avg Memory" stringValue={avgMem !== null ? `${avgMem}%` : '—'} accentColor="#6366f1" icon={icons.server} loading={loading} />
            <KpiCard label="CPU ≥ 80%" value={highCpuCount} accentColor="#f59e0b" icon={icons.alertCircle} pulse={highCpuCount > 0} loading={loading} />
            <KpiCard label="Memory ≥ 80%" value={highMemCount} accentColor="#f43f5e" icon={icons.alertTriangle} pulse={highMemCount > 0} loading={loading} />
          </section>

          {/* ── Top N Tables ── */}
          <div className="flex overflow-x-auto snap-x snap-mandatory custom-scrollbar lg:grid lg:grid-cols-3 gap-3 pb-1 lg:pb-0 w-full">
            <div className="shrink-0 w-[85vw] sm:w-[300px] lg:w-auto lg:shrink snap-center h-full">
              <TopUsageTable title="Top CPU Usage" icon="🖥️" data={topCpu} loading={loading} />
            </div>
            <div className="shrink-0 w-[85vw] sm:w-[300px] lg:w-auto lg:shrink snap-center h-full">
              <TopUsageTable title="Top Memory Usage" icon="💾" data={topMemory} loading={loading} />
            </div>
            <div className="shrink-0 w-[85vw] sm:w-[300px] lg:w-auto lg:shrink snap-center h-full">
              <TopUsageTable title="Top Disk Usage" icon="🖴" data={topDisk} loading={loading} />
            </div>
          </div>

          {/* ── Distribution Histograms ── */}
          <div className="flex overflow-x-auto snap-x snap-mandatory custom-scrollbar lg:grid lg:grid-cols-2 gap-3 pb-1 lg:pb-0 w-full">
            <div className="panel-card p-3 shrink-0 w-[90vw] sm:w-[400px] lg:w-auto lg:shrink snap-center h-full">
              <div className="text-sm font-bold text-text-primary mb-4">CPU Distribution</div>
              {loading ? (
                <div className="h-[200px] bg-surface-2/30 animate-pulse rounded-lg" />
              ) : (
                <MetricHistogram values={allHosts.map((h) => h.cpuUtil).filter((v): v is number => v !== undefined)} color="#0ea5e9" label="CPU %" />
              )}
            </div>

            <div className="panel-card p-3 shrink-0 w-[90vw] sm:w-[400px] lg:w-auto lg:shrink snap-center h-full">
              <div className="text-sm font-bold text-text-primary mb-4">Memory Distribution</div>
              {loading ? (
                <div className="h-[200px] bg-surface-2/30 animate-pulse rounded-lg" />
              ) : (
                <MetricHistogram values={allHosts.map((h) => h.memUtil).filter((v): v is number => v !== undefined)} color="#6366f1" label="Memory %" />
              )}
            </div>
          </div>

          {/* ── Network & Disk Row ── */}
          <div className="flex overflow-x-auto snap-x snap-mandatory custom-scrollbar lg:grid lg:grid-cols-2 gap-3 pb-1 lg:pb-0 w-full">
            {/* ── Network Top 5 ── */}
            {(!loading && topNetwork.length > 0) ? (
              <div className="panel-card p-3 shrink-0 w-[90vw] sm:w-[500px] lg:w-auto lg:shrink snap-center h-full">
                <div className="text-sm font-bold text-text-primary mb-4">Top Network Traffic (in + out)</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topNetwork} layout="vertical" margin={{ left: 0, right: 30, top: 10, bottom: 10 }}>
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => bpsToStr(v)} />
                    <YAxis type="category" dataKey="hostName" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} width={130} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [bpsToStr(v), 'Bandwidth']} />
                    <Bar dataKey="totalBps" name="Bandwidth" radius={[0, 4, 4, 0]} fill="#06b6d4">
                      {topNetwork.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? '#0891b2' : '#06b6d4'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="panel-card p-3 shrink-0 w-[90vw] sm:w-[500px] lg:w-auto lg:shrink snap-center h-full flex flex-col">
                 <div className="text-sm font-bold text-text-primary mb-4">Top Network Traffic (in + out)</div>
                 <div className="flex-1 flex items-center justify-center text-text-tertiary text-xs">No Data</div>
              </div>
            )}

            {/* ── Disk Distribution ── */}
            <div className="panel-card p-3 shrink-0 w-[90vw] sm:w-[400px] lg:w-auto lg:shrink snap-center h-full flex flex-col">
              <div className="text-sm font-bold text-text-primary mb-4">Disk Usage Distribution</div>
              <div className="flex-1 min-h-[200px]">
                {loading ? (
                  <div className="h-full bg-surface-2/30 animate-pulse rounded-lg" />
                ) : (
                  <MetricHistogram values={allHosts.map((h) => h.diskUsedPct).filter((v): v is number => v !== undefined)} color="#10b981" label="Disk %" />
                )}
              </div>
            </div>
          </div>

          {/* ── Proxy Status ── */}
          {!loading && proxies && proxies.total > 0 && (
            <div className="panel-card p-3 mb-10">
              <div className="text-sm font-bold text-text-primary mb-4">Proxy Status ({proxies.total})</div>
              <ProxyStatusPanel proxies={proxies.proxies} />
            </div>
          )}

        </div>
      </div>
    </Layout>
  );
}