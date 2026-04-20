import type { ProxyRecord } from '../types/monitor.types';

interface Props {
  proxies: ProxyRecord[];
}

function formatLastAccess(unix: number): string {
  if (!unix || unix === 0) return 'Never';
  const diff = Math.floor(Date.now() / 1000) - unix;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ProxyStatusPanel({ proxies }: Props) {
  if (proxies.length === 0) {
    return (
      <div style={{ color: 'var(--text-tertiary)', fontSize: 12, padding: '12px 0' }}>
        No proxies configured
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
      {proxies.map((proxy) => {
        const diff = proxy.lastAccess ? Math.floor(Date.now() / 1000) - proxy.lastAccess : Infinity;
        const isOnline = diff < 120; // seen within 2 minutes
        const statusColor = isOnline ? 'var(--color-online)' : 'var(--color-offline)';

        return (
          <div key={proxy.proxyId} className="panel-card p-4">
            {/* Status indicator + name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: statusColor,
                flexShrink: 0, boxShadow: isOnline ? `0 0 6px ${statusColor}` : 'none',
              }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {proxy.name}
              </span>
            </div>

            {/* Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Type</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                  {proxy.status}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Last seen</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: isOnline ? 'var(--color-online)' : 'var(--text-tertiary)' }}>
                  {formatLastAccess(proxy.lastAccess)}
                </span>
              </div>
              {proxy.hostsCount !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Hosts</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{proxy.hostsCount}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
