import { useEffect, useRef, useState } from 'react';
import type { TopHostRecord, TopUsageData } from '../types/monitor.types';

function parsePercent(value: string): number {
  const n = parseFloat(value);
  return isNaN(n) ? 0 : Math.min(100, Math.max(0, n));
}

function BarCell({ value, unit }: { value: string; unit: string }) {
  const pct = parsePercent(value);
  const [width, setWidth] = useState(0);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      const raf = requestAnimationFrame(() => setWidth(pct));
      mounted.current = true;
      return () => cancelAnimationFrame(raf);
    }
    setWidth(pct);
  }, [pct]);

  const barColor =
    pct >= 90
      ? 'var(--color-critical)'
      : pct >= 70
        ? 'var(--color-warning)'
        : 'var(--color-online)';

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full overflow-hidden bg-surface-3">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out shadow-sm"
          style={{ width: `${width}%`, background: barColor }}
        />
      </div>
      <span className="font-mono tabular-nums text-right text-xs font-bold w-16 text-primary">
        {parseFloat(value).toFixed(1)}{unit && unit !== '%' ? ` ${unit}` : '%'}
      </span>
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <tr key={i} className="border-t border-subtle">
          <td className="py-3.5 px-5">
            <div className="h-3.5 w-32 rounded animate-pulse bg-surface-3" />
          </td>
          <td className="py-3.5 px-5">
            <div className="h-3.5 w-24 rounded animate-pulse bg-surface-3" />
          </td>
        </tr>
      ))}
    </>
  );
}

interface Props {
  title: string;
  icon: string;
  data: TopUsageData | null;
  loading: boolean;
}

export default function TopUsageTable({ title, icon, data, loading }: Props) {
  const hosts: TopHostRecord[] = data?.hosts ?? [];

  return (
    <div className="panel-card overflow-hidden flex flex-col h-full animate-slide-up" style={{ animationDelay: '0.4s' }}>
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-3 border-b border-border/50 bg-surface-1/40 backdrop-blur-sm">
        <div className="p-1.5 rounded-md bg-surface-2 text-primary">
          <span className="text-sm">{icon}</span>
        </div>
        <h2 className="text-[13px] font-semibold tracking-widest uppercase text-primary">
          {title}
        </h2>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-0/50 text-[11px] font-semibold tracking-wider uppercase text-tertiary border-b border-border/50 text-left">
            <th className="px-5 py-3">Host</th>
            <th className="px-5 py-3">Usage</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-subtle/50">
          {loading ? (
            <SkeletonRows />
          ) : hosts.length === 0 ? (
            <tr>
              <td colSpan={2} className="py-10 text-center text-sm text-tertiary">
                No data available.
              </td>
            </tr>
          ) : (
            hosts.slice(0, 5).map((h) => (
              <tr
                key={h.hostId}
                className="group transition-colors duration-150 hover:bg-surface-2/40"
              >
                <td className="py-3 px-5 font-mono font-semibold tabular-nums text-primary truncate max-w-[160px] transition-colors">
                  {h.hostName}
                </td>
                <td className="py-3 px-5">
                  <BarCell value={h.value} unit={h.unit} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
