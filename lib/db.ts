import { Pool, QueryResult } from 'pg';

// Debug: Log environment variable status
console.log('🔍 Database Configuration:');
console.log('  DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('  DB_HOST:', process.env.DB_HOST || 'NOT SET (using default)');
console.log('  DB_PORT:', process.env.DB_PORT || 'NOT SET (using default)');
console.log('  DB_NAME:', process.env.DB_NAME || 'NOT SET (using default)');
console.log('  DB_USER:', process.env.DB_USER || 'NOT SET (using default)');
console.log('  DB_PASSWORD:', process.env.DB_PASSWORD ? 'SET' : 'NOT SET');

// Create a connection pool
// Use DATABASE_URL if available (for Coolify/Railway), otherwise use individual env vars
const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 60000,
        statement_timeout: 120000,
    })
    : new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'restaurant_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 60000,
        statement_timeout: 120000,
    });

// Test the connection
pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle client', err);
    process.exit(-1);
});

// Helper function to execute queries
export async function query(text: string, params?: any[]): Promise<QueryResult> {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log('Executed query', { text, duration, rows: res.rowCount });
        return res;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}

// Helper function to get a client from the pool for transactions
export async function getClient() {
    const client = await pool.connect();
    return client;
}

// Export the pool for direct access if needed
export default pool;
