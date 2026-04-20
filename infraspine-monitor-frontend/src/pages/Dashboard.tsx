import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { monitorApi } from '../api/monitor.api';
import type {
  HealthData,
  SummaryData,
  ProblemsData,
  HostsData,
  TopUsageData,
  TrendData,
  HostRecord,
} from '../types/monitor.types';
import Layout from '../components/Layout';
import SummaryCards from '../components/SummaryCards';
import TrendChart from '../components/TrendChart';
import TopUsageTable from '../components/TopUsageTable';
import ProblemsTable from '../components/ProblemsTable';
import HostDetailDrawer from '../components/HostDetailDrawer';

const REFRESH_INTERVAL_MS = 60_000;
type TrendRange = '1d' | '7d' | '30d';

interface State {
  loading: boolean;
  syncPending: boolean;
  health: HealthData | null;
  summary: SummaryData | null;
  problems: ProblemsData | null;
  hosts: HostsData | null;
  topCpu: TopUsageData | null;
  topMemory: TopUsageData | null;
  topDisk: TopUsageData | null;
  trend: TrendData | null;
  lastRefresh: Date | null;
}

const INITIAL_STATE: State = {
  loading: true,
  syncPending: false,
  health: null,
  summary: null,
  problems: null,
  hosts: null,
  topCpu: null,
  topMemory: null,
  topDisk: null,
  trend: null,
  lastRefresh: null,
};

export default function Dashboard() {
  const [state, setState] = useState<State>(INITIAL_STATE);
  const [trendRange, setTrendRange] = useState<TrendRange>('1d');
  const [trendLoading, setTrendLoading] = useState(false);
  const [selectedHost, setSelectedHost] = useState<HostRecord | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, syncPending: false }));
    try {
      const [health, summary, problems, hosts, topCpu, topMemory, topDisk, trend] =
        await Promise.allSettled([
          monitorApi.health(),
          monitorApi.summary(),
          monitorApi.problems(),
          monitorApi.hosts(),
          monitorApi.topCpu(),
          monitorApi.topMemory(),
          monitorApi.topDisk(),
          monitorApi.trend(trendRange),
        ]);

      setState({
        loading: false,
        syncPending: false,
        health: health.status === 'fulfilled' ? health.value : null,
        summary: summary.status === 'fulfilled' ? summary.value : null,
        problems: problems.status === 'fulfilled' ? problems.value : null,
        hosts: hosts.status === 'fulfilled' ? hosts.value : null,
        topCpu: topCpu.status === 'fulfilled' ? topCpu.value : null,
        topMemory: topMemory.status === 'fulfilled' ? topMemory.value : null,
        topDisk: topDisk.status === 'fulfilled' ? topDisk.value : null,
        trend: trend.status === 'fulfilled' ? trend.value : null,
        lastRefresh: new Date(),
      });
    } catch (err) {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [trendRange]);

  useEffect(() => {
    fetchAll();
    timerRef.current = setInterval(fetchAll, REFRESH_INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchAll]);

  const handleRangeChange = useCallback(async (newRange: TrendRange) => {
    if (newRange === trendRange) return;
    setTrendRange(newRange);
    setTrendLoading(true);
    try {
      const trend = await monitorApi.trend(newRange);
      setState((prev) => ({ ...prev, trend }));
    } finally { setTrendLoading(false); }
  }, [trendRange]);

  const zabbixUnreachable = state.health?.zabbixReachable === false;

  return (
    <Layout
      zabbixUnreachable={zabbixUnreachable}
      criticalCount={state.summary?.critical ?? 0}
      lastRefresh={state.lastRefresh}
    >
      <div className="bg-surface-0 min-h-screen -m-6 p-6">
        <div className="space-y-2 pb-6">
          <SummaryCards 
            data={state.summary} 
            loading={state.loading} 
            onFilterChange={() => {}} 
            activeFilter="all" 
          />

          <div className="flex flex-col gap-3 min-w-0">
            <div className="w-full min-w-0">
              <TrendChart
                data={state.trend}
                loading={state.loading || trendLoading}
                range={trendRange}
                onRangeChange={handleRangeChange}
              />
            </div>

            <div className="flex overflow-x-auto snap-x snap-mandatory custom-scrollbar md:grid md:grid-cols-3 gap-3 min-w-0 pb-1 md:pb-0 w-full">
              <div className="shrink-0 w-[85vw] sm:w-[300px] md:w-auto md:shrink snap-center h-full">
                <TopUsageTable title="Top CPU Usage" icon="CPU" data={state.topCpu} loading={state.loading} />
              </div>
              <div className="shrink-0 w-[85vw] sm:w-[300px] md:w-auto md:shrink snap-center h-full">
                <TopUsageTable title="Top Memory Usage" icon="RAM" data={state.topMemory} loading={state.loading} />
              </div>
              <div className="shrink-0 w-[85vw] sm:w-[300px] md:w-auto md:shrink snap-center h-full">
                <TopUsageTable title="Top Disk Usage" icon="DSK" data={state.topDisk} loading={state.loading} />
              </div>
            </div>
          </div>

          <ProblemsTable
            data={state.problems}
            loading={state.loading}
            title="Recent Problems"
            headerRight={<Link to="/problems" className="text-xs font-bold text-[var(--accent)] hover:underline">View All -&gt;</Link>}
          />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pb-10">
            {[
              { to: '/hosts', label: 'Host Inventory', sub: `${state.summary?.total ?? '--'} hosts`, color: '#6366f1' },
              { to: '/problems', label: 'Problems', sub: `${state.problems?.total ?? '--'} active`, color: '#ef4444' },
              { to: '/trend', label: 'Health Trend', sub: 'Historical charts', color: '#10b981' },
              { to: '/perf', label: 'Performance', sub: 'CPU | Memory | Disk', color: '#f59e0b' },
            ].map((item) => (
              <Link key={item.to} to={item.to} className="group">
                <div className="bg-surface-1/50 p-4 hover:shadow-card-hover transition-all border border-border/50 border-l-4 rounded-xl shadow-card" style={{ borderLeftColor: item.color }}>
                  <div className="text-xs font-bold text-text-primary mb-1 group-hover:text-[var(--accent)]">{item.label}</div>
                  <div className="text-[10px] text-text-tertiary uppercase font-semibold">{item.sub}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {selectedHost && (
        <HostDetailDrawer
          host={selectedHost}
          onClose={() => setSelectedHost(null)}
        />
      )}
    </Layout>
  );
}
