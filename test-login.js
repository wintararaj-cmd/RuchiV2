// Test login functionality
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function testLogin() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    try {
        console.log('🔍 Testing login...\n');
        
        const email = 'admin@restaurant.com';
        const password = 'admin123';
        
        console.log('1. Fetching user from database...');
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (result.rowCount === 0) {
            console.log('❌ User not found!');
            process.exit(1);
        }
        
        console.log('✅ User found:', result.rows[0].email);
        
        const user = result.rows[0];
        console.log('\n2. Testing password comparison...');
        console.log('   Password to test:', password);
        console.log('   Stored hash:', user.password_hash.substring(0, 20) + '...');
        
        const isValid = await bcrypt.compare(password, user.password_hash);
        
        if (isValid) {
            console.log('✅ Password is VALID!');
            console.log('\n3. Login should work!');
            console.log('   User ID:', user.id);
            console.log('   Email:', user.email);
            console.log('   Role:', user.role);
        } else {
            console.log('❌ Password is INVALID!');
            console.log('   This means the password hash in database doesn\'t match');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('   Full error:', error);
    } finally {
        await pool.end();
    }
}

testLogin();
