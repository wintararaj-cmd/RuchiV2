const { Client } = require('pg');
const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'restaurant_db',
    user: 'postgres',
    password: 'Root123',
});

async function run() {
    await client.connect();
    try {
        console.log('Adding customer_lat, customer_lng, and distance columns to orders table...');
        await client.query(`
            ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS customer_lat NUMERIC,
            ADD COLUMN IF NOT EXISTS customer_lng NUMERIC,
            ADD COLUMN IF NOT EXISTS distance NUMERIC;
        `);
        console.log('Columns added successfully.');
    } catch (err) {
        console.error('Error migrating table:', err);
    } finally {
        await client.end();
    }
}
run();
