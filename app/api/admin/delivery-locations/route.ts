import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - Fetch all delivery locations
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const activeOnly = searchParams.get('active') === 'true';

        let queryText = 'SELECT * FROM delivery_locations';
        if (activeOnly) {
            queryText += ' WHERE is_active = true';
        }
        queryText += ' ORDER BY location_name ASC';

        const result = await query(queryText);

        return NextResponse.json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        console.error('Error fetching delivery locations:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch delivery locations' },
            { status: 500 }
        );
    }
}

// POST - Create a new delivery location
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { location_name, delivery_charge, latitude, longitude, radius_km, min_radius_km, is_active, min_order_value } = body;

        // Validation
        if (!location_name || location_name.trim() === '') {
            return NextResponse.json(
                { success: false, error: 'Location name is required' },
                { status: 400 }
            );
        }

        if (delivery_charge === undefined || delivery_charge === null || delivery_charge < 0) {
            return NextResponse.json(
                { success: false, error: 'Valid delivery charge is required' },
                { status: 400 }
            );
        }

        // Validate GPS coordinates if provided
        if ((latitude && !longitude) || (!latitude && longitude)) {
            return NextResponse.json(
                { success: false, error: 'Both latitude and longitude must be provided together' },
                { status: 400 }
            );
        }

        if (latitude && (latitude < -90 || latitude > 90)) {
            return NextResponse.json(
                { success: false, error: 'Latitude must be between -90 and 90' },
                { status: 400 }
            );
        }

        if (longitude && (longitude < -180 || longitude > 180)) {
            return NextResponse.json(
                { success: false, error: 'Longitude must be between -180 and 180' },
                { status: 400 }
            );
        }

        // Build query dynamically based on provided fields
        let queryText = `INSERT INTO delivery_locations (location_name, delivery_charge, is_active, min_order_value`;
        let values: any[] = [location_name.trim(), delivery_charge, is_active !== false, min_order_value || 0];
        let paramCount = 4;

        if (latitude && longitude) {
            queryText += `, latitude, longitude, radius_km, min_radius_km`;
            values.push(latitude, longitude, radius_km || 5.0, min_radius_km || 0.0);
            paramCount += 4;
        }

        queryText += `) VALUES ($1, $2, $3, $4`;
        if (latitude && longitude) {
            queryText += `, $5, $6, $7, $8`;
        }
        queryText += `) RETURNING *`;

        const result = await query(queryText, values);

        return NextResponse.json({
            success: true,
            data: result.rows[0],
            message: 'Delivery location created successfully',
        });
    } catch (error: any) {
        console.error('Error creating delivery location:', error);

        // Handle unique constraint violation (though we dropped it, just in case)
        if (error.code === '23505') {
            return NextResponse.json(
                { success: false, error: 'A location with this exact name and range already exists' },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { success: false, error: 'Failed to create delivery location' },
            { status: 500 }
        );
    }
}
