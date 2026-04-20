import { useEffect, useRef, useState, useCallback } from 'react';
import { monitorApi } from '../api/monitor.api';
import type { HealthData, SummaryData, TrendData, TrendPoint } from '../types/monitor.types';
import Layout from '../components/Layout';
import TrendChart from '../components/TrendChart';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { useTheme } from '../context/ThemeContext';

type TrendRange = '1d' | '7d' | '30d';

const REFRESH_INTERVAL_MS = 60_000;

interface AvailPoint {
  time: string;
  availability: number;
  critical: number;
  warning: number;
}

function toAvailability(points: TrendPoint[]): AvailPoint[] {
  const sorted = [...points].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return sorted.map((p) => ({
    time: new Date(p.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    availability: p.totalHosts > 0 ? Math.round((p.online / p.totalHosts) * 1000) / 10 : 0,
    critical: p.critical,
    warning: p.warning,
  }));
}

export default function TrendPage() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(false);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [trend, setTrend] = useState<TrendData | null>(null);
  const [trendRange, setTrendRange] = useState<TrendRange>('7d');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [h, s, t] = await Promise.allSettled([
        monitorApi.health(),
        monitorApi.summary(),
        monitorApi.trend(trendRange),
      ]);
      setHealth(h.status === 'fulfilled' ? h.value : null);
      setSummary(s.status === 'fulfilled' ? s.value : null);
      setTrend(t.status === 'fulfilled' ? t.value : null);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
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
      const t = await monitorApi.trend(newRange);
      setTrend(t);
    } finally {
      setTrendLoading(false);
    }
  }, [trendRange]);

  const points = trend?.points ?? [];
  const availData = toAvailability(points);

  const tooltipStyle = {
    background: theme === 'dark' ? '#1e293b' : '#fff',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    fontSize: 12,
  };

  // Summary stats from trend data
  const avgAvail = availData.length > 0
    ? Math.round(availData.reduce((a, p) => a + p.availability, 0) / availData.length * 10) / 10
    : null;
  const maxCritical = points.length > 0 ? Math.max(...points.map((p) => p.critical)) : null;
  const minOnline = points.length > 0 ? Math.min(...points.map((p) => p.online)) : null;

  // Determine trend direction
  const trendDir = (() => {
    if (availData.length < 2) return 'stable';
    const last5 = availData.slice(-5);
    const avg = last5.reduce((a, p) => a + p.availability, 0) / last5.length;
    const all = availData.reduce((a, p) => a + p.availability, 0) / availData.length;
    if (avg > all + 2) return 'improving';
    if (avg < all - 2) return 'degrading';
    return 'stable';
  })();

  const dirColor = trendDir === 'improving' ? 'var(--color-online)' : trendDir === 'degrading' ? 'var(--color-critical)' : 'var(--text-tertiary)';
  const dirIcon = trendDir === 'improving' ? '↑' : trendDir === 'degrading' ? '↓' : '→';

  return (
    <Layout
      zabbixUnreachable={health?.zabbixReachable === false}
      criticalCount={summary?.critical ?? 0}
      lastRefresh={lastRefresh}
    >
      <div className="bg-surface-0 min-h-screen -m-6 p-6">
        <div className="flex flex-col space-y-2 pb-6">
      {/* ── Trend Stats Row ──────────────────────────────────────────────────── */}
      <div className="flex overflow-x-auto snap-x snap-mandatory custom-scrollbar sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 pb-1 sm:pb-0 w-full">
        {[
          { label: 'Avg Availability',   value: avgAvail !== null ? `${avgAvail}%` : '—',       color: 'var(--color-online)'   },
          { label: 'Max Critical Issues', value: maxCritical !== null ? maxCritical : '—',        color: 'var(--color-critical)' },
          { label: 'Min Online Hosts',    value: minOnline !== null ? minOnline : '—',             color: 'var(--color-warning)'  },
          { label: 'Trend Direction',     value: `${dirIcon} ${trendDir.charAt(0).toUpperCase() + trendDir.slice(1)}`, color: dirColor },
        ].map((s) => (
          <div key={s.label} className="panel-card p-3 shrink-0 min-w-[150px] sm:min-w-0 sm:w-auto sm:shrink snap-start h-full">
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
            <div className="text-[18px] font-extrabold whitespace-nowrap" style={{ color: s.color }}>{loading ? '—' : s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Main Trend Chart (existing) ──────────────────────────────────────── */}
      <TrendChart
        data={trend}
        loading={loading || trendLoading}
        range={trendRange}
        onRangeChange={handleRangeChange}
      />

      {/* ── Availability % Trend ─────────────────────────────────────────────── */}
      <div className="panel-card p-3">
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>
          Availability % Over Time
        </div>
        {loading || trendLoading ? (
          <div style={{ height: 220, background: 'var(--surface-2)', borderRadius: 8, animation: 'pulse 1.5s ease infinite' }} />
        ) : availData.length === 0 ? (
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
            No trend data available for this range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={availData} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="availGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-online)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--color-online)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false}
                interval={Math.max(0, Math.floor(availData.length / 8) - 1)} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false}
                width={36} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, 'Availability']} />
              <Area type="monotone" dataKey="availability" name="Availability" stroke="var(--color-online)"
                fill="url(#availGrad)" strokeWidth={2.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Critical + Warning Trend ─────────────────────────────────────────── */}
      <div className="panel-card p-3">
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>
          Issues Over Time
        </div>
        {loading || trendLoading ? (
          <div style={{ height: 200, background: 'var(--surface-2)', borderRadius: 8, animation: 'pulse 1.5s ease infinite' }} />
        ) : availData.length === 0 ? (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
            No data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={availData} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false}
                interval={Math.max(0, Math.floor(availData.length / 8) - 1)} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false}
                width={28} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend
                formatter={(value) => (
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>{value}</span>
                )}
              />
              <Line type="monotone" dataKey="critical" name="Critical" stroke="var(--color-critical)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="warning" name="Warning" stroke="var(--color-warning)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      </div>
      </div>
    </Layout>
  );
}
