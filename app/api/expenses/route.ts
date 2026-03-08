import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET all expenses
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const category = searchParams.get('category');

        let sql = `
            SELECT id, description, amount, category, expense_date AS date, payment_method, notes, created_at, updated_at
            FROM expenses
            WHERE 1=1
        `;
        const params: any[] = [];
        let paramIndex = 1;

        if (startDate) {
            sql += ` AND expense_date >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }

        if (endDate) {
            sql += ` AND expense_date <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }

        if (category && category !== 'All') {
            sql += ` AND category = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }

        sql += ' ORDER BY expense_date DESC, created_at DESC';

        const result = await query(sql, params);

        return NextResponse.json({
            success: true,
            data: result.rows,
        });
    } catch (error: any) {
        console.error('Error fetching expenses:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch expenses', details: error.message },
            { status: 500 }
        );
    }
}

// POST create new expense
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { description, amount, category, date, payment_method, notes } = body;

        if (!description || amount === undefined || amount === null || !category || !date) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const result = await query(
            `INSERT INTO expenses (description, amount, category, expense_date, payment_method, notes)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, description, amount, category, expense_date AS date, payment_method, notes, created_at, updated_at`,
            [description, amount, category, date, payment_method, notes]
        );

        return NextResponse.json({
            success: true,
            data: result.rows[0],
        });
    } catch (error: any) {
        console.error('Error creating expense:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to create expense',
                details: error.message
            },
            { status: 500 }
        );
    }
}
