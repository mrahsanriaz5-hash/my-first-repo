import { useEffect, useRef, useState, useCallback } from 'react';
import { monitorApi } from '../api/monitor.api';
import type { HealthData, SummaryData, ProblemsData, EventsData } from '../types/monitor.types';
import Layout from '../components/Layout';
import ProblemsTable from '../components/ProblemsTable';
import SeverityChart from '../components/SeverityChart';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useTheme } from '../context/ThemeContext';

const REFRESH_INTERVAL_MS = 60_000;

interface TimelineBucket {
  time: string;
  events: number;
  critical: number;
}

function buildTimeline(events: EventsData['events']): TimelineBucket[] {
  const buckets = new Map<string, { events: number; critical: number }>();
  const now = Date.now();
  for (let i = 23; i >= 0; i--) {
    const t = new Date(now - i * 3600000);
    const label = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    buckets.set(label, { events: 0, critical: 0 });
  }
  for (const e of events) {
    const t = new Date(e.clock * 1000);
    const label = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (buckets.has(label)) {
      const b = buckets.get(label)!;
      b.events++;
      if (e.severity >= 4) b.critical++;
    }
  }
  return [...buckets.entries()].map(([time, v]) => ({ time, ...v }));
}

export default function ProblemsPage() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [problems, setProblems] = useState<ProblemsData | null>(null);
  const [events, setEvents] = useState<EventsData | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [showAcked] = useState(true); // setShowAcked removed to fix "declared but never read"
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHosts, setSelectedHosts] = useState<string[]>([]);
  const [hostSearchTerm, setHostSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [h, s, p, ev] = await Promise.allSettled([
        monitorApi.health(),
        monitorApi.summary(),
        monitorApi.problems(),
        monitorApi.events(),
      ]);
      setHealth(h.status === 'fulfilled' ? h.value : null);
      setSummary(s.status === 'fulfilled' ? s.value : null);
      setProblems(p.status === 'fulfilled' ? p.value : null);
      setEvents(ev.status === 'fulfilled' ? ev.value : null);
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

  const allProblems = problems?.problems ?? [];
  const uniqueHosts = Array.from(new Set(allProblems.map(p => p.hostName))).sort();

  const filteredProblems = allProblems
    .filter((p) => showAcked || !p.acknowledged)
    .filter((p) => {
      const matchesSearch = p.hostName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            p.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesHosts = selectedHosts.length === 0 || selectedHosts.includes(p.hostName);
      return matchesSearch && matchesHosts;
    });

  const toggleHost = (host: string) => {
    setSelectedHosts(prev => 
      prev.includes(host) ? prev.filter(h => h !== host) : [...prev, host]
    );
  };
  
  // FIXED: Prop type must match ProblemsData object
  const filteredData: ProblemsData | null = problems 
    ? { ...problems, problems: filteredProblems, total: filteredProblems.length } 
    : null;

  const timeline = buildTimeline(events?.events ?? []);

  const tooltipStyle = {
    background: theme === 'dark' ? '#1e293b' : '#fff',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    fontSize: 12,
  };

  const sevCounts = [0, 1, 2, 3, 4, 5].map((sev) => ({
    sev,
    count: allProblems.filter((p) => p.severity === sev).length,
  })).filter((s) => s.count > 0);

  const SEV_LABELS: Record<number, string> = {
    0: 'Not classified', 1: 'Information', 2: 'Warning', 3: 'Average', 4: 'High', 5: 'Disaster',
  };

  const sevAccent = (sev: number) => {
    if (sev >= 4) return 'var(--color-critical)';
    if (sev >= 2) return 'var(--color-warning-accent)';
    return 'var(--text-tertiary)';
  };

  return (
    <Layout
      zabbixUnreachable={health?.zabbixReachable === false}
      criticalCount={summary?.critical ?? 0}
      lastRefresh={lastRefresh}
    >
      <div className="bg-surface-0 min-h-screen -m-6 p-6">
        <div className="space-y-2 pb-6">
        {/* ── Severity Summary Cards (Trend style) ── */}
        {!loading && sevCounts.length > 0 && (
          <div className="flex overflow-x-auto snap-x snap-mandatory custom-scrollbar sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 pb-1 sm:pb-0 w-full">
            {sevCounts.map(({ sev, count }) => (
              <div
                key={sev}
                className="panel-card transition-all duration-200 p-3 hover:shadow-card-hover hover:-translate-y-0.5 shrink-0 w-[130px] sm:w-auto sm:shrink-1 snap-start h-full"
                style={{ padding: '12px 14px' }}
              >
                <div className="text-[11px] text-text-tertiary font-semibold tracking-wide" style={{ marginBottom: 2 }}>
                  {SEV_LABELS[sev]}
                </div>
                <div
                  className="text-[20px] font-extrabold font-mono tabular-nums tracking-tight"
                  style={{ color: sevAccent(sev) }}
                >
                  {count}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Charts Row ── */}
        <div className="flex overflow-x-auto snap-x snap-mandatory custom-scrollbar lg:grid lg:grid-cols-2 gap-3 pb-1 lg:pb-0 w-full">
          <div className="panel-card p-3 shrink-0 w-[90vw] sm:w-[400px] lg:w-auto lg:shrink snap-center h-full">
            <div className="text-xs font-bold text-[var(--text-primary)] mb-4">Severity Distribution</div>
            {loading ? <div className="h-[200px] animate-pulse bg-[var(--surface-2)] rounded-lg" /> : <SeverityChart problems={allProblems} />}
          </div>

          <div className="panel-card p-3 shrink-0 w-[90vw] sm:w-[400px] lg:w-auto lg:shrink snap-center h-full">
            <div className="text-xs font-bold text-[var(--text-primary)] mb-4">Events Timeline (24h)</div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
                <XAxis dataKey="time" hide />
                <YAxis hide />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="events" stroke="var(--accent)" fillOpacity={0.1} fill="var(--accent)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Problems Table (FIXED PROP ERROR) ── */}
        <div className="panel-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-[var(--text-primary)]">Problem Details</span>
              <span className="px-2 py-0.5 bg-surface-2/60 border border-border/40 rounded text-[9px] font-bold text-text-tertiary tabular-nums shadow-sm">
                {filteredProblems.length} Active Issues
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Host Multi-Select Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all duration-200 ${
                    selectedHosts.length > 0 
                      ? 'bg-indigo-50/50 border-indigo-500/50 text-indigo-700 shadow-sm' 
                      : 'bg-surface-2 border-border text-text-tertiary hover:bg-surface-3 transition-colors'
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M7 12h10M10 18h4"/>
                  </svg>
                  {selectedHosts.length === 0 ? 'All Hosts' : `${selectedHosts.length} Hosts`}
                  <svg className={`ml-1 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </button>

                {isDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-[220px] bg-surface-1 border border-border rounded-xl shadow-2xl z-50 p-2 animate-fade-in backdrop-blur-md">
                    <div className="flex flex-col gap-2 mb-2 px-2 pb-2 border-b border-border/50">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Filter Hosts</span>
                        {selectedHosts.length > 0 && (
                          <button 
                            onClick={() => setSelectedHosts([])}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search hosts..."
                          value={hostSearchTerm}
                          onChange={(e) => setHostSearchTerm(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()} // Prevent accidental interactions
                          className="w-full pl-7 pr-4 py-1.5 text-[10px] rounded-md bg-surface-2 border border-border text-text-primary outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-text-tertiary"
                        />
                        <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary opacity-60" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                        </svg>
                      </div>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                      {uniqueHosts
                        .filter(h => h.toLowerCase().includes(hostSearchTerm.toLowerCase()))
                        .map(host => (
                        <div 
                          key={host} 
                          onClick={() => toggleHost(host)}
                          className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-surface-2 cursor-pointer transition-colors group"
                        >
                          <div className={`w-3.5 h-3.5 border rounded flex items-center justify-center transition-all ${
                            selectedHosts.includes(host) 
                              ? 'bg-indigo-600 border-indigo-600 shadow-sm' 
                              : 'border-border bg-surface-1 group-hover:border-indigo-400'
                          }`}>
                            {selectedHosts.includes(host) && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                          <span className={`text-[11px] font-semibold truncate ${selectedHosts.includes(host) ? 'text-indigo-600' : 'text-text-secondary'}`}>
                            {host}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative group">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-1.5 text-[11px] rounded-lg bg-surface-2 border border-border text-text-primary outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all shadow-inner placeholder:text-text-tertiary w-[160px] md:w-[220px]"
                />
                <svg 
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary opacity-50 group-focus-within:text-[var(--accent)] group-focus-within:opacity-100 transition-all" 
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                </svg>
              </div>
            </div>
          </div>
          <ProblemsTable data={filteredData} loading={loading} showAck />
        </div>
      </div>
      </div>

      
    </Layout>
  );
}