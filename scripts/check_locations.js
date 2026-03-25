const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

async function checkData() {
    if (!connectionString) return;
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query('SELECT id, location_name, delivery_charge, latitude, longitude, radius_km, min_radius_km FROM delivery_locations ORDER BY id DESC');
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkData();
