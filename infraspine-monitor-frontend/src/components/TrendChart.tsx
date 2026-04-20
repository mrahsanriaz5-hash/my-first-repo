import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useTheme } from '../context/ThemeContext';
import type { TrendData, TrendPoint } from '../types/monitor.types';

type TrendRange = '1d' | '7d' | '30d';

interface ChartRow {
  time: string;
  online: number;
  critical: number;
  total: number;
}

function formatTime(iso: string, range: TrendRange): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  if (range === '1d') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: '2-digit' }) +
    ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function toChartRows(points: TrendPoint[], range: TrendRange): ChartRow[] {
  const sorted = [...points].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return sorted.map((p) => ({
    time: formatTime(p.createdAt, range),
    online: p.online,
    critical: p.critical,
    total: p.totalHosts,
  }));
}

const RANGE_OPTIONS: { value: TrendRange; label: string }[] = [
  { value: '1d', label: '1d' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
];

interface Props {
  data: TrendData | null;
  loading: boolean;
  range: TrendRange;
  onRangeChange: (r: TrendRange) => void;
}

export default function TrendChart({ data, loading, range, onRangeChange }: Props) {
  const { theme } = useTheme();
  const rows = data ? toChartRows(data.points, range) : [];

  const isDark = theme === 'dark';

  const tooltipStyle: React.CSSProperties = {
    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(8px)',
    border: `1px solid ${isDark ? 'rgba(51,65,85,0.8)' : 'rgba(226,232,240,0.8)'}`,
    borderRadius: '12px',
    color: isDark ? '#f8fafc' : '#0f172a',
    fontSize: '12px',
    fontWeight: 500,
    padding: '10px 14px',
    boxShadow: isDark ? '0 8px 32px 0 rgba(0, 0, 0, 0.3)' : '0 8px 32px 0 rgba(0, 0, 0, 0.05)',
  };

  const axisTickColor = '#64748b';
  const gridStroke = isDark ? 'rgba(51,65,85,0.3)' : 'rgba(226,232,240,0.6)';
  const legendColor = isDark ? '#cbd5e1' : '#475569';

  return (
    <section className="panel-card overflow-hidden p-6 animate-slide-up" style={{ animationDelay: '0.5s' }}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <h2 className="text-[13px] font-bold tracking-widest uppercase text-primary">
            Health Trend
          </h2>
        </div>

        {/* ── Time range pill selector ─── */}
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--surface-0)', border: '1px solid var(--border)' }}>
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onRangeChange(opt.value)}
              disabled={loading}
              className="range-pill-btn"
              data-active={range === opt.value ? 'true' : 'false'}
              style={{
                background: range === opt.value ? 'var(--accent)' : 'transparent',
                color: range === opt.value ? '#ffffff' : 'var(--text-tertiary)',
                fontWeight: range === opt.value ? 700 : 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading && range !== opt.value ? 0.5 : 1,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-[280px] rounded-xl animate-pulse bg-surface-0/50 border border-subtle border-dashed flex items-center justify-center">
          <div className="flex items-center gap-2 text-tertiary">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm font-medium">Loading trend data…</span>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="h-[280px] flex flex-col items-center justify-center bg-surface-0/30 rounded-xl border border-subtle border-dashed">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-tertiary mb-3">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span className="text-sm font-medium text-secondary">No trend data available yet.</span>
          <span className="text-xs text-tertiary mt-1">Check back later when stats are collected.</span>
        </div>
      ) : (
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={isDark ? 0.2 : 0.12} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fillOnline" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={isDark ? 0.3 : 0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fillCritical" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={isDark ? 0.3 : 0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fill: axisTickColor, fontSize: 11, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                tickMargin={12}
                minTickGap={range === '30d' ? 60 : 30}
              />
              <YAxis
                tick={{ fill: axisTickColor, fontSize: 11, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                tickMargin={12}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ stroke: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(15,23,42,0.05)', strokeWidth: 2 }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, color: legendColor, paddingTop: 20, fontWeight: 500 }}
                iconType="circle"
              />
              <Area
                type="monotone"
                dataKey="total"
                name="Total Hosts"
                stroke="#6366f1"
                strokeWidth={2}
                strokeDasharray="4 3"
                fill="url(#fillTotal)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: isDark ? '#0f172a' : '#ffffff', fill: '#6366f1' }}
              />
              <Area
                type="monotone"
                dataKey="online"
                name="Online Hosts"
                stroke="#10b981"
                strokeWidth={3}
                fill="url(#fillOnline)"
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: isDark ? '#0f172a' : '#ffffff', fill: '#10b981' }}
              />
              <Area
                type="monotone"
                dataKey="critical"
                name="Critical Issues"
                stroke="#ef4444"
                strokeWidth={3}
                fill="url(#fillCritical)"
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: isDark ? '#0f172a' : '#ffffff', fill: '#ef4444' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
