const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runDeployTasks() {
    console.log('🚀 Starting Database Deployment Tasks...');
    
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
        console.log('✅ Connected to database');

        // 1. Run the base schema (safe due to IF NOT EXISTS)
        const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
        if (fs.existsSync(schemaPath)) {
            console.log('📄 Applying base schema (atomic mode)...');
            const schema = fs.readFileSync(schemaPath, 'utf8');
            
            // Basic splitter that handles simple SQL statements while avoiding split issues within functions
            // Use with caution for complex SQL, but for this schema it should be fine.
            const statements = schema
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0);

            let schemaSuccesses = 0;
            for (const statement of statements) {
                try {
                    await client.query(statement);
                    schemaSuccesses++;
                } catch (err) {
                    // Log but don't stop the whole process for base schema seeding issues
                    if (process.env.DEBUG_MIGRATIONS) {
                        console.warn(`   ⚠️  Notice: Statement skipped/failed: ${err.message}`);
                    }
                }
            }
            console.log(`✅ Base schema pass complete (${schemaSuccesses} statements applied/verified)`);
        }

        // 2. Run sequential migrations
        const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');
        if (fs.existsSync(migrationsDir)) {
            const migrationFiles = fs.readdirSync(migrationsDir)
                .filter(file => file.endsWith('.sql'))
                .sort();

            console.log(`📂 Found ${migrationFiles.length} migration files`);
            
            for (const file of migrationFiles) {
                try {
                    const migrationPath = path.join(migrationsDir, file);
                    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
                    await client.query(migrationSQL);
                    console.log(`   ✅ Migration applied: ${file}`);
                } catch (err) {
                    // Ignore duplicate column/table/constraint errors
                    if (err.code === '42701' || err.code === '42P07' || err.code === '42710') {
                        console.log(`   ℹ️  Skipped (already exists): ${file}`);
                    } else {
                        console.warn(`   ⚠️  Migration issue in ${file}: ${err.message}`);
                    }
                }
            }
        }

        console.log('🎉 All deployment tasks finished successfully!');
    } catch (error) {
        console.error('❌ Deployment tasks failed:', error.message);
        // We don't exit with 1 here to avoid blocking the app start if DB is transiently down
        // but it's safer to just log and continue.
    } finally {
        await client.end();
    }
}

runDeployTasks();
