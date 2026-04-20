import dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`[Config] Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  // Zabbix
  zabbixUrl:      requireEnv('ZABBIX_URL'),
  zabbixUsername: requireEnv('ZABBIX_USERNAME'),
  zabbixPassword: requireEnv('ZABBIX_PASSWORD'),

  // MySQL
  dbHost:     requireEnv('DB_HOST'),
  dbPort:     parseInt(process.env['DB_PORT'] ?? '3306', 10),
  dbUser:     requireEnv('DB_USER'),
  dbPassword: requireEnv('DB_PASSWORD'),
  dbName:     requireEnv('DB_NAME'),

  // HTTP
  port: parseInt(process.env['PORT'] ?? '5151', 10),
} as const;

