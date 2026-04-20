// reflect-metadata must be the very first import for TypeORM decorators.
import 'reflect-metadata';

import { env } from './config/env';
import { AppDataSource } from './database/data-source';
import { createApp } from './app';
import { startSyncJob } from './jobs/sync.job';
import { logger } from './utils/logger';
import type { Server } from 'http';

const CTX = 'Server';

// ─────────────────────────────────────────────────────────────────────────────
//  Startup sequence (strict ordering):
//   1. Connect to MySQL + run pending migrations
//   2. Bind Express HTTP server
//   3. Launch background sync scheduler
// ─────────────────────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  // 1. Database
  logger.info(CTX, 'Connecting to MySQL…');
  await AppDataSource.initialize();
  logger.info(CTX, 'Database connected – migrations applied');

  // 2. HTTP server
  const app = createApp();

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(env.port, () => {
      logger.info(CTX, `InfraSpine Monitor listening on port ${env.port}`);
      logger.info(CTX, `Environment : ${process.env['NODE_ENV'] ?? 'development'}`);
      logger.info(CTX, `Zabbix      : ${env.zabbixUrl}`);
      resolve(s);
    });
  });

  // 3. Sync job (DB is guaranteed ready by this point)
  startSyncJob();

  // ── Graceful shutdown ────────────────────────────────────────────────────

  async function shutdown(signal: string): Promise<void> {
    logger.warn(CTX, `Received ${signal} – shutting down gracefully…`);

    // Stop accepting new HTTP connections
    server.close(async () => {
      logger.info(CTX, 'HTTP server closed');

      // Close database connection pool cleanly
      try {
        await AppDataSource.destroy();
        logger.info(CTX, 'Database disconnected');
      } catch (dbErr) {
        logger.error(CTX, 'Error closing database connection', dbErr);
      }

      process.exit(0);
    });

    // Hard kill if shutdown stalls
    setTimeout(() => {
      logger.error(CTX, 'Forced exit – shutdown timed out');
      process.exit(1);
    }, 10_000);
  }

  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT',  () => { void shutdown('SIGINT'); });
}

// ── Global error guards ───────────────────────────────────────────────────────

process.on('unhandledRejection', (reason) => {
  logger.error(
    CTX,
    'Unhandled promise rejection',
    reason instanceof Error ? reason : new Error(String(reason)),
  );
});

process.on('uncaughtException', (err) => {
  logger.error(CTX, 'Uncaught exception', err);
  process.exit(1);
});

// ── Start ─────────────────────────────────────────────────────────────────────

bootstrap().catch((err: unknown) => {
  logger.error(CTX, 'Fatal startup error', err);
  process.exit(1);
});

