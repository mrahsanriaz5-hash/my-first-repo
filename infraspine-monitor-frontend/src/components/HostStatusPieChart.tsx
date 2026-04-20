import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTheme } from '../context/ThemeContext';

interface Props {
  online: number;
  offline: number;
  unknown: number;
}

// Fixed Colors to match your previous screenshot exactly
const COLORS: Record<string, string> = {
  Online:  '#10b981',   // Emerald Green
  Offline: '#ef4444',   // Rose Red
  Unknown: '#9ca3af',   // Muted Grey
};

export default function HostStatusPieChart({ online, offline, unknown }: Props) {
  const { theme } = useTheme();

  const data = [
    { name: 'Online',  value: online  },
    { name: 'Offline', value: offline },
    { name: 'Unknown', value: unknown },
  ].filter((d) => d.value > 0);

  const total = online + offline + unknown;

  const tooltipStyle = {
    background: theme === 'dark' ? '#1e293b' : '#fff',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    fontSize: 12,
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  };

  if (total === 0) {
    return (
      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
        No host data available
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '220px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%" // Thora upar shift kiya taake legend ki jagah banay
            innerRadius={60}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={COLORS[entry.name]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number, name: string) => [`${v} (${((v / total) * 100).toFixed(1)}%)`, name]}
          />
          <Legend
            verticalAlign="bottom"
            align="center"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ paddingTop: '10px' }}
            formatter={(value) => (
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Center Label Fix: Exactly centered in the Donut hole */}
      <div style={{
        position: 'absolute', 
        top: '45%', 
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center', 
        pointerEvents: 'none',
      }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>{total}</div>
        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 800, marginTop: 2, letterSpacing: '0.05em' }}>TOTAL</div>
      </div>
    </div>
  );
}