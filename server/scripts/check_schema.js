import path from "path";
import dotenv from "dotenv";
const __dirname = import.meta.dirname;
dotenv.config({ path: path.join(__dirname, "../.env") });

import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString:
    process.env.POSTGRES_URL ||
    "postgresql://postgres:postgres@localhost:5433/postgres",
});

(async () => {
  try {
    const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'server_logs';
        `);
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
})();
