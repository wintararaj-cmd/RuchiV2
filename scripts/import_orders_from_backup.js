const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function importOrders(backupFilePath) {
    if (!backupFilePath) {
        console.error('❌ Please provide path to backup JSON file');
        return;
    }

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('❌ No DATABASE_URL found!');
        return;
    }

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('🔌 Connected. Reading backup file...');

        const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
        const { orders, invoices } = backupData;

        console.log(`📦 Found ${orders.length} orders and ${invoices.length} invoices. Starting import...`);

        // Use a transaction for the entire import
        await client.query('BEGIN');

        for (const order of orders) {
            // Check if order already exists by number
            const exists = await client.query('SELECT 1 FROM orders WHERE order_number = $1 OR id = $2', [order.order_number, order.id]);
            if (exists.rows.length > 0) continue;

            // Build dynamic insert for all columns present in backup
            const columns = Object.keys(order).filter(k => order[k] !== undefined && order[k] !== '');
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            const values = columns.map(k => order[k]);

            const query = `INSERT INTO orders (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
            await client.query(query, values);
        }

        for (const inv of invoices) {
            const exists = await client.query('SELECT 1 FROM invoices WHERE invoice_number = $1 OR id = $2', [inv.invoice_number, inv.id]);
            if (exists.rows.length > 0) continue;

            const columns = Object.keys(inv).filter(k => inv[k] !== undefined && inv[k] !== '');
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            const values = columns.map(k => inv[k]);

            const query = `INSERT INTO invoices (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
            await client.query(query, values);
        }

        await client.query('COMMIT');
        console.log('✅ Import finished successfully!');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Import failed:', err.message);
    } finally {
        await client.end();
    }
}

// Get the latest backup file if none provided
const backupDir = path.join(__dirname, '..', 'backup');
const files = fs.readdirSync(backupDir).filter(f => f.startsWith('orders_backup')).sort().reverse();

if (files.length > 0) {
    const latest = path.join(backupDir, files[0]);
    console.log(`📂 Using latest backup: ${latest}`);
    importOrders(latest);
} else {
    console.error('❌ No backup files found in /backup directory.');
}
