import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Fetch a single delivery location
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;

        const result = await query(
            'SELECT * FROM delivery_locations WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Delivery location not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: result.rows[0],
        });
    } catch (error) {
        console.error('Error fetching delivery location:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch delivery location' },
            { status: 500 }
        );
    }
}

// PUT - Update a delivery location
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;
        const body = await request.json();
        const { location_name, delivery_charge, latitude, longitude, radius_km, min_radius_km, is_active, min_order_value } = body;

        // Validation
        if (location_name !== undefined && location_name.trim() === '') {
            return NextResponse.json(
                { success: false, error: 'Location name cannot be empty' },
                { status: 400 }
            );
        }

        if (delivery_charge !== undefined && delivery_charge < 0) {
            return NextResponse.json(
                { success: false, error: 'Delivery charge cannot be negative' },
                { status: 400 }
            );
        }

        // Validate GPS coordinates if provided
        if ((latitude !== undefined && longitude === undefined) || (latitude === undefined && longitude !== undefined)) {
            return NextResponse.json(
                { success: false, error: 'Both latitude and longitude must be provided together' },
                { status: 400 }
            );
        }

        if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
            return NextResponse.json(
                { success: false, error: 'Latitude must be between -90 and 90' },
                { status: 400 }
            );
        }

        if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
            return NextResponse.json(
                { success: false, error: 'Longitude must be between -180 and 180' },
                { status: 400 }
            );
        }

        // Build dynamic update query
        const updates: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        if (location_name !== undefined) {
            updates.push(`location_name = $${paramCount++}`);
            values.push(location_name.trim());
        }

        if (delivery_charge !== undefined) {
            updates.push(`delivery_charge = $${paramCount++}`);
            values.push(delivery_charge);
        }

        if (min_order_value !== undefined) {
            updates.push(`min_order_value = $${paramCount++}`);
            values.push(min_order_value);
        }

        if (latitude !== undefined && longitude !== undefined) {
            updates.push(`latitude = $${paramCount++}`);
            values.push(latitude);
            updates.push(`longitude = $${paramCount++}`);
            values.push(longitude);
            updates.push(`radius_km = $${paramCount++}`);
            values.push(radius_km || 5.0);
            updates.push(`min_radius_km = $${paramCount++}`);
            values.push(min_radius_km || 0.0);
        }

        if (is_active !== undefined) {
            updates.push(`is_active = $${paramCount++}`);
            values.push(is_active);
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);

        if (updates.length === 1) {
            return NextResponse.json(
                { success: false, error: 'No fields to update' },
                { status: 400 }
            );
        }

        values.push(id);
        const queryText = `
            UPDATE delivery_locations 
            SET ${updates.join(', ')} 
            WHERE id = $${paramCount}
            RETURNING *
        `;

        const result = await query(queryText, values);

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Delivery location not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: result.rows[0],
            message: 'Delivery location updated successfully',
        });
    } catch (error: any) {
        console.error('Error updating delivery location:', error);

        // Handle unique constraint violation (though we dropped it, just in case)
        if (error.code === '23505') {
            return NextResponse.json(
                { success: false, error: 'A location with this exact name and range already exists' },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { success: false, error: 'Failed to update delivery location' },
            { status: 500 }
        );
    }
}

// DELETE - Delete a delivery location
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;

        // Check if location is being used in any orders
        const ordersCheck = await query(
            'SELECT COUNT(*) as count FROM orders WHERE delivery_location_id = $1',
            [id]
        );

        if (parseInt(ordersCheck.rows[0].count) > 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Cannot delete location that is used in existing orders. Consider deactivating it instead.'
                },
                { status: 409 }
            );
        }

        const result = await query(
            'DELETE FROM delivery_locations WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Delivery location not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Delivery location deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting delivery location:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete delivery location' },
            { status: 500 }
        );
    }
}
