// ─────────────────────────────────────────────────────────────────────────────
//  monitor.types.ts – mirrors every backend response shape exactly.
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// ─── /api/health ─────────────────────────────────────────────────────────────

export interface HealthData {
  server: string;
  zabbixReachable: boolean;
  lastSync: string | null;
  uptime: string;
}

// ─── /api/summary ────────────────────────────────────────────────────────────

export interface SummaryData {
  total: number;
  online: number;
  offline: number;
  critical?: number;
  warning?: number;
  highCpuCount?: number; // <--- ADDED: To fix the "highCpuCount" error in SummaryCards
  lastSync: string;
}

// ─── /api/problems ───────────────────────────────────────────────────────────

export interface ProblemRecord {
  eventId: string;
  hostName: string;
  description: string;
  severity: number;
  severityLabel: string;
  clock: number;
  acknowledged: boolean;
  acknowledgedBy?: string;
}

export interface ProblemsData {
  total: number;
  problems: ProblemRecord[];
  lastSync: string;
}

// ─── /api/hosts ──────────────────────────────────────────────────────────────

export type HostStatus = 'online' | 'offline' | 'unknown';

export interface DriveRecord {
  drive: string;       // e.g. "C:", "/", "/data"
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPct: number;     // 0–100
}

export interface NetworkInterface {
  interfaceId: string;
  interfaceName: string;
  status: 'up' | 'down' | 'unknown';
  inBps?: number;
  outBps?: number;
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

export interface HostInventory {
  osName?: string;
  osVersion?: string;
  osFullVersion?: string;
  hardwareManufacturer?: string;
  hardwareModel?: string;
  serialNumber?: string;
  cpuCores?: number;
  ram?: string; 
  softwareBasic?: string;
  softwareFull?: string; 
  softwareA?: string;    // Architecture
  softwareB?: string; 
  softwareC?: string;
  softwareD?: string;    // OS Version
  softwareE?: string;
  poc_1_ip?: string;     // Zabbix "POC 1 IP" field
  ip?: string;           // Fallback IP
  macAddressA?: string;  // Zabbix "MAC address A" field
}

export interface MaintenanceRecord {
  maintenanceId: string;
  maintenanceName: string;
  description?: string;
  startTime: number;
  endTime: number;
  active: boolean;
}

export interface HostTag {
  tag: string;
  value: string;
}

export interface HostRecord {
  hostId: string;
  hostName: string;
  displayName: string;
  status: HostStatus;
  severity?: number;      // <--- Added to track alert level
  problemCount: number;
  hasCritical: boolean;
  hasWarning: boolean;
  problems?: ProblemRecord[]; // <--- Added to show actual issues
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

export interface HostsData {
  total: number;
  hosts: HostRecord[];
  lastSync: string;
}

// ─── /api/top/cpu  and  /api/top/memory ──────────────────────────────────────

export interface TopHostRecord {
  hostId: string;
  hostName: string;
  value: string;
  unit: string;
  itemKey: string;
}

export interface TopUsageData {
  hosts: TopHostRecord[];
  lastSync: string;
}

// ─── /api/trend ──────────────────────────────────────────────────────────────

export interface TrendPoint {
  id: string;
  createdAt: string;
  totalHosts: number;
  online: number;
  offline: number;
  critical: number;
  warning: number;
}

export interface TrendData {
  range: string;
  points: TrendPoint[];
}

// ─── /api/events ─────────────────────────────────────────────────────────────

export interface EventRecord {
  eventId: string;
  hostName: string;
  name: string;
  severity: number;
  severityLabel: string;
  clock: number;
  acknowledged: boolean;
}

export interface EventsData {
  total: number;
  events: EventRecord[];
  lastSync: string;
}

// ─── /api/proxies ─────────────────────────────────────────────────────────────

export interface ProxyRecord {
  proxyId: string;
  name: string;
  status: string;     // 'active' | 'passive' | 'unknown'
  lastAccess: number; // Unix timestamp
  hostsCount?: number;
}

export interface ProxiesData {
  total: number;
  proxies: ProxyRecord[];
  lastSync: string;
}

// ─── /api/host/:id/history ───────────────────────────────────────────────────

export interface MetricHistoryPoint {
  clock: number;
  value: number;
}

export interface MetricHistoryData {
  hostid: string;
  item: string;
  hours: number;
  points: MetricHistoryPoint[];
}

// Severity badges — theme-aware CSS classes defined in index.css
export const SEVERITY_BADGE: Record<number, string> = {
  0: 'severity-0',
  1: 'severity-1',
  2: 'severity-2',
  3: 'severity-3',
  4: 'severity-4',
  5: 'severity-5',
};