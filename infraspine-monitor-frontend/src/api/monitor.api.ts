import axios from 'axios';
import type {
  ApiResponse,
  HealthData,
  SummaryData,
  ProblemsData,
  HostsData,
  TopUsageData,
  TrendData,
  HostRecord,
  NetworkInterface,
  HostGroup,
  HostInventory,
  MaintenanceRecord,
  EventsData,
  ProxiesData,
  MetricHistoryData,
} from '../types/monitor.types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10_000,
});

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const { data } = await api.get<ApiResponse<T>>(path, { params });
  return data.data;
}

export const monitorApi = {
  health:    (): Promise<HealthData>   => get<HealthData>('/health'),
  summary:   (): Promise<SummaryData>  => get<SummaryData>('/summary'),
  problems:  (): Promise<ProblemsData> => get<ProblemsData>('/problems'),
  hosts:     (): Promise<HostsData>    => get<HostsData>('/hosts'),
  topCpu:    (): Promise<TopUsageData> => get<TopUsageData>('/top/cpu'),
  topMemory: (): Promise<TopUsageData> => get<TopUsageData>('/top/memory'),
  topDisk:   (): Promise<TopUsageData> => get<TopUsageData>('/top/disk'),
  trend: (range: '1d' | '7d' | '30d' = '1d'): Promise<TrendData> =>
    get<TrendData>('/trend', { range }),

  // Enhanced host details
  hostEnhanced: (hostid: string): Promise<HostRecord> =>
    get<HostRecord>(`/host/${hostid}/enhanced`),
  
  hostNetwork: (hostid: string): Promise<{ hostid: string; networkInterfaces: NetworkInterface[] }> =>
    get<{ hostid: string; networkInterfaces: NetworkInterface[] }>(`/host/${hostid}/network`),
  
  hostGroups: (hostid: string): Promise<{ hostid: string; groups: HostGroup[] }> =>
    get<{ hostid: string; groups: HostGroup[] }>(`/host/${hostid}/groups`),
  
  hostInventory: (hostid: string): Promise<{ hostid: string; inventory: HostInventory | null }> =>
    get<{ hostid: string; inventory: HostInventory | null }>(`/host/${hostid}/inventory`),
  
  hostMaintenance: (hostid: string): Promise<{ hostid: string; maintenance: MaintenanceRecord | null }> =>
    get<{ hostid: string; maintenance: MaintenanceRecord | null }>(`/host/${hostid}/maintenance`),

  hostHistory: (hostid: string, item: 'cpu' | 'memory' | 'disk' | 'net_in' | 'net_out', hours = 24): Promise<MetricHistoryData> =>
    get<MetricHistoryData>(`/host/${hostid}/history`, { item, hours: String(hours) }),

  // New global endpoints
  events: (): Promise<EventsData> => get<EventsData>('/events'),
  proxies: (): Promise<ProxiesData> => get<ProxiesData>('/proxies'),
};
