
const pg = require("pg");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || "postgresql://postgres:postgres@localhost:5433/postgres",
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
