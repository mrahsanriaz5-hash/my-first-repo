import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import {
  HostSummary,
  HostRecord,
  HostStatus,
  DriveRecord,
  ProblemRecord,
  TopHostRecord,
  NetworkInterface,
  HostGroup,
  MaintenanceRecord,
  HostTag,
  EventRecord,
  ProxyRecord,
  severityLabel,
} from '../store/cache.store';

// ─────────────────────────────────────────────────────────────────────────────
//  Zabbix JSON-RPC types
// ─────────────────────────────────────────────────────────────────────────────

// Zabbix 7.0+ removed "auth" from the JSON-RPC body.
// The token is now passed as "Authorization: Bearer <token>" in HTTP headers.
interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params: Record<string, unknown>;
  id: number;
}

interface JsonRpcResponse<T> {
  jsonrpc: string;
  result: T;
  error?: { code: number; message: string; data: string };
  id: number;
}

interface ZabbixHostInterface {
  interfaceid: string;
  available: string; // '0'=unknown, '1'=available, '2'=unavailable
}

interface ZabbixHost {
  hostid: string;
  host: string;
  name: string;
  active_available: string; // '0'=unknown, '1'=available, '2'=unavailable (Zabbix 7.x)
  interfaces?: ZabbixHostInterface[]; // Interface-level availability
  groups?: ZabbixHostGroup[]; // Groups for this host (when selectGroups is used)
}

interface ZabbixProblem {
  eventid: string;
  objectid: string; // trigger ID – used to resolve the host name via trigger.get
  name: string;
  severity: string;
  clock: string;
  acknowledged: string;  // '0' or '1'
  acknowledges?: Array<{ acknowledgeid: string; userid: string; clock: string; message: string; action: string }>;
}

// selectHosts is not supported by item.get in Zabbix 7.x;
// hostid is used to resolve names via a separate host.get call.
interface ZabbixItem {
  itemid: string;
  hostid: string;
  key_: string;
  lastvalue: string;
  units: string;
}

interface ZabbixTrigger {
  triggerid: string;
  hosts: Array<{ hostid: string; name: string }>;
}

interface ZabbixHostGroup {
  groupid: string;
  name: string;
}

interface ZabbixHostInventory {
  hostid: string;
  os_full?: string;
  os_short?: string;
  hardware?: string;          // Yahan Processor detail (Intel i5...) aati hai
  hardware_full?: string;     // RAM
  serialno_a?: string;
  serialno_b?: string;
  cpu_count?: string;
  cpu_cores?: string;
  memory_total?: string;
  memory_free?: string;
  manufacturer?: string;
  model_number?: string;      // Yahan Machine Model (20ARS...) aata hai
  model?: string;             
  macaddress_a?: string;
  vendor?: string;            // Ismein Lenovo/Dell aata hai

  // Software Fields
  software?: string;          
  software_full?: string;     
  software_a?: string;        
  software_b?: string;        
  software_c?: string;        
  software_d?: string;        
  software_e?: string;        
}
interface ZabbixMaintenance {
  maintenanceid: string;
  name: string;
  description?: string;
  start_time: string;
  maintenance_type: string;  // '0' = no data, '1' = with data
  active_since: string;
  active_till: string;
  active: string;  // '0' or '1'
}

interface ZabbixNetworkInterface {
  interfaceid: string;
  hostid: string;
  ip?: string;
  dns?: string;
  port?: string;
  type: string;  // '1'=agent, '2'=SNMP, '3'=IPMI, '4'=JMX
  available: string;  // '0'=unknown, '1'=available, '2'=unavailable
  useip?: string;     // '1'=use IP, '0'=use DNS
}

interface ZabbixTag {
  tag: string;
  value: string;
}

interface ZabbixEvent {
  eventid: string;
  objectid: string;   // trigger ID
  name: string;
  severity: string;
  clock: string;
  acknowledged: string;  // '0' or '1'
}

interface ZabbixProxy {
  proxyid: string;
  name: string;
  operating_mode: string; // '0'=active proxy, '1'=passive proxy (Zabbix 7.x)
  lastaccess: string;     // Unix timestamp
  state: string;          // '0'=unknown, '1'=online, '2'=offline (Zabbix 7.x)
  hosts?: Array<{ hostid: string }>;
}

interface ZabbixHistoryPoint {
  itemid: string;
  clock: string;
  value: string;
  ns: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  ZabbixService
// ─────────────────────────────────────────────────────────────────────────────

const CTX = 'ZabbixService';
const TOP_N = 5;

export class ZabbixService {
  private readonly http: AxiosInstance;
  private authToken: string | null = null;
  private requestId = 1;

  constructor() {
    this.http = axios.create({
      baseURL: `${env.zabbixUrl}/api_jsonrpc.php`,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10_000,
    });
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private nextId(): number {
    return this.requestId++;
  }

  private async call<T>(
    method: string,
    params: Record<string, unknown>,
    authenticated = true,
  ): Promise<T> {
    const body: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: this.nextId(),
    };

    // Zabbix 7.0+: send token as Bearer header, not in the request body.
    const headers: Record<string, string> = {};
    if (authenticated && this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const { data } = await this.http.post<JsonRpcResponse<T>>('', body, { headers });

    if (data.error) {
      const msg = `${data.error.message}: ${data.error.data}`;

      // -32000 = session expired / not authorised (Zabbix 7.x).
      // -32602 means "invalid params" in Zabbix 7.x – do NOT clear the token.
      if (data.error.code === -32000) {
        logger.warn(CTX, 'Auth token expired – clearing for re-login');
        this.authToken = null;
      }

      throw new Error(`Zabbix API error [${data.error.code}]: ${msg}`);
    }

    return data.result;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async login(): Promise<void> {
    logger.info(CTX, `Authenticating as "${env.zabbixUsername}"…`);
    const token = await this.call<string>(
      'user.login',
      { username: env.zabbixUsername, password: env.zabbixPassword },
      false,
    );
    this.authToken = token;
    logger.info(CTX, 'Authentication successful');
  }

  /** Ensure we have a valid token before making calls. */
  private async ensureAuth(): Promise<void> {
    if (!this.authToken) {
      await this.login();
    }
  }

  async getHosts(): Promise<HostSummary> {
    await this.ensureAuth();

    // Zabbix 7.x: 'available' is no longer a host-level property.
    // Use 'active_available' for active agent checks, and 'selectInterfaces' for interface availability.
    const hosts = await this.call<ZabbixHost[]>('host.get', {
      output: ['hostid', 'host', 'name', 'active_available'],
      selectInterfaces: ['interfaceid', 'available'],
    });

    const total = hosts.length;

    // A host is considered "online" if:
    // 1. active_available === '1' (active agent is available), OR
    // 2. Any interface has available === '1' (passive checks available)
    const online = hosts.filter((h) => {
      // Check active agent availability
      if (h.active_available === '1') return true;
      // Check interface-level availability (for passive checks)
      if (h.interfaces && h.interfaces.length > 0) {
        return h.interfaces.some((iface) => iface.available === '1');
      }
      return false;
    }).length;

    // A host is considered "offline" if:
    // 1. active_available === '2' (active agent unavailable), OR
    // 2. All interfaces have available === '2' (all passive checks unavailable)
    // But NOT if it's already counted as online
    const offline = hosts.filter((h) => {
      // If online by active agent, not offline
      if (h.active_available === '1') return false;
      // If any interface is available, not offline
      if (h.interfaces && h.interfaces.some((iface) => iface.available === '1')) {
        return false;
      }
      // Check if actively unavailable or all interfaces unavailable
      if (h.active_available === '2') return true;
      if (h.interfaces && h.interfaces.length > 0) {
        return h.interfaces.every((iface) => iface.available === '2');
      }
      return false;
    }).length;

    return { total, online, offline, critical: 0, warning: 0 };
  }

  /**
   * Returns full per-host detail: status, display name, problem counts,
   * and live metrics (CPU %, disk used %, net in/out bps).
   * Problem counts are cross-referenced after getProblems() so must be called
   * with the problems array passed in from the sync job.
   */
  async getHostsDetail(problems: ProblemRecord[]): Promise<HostRecord[]> {
    await this.ensureAuth();

    const hosts = await this.call<Array<ZabbixHost & { tags?: ZabbixTag[] }>>('host.get', {
      output: ['hostid', 'host', 'name', 'active_available'],
      selectInterfaces: ['interfaceid', 'available'],
      selectTags: 'extend',
    });

    if (hosts.length === 0) return [];

    const allHostIds = hosts.map((h) => h.hostid);

    // ── Fetch all metrics in parallel ──────────────────────────────────────
    const [cpuItems, memItems, swapItems, diskItems, uptimeItems, netItems] = await Promise.all([
      // CPU utilisation %
      this.call<ZabbixItem[]>('item.get', {
        output: ['itemid', 'hostid', 'key_', 'lastvalue', 'units'],
        hostids: allHostIds,
        search: { key_: 'system.cpu.util' },
      }),
      // Memory utilisation % — vm.memory.util
      this.call<ZabbixItem[]>('item.get', {
        output: ['itemid', 'hostid', 'key_', 'lastvalue', 'units'],
        hostids: allHostIds,
        search: { key_: 'vm.memory.util' },
      }),
      // Swap free % — system.swap.pfree
      this.call<ZabbixItem[]>('item.get', {
        output: ['itemid', 'hostid', 'key_', 'lastvalue', 'units'],
        hostids: allHostIds,
        search: { key_: 'system.swap.pfree' },
      }),
      // Disk — two key families (both have individual float items per metric):
      //   vfs.fs.size[/,pused]               — classic Zabbix agent
      //   vfs.fs.dependent.size[C:,pused]    — Zabbix 7 agent (Linux & Windows)
      this.call<ZabbixItem[]>('item.get', {
        output: ['itemid', 'key_', 'hostid', 'lastvalue'],
        hostids: allHostIds,
        search: { key_: ['vfs.fs.size', 'vfs.fs.dependent.size'] },
        searchByAny: true,
      }),
      // Uptime in seconds — system.uptime
      this.call<ZabbixItem[]>('item.get', {
        output: ['itemid', 'hostid', 'key_', 'lastvalue'],
        hostids: allHostIds,
        search: { key_: 'system.uptime' },
      }),
      // Network — net.if.in and net.if.out
      this.call<ZabbixItem[]>('item.get', {
        output: ['itemid', 'hostid', 'key_', 'lastvalue'],
        hostids: allHostIds,
        search: { key_: ['net.if.in[', 'net.if.out['] },
        searchByAny: true,
      }),
    ]);

    logger.info(CTX, `Metric items — cpu:${cpuItems.length} mem:${memItems.length} swap:${swapItems.length} disk:${diskItems.length} uptime:${uptimeItems.length} net:${netItems.length}`);

    // ── Build hostId-keyed metric maps ─────────────────────────────────────

    // CPU: pick highest util value per host
    const cpuByHost = new Map<string, number>();
    for (const item of cpuItems) {
      const v = parseFloat(item.lastvalue);
      if (!isNaN(v)) {
        const cur = cpuByHost.get(item.hostid) ?? 0;
        cpuByHost.set(item.hostid, Math.max(cur, v));
      }
    }

    // Memory: vm.memory.util value is already used %
    const memByHost = new Map<string, number>();
    for (const item of memItems) {
      const v = parseFloat(item.lastvalue);
      if (!isNaN(v)) {
        const cur = memByHost.get(item.hostid) ?? 0;
        memByHost.set(item.hostid, Math.max(cur, v));
      }
    }

    // Swap: system.swap.pfree gives free%, convert to used%
    const swapByHost = new Map<string, number>();
    for (const item of swapItems) {
      const v = parseFloat(item.lastvalue);
      if (!isNaN(v)) {
        swapByHost.set(item.hostid, Math.round(100 - v));
      }
    }

    // Uptime: system.uptime in seconds
    const uptimeByHost = new Map<string, number>();
    for (const item of uptimeItems) {
      const v = parseFloat(item.lastvalue);
      if (!isNaN(v)) {
        uptimeByHost.set(item.hostid, Math.floor(v));
      }
    }

    // Disk used% — both key families use plain float lastvalue for the pused metric:
    //   vfs.fs.size[/,pused]                — classic Zabbix agent
    //   vfs.fs.dependent.size[C:,pused]     — Zabbix 7 agent (Linux & Windows)
    const diskByHost = new Map<string, number>();
    for (const item of diskItems) {
      const key = item.key_;
      if (!key.includes(',pused]')) continue;
      const v = parseFloat(item.lastvalue);
      if (!isNaN(v)) {
        const cur = diskByHost.get(item.hostid) ?? 0;
        diskByHost.set(item.hostid, Math.max(cur, v));
      }
    }

    // Network: hostid -> NetworkInterface[]
    const netByHost = new Map<string, Map<string, Partial<NetworkInterface>>>();
    const parseIntfName = (key: string): string | null => {
      const match = /net\.if\.(?:in|out)\[([^\]]+)\]/.exec(key);
      return match ? match[1] : null;
    };

    for (const item of netItems) {
      const name = parseIntfName(item.key_);
      if (!name) continue;
      if (!netByHost.has(item.hostid)) netByHost.set(item.hostid, new Map());
      const ifacesMap = netByHost.get(item.hostid)!;
      if (!ifacesMap.has(name)) ifacesMap.set(name, { interfaceName: name, status: 'unknown' });
      const raw = ifacesMap.get(name)!;
      const v = Math.round(parseFloat(item.lastvalue));

      if (item.key_.startsWith('net.if.in[')) raw.inBps = v;
      else if (item.key_.startsWith('net.if.out[')) raw.outBps = v;
    }

    // ── Build per-drive breakdown: hostid -> DriveRecord[] ─────────────────
    // Both key families have individual float items per metric:
    //   vfs.fs.size[/,total|used|free|pused]              — classic Zabbix agent
    //   vfs.fs.dependent.size[C:,total|used|free|pused]   — Zabbix 7 agent
    const driveKeyRe = /^vfs\.fs(?:\.dependent)?\.size\[([^\],]+),(total|used|free|pused)\]$/;

    // Nested map: hostid -> drive -> { total, used, free, pused }
    type DriveRaw = { total?: number; used?: number; free?: number; pused?: number };
    const driveDataByHost = new Map<string, Map<string, DriveRaw>>();

    for (const item of diskItems) {
      const m = driveKeyRe.exec(item.key_);
      if (!m) continue;
      const [, drive, metric] = m;
      const v = parseFloat(item.lastvalue);
      if (isNaN(v)) continue;

      if (!driveDataByHost.has(item.hostid)) driveDataByHost.set(item.hostid, new Map());
      const drivesMap = driveDataByHost.get(item.hostid)!;
      if (!drivesMap.has(drive)) drivesMap.set(drive, {});
      const raw = drivesMap.get(drive)!;

      if (metric === 'total')      raw.total = v;
      else if (metric === 'used')  raw.used  = v;
      else if (metric === 'free')  raw.free  = v;
      else if (metric === 'pused') raw.pused = v;
    }

    // Convert nested map to DriveRecord[]
    const drivesByHost = new Map<string, DriveRecord[]>();
    for (const [hostId, drivesMap] of driveDataByHost.entries()) {
      const records: DriveRecord[] = [];
      for (const [drive, raw] of drivesMap.entries()) {
        // Must have pused at minimum (Windows hosts may not expose total/used/free items)
        if (raw.pused === undefined) continue;
        const totalBytes = raw.total ?? 0;
        records.push({
          drive,
          totalBytes,
          usedBytes: raw.used ?? 0,
          freeBytes: raw.free ?? 0,
          usedPct: Math.round(raw.pused * 10) / 10,
        });
      }
      // Sort drives: root/system drives first, then alphabetically
      records.sort((a, b) => a.drive.localeCompare(b.drive));
      if (records.length > 0) drivesByHost.set(hostId, records);
    }

    // ── Build problem map: displayName -> problems ─────────────────────────
    const problemsByHost = new Map<string, ProblemRecord[]>();
    for (const p of problems) {
      const list = problemsByHost.get(p.hostName) ?? [];
      list.push(p);
      problemsByHost.set(p.hostName, list);
    }

    return hosts.map((h): HostRecord => {
      const isOnline =
        h.active_available === '1' ||
        (h.interfaces ?? []).some((i) => i.available === '1');

      const isOffline =
        !isOnline &&
        (h.active_available === '2' ||
          ((h.interfaces ?? []).length > 0 &&
            (h.interfaces ?? []).every((i) => i.available === '2')));

      const status: HostStatus = isOnline ? 'online' : isOffline ? 'offline' : 'unknown';

      const hostProblems = problemsByHost.get(h.name) ?? [];
      const hasCritical = hostProblems.some((p) => p.severity >= 4);
      const hasWarning = hostProblems.some((p) => p.severity >= 2 && p.severity < 4);

      const cpuRaw = cpuByHost.get(h.hostid);
      const cpuUtil = cpuRaw !== undefined ? Math.round(cpuRaw * 10) / 10 : undefined;

      const memRaw = memByHost.get(h.hostid);
      const memUtil = memRaw !== undefined ? Math.round(memRaw * 10) / 10 : undefined;

      const diskRaw = diskByHost.get(h.hostid);
      const diskUsedPct = diskRaw !== undefined ? Math.round(diskRaw * 10) / 10 : undefined;

      const rawTags = (h as ZabbixHost & { tags?: ZabbixTag[] }).tags;
      const tags: HostTag[] | undefined = rawTags && rawTags.length > 0
        ? rawTags.map((t) => ({ tag: t.tag, value: t.value }))
        : undefined;

      return {
        hostId: h.hostid,
        hostName: h.host,
        displayName: h.name,
        status,
        problemCount: hostProblems.length,
        hasCritical,
        hasWarning,
        cpuUtil,
        memUtil,
        swapUsedPct: swapByHost.get(h.hostid),
        diskUsedPct,
        uptime: uptimeByHost.get(h.hostid),
        drives: drivesByHost.get(h.hostid),
        networkInterfaces: netByHost.has(h.hostid) 
          ? Array.from(netByHost.get(h.hostid)!.values()) as NetworkInterface[] 
          : undefined,
        tags,
      };
    });
  }

  /**
   * Get enhanced details for a single host including network, groups, inventory, and maintenance.
   * This should be called on-demand for specific hosts to avoid performance issues.
   */
  async getHostDetailEnhanced(hostid: string, problems: ProblemRecord[]): Promise<HostRecord | null> {
    await this.ensureAuth();

    // Get basic host info
    const hosts = await this.call<ZabbixHost[]>('host.get', {
      output: ['hostid', 'host', 'name', 'active_available'],
      selectInterfaces: ['interfaceid', 'available'],
      hostids: [hostid],
    });

    if (hosts.length === 0) return null;
    const h = hosts[0];

    // Parallel fetch of all enhanced data
    const [cpuVal, memVal, swapVal, diskVal, driveData, networkIntf, groups, inv, maint] = await Promise.allSettled([
      // CPU
      this.call<ZabbixItem[]>('item.get', {
        output: ['itemid', 'lastvalue'],
        hostids: [hostid],
        search: { key_: 'system.cpu.util' },
      }),
      // Memory
      this.call<ZabbixItem[]>('item.get', {
        output: ['itemid', 'lastvalue'],
        hostids: [hostid],
        search: { key_: 'vm.memory.util' },
      }),
      // Swap
      this.call<ZabbixItem[]>('item.get', {
        output: ['itemid', 'lastvalue'],
        hostids: [hostid],
        search: { key_: 'system.swap.pfree' },
      }),
      // Disk used %
      this.call<ZabbixItem[]>('item.get', {
        output: ['itemid', 'key_', 'lastvalue'],
        hostids: [hostid],
        search: { key_: ['vfs.fs.size', 'vfs.fs.dependent.size'] },
        searchByAny: true,
      }),
      // Drives full breakdown
      this.call<ZabbixItem[]>('item.get', {
        output: ['itemid', 'key_', 'lastvalue'],
        hostids: [hostid],
        search: { key_: ['vfs.fs.size', 'vfs.fs.dependent.size'] },
        searchByAny: true,
      }),
      this.getNetworkInterfaces(hostid),
      this.getHostGroups(hostid),
      this.getHostInventory(hostid),
      this.getActiveMaintenance(hostid),
    ]);

    // Extract values, handling rejections gracefully
    const cpuItems = cpuVal.status === 'fulfilled' ? cpuVal.value : [];
    const memItems = memVal.status === 'fulfilled' ? memVal.value : [];
    const swapItems = swapVal.status === 'fulfilled' ? swapVal.value : [];
    const diskItems = diskVal.status === 'fulfilled' ? diskVal.value : [];
    const driveItems = driveData.status === 'fulfilled' ? driveData.value : [];
    const networkIfaces = networkIntf.status === 'fulfilled' ? networkIntf.value : [];
    const hostGroups = groups.status === 'fulfilled' ? groups.value : [];
    const hostInv = inv.status === 'fulfilled' ? inv.value : null;
    const hostMaint = maint.status === 'fulfilled' ? maint.value : null;

    // Parse metrics
    const cpuRaw = cpuItems[0] ? parseFloat(cpuItems[0].lastvalue) : undefined;
    const cpuUtil = cpuRaw !== undefined ? Math.round(cpuRaw * 10) / 10 : undefined;

    const memRaw = memItems[0] ? parseFloat(memItems[0].lastvalue) : undefined;
    const memUtil = memRaw !== undefined ? Math.round(memRaw * 10) / 10 : undefined;

    const swapRaw = swapItems[0] ? parseFloat(swapItems[0].lastvalue) : undefined;
    const swapUsedPct = swapRaw !== undefined ? Math.round(100 - swapRaw * 10) / 10 : undefined;

    // Parse disk used %
    let diskUsedPct: number | undefined;
    for (const item of diskItems) {
      if (item.key_.includes(',pused]')) {
        const v = parseFloat(item.lastvalue);
        if (!isNaN(v)) {
          diskUsedPct = Math.round(v * 10) / 10;
          break;
        }
      }
    }

    // Parse drives
    const driveKeyRe = /^vfs\.fs(?:\.dependent)?\.size\[([^\],]+),(total|used|free|pused)\]$/;
    type DriveRaw = { total?: number; used?: number; free?: number; pused?: number };
    const drivesMap = new Map<string, DriveRaw>();

    for (const item of driveItems) {
      const m = driveKeyRe.exec(item.key_);
      if (!m) continue;
      const [, drive, metric] = m;
      const v = parseFloat(item.lastvalue);
      if (isNaN(v)) continue;

      if (!drivesMap.has(drive)) drivesMap.set(drive, {});
      const raw = drivesMap.get(drive)!;

      if (metric === 'total') raw.total = v;
      else if (metric === 'used') raw.used = v;
      else if (metric === 'free') raw.free = v;
      else if (metric === 'pused') raw.pused = v;
    }

    const drives: DriveRecord[] = [];
    for (const [drive, raw] of drivesMap.entries()) {
      if (raw.pused === undefined) continue;
      drives.push({
        drive,
        totalBytes: raw.total ?? 0,
        usedBytes: raw.used ?? 0,
        freeBytes: raw.free ?? 0,
        usedPct: Math.round(raw.pused * 10) / 10,
      });
    }

    drives.sort((a, b) => a.drive.localeCompare(b.drive));

    // Build problem map for this host
    const hostProblems = problems.filter((p) => p.hostName === h.name);
    const hasCritical = hostProblems.some((p) => p.severity >= 4);
    const hasWarning = hostProblems.some((p) => p.severity >= 2 && p.severity < 4);

    const isOnline =
      h.active_available === '1' ||
      (h.interfaces ?? []).some((i) => i.available === '1');

    const isOffline =
      !isOnline &&
      (h.active_available === '2' ||
        ((h.interfaces ?? []).length > 0 &&
          (h.interfaces ?? []).every((i) => i.available === '2')));

    const status: HostStatus = isOnline ? 'online' : isOffline ? 'offline' : 'unknown';

    return {
      hostId: h.hostid,
      hostName: h.host,
      displayName: h.name,
      status,
      problemCount: hostProblems.length,
      hasCritical,
      hasWarning,
      cpuUtil,
      memUtil,
      swapUsedPct,
      diskUsedPct,
      drives: drives.length > 0 ? drives : undefined,
      networkInterfaces: networkIfaces.length > 0 ? networkIfaces : undefined,
      groups: hostGroups.length > 0 ? hostGroups : undefined,
      inventory: hostInv ?? undefined,
      maintenance: hostMaint,
    };
  }

  async getProblems(): Promise<ProblemRecord[]> {
    await this.ensureAuth();

    // Zabbix 7.x only permits sortfield: 'eventid' on problem.get.
    // Sorting by severity/clock is done in Node.js after the call.
    const rawProblems = await this.call<ZabbixProblem[]>('problem.get', {
      output: ['eventid', 'objectid', 'name', 'severity', 'clock', 'acknowledged'],
      selectAcknowledges: ['acknowledgeid', 'userid', 'clock', 'message', 'action'],
      limit: 200,
    });

    // Sort by severity desc, then by clock desc (most recent first within same severity).
    const problems = rawProblems
      .slice()
      .sort(
        (a, b) =>
          parseInt(b.severity, 10) - parseInt(a.severity, 10) ||
          parseInt(b.clock, 10) - parseInt(a.clock, 10),
      )
      .slice(0, 100);

    if (problems.length === 0) return [];

    // Resolve host names: problem.objectid is the trigger ID.
    // trigger.get with selectHosts is still supported in Zabbix 7.x.
    const triggerIds = [...new Set(problems.map((p) => p.objectid))];
    const triggers = await this.call<ZabbixTrigger[]>('trigger.get', {
      output: ['triggerid'],
      selectHosts: ['hostid', 'name'],
      triggerids: triggerIds,
    });

    const triggerHostMap = new Map(
      triggers.map((t) => [t.triggerid, t.hosts[0]?.name ?? 'Unknown']),
    );

    return problems.map((p) => {
      const ackUser = p.acknowledges?.[0];
      // Zabbix 7.x acknowledges don't include user name fields — use message if available
      const acknowledgedBy = ackUser?.message
        ? ackUser.message.slice(0, 40)
        : (ackUser ? `User #${ackUser.userid}` : undefined);

      return {
        eventId: p.eventid,
        hostName: triggerHostMap.get(p.objectid) ?? 'Unknown',
        description: p.name,
        severity: parseInt(p.severity, 10),
        severityLabel: severityLabel(parseInt(p.severity, 10)),
        clock: parseInt(p.clock, 10),
        acknowledged: p.acknowledged === '1',
        acknowledgedBy,
      };
    });
  }

  async getTopCPU(): Promise<TopHostRecord[]> {
    await this.ensureAuth();
    return this.fetchTopItems('system.cpu.util');
  }

  async getTopMemory(): Promise<TopHostRecord[]> {
    await this.ensureAuth();
    return this.fetchTopItems('vm.memory.util');
  }

  async getTopDisk(): Promise<TopHostRecord[]> {
    await this.ensureAuth();
    // Both classic (vfs.fs.size) and Zabbix 7 (vfs.fs.dependent.size) pused items
    // have a plain float lastvalue — fetchTopItems handles them identically.
    return this.fetchTopItems('vfs.fs', ',pused]');
  }

  /**
   * Fetch items matching a key pattern, resolve host names via host.get
   * (selectHosts is not supported by item.get in Zabbix 7.x), then sort
   * by lastvalue descending in Node.js and return the top N results.
   */
  private async fetchTopItems(keyPattern: string, keyMustContain?: string, invertValue = false): Promise<TopHostRecord[]> {
    // No searchWildcardsEnabled — default Zabbix search is a case-insensitive prefix match.
    let items = await this.call<ZabbixItem[]>('item.get', {
      output: ['itemid', 'hostid', 'key_', 'lastvalue', 'units'],
      search: { key_: keyPattern },
    });

    if (keyMustContain) {
      items = items.filter((i) => i.key_.includes(keyMustContain));
    }

    if (items.length === 0) return [];

    // Per host: keep one item (for multi-item keys like vfs.fs, pick worst).
    const bestByHost = new Map<string, ZabbixItem>();
    for (const item of items) {
      const cur = bestByHost.get(item.hostid);
      if (!cur || parseFloat(item.lastvalue) > parseFloat(cur.lastvalue)) {
        bestByHost.set(item.hostid, item);
      }
    }
    const deduped = [...bestByHost.values()];

    // Resolve host display names.
    const hostIds = deduped.map((i) => i.hostid);
    const hosts = await this.call<ZabbixHost[]>('host.get', {
      output: ['hostid', 'name'],
      hostids: hostIds,
    });
    const hostMap = new Map(hosts.map((h) => [h.hostid, h.name]));

    return deduped
      .slice()
      // When invertValue=true (pfree → pused), sort ascending so highest used% is first.
      .sort((a, b) => invertValue
        ? parseFloat(a.lastvalue) - parseFloat(b.lastvalue)
        : parseFloat(b.lastvalue) - parseFloat(a.lastvalue))
      .slice(0, TOP_N)
      .map((i) => {
        const raw = parseFloat(i.lastvalue);
        const display = invertValue ? Math.max(0, 100 - raw) : raw;
        return {
          hostId: i.hostid,
          hostName: hostMap.get(i.hostid) ?? 'Unknown',
          value: display.toFixed(1),
          unit: '%',
          itemKey: i.key_,
        };
      });
  }

  /**
   * Get network interface metrics for a host: bandwidth in/out, errors, dropped packets.
   */
  async getNetworkInterfaces(hostid: string): Promise<NetworkInterface[]> {
    await this.ensureAuth();

    logger.info(CTX, `Fetching network interfaces for host: ${hostid}`);

    // Fetch network interface objects
    const interfaces = await this.call<ZabbixNetworkInterface[]>('hostinterface.get', {
      output: ['interfaceid', 'ip', 'port', 'type', 'available'],
      hostids: [hostid],
    });

    logger.info(CTX, `Found ${interfaces.length} network interfaces`);

    if (interfaces.length === 0) return [];

    // Map interface types to names
    const typeMap: Record<string, string> = {
      '1': 'Agent',
      '2': 'SNMP',
      '3': 'IPMI',
      '4': 'JMX',
    };

    // Fetch network metrics for all interfaces
    const [inBpsItems, outBpsItems, inErrorsItems, outErrorsItems, inDroppedItems, outDroppedItems] = await Promise.all([
      this.call<ZabbixItem[]>('item.get', {
        output: ['itemid', 'key_', 'lastvalue'],
        hostids: [hostid],
        search: { key_: 'net.if.in[' },
      }),
      this.call<ZabbixItem[]>('item.get', {
        output: ['itemid', 'key_', 'lastvalue'],
        hostids: [hostid],
        search: { key_: 'net.if.out[' },
      }),
      this.call<ZabbixItem[]>('item.get', {
        output: ['itemid', 'key_', 'lastvalue'],
        hostids: [hostid],
        search: { key_: 'net.if.inerror[' },
      }),
      this.call<ZabbixItem[]>('item.get', {
        output: ['itemid', 'key_', 'lastvalue'],
        hostids: [hostid],
        search: { key_: 'net.if.outerror[' },
      }),
      this.call<ZabbixItem[]>('item.get', {
        output: ['itemid', 'key_', 'lastvalue'],
        hostids: [hostid],
        search: { key_: 'net.if.indrop[' },
      }),
      this.call<ZabbixItem[]>('item.get', {
        output: ['itemid', 'key_', 'lastvalue'],
        hostids: [hostid],
        search: { key_: 'net.if.outdrop[' },
      }),
    ]);

    // Parse interface name from key: "net.if.in[eth0]"
    const parseIntfName = (key: string, metric: string): string | null => {
      const match = new RegExp(`net\\.if\\.${metric}\\[([^\\]]+)\\]`).exec(key);
      return match ? match[1] : null;
    };

    // Build metrics map by interface name
    const metricsByName = new Map<string, Partial<NetworkInterface>>();

    for (const item of inBpsItems) {
      const name = parseIntfName(item.key_, 'in');
      if (name) {
        const existing = metricsByName.get(name) || { interfaceName: name };
        existing.inBps = Math.round(parseFloat(item.lastvalue));
        metricsByName.set(name, existing);
      }
    }

    for (const item of outBpsItems) {
      const name = parseIntfName(item.key_, 'out');
      if (name) {
        const existing = metricsByName.get(name) || { interfaceName: name };
        existing.outBps = Math.round(parseFloat(item.lastvalue));
        metricsByName.set(name, existing);
      }
    }

    for (const item of inErrorsItems) {
      const name = parseIntfName(item.key_, 'inerror');
      if (name) {
        const existing = metricsByName.get(name) || { interfaceName: name };
        existing.inErrors = Math.round(parseFloat(item.lastvalue));
        metricsByName.set(name, existing);
      }
    }

    for (const item of outErrorsItems) {
      const name = parseIntfName(item.key_, 'outerror');
      if (name) {
        const existing = metricsByName.get(name) || { interfaceName: name };
        existing.outErrors = Math.round(parseFloat(item.lastvalue));
        metricsByName.set(name, existing);
      }
    }

    for (const item of inDroppedItems) {
      const name = parseIntfName(item.key_, 'indrop');
      if (name) {
        const existing = metricsByName.get(name) || { interfaceName: name };
        existing.inDropped = Math.round(parseFloat(item.lastvalue));
        metricsByName.set(name, existing);
      }
    }

    for (const item of outDroppedItems) {
      const name = parseIntfName(item.key_, 'outdrop');
      if (name) {
        const existing = metricsByName.get(name) || { interfaceName: name };
        existing.outDropped = Math.round(parseFloat(item.lastvalue));
        metricsByName.set(name, existing);
      }
    }

    return interfaces.map((iface): NetworkInterface => {
      const ifName = iface.ip || `${typeMap[iface.type] ?? 'Unknown'}`;
      const metrics = metricsByName.get(ifName) || { interfaceName: ifName };
      
      return {
        interfaceId: iface.interfaceid,
        interfaceName: metrics.interfaceName || ifName,
        status: iface.available === '1' ? 'up' : iface.available === '2' ? 'down' : 'unknown',
        inBps: metrics.inBps,
        outBps: metrics.outBps,
        inErrors: metrics.inErrors,
        outErrors: metrics.outErrors,
        inDropped: metrics.inDropped,
        outDropped: metrics.outDropped,
      };
    });
  }

  /**
   * Get host groups for a specific host.
   */
  async getHostGroups(hostid: string): Promise<HostGroup[]> {
    await this.ensureAuth();

    logger.info(CTX, `Fetching host groups for host: ${hostid}`);

    // Use host.get with selectGroups to get groups for a specific host
    const hosts = await this.call<Array<{ hostid: string; groups: ZabbixHostGroup[] }>>('host.get', {
      output: ['hostid'],
      selectGroups: ['groupid', 'name'],
      hostids: [hostid],
    });

    if (hosts.length === 0) {
      logger.info(CTX, `No host found for ID: ${hostid}`);
      return [];
    }

    const groups = hosts[0].groups || [];
    logger.info(CTX, `Found ${groups.length} host groups`);

    return groups.map((g) => ({
      groupId: g.groupid,
      groupName: g.name,
    }));
  }

  /**
   * Get host inventory data (hardware, OS, serial, RAM, etc.).
   */
async getHostInventory(hostid: string): Promise<any | null> { // Interface error se bachne ke liye 'any' use karein
    await this.ensureAuth();

    logger.info(CTX, `Fetching host inventory for host: ${hostid}`);

    try {
      const hosts = await this.call<Array<{ 
        hostid: string; 
        inventory: ZabbixHostInventory;
        interfaces: any[]; 
      }>>(
        'host.get',
        {
          output: ['hostid'],
          selectInventory: 'extend',
          selectInterfaces: ['ip'], 
          hostids: [hostid],
        },
      );

      if (hosts.length === 0 || !hosts[0].inventory) {
        logger.info(CTX, `No inventory data found for host: ${hostid}`);
        return null;
      }

      const inv = hosts[0].inventory;
      const mainIp = hosts[0].interfaces?.[0]?.ip || inv.software_d || "N/A";

      // --- UPDATED RESULT OBJECT ---
      const result = {
        // 1. OS Name fix: inv.software ko pehle rakha taaki "Windows 10 Pro" aaye
        osName: inv.software || inv.os_short || "N/A", 
        osVersion: inv.os_full || "N/A",

        hardwareManufacturer: inv.vendor || inv.manufacturer || "Generic Hardware",

        // 2. Processor detail (Intel i5...)
        processor: inv.hardware || "N/A", 

        // 3. Hardware Model fix: 'inv.model' add kiya taaki terminal ka "N/A" khatam ho
        hardwareModel: inv.model_number || inv.model || "N/A",

        serialNumber: inv.serialno_a || inv.serialno_b || "N/A",
        
        // 4. CPU Cores fix: cpu_count bhi check karein
        cpuCores: (inv.cpu_cores || inv.cpu_count) ? parseInt(inv.cpu_cores || inv.cpu_count || '0', 10) : undefined,
        
        ram: inv.hardware_full || "N/A", 
        macAddress: inv.macaddress_a || "N/A", 
        ipAddress: mainIp, 

        softwareBasic: inv.software,
        softwareFull: inv.software_full, 
        softwareA: inv.software_a,
        softwareB: inv.software_b,
        softwareC: inv.software_c,
        softwareD: inv.software_d,
        softwareE: inv.software_e,
      };

      logger.info(CTX, `Got inventory with IP: ${result.ipAddress}`);
      return result;

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      logger.warn(CTX, `Failed to get inventory data: ${errorMsg}`);
      return null;
    }
}

  /**
   * Get recent events from the last 24 hours.
   */
  async getRecentEvents(): Promise<EventRecord[]> {
    await this.ensureAuth();

    const timeFrom = Math.floor(Date.now() / 1000) - 86400; // last 24h

    let rawEvents: ZabbixEvent[] = [];
    try {
      rawEvents = await this.call<ZabbixEvent[]>('event.get', {
        output: ['eventid', 'objectid', 'name', 'severity', 'clock', 'acknowledged'],
        source: 0,       // trigger events
        object: 0,       // trigger
        value: 1,        // problem state
        time_from: timeFrom,
        limit: 500,
        sortfield: 'clock',
        sortorder: 'DESC',
      });
    } catch (err) {
      logger.warn(CTX, `getRecentEvents failed: ${err instanceof Error ? err.message : err}`);
      return [];
    }

    if (rawEvents.length === 0) return [];

    // Resolve trigger IDs → host names
    const triggerIds = [...new Set(rawEvents.map((e) => e.objectid))];
    let triggers: ZabbixTrigger[] = [];
    try {
      triggers = await this.call<ZabbixTrigger[]>('trigger.get', {
        output: ['triggerid'],
        selectHosts: ['hostid', 'name'],
        triggerids: triggerIds,
      });
    } catch {
      // proceed without host names
    }

    const triggerHostMap = new Map(
      triggers.map((t) => [t.triggerid, t.hosts[0]?.name ?? 'Unknown']),
    );

    return rawEvents.map((e) => ({
      eventId: e.eventid,
      hostName: triggerHostMap.get(e.objectid) ?? 'Unknown',
      name: e.name,
      severity: parseInt(e.severity, 10),
      severityLabel: severityLabel(parseInt(e.severity, 10)),
      clock: parseInt(e.clock, 10),
      acknowledged: e.acknowledged === '1',
    }));
  }

  /**
   * Get proxy status list.
   */
  async getProxies(): Promise<ProxyRecord[]> {
    await this.ensureAuth();

    try {
      const proxies = await this.call<ZabbixProxy[]>('proxy.get', {
        output: ['proxyid', 'name', 'operating_mode', 'lastaccess', 'state'],
        selectHosts: ['hostid'],
      });

      const modeMap: Record<string, string> = {
        '0': 'active',
        '1': 'passive',
      };

      return proxies.map((p) => ({
        proxyId: p.proxyid,
        name: p.name,
        status: modeMap[p.operating_mode] ?? 'unknown',
        lastAccess: parseInt(p.lastaccess, 10),
        hostsCount: p.hosts?.length ?? 0,
      }));
    } catch (err) {
      logger.warn(CTX, `getProxies failed: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  /**
   * Get metric history for a single host item over the last N hours.
   * item: 'cpu' | 'memory' | 'disk' | 'net_in' | 'net_out'
   */
  async getHostMetricHistory(
    hostid: string,
    metric: 'cpu' | 'memory' | 'disk' | 'net_in' | 'net_out',
    hours = 24,
  ): Promise<Array<{ clock: number; value: number }>> {
    await this.ensureAuth();

    const keyMap: Record<string, string> = {
      cpu:     'system.cpu.util',
      memory:  'vm.memory.util',
      disk:    'vfs.fs',
      net_in:  'net.if.in[',
      net_out: 'net.if.out[',
    };

    const keyPattern = keyMap[metric];
    const timeFrom = Math.floor(Date.now() / 1000) - hours * 3600;

    try {
      // Find the item ID first
      let items = await this.call<ZabbixItem[]>('item.get', {
        output: ['itemid', 'key_', 'lastvalue'],
        hostids: [hostid],
        search: { key_: keyPattern },
      });

      if (metric === 'disk') {
        items = items.filter((i) => i.key_.includes(',pused]'));
      }

      if (items.length === 0) return [];

      // For disk/net, pick the item with highest lastvalue (worst/busiest)
      items.sort((a, b) => parseFloat(b.lastvalue) - parseFloat(a.lastvalue));
      const item = items[0];

      const history = await this.call<ZabbixHistoryPoint[]>('history.get', {
        output: 'extend',
        history: 0,  // float type
        itemids: [item.itemid],
        time_from: timeFrom,
        limit: 1000,
        sortfield: 'clock',
        sortorder: 'ASC',
      });

      return history.map((h) => ({
        clock: parseInt(h.clock, 10),
        value: Math.round(parseFloat(h.value) * 10) / 10,
      }));
    } catch (err) {
      logger.warn(CTX, `getHostMetricHistory(${hostid}, ${metric}) failed: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  /**
   * Get active maintenance windows for a host.
   */
  async getActiveMaintenance(hostid: string): Promise<MaintenanceRecord | null> {
    await this.ensureAuth();

    logger.info(CTX, `Fetching maintenance windows for host: ${hostid}`);

    const maintenances = await this.call<ZabbixMaintenance[]>('maintenance.get', {
      output: ['maintenanceid', 'name', 'description', 'start_time', 'active_since', 'active_till', 'active'],
      hostids: [hostid],
      selectHosts: ['hostid'],
    });

    logger.info(CTX, `Found ${maintenances.length} maintenance windows`);

    if (maintenances.length === 0) return null;

    // Find the most recent active maintenance (highest active_since)
    const now = Math.floor(Date.now() / 1000);
    const active = maintenances.find(
      (m) => parseInt(m.active, 10) === 1 || (parseInt(m.active_since, 10) <= now && now <= parseInt(m.active_till, 10))
    );

    if (!active) {
      logger.info(CTX, `No active maintenance window for host: ${hostid}`);
      return null;
    }

    const result = {
      maintenanceId: active.maintenanceid,
      maintenanceName: active.name,
      description: active.description,
      startTime: parseInt(active.active_since, 10),
      endTime: parseInt(active.active_till, 10),
      active: parseInt(active.active, 10) === 1,
    };

    logger.info(CTX, `Active maintenance: ${result.maintenanceName}`);
    return result;
  }

}

// Export a singleton instance
export const zabbixService = new ZabbixService();

