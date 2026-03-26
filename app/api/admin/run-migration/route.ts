import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
    try {
        // Run the migration to add missing columns
        const migrationSQL = `
            DO $$
            BEGIN
                BEGIN
                    ALTER TABLE expenses ADD COLUMN expense_date DATE NOT NULL DEFAULT CURRENT_DATE;
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;

                BEGIN
                    ALTER TABLE expenses ADD COLUMN receipt_image_id INTEGER REFERENCES images(id) ON DELETE SET NULL;
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;

                BEGIN
                    ALTER TABLE expenses ADD COLUMN notes TEXT;
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;

                -- Orders Table Migrations
                BEGIN
                    ALTER TABLE orders ADD COLUMN customer_lat NUMERIC;
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;

                BEGIN
                    ALTER TABLE orders ADD COLUMN customer_lng NUMERIC;
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;

                BEGIN
                    ALTER TABLE orders ADD COLUMN distance NUMERIC;
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;
            END $$;
        `;

        await query(migrationSQL);

        // Verify the columns exist
        const result = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'expenses'
            ORDER BY column_name;
        `);

        return NextResponse.json({
            success: true,
            message: 'Migration completed successfully',
            columns: result.rows.map(r => r.column_name)
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
