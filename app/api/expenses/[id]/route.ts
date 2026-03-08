import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// PUT update expense
export async function PUT(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const body = await request.json();
        const { description, amount, category, date, payment_method, notes } = body;

        const result = await query(
            `UPDATE expenses 
             SET description = COALESCE($1, description),
                 amount = COALESCE($2, amount),
                 category = COALESCE($3, category),
                 expense_date = COALESCE($4, expense_date),
                 payment_method = COALESCE($5, payment_method),
                 notes = COALESCE($6, notes),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $7
             RETURNING id, description, amount, category, expense_date AS date, payment_method, notes, created_at, updated_at`,
            [description, amount, category, date, payment_method, notes, params.id]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Expense not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: result.rows[0],
        });
    } catch (error: any) {
        console.error('Error updating expense:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update expense', details: error.message },
            { status: 500 }
        );
    }
}

// DELETE expense
export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const result = await query(
            'DELETE FROM expenses WHERE id = $1 RETURNING id',
            [params.id]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Expense not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Expense deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting expense:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete expense' },
            { status: 500 }
        );
    }
}
