import { useRef, useEffect, useState } from 'react';

/** ── ANIMATED NUMBER ── */
function AnimatedNumber({ value, suffix = "" }: { value: number, suffix?: string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const from = prev.current;
    const to = value;
    if (from === to) return;
    const duration = 400;
    const start = performance.now();
    let raf: number;
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * ease));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    prev.current = value;
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{display}{suffix}</>;
}

export interface CardProps {
  label: string;
  value?: number;
  stringValue?: string | React.ReactNode;
  accentColor: string;
  icon: React.ReactNode;
  loading: boolean;
  pulse?: boolean;
  onClick?: () => void;
  isActive?: boolean;
  suffix?: string;
}

/** ── PROMINENT BORDER KPI CARD ── */
export function KpiCard({ label, value = 0, stringValue, accentColor, icon, loading, pulse, onClick, isActive, suffix = "" }: CardProps) {
  return (
    <div 
      onClick={onClick}
      // border-2 aur border-slate-200 se border prominent kiya gaya hai
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : -1}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
      className={`panel-card relative group overflow-hidden transition-all duration-200 p-3 flex flex-col gap-2 shrink-0 w-[130px] sm:w-auto sm:shrink-1 snap-start ${
        onClick ? 'cursor-pointer' : ''
      } ${
        isActive 
          ? 'bg-surface-1/80 shadow-card-hover hover:-translate-y-0.5 z-10'
          : 'bg-surface-1/60 shadow-card hover:shadow-card-hover hover:-translate-y-0.5'
      }`}
      style={{ 
        borderColor: isActive ? accentColor : 'var(--border)'
      }}
    >
      <div className="absolute inset-0 bg-glass-gradient opacity-50 dark:opacity-10 pointer-events-none"></div>

      {/* Trend-page-like: small label + big number */}
          <div className="flex items-start justify-between relative z-10">
        <div className="flex flex-col">
          <div className="text-[11px] text-text-tertiary font-semibold tracking-wide" style={{ marginBottom: 2 }}>
            {label}
          </div>
          <div
            className="text-[20px] font-extrabold font-mono tabular-nums tracking-tight"
            style={{ color: accentColor }}
          >
            {loading ? '—' : stringValue !== undefined ? stringValue : <AnimatedNumber value={value} suffix={suffix} />}
          </div>
        </div>

        {pulse && value > 0 ? (
          <div className="flex items-center justify-center w-7 h-7 rounded-lg border border-border/50 bg-surface-2/40">
            <span
              className="inline-flex w-2 h-2 rounded-full animate-pulse"
              style={{
                backgroundColor: accentColor,
                boxShadow: `0 0 0 4px color-mix(in srgb, ${accentColor} 20%, transparent)`,
              }}
            />
          </div>
        ) : (
          <div className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg border border-border/50 bg-surface-2/40 text-text-tertiary">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

export const icons = {
  server: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="8" x="2" y="2" rx="2" /><rect width="20" height="8" x="2" y="14" rx="2" /><path d="M6 6h.01M6 18h.01" /></svg>,
  pulse: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>,
  powerOff: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" /></svg>,
  alertTriangle: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4M12 17h.01" /></svg>,
  alertCircle: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>,
  shield: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>,
  cpu: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="16" x="4" y="4" rx="2" /><rect width="6" height="6" x="9" y="9" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3" /></svg>,
};

export default function SummaryCards({ data, loading }: any) {
  const total = data?.total ?? 0;
  const online = data?.online ?? 0;
  const availability = total > 0 ? (online / total) * 100 : 100;
  const highCpu = data?.highCpuCount ?? 0;

  return (
    <section className="flex overflow-x-auto snap-x snap-mandatory custom-scrollbar sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4 mb-0 pb-1 sm:pb-0 w-full">
      <KpiCard label="Inventory" value={total} accentColor="#6366f1" icon={icons.server} loading={loading} />
      <KpiCard label="Online" value={online} accentColor="#10b981" icon={icons.pulse} loading={loading} />
      <KpiCard label="Offline" value={data?.offline ?? 0} accentColor="#64748b" icon={icons.powerOff} loading={loading} pulse={(data?.offline ?? 0) > 0} />
      <KpiCard label="Critical" value={data?.critical ?? 0} accentColor="#f43f5e" icon={icons.alertTriangle} loading={loading} pulse={(data?.critical ?? 0) > 0} />
      <KpiCard label="Warning" value={data?.warning ?? 0} accentColor="#f59e0b" icon={icons.alertCircle} loading={loading} />
      <KpiCard label="High CPU" value={highCpu} accentColor="#ec4899" icon={icons.cpu} loading={loading} pulse={highCpu > 0} />
      <KpiCard label="Health" value={Math.round(availability)} suffix="%" accentColor="#14b8a6" icon={icons.shield} loading={loading} />
    </section>
  );
}