const { Client } = require('pg');

async function runFix() {
    let clientConfig = {};

    if (process.env.DATABASE_URL) {
        clientConfig = {
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        };
    } else {
        clientConfig = {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'restaurant_db',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'Root123',
        };
    }

    const client = new Client(clientConfig);

    try {
        await client.connect();
        console.log('Connected to DB');

        // Check columns
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'delivery_locations' AND column_name = 'min_radius_km'
        `);

        if (res.rows.length === 0) {
            console.log('Adding min_radius_km column...');
            await client.query(`
                ALTER TABLE delivery_locations 
                ADD COLUMN min_radius_km DECIMAL(5,2) DEFAULT 0.00
            `);
            console.log('Column added!');
        } else {
            console.log('Column min_radius_km already exists.');
        }

        // Check if we need to remove the unique constraint
        const constraintRes = await client.query(`
            SELECT conname 
            FROM pg_constraint 
            WHERE conrelid = 'delivery_locations'::regclass 
            AND contype = 'u' 
            AND conname LIKE '%location_name%'
        `);

        if (constraintRes.rows.length > 0) {
            console.log('Removing unique constraint on location_name...');
            await client.query(`
                ALTER TABLE delivery_locations 
                DROP CONSTRAINT IF EXISTS delivery_locations_location_name_key
            `);
            console.log('Constraint removed!');
        }

        console.log('Success - all required database changes are applied.');

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

runFix();
