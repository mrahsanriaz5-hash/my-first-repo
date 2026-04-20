import { useState, useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { Search, RefreshCw, Menu, X } from 'lucide-react';

interface Props {
  children: ReactNode;
  zabbixUnreachable?: boolean;
  criticalCount?: number;
  lastRefresh?: Date | null;
  searchTerm?: string;
  onSearchChange?: (val: string) => void;
  onRefresh?: () => void;
}

function IconDashboard() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>; }
function IconHosts() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>; }
function IconProblems() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>; }
function IconTrend() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>; }
function IconPerf() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>; }
function IconNetwork() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="6" height="6" rx="1"/><rect x="16" y="2" width="6" height="6" rx="1"/><rect x="9" y="16" width="6" height="6" rx="1"/><path d="M5 8v3a2 2 0 002 2h10a2 2 0 002-2V8"/><line x1="12" y1="13" x2="12" y2="16"/></svg>; }
function IconChevronLeft() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>; }
function IconChevronRight() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>; }
function SunIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>; }
function MoonIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>; }

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',      icon: <IconDashboard />, path: '/'          },
  { id: 'hosts',     label: 'Host Inventory', icon: <IconHosts />,     path: '/hosts'      },
  { id: 'problems',  label: 'Problems',       icon: <IconProblems />,  path: '/problems'   },
  { id: 'trend',     label: 'Health Trend',   icon: <IconTrend />,     path: '/trend'      },
  { id: 'perf',      label: 'Performance',    icon: <IconPerf />,      path: '/perf'       },
  { id: 'network',   label: 'Network',        icon: <IconNetwork />,   path: '/network'    },
];

const PAGE_TITLES: Record<string, string> = {
  '/':         'Dashboard',
  '/hosts':    'Host Inventory',
  '/problems': 'Problems',
  '/trend':    'Health Trend',
  '/perf':     'Performance',
  '/network':  'Network',
};

export default function Layout({ 
  children, 
  zabbixUnreachable = false, 
  criticalCount = 0, 
  lastRefresh,
  searchTerm = '',
  onSearchChange,
  onRefresh
}: Props) {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true'; }
    catch { return false; }
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem('sidebar-collapsed', String(collapsed)); }
    catch { }
  }, [collapsed]);

  // Handle mobile menu auto-close on navigate
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const currentPageTitle = PAGE_TITLES[location.pathname] ?? 'Dashboard';
  const isHostsPage = location.pathname === '/hosts';

  return (
    <div className="premium-bg" style={{ minHeight: '100vh', display: 'flex' }}>
      {/* Mobile Backdrop */}
      <div 
        className={`sidebar-backdrop ${mobileOpen ? 'sidebar-backdrop--visible' : ''}`} 
        onClick={() => setMobileOpen(false)} 
      />

      <nav className={`sidebar ${collapsed ? 'sidebar--collapsed' : 'sidebar--expanded'} ${mobileOpen ? 'sidebar--mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, color: 'var(--accent)' }}>
            <rect x="2" y="2" width="9" height="9" rx="2" fill="currentColor" opacity="0.9"/><rect x="13" y="2" width="9" height="4" rx="1.5" fill="currentColor" opacity="0.55"/><rect x="13" y="8" width="9" height="3" rx="1.5" fill="currentColor" opacity="0.3"/><rect x="2" y="13" width="20" height="9" rx="2" fill="currentColor" opacity="0.65"/>
          </svg>
          {!collapsed && (
            <div className="sidebar-brand-text">
              <span className="text-[13px] font-bold text-text-primary leading-tight">InfraSpine</span>
              <span className="text-[9px] font-bold text-[var(--accent)] uppercase tracking-[0.12em] leading-tight">Monitor</span>
            </div>
          )}
          {/* Close button for mobile inside sidebar if needed, or just use backdrop */}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingTop: 4 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
            return (
              <Link key={item.id} to={item.path} className={`nav-item ${isActive ? 'nav-item--active' : ''} no-underline`}>
                <span className="nav-item-icon">{item.icon}</span>
                {!collapsed && <span className="nav-item-label">{item.label}</span>}
                {!collapsed && item.id === 'problems' && criticalCount > 0 && <span className="nav-item-badge">{criticalCount}</span>}
              </Link>
            );
          })}
        </div>
        <button className="sidebar-collapse-btn" onClick={() => setCollapsed(!collapsed)}>{collapsed ? <IconChevronRight /> : <IconChevronLeft />}</button>
      </nav>

      <div className={`app-body ${collapsed ? 'app-body--collapsed' : 'app-body--expanded'}`} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {zabbixUnreachable && (
          <div style={{ background: 'var(--color-critical)', color: '#fff', fontSize: '11px', fontWeight: 600, padding: '4px 20px', textAlign: 'center' }}>Zabbix unreachable - monitoring data may be stale</div>
        )}

        <header className="topbar" style={{ height: '52px', minHeight: '52px', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Mobile Hamburguer Toggle */}
            <button 
              onClick={() => setMobileOpen(!mobileOpen)} 
              className="topbar-icon-btn flex lg:hidden"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            {collapsed && !mobileOpen && (
              <button 
                onClick={() => setCollapsed(false)} 
                className="topbar-icon-btn hidden md:flex"
              >
                <Menu size={16} />
              </button>
            )}
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} className="ml-1">
              <span className="text-[10px] font-black tracking-tighter text-text-tertiary uppercase hidden sm:inline opacity-40">InfraSpine</span>
              <span className="hidden sm:inline opacity-30"><IconChevronRight /></span>
              <span className="text-[13px] font-black text-text-primary tracking-tight">{currentPageTitle}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isHostsPage && (
              <div style={{ position: 'relative' }} className="flex">
                <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  className="pl-9 pr-3 py-2 text-[11px] rounded-lg bg-surface-2 border border-border text-text-primary outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all shadow-inner placeholder:text-text-tertiary w-[100px] sm:w-[180px]"
                />
              </div>
            )}
            {isHostsPage && <button onClick={onRefresh} className="topbar-icon-btn bg-surface-2"><RefreshCw size={13} /></button>}
            <div className="topbar-meta-pill" style={{ padding: '2px 8px', height: '24px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-online)' }} />
              <span style={{ fontSize: '10px', fontWeight: 600 }}>Live</span>
              {lastRefresh && <span className="hidden sm:inline" style={{ fontSize: '10px', color: 'var(--text-tertiary)', borderLeft: '1px solid var(--border)', paddingLeft: '6px' }}>{lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
            </div>
            <button onClick={toggleTheme} className="topbar-icon-btn">{theme === 'dark' ? <SunIcon /> : <MoonIcon />}</button>
          </div>
        </header>

        <main style={{ flex: 1, padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          {children}
        </main>

        <footer style={{ padding: '6px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface-1)', fontSize: '9px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
          InfraSpine Monitor | Powered by Zabbix
        </footer>
      </div>
    </div>
  );
}
