
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET() {
    try {
        const result = await query(
            "SELECT id, name, email, phone, role, created_at FROM users WHERE role = 'salesman' ORDER BY created_at DESC"
        );
        return NextResponse.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching salesmen:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch salesmen' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, email, password, phone } = body;

        if (!name || !email || !password) {
            return NextResponse.json({ success: false, error: 'Name, email, and password are required' }, { status: 400 });
        }

        // Check if email exists
        const check = await query("SELECT id FROM users WHERE email = $1", [email]);
        if ((check.rowCount ?? 0) > 0) {
            return NextResponse.json({ success: false, error: 'Email already exists' }, { status: 409 });
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const result = await query(
            `INSERT INTO users (name, email, password_hash, phone, role) 
             VALUES ($1, $2, $3, $4, 'salesman') 
             RETURNING id, name, email, phone, role`,
            [name, email, hash, phone || null]
        );

        return NextResponse.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error creating salesman:', error);
        return NextResponse.json({ success: false, error: 'Failed to create salesman' }, { status: 500 });
    }
}
