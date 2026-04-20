import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from '../config/env';
import { MonitorSnapshot } from '../entities/MonitorSnapshot.entity';
import { CreateMonitorSnapshots1700000000000 } from './migrations/1700000000000-CreateMonitorSnapshots';

// ─────────────────────────────────────────────────────────────────────────────
//  AppDataSource – central TypeORM DataSource (singleton).
//
//  • type: 'mysql'        → uses mysql2 driver (never the deprecated mysql driver).
//  • synchronize: false   → schema is NEVER auto-modified at runtime (safe for prod).
//  • migrationsRun: true  → pending migrations are applied automatically on startup.
//  • Entities/migrations imported directly (no glob) for reliable bundling.
// ─────────────────────────────────────────────────────────────────────────────

export const AppDataSource = new DataSource({
  type: 'mysql',

  host:     env.dbHost,
  port:     env.dbPort,
  username: env.dbUser,
  password: env.dbPassword,
  database: env.dbName,

  // Safety: never auto-alter schema – migrations govern all DDL changes.
  synchronize: false,

  // Run pending migrations automatically when the DataSource is initialized.
  migrationsRun: true,

  // Emit SQL in development for visibility; only errors + migration logs in prod.
  logging: process.env['NODE_ENV'] === 'development'
    ? ['query', 'error', 'migration']
    : ['error', 'migration'],

  entities: [MonitorSnapshot],

  migrations: [CreateMonitorSnapshots1700000000000],

  // mysql2 connection pool tuning – conservative defaults for Phase 1.
  extra: {
    connectionLimit:    10,
    connectTimeout:     10_000,
    waitForConnections: true,
    queueLimit:         0,
  },
});

