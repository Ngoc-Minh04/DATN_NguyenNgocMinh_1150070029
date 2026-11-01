import pg from 'pg';
import { ENV } from './env.js';

const { Pool } = pg;

export const dbPool = new Pool({
  host: ENV.PG_HOST,
  port: ENV.PG_PORT,
  user: ENV.PG_USER,
  password: ENV.PG_PASSWORD,
  database: ENV.PG_DATABASE,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

dbPool.on('error', (err) => {
  console.error('[PostgreSQL Error] Unexpected error on idle client:', err.message);
});

export async function testDbConnection(): Promise<boolean> {
  try {
    const client = await dbPool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    client.release();
    console.log(`[PostgreSQL Connected] Server time: ${result.rows[0].current_time}`);
    return true;
  } catch (error: any) {
    console.warn(`[PostgreSQL Connection Warning] Unable to connect: ${error.message}`);
    return false;
  }
}
