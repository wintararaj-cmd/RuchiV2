import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const sqlCalls = [
            { id: 'lat', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_lat NUMERIC;` },
            { id: 'lng', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_lng NUMERIC;` },
            { id: 'dist', sql: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS distance NUMERIC;` },
            { id: 'exp_notes', sql: `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS notes TEXT;` },
            { id: 'exp_date', sql: `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_date DATE NOT NULL DEFAULT CURRENT_DATE;` }
        ];

        const results = [];
        for (const call of sqlCalls) {
            try {
                await query(call.sql);
                results.push({ id: call.id, success: true });
            } catch (err: any) {
                results.push({ id: call.id, success: false, error: err.message });
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Migration process finished',
            results: results
        });
    } catch (error: any) {
        console.error('Migration error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Migration failed',
                details: error.message
            },
            { status: 500 }
        );
    }
}
