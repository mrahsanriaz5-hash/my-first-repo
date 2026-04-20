import cron from 'node-cron';
import { zabbixService } from '../services/zabbix.service';
import { cacheStore } from '../store/cache.store';
import { snapshotRepository } from '../repositories/snapshot.repository';
import { logger } from '../utils/logger';

const CTX = 'SyncJob';

export async function runSync(): Promise<void> {
  logger.info(CTX, 'Starting sync cycle…');

  try {
    // Run all independent fetches concurrently for speed
    const [summary, problems, topCpu, topMemory, topDisk, events, proxies] = await Promise.all([
      zabbixService.getHosts(),
      zabbixService.getProblems(),
      zabbixService.getTopCPU(),
      zabbixService.getTopMemory(),
      zabbixService.getTopDisk(),
      zabbixService.getRecentEvents(),
      zabbixService.getProxies(),
    ]);

    const critical = problems.filter((p) => p.severity >= 4).length;
    const warning  = problems.filter((p) => p.severity >= 2 && p.severity < 4).length;

    // Fetch per-host detail — needs problems already resolved for cross-referencing
    const hosts = await zabbixService.getHostsDetail(problems);

    // ── 1. Update in-memory cache ──────────────────────────────────────────
    cacheStore.setSummary({ ...summary, critical, warning });
    cacheStore.setProblems(problems);
    cacheStore.setTopCpu(topCpu);
    cacheStore.setTopMemory(topMemory);
    cacheStore.setTopDisk(topDisk);
    cacheStore.setHosts(hosts);
    cacheStore.setEvents(events);
    cacheStore.setProxies(proxies);
    cacheStore.markSynced(true);

    logger.info(
      CTX,
      `Sync complete – hosts: ${summary.total} | online: ${summary.online} | ` +
        `problems: ${problems.length} | critical: ${critical} | warning: ${warning} | ` +
        `events: ${events.length} | proxies: ${proxies.length}`,
    );

    // ── 2. Persist aggregated snapshot to DB ──────────────────────────────
    try {
      await snapshotRepository.insertSnapshot({
        totalHosts: summary.total,
        online:     summary.online,
        offline:    summary.offline,
        critical,
        warning,
      });
    } catch (dbErr) {
      logger.error(CTX, 'DB snapshot write failed – continuing without persistence', dbErr);
    }
  } catch (err) {
    cacheStore.markSynced(false);
    logger.error(CTX, 'Sync failed', err);
  }
}

export function startSyncJob(): void {
  void runSync();
  cron.schedule('*/60 * * * * *', () => { void runSync(); });
  logger.info(CTX, 'Sync job scheduled – interval: 60 s');
}
