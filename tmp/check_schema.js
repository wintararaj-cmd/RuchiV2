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
    const res = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'orders'
    `);
    console.log(JSON.stringify(res.rows, null, 2));
    await client.end();
}
run();
