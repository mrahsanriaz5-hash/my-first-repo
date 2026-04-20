// ─────────────────────────────────────────────────────────────────────────────
//  In-memory cache store – single source of truth for all synced data
// ─────────────────────────────────────────────────────────────────────────────

export interface HostSummary {
  total: number;
  online: number;
  offline: number;
  critical: number;
  warning: number;
}

export interface ProblemRecord {
  eventId: string;
  hostName: string;
  description: string;
  severity: number;
  severityLabel: string;
  clock: number; // Unix timestamp from Zabbix
  acknowledged: boolean;
  acknowledgedBy?: string;
}

export interface HostTag {
  tag: string;
  value: string;
}

export interface EventRecord {
  eventId: string;
  hostName: string;
  name: string;
  severity: number;
  severityLabel: string;
  clock: number;
  acknowledged: boolean;
}

export interface ProxyRecord {
  proxyId: string;
  name: string;
  status: string; // 'active' | 'passive' | 'unknown'
  lastAccess: number; // Unix timestamp
  hostsCount?: number;
}

export interface TopHostRecord {
  hostId: string;
  hostName: string;
  value: string;
  unit: string;
  itemKey: string;
}

export type HostStatus = 'online' | 'offline' | 'unknown';

export interface DriveRecord {
  drive: string;       // e.g. "C:", "/", "/data"
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPct: number;     // 0–100, rounded to 1 decimal place
}

export interface NetworkInterface {
  interfaceId: string;
  interfaceName: string;      // e.g. "eth0", "ens33"
  status: 'up' | 'down' | 'unknown';  // interface availability
  inBps?: number;             // bytes per second in
  outBps?: number;            // bytes per second out
  inErrors?: number;
  outErrors?: number;
  inDropped?: number;
  outDropped?: number;
  mtu?: number;
}

export interface HostGroup {
  groupId: string;
  groupName: string;
}

/**
 * UPDATED: HostInventory Interface
 * Ismein Software A-E aur Full Details shamil hain.
 */
export interface HostInventory {
  osName?: string;            // e.g. "Windows", "Linux"
  osVersion?: string;
  osFullVersion?: string;
  hardwareManufacturer?: string;
  hardwareModel?: string;      
  serialNumber?: string;
  cpuCores?: number;
  
  // RAM string hai kyunke Zabbix se preprocessing ke baad "16 GB" jaisa text ayega
  ram?: string; 

  // --- Aapke Naye 7 Software Items ---
  softwareBasic?: string;     // Software field
  softwareFull?: string;      // Full Apps List
  softwareA?: string;         // Architecture
  softwareB?: string;         // Build Number
  softwareC?: string;         // Install Date
  softwareD?: string;         // OS Version
  softwareE?: string;         // Registered User
}

export interface MaintenanceRecord {
  maintenanceId: string;
  maintenanceName: string;
  description?: string;
  startTime: number;
  endTime: number;
  active: boolean;
}

export interface HostRecord {
  hostId: string;
  hostName: string;
  displayName: string;
  status: HostStatus;
  problemCount: number;
  hasCritical: boolean;
  hasWarning: boolean;
  cpuUtil?: number;
  memUtil?: number;
  swapUsedPct?: number;
  diskUsedPct?: number;
  uptime?: number;
  drives?: DriveRecord[];
  networkInterfaces?: NetworkInterface[];
  groups?: HostGroup[];
  tags?: HostTag[];
  inventory?: HostInventory;
  maintenance?: MaintenanceRecord | null;
}

export interface CacheState {
  summary: HostSummary | null;
  problems: ProblemRecord[];
  topCpu: TopHostRecord[];
  topMemory: TopHostRecord[];
  topDisk: TopHostRecord[];
  hosts: HostRecord[];
  events: EventRecord[];
  proxies: ProxyRecord[];
  lastSync: Date | null;
  zabbixReachable: boolean;
}

const SEVERITY_LABELS: Record<number, string> = {
  0: 'Not classified',
  1: 'Information',
  2: 'Warning',
  3: 'Average',
  4: 'High',
  5: 'Disaster',
};

export function severityLabel(level: number): string {
  return SEVERITY_LABELS[level] ?? 'Unknown';
}

// ── Singleton ────────────────────────────────────────────────────────────────

const state: CacheState = {
  summary: null,
  problems: [],
  topCpu: [],
  topMemory: [],
  topDisk: [],
  hosts: [],
  events: [],
  proxies: [],
  lastSync: null,
  zabbixReachable: false,
};

export const cacheStore = {
  getState(): Readonly<CacheState> {
    return state;
  },

  setSummary(summary: HostSummary): void {
    state.summary = summary;
  },

  setProblems(problems: ProblemRecord[]): void {
    state.problems = problems;
  },

  setTopCpu(hosts: TopHostRecord[]): void {
    state.topCpu = hosts;
  },

  setTopMemory(hosts: TopHostRecord[]): void {
    state.topMemory = hosts;
  },

  setTopDisk(hosts: TopHostRecord[]): void {
    state.topDisk = hosts;
  },

  setHosts(hosts: HostRecord[]): void {
    state.hosts = hosts;
  },

  setEvents(events: EventRecord[]): void {
    state.events = events;
  },

  setProxies(proxies: ProxyRecord[]): void {
    state.proxies = proxies;
  },

  markSynced(reachable: boolean): void {
    state.lastSync = new Date();
    state.zabbixReachable = reachable;
  },
};