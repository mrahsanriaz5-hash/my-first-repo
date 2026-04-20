import { MoreThanOrEqual } from 'typeorm';
import { AppDataSource } from '../database/data-source';
import { MonitorSnapshot } from '../entities/MonitorSnapshot.entity';

// ─────────────────────────────────────────────────────────────────────────────
//  Public interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface SnapshotInsertData {
  totalHosts: number;
  online: number;
  offline: number;
  critical: number;
  warning: number;
}

export interface TrendPoint {
  id: string;
  createdAt: string;  // ISO-8601
  totalHosts: number;
  online: number;
  offline: number;
  critical: number;
  warning: number;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SnapshotRepository
//
//  Thin wrapper around TypeORM repository.
//  • Provides a stable interface to the rest of the application.
//  • Hides TypeORM internals – easy to swap/mock in tests.
//  • Lazy repo getter → safe to import before DataSource is initialized.
// ─────────────────────────────────────────────────────────────────────────────

class SnapshotRepository {
  private get repo() {
    return AppDataSource.getRepository(MonitorSnapshot);
  }

  /**
   * Persist one aggregated monitoring snapshot.
   * Caller must handle errors (or allow them to propagate).
   */
  async insertSnapshot(data: SnapshotInsertData): Promise<void> {
    await this.repo.insert({
      totalHosts: data.totalHosts,
      online: data.online,
      offline: data.offline,
      critical: data.critical,
      warning: data.warning,
    });
  }

  /**
   * Return all snapshots whose createdAt >= since, ordered ascending.
   * Used to build time-series trend responses.
   */
  async findByRange(since: Date): Promise<TrendPoint[]> {
    const rows = await this.repo.find({
      where: { createdAt: MoreThanOrEqual(since) },
      order: { createdAt: 'ASC' },
      select: {
        id: true,
        createdAt: true,
        totalHosts: true,
        online: true,
        offline: true,
        critical: true,
        warning: true,
      },
    });

    return rows.map((row) => {
      // MySQL driver may return datetime as string or Date – handle both
      const createdAt = row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : new Date(row.createdAt).toISOString();

      return {
        id: row.id,
        createdAt,
        totalHosts: row.totalHosts,
        online: row.online,
        offline: row.offline,
        critical: row.critical,
        warning: row.warning,
      };
    });
  }
}

// Export a singleton – AppDataSource is initialized before any method is called.
export const snapshotRepository = new SnapshotRepository();

