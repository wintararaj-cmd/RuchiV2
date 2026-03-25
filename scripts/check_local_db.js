const { Client } = require('pg');

const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'restaurant_db',
    password: 'Root123',
    port: 5432,
});

async function checkData() {
    try {
        await client.connect();
        const res = await client.query('SELECT id, location_name, delivery_charge, latitude, longitude, radius_km, min_radius_km, is_active FROM delivery_locations');
        console.table(res.rows);
    } catch (err) {
        console.error('Error fetching data:', err.message);
    } finally {
        await client.end();
    }
}

checkData();
