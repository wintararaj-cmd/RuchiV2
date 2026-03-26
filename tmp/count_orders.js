require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function test() {
    let pool;
    try {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') ? { rejectUnauthorized: false } : false
        });
        const res = await pool.query('SELECT COUNT(*) FROM orders');
        console.log('Order count:', res.rows[0].count);
    } catch (err) {
        console.error(err);
    } finally {
        if (pool) await pool.end();
    }
}

test();
