const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function backupOrders() {
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
        console.log('🔌 Connected. Fetching orders for backup...');

        const orders = await client.query('SELECT * FROM orders');
        const invoices = await client.query('SELECT * FROM invoices');

        const backupData = {
            timestamp: new Date().toISOString(),
            orders: orders.rows,
            invoices: invoices.rows
        };

        const backupDir = path.join(__dirname, '..', 'backup');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir);
        }

        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `orders_backup_${dateStr}_${Date.now()}.json`;
        const filePath = path.join(backupDir, fileName);

        fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));
        console.log(`✅ Backup saved to: ${filePath}`);
        console.log(`📊 Backed up ${orders.rows.length} orders and ${invoices.rows.length} invoices.`);

    } catch (err) {
        console.error('❌ Backup failed:', err.message);
    } finally {
        await client.end();
    }
}

backupOrders();
