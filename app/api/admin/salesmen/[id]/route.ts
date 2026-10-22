
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const body = await request.json();
        const { name, email, password, phone } = body;
        const id = params.id;

        // Check availability
        const check = await query("SELECT id FROM users WHERE id = $1 AND role = 'salesman'", [id]);
        if (check.rowCount === 0) {
            return NextResponse.json({ success: false, error: 'Salesman not found' }, { status: 404 });
        }

        // If updating email, check uniqueness
        if (email) {
            const emailCheck = await query("SELECT id FROM users WHERE email = $1 AND id != $2", [email, id]);
            if ((emailCheck.rowCount ?? 0) > 0) {
                return NextResponse.json({ success: false, error: 'Email already in use' }, { status: 409 });
            }
        }

        let updateQuery = "UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), phone = COALESCE($3, phone)";
        const queryParams = [name, email, phone];
        let paramCount = 3;

        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password, salt);
            paramCount++;
            updateQuery += `, password_hash = $${paramCount}`;
            queryParams.push(hash);
        }

        paramCount++;
        updateQuery += ` WHERE id = $${paramCount} RETURNING id, name, email, phone`;
        queryParams.push(id);

        const result = await query(updateQuery, queryParams);

        return NextResponse.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error updating salesman:', error);
        return NextResponse.json({ success: false, error: 'Failed to update salesman' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const id = params.id;
        const result = await query("DELETE FROM users WHERE id = $1 AND role = 'salesman' RETURNING id", [id]);

        if (result.rowCount === 0) {
            return NextResponse.json({ success: false, error: 'Salesman not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Salesman deleted' });
    } catch (error) {
        console.error('Error deleting salesman:', error);
        return NextResponse.json({ success: false, error: 'Failed to delete salesman' }, { status: 500 });
    }
}
