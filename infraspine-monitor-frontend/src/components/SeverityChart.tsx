import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { ProblemRecord } from '../types/monitor.types';
import { useTheme } from '../context/ThemeContext';

interface Props {
  problems: ProblemRecord[];
}

const SEV_LABELS: Record<number, string> = {
  0: 'N/C', 1: 'Info', 2: 'Warn', 3: 'Avg', 4: 'High', 5: 'Disaster',
};

const SEV_COLORS: Record<number, string> = {
  0: '#6b7280',
  1: '#3b82f6',
  2: '#f59e0b',
  3: '#f97316',
  4: '#ef4444',
  5: '#991b1b',
};

export default function SeverityChart({ problems }: Props) {
  const { theme } = useTheme();

  const data = [0, 1, 2, 3, 4, 5].map((sev) => ({
    name: SEV_LABELS[sev],
    count: problems.filter((p) => p.severity === sev).length,
    sev,
  }));

  const tooltipStyle = {
    background: theme === 'dark' ? '#1e293b' : '#fff',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    fontSize: 12,
  };

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: 'rgba(99,102,241,0.06)' }}
          formatter={(v: number) => [v, 'Hosts']}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.sev} fill={SEV_COLORS[entry.sev]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
