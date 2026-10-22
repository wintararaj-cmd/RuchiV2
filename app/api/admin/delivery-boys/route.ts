
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET() {
    try {
        const result = await query(
            "SELECT id, name, email, phone, role, created_at FROM users WHERE role = 'delivery_boy' ORDER BY created_at DESC"
        );
        return NextResponse.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching delivery boys:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch delivery boys' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, email, password, phone, commission_rate, commission_type } = body;

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
            `INSERT INTO users (name, email, password_hash, phone, role, commission_rate, commission_type) 
             VALUES ($1, $2, $3, $4, 'delivery_boy', $5, $6) 
             RETURNING id, name, email, phone, role`,
            [name, email, hash, phone || null, commission_rate || 0, commission_type || 'fixed']
        );

        return NextResponse.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error creating delivery boy:', error);
        return NextResponse.json({ success: false, error: 'Failed to create delivery boy' }, { status: 500 });
    }
}
