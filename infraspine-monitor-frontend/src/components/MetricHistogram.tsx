import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useTheme } from '../context/ThemeContext';

interface Props {
  values: number[];
  color: string;
  label: string;
}

const BUCKETS = [
  { range: '0–20%',   min: 0,  max: 20  },
  { range: '20–40%',  min: 20, max: 40  },
  { range: '40–60%',  min: 40, max: 60  },
  { range: '60–80%',  min: 60, max: 80  },
  { range: '80–100%', min: 80, max: 100 },
];

const HIGH_COLOR = 'var(--color-critical)';
const WARN_COLOR = 'var(--color-warning)';

export default function MetricHistogram({ values, color, label }: Props) {
  const { theme } = useTheme();

  const data = BUCKETS.map((b) => ({
    range: b.range,
    count: values.filter((v) => v >= b.min && v < b.max).length,
    isHigh: b.min >= 80,
    isWarn: b.min >= 60 && b.min < 80,
  }));
  // include exactly 100 in last bucket
  if (data[4]) {
    data[4].count = values.filter((v) => v >= 80 && v <= 100).length;
  }

  const tooltipStyle = {
    background: theme === 'dark' ? '#1e293b' : '#fff',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    fontSize: 12,
  };

  if (values.length === 0) {
    return (
      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
        No {label} data available
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{values.length} hosts</span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          avg: {(values.reduce((a, v) => a + v, 0) / values.length).toFixed(1)}%
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          max: {Math.max(...values).toFixed(1)}%
        </span>
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
          <XAxis dataKey="range" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: 'rgba(99,102,241,0.06)' }}
            formatter={(v: number) => [v, 'Hosts']}
          />
          <Bar dataKey="count" name="Hosts" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.isHigh ? HIGH_COLOR : entry.isWarn ? WARN_COLOR : color}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
