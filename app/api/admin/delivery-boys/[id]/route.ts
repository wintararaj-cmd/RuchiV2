
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const id = params.id;
        const result = await query(
            "SELECT id, name, email, phone, role, commission_rate, commission_type FROM users WHERE id = $1 AND role = 'delivery_boy'",
            [id]
        );

        if (result.rowCount === 0) {
            return NextResponse.json({ success: false, error: 'Delivery boy not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error fetching delivery boy:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch delivery boy' }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const id = params.id;
        const body = await request.json();
        const { name, email, password, phone, commission_rate, commission_type } = body;

        // Check if exists
        const check = await query("SELECT id FROM users WHERE id = $1 AND role = 'delivery_boy'", [id]);
        if (check.rowCount === 0) {
            return NextResponse.json({ success: false, error: 'Delivery boy not found' }, { status: 404 });
        }

        // Check email uniqueness if changed
        if (email) {
            const emailCheck = await query("SELECT id FROM users WHERE email = $1 AND id != $2", [email, id]);
            if ((emailCheck.rowCount ?? 0) > 0) {
                return NextResponse.json({ success: false, error: 'Email already exists' }, { status: 409 });
            }
        }

        let updateQuery = "UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), phone = COALESCE($3, phone), commission_rate = COALESCE($4, commission_rate), commission_type = COALESCE($5, commission_type)";
        const queryParams: any = [name, email, phone, commission_rate, commission_type];
        let paramCount = 5;

        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password, salt);
            paramCount++;
            updateQuery += `, password_hash = $${paramCount}`;
            queryParams.push(hash);
        }

        paramCount++;
        updateQuery += ` WHERE id = $${paramCount} RETURNING id, name, email, phone, commission_rate, commission_type`;
        queryParams.push(id);

        const result = await query(updateQuery, queryParams);

        return NextResponse.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error updating delivery boy:', error);
        return NextResponse.json({ success: false, error: 'Failed to update delivery boy' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const id = params.id;
        const result = await query("DELETE FROM users WHERE id = $1 AND role = 'delivery_boy' RETURNING id", [id]);

        if (result.rowCount === 0) {
            return NextResponse.json({ success: false, error: 'Delivery boy not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Delivery boy deleted' });
    } catch (error) {
        console.error('Error deleting delivery boy:', error);
        return NextResponse.json({ success: false, error: 'Failed to delete delivery boy' }, { status: 500 });
    }
}
