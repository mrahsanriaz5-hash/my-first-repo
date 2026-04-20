import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// ─────────────────────────────────────────────────────────────────────────────
//  MonitorSnapshot – one aggregated row written after every successful sync.
//
//  Design rules:
//   • Never stores raw Zabbix metrics or individual host records.
//   • One row per sync cycle – gives us a time-series of infrastructure health.
//   • 'critical'  → problems with severity ≥ 4 (High + Disaster)
//   • 'warning'   → problems with severity 2–3 (Warning + Average)
// ─────────────────────────────────────────────────────────────────────────────

@Entity('monitor_snapshots')
export class MonitorSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_monitor_snapshots_created_at')
  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @Column({ name: 'total_hosts', type: 'int' })
  totalHosts!: number;

  @Column({ type: 'int' })
  online!: number;

  @Column({ type: 'int' })
  offline!: number;

  /** Count of active problems with Zabbix severity ≥ 4 (High / Disaster). */
  @Column({ type: 'int' })
  critical!: number;

  /** Count of active problems with Zabbix severity 2–3 (Warning / Average). */
  @Column({ type: 'int' })
  warning!: number;
}

