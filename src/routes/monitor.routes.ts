import { Router, Request, Response } from 'express';
import { cacheStore } from '../store/cache.store';
import { snapshotRepository } from '../repositories/snapshot.repository';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok<T>(res: Response, data: T): void {
  res.status(200).json({ success: true, data });
}

function notReady(res: Response): void {
  res.status(503).json({
    success: false,
    message: 'Data not yet available – sync is still running. Please retry shortly.',
  });
}

// ─── GET /api/health ─────────────────────────────────────────────────────────

router.get('/health', (_req: Request, res: Response) => {
  const { lastSync, zabbixReachable } = cacheStore.getState();

  res.status(200).json({
    success: true,
    data: {
      server: 'running',
      zabbixReachable,
      lastSync: lastSync ? lastSync.toISOString() : null,
      uptime: `${Math.floor(process.uptime())}s`,
    },
  });
});

// ─── GET /api/summary ────────────────────────────────────────────────────────

router.get('/summary', (_req: Request, res: Response) => {
  const { summary, lastSync } = cacheStore.getState();

  if (!summary || !lastSync) {
    notReady(res);
    return;
  }

  ok(res, {
    ...summary,
    lastSync: lastSync.toISOString(),
  });
});

// ─── GET /api/problems ───────────────────────────────────────────────────────

router.get('/problems', (req: Request, res: Response) => {
  const { problems, lastSync } = cacheStore.getState();

  if (!lastSync) {
    notReady(res);
    return;
  }

  // Optional severity filter: /api/problems?severity=4
  const severityFilter = req.query['severity'];
  const filtered =
    severityFilter !== undefined
      ? problems.filter((p) => p.severity === parseInt(severityFilter as string, 10))
      : problems;

  ok(res, {
    total: filtered.length,
    problems: filtered,
    lastSync: lastSync.toISOString(),
  });
});

// ─── GET /api/top/cpu ────────────────────────────────────────────────────────

router.get('/top/cpu', (_req: Request, res: Response) => {
  const { topCpu, lastSync } = cacheStore.getState();

  if (!lastSync) {
    notReady(res);
    return;
  }

  ok(res, {
    hosts: topCpu,
    lastSync: lastSync.toISOString(),
  });
});

// ─── GET /api/top/memory ─────────────────────────────────────────────────────

router.get('/top/memory', (_req: Request, res: Response) => {
  const { topMemory, lastSync } = cacheStore.getState();

  if (!lastSync) {
    notReady(res);
    return;
  }

  ok(res, {
    hosts: topMemory,
    lastSync: lastSync.toISOString(),
  });
});

// ─── GET /api/top/disk ───────────────────────────────────────────────────────

router.get('/top/disk', (_req: Request, res: Response) => {
  const { topDisk, lastSync } = cacheStore.getState();

  if (!lastSync) {
    notReady(res);
    return;
  }

  ok(res, {
    hosts: topDisk,
    lastSync: lastSync.toISOString(),
  });
});

// ─── GET /api/hosts ──────────────────────────────────────────────────────────

router.get('/hosts', (_req: Request, res: Response) => {
  const { hosts, lastSync } = cacheStore.getState();

  if (!lastSync) {
    notReady(res);
    return;
  }

  ok(res, { total: hosts.length, hosts, lastSync: lastSync.toISOString() });
});

// ─── GET /api/host/:hostid/enhanced ──────────────────────────────────────────
//
//  Returns detailed information for a specific host including network interfaces,
//  host groups, inventory data, and active maintenance windows.

router.get('/host/:hostid/enhanced', async (req: Request, res: Response) => {
  const { hostid } = req.params;
  const { problems, lastSync } = cacheStore.getState();

  if (!lastSync) {
    notReady(res);
    return;
  }

  try {
    console.log(`[Routes] Fetching enhanced host details for: ${hostid}`);
    const { zabbixService } = await import('../services/zabbix.service');
    const hostDetail = await zabbixService.getHostDetailEnhanced(hostid, problems);

    if (!hostDetail) {
      res.status(404).json({
        success: false,
        message: `Host with ID "${hostid}" not found.`,
      });
      return;
    }

    ok(res, hostDetail);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Routes] Error fetching host details:`, errorMsg);
    res.status(500).json({
      success: false,
      message: `Failed to retrieve host details: ${errorMsg}`,
    });
  }
});

// ─── GET /api/host/:hostid/network ──────────────────────────────────────────

router.get('/host/:hostid/network', async (req: Request, res: Response) => {
  const { hostid } = req.params;

  try {
    console.log(`[Routes] Fetching network interfaces for: ${hostid}`);
    const { zabbixService } = await import('../services/zabbix.service');
    const interfaces = await zabbixService.getNetworkInterfaces(hostid);

    console.log(`[Routes] Got ${interfaces.length} network interfaces`);
    ok(res, {
      hostid,
      networkInterfaces: interfaces,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Routes] Error fetching network interfaces:`, errorMsg);
    res.status(500).json({
      success: false,
      message: `Failed to retrieve network interfaces: ${errorMsg}`,
    });
  }
});

// ─── GET /api/host/:hostid/groups ───────────────────────────────────────────

router.get('/host/:hostid/groups', async (req: Request, res: Response) => {
  const { hostid } = req.params;

  try {
    console.log(`[Routes] Fetching host groups for: ${hostid}`);
    const { zabbixService } = await import('../services/zabbix.service');
    const groups = await zabbixService.getHostGroups(hostid);

    console.log(`[Routes] Got ${groups.length} host groups`);
    ok(res, {
      hostid,
      groups,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Routes] Error fetching host groups:`, errorMsg);
    res.status(500).json({
      success: false,
      message: `Failed to retrieve host groups: ${errorMsg}`,
    });
  }
});

// ─── GET /api/host/:hostid/inventory ────────────────────────────────────────

router.get('/host/:hostid/inventory', async (req: Request, res: Response) => {
  const { hostid } = req.params;

  try {
    console.log(`[Routes] Fetching host inventory for: ${hostid}`);
    const { zabbixService } = await import('../services/zabbix.service');
    const inventory = await zabbixService.getHostInventory(hostid);

    console.log(`[Routes] Got inventory:`, inventory);
    ok(res, {
      hostid,
      inventory,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Routes] Error fetching host inventory:`, errorMsg);
    // Return 200 with null inventory instead of 500 - inventory is optional
    ok(res, {
      hostid,
      inventory: null,
    });
  }
});

// ─── GET /api/host/:hostid/maintenance ──────────────────────────────────────

router.get('/host/:hostid/maintenance', async (req: Request, res: Response) => {
  const { hostid } = req.params;

  try {
    console.log(`[Routes] Fetching maintenance for: ${hostid}`);
    const { zabbixService } = await import('../services/zabbix.service');
    const maintenance = await zabbixService.getActiveMaintenance(hostid);

    console.log(`[Routes] Got maintenance:`, maintenance);
    ok(res, {
      hostid,
      maintenance,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Routes] Error fetching maintenance:`, errorMsg);
    res.status(500).json({
      success: false,
      message: `Failed to retrieve maintenance information: ${errorMsg}`,
    });
  }
});

// ─── GET /api/events ─────────────────────────────────────────────────────────

router.get('/events', (_req: Request, res: Response) => {
  const { events, lastSync } = cacheStore.getState();

  if (!lastSync) {
    notReady(res);
    return;
  }

  ok(res, {
    total: events.length,
    events,
    lastSync: lastSync.toISOString(),
  });
});

// ─── GET /api/proxies ─────────────────────────────────────────────────────────

router.get('/proxies', (_req: Request, res: Response) => {
  const { proxies, lastSync } = cacheStore.getState();

  if (!lastSync) {
    notReady(res);
    return;
  }

  ok(res, {
    total: proxies.length,
    proxies,
    lastSync: lastSync.toISOString(),
  });
});

// ─── GET /api/host/:hostid/history ────────────────────────────────────────────
//
//  Query params:
//    item   → 'cpu' | 'memory' | 'disk' | 'net_in' | 'net_out' (default 'cpu')
//    hours  → 1–168 (default 24)

router.get('/host/:hostid/history', async (req: Request, res: Response) => {
  const { hostid } = req.params;
  const itemParam = typeof req.query['item'] === 'string' ? req.query['item'] : 'cpu';
  const hoursParam = typeof req.query['hours'] === 'string' ? parseInt(req.query['hours'], 10) : 24;

  const validItems = ['cpu', 'memory', 'disk', 'net_in', 'net_out'];
  if (!validItems.includes(itemParam)) {
    res.status(400).json({ success: false, message: `Invalid item "${itemParam}". Supported: ${validItems.join(', ')}` });
    return;
  }

  const hours = isNaN(hoursParam) || hoursParam < 1 ? 24 : Math.min(hoursParam, 168);

  try {
    const { zabbixService } = await import('../services/zabbix.service');
    const points = await zabbixService.getHostMetricHistory(
      hostid,
      itemParam as 'cpu' | 'memory' | 'disk' | 'net_in' | 'net_out',
      hours,
    );

    ok(res, { hostid, item: itemParam, hours, points });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, message: `Failed to retrieve metric history: ${errorMsg}` });
  }
});

// ─── GET /api/trend ──────────────────────────────────────────────────────────
//
//  Query params:
//    range  →  '1d' | '7d' (default) | '30d'
//
//  Returns a time-ordered array of aggregated monitoring snapshots stored in
//  PostgreSQL, giving callers a historical view of infrastructure health.

const RANGE_DAYS: Record<string, number> = {
  '1d':  1,
  '7d':  7,
  '30d': 30,
};

router.get('/trend', async (req: Request, res: Response) => {
  const rangeParam = typeof req.query['range'] === 'string'
    ? req.query['range']
    : '7d';

  const days = RANGE_DAYS[rangeParam];
  if (days === undefined) {
    res.status(400).json({
      success: false,
      message: `Invalid range "${rangeParam}". Supported values: 1d, 7d, 30d.`,
    });
    return;
  }

  try {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const points = await snapshotRepository.findByRange(since);

    ok(res, { range: rangeParam, points });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve trend data. Database may be unavailable.',
    });
  }
});


export { router as monitorRoutes };

