import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

// Helper function to convert data to CSV
function convertToCSV(data: any[], headers: string[]): string {
    if (data.length === 0) return '';

    const csvRows = [];

    // Add headers
    csvRows.push(headers.join(','));

    // Add data rows
    for (const row of data) {
        const values = headers.map(header => {
            const value = row[header];
            // Handle null/undefined
            if (value === null || value === undefined) return '';
            // Escape quotes and wrap in quotes if contains comma or quote
            const stringValue = String(value);
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        });
        csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const format = searchParams.get('format') || 'json';
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (!type) {
            return NextResponse.json({ error: 'Data type is required' }, { status: 400 });
        }

        let queryText = '';
        let queryParams: any[] = [];
        let data: any[] = [];
        let headers: string[] = [];

        switch (type) {
            case 'menu_items':
                queryText = `
                    SELECT 
                        m.name, m.description, m.category_id, 
                        c.name as category_name, m.price, m.gst_rate, 
                        m.available,
                        CASE 
                            WHEN m.image_data IS NOT NULL THEN encode(m.image_data, 'base64')
                            ELSE NULL
                        END as image_data_base64,
                        m.image_type,
                        CASE 
                            WHEN m.image_data IS NOT NULL THEN length(m.image_data)
                            ELSE 0
                        END as image_size
                    FROM menu_items m
                    LEFT JOIN categories c ON m.category_id = c.id
                    ORDER BY m.id
                `;
                headers = ['name', 'description', 'category_id', 'category_name', 'price', 'gst_rate', 'available', 'image_data_base64', 'image_type', 'image_size'];
                break;

            case 'categories':
                queryText = 'SELECT name, description, sort_order FROM categories ORDER BY sort_order, id';
                headers = ['name', 'description', 'sort_order'];
                break;

            case 'delivery_locations':
                queryText = 'SELECT location_name, delivery_charge, COALESCE(is_active, true) as is_active FROM delivery_locations ORDER BY id';
                headers = ['location_name', 'delivery_charge', 'is_active'];
                break;

            case 'users':
                queryText = `
                    SELECT email, name, phone, address, role
                    FROM users 
                    WHERE role = 'customer'
                    ORDER BY id
                `;
                headers = ['email', 'name', 'phone', 'address', 'role'];
                break;

            case 'salesmen':
                queryText = `
                    SELECT name, phone, email, commission_rate, commission_type, COALESCE(is_active, true) as is_active
                    FROM users 
                    WHERE role = 'salesman'
                    ORDER BY id
                `;
                headers = ['name', 'phone', 'email', 'commission_rate', 'commission_type', 'is_active'];
                break;

            case 'delivery_boys':
                queryText = `
                    SELECT name, phone, email, commission_rate, commission_type, COALESCE(is_active, true) as is_active
                    FROM users 
                    WHERE role = 'delivery_boy'
                    ORDER BY id
                `;
                headers = ['name', 'phone', 'email', 'commission_rate', 'commission_type', 'is_active'];
                break;

            case 'orders':
                let orderQuery = `
                    SELECT 
                        o.id, o.customer_name, o.customer_phone, o.customer_address,
                        o.order_type, o.items, o.subtotal, o.tax, o.discount, 
                        o.total_amount, o.payment_method, o.payment_status, 
                        o.order_status, o.notes, o.table_number,
                        dl.location_name as delivery_location, o.delivery_charge,
                        o.created_at, o.updated_at
                    FROM orders o
                    LEFT JOIN delivery_locations dl ON o.delivery_location_id = dl.id
                `;

                if (startDate && endDate) {
                    queryParams = [startDate, `${endDate} 23:59:59`];
                    orderQuery += ' WHERE o.created_at >= $1 AND o.created_at <= $2';
                }

                orderQuery += ' ORDER BY o.created_at DESC';
                queryText = orderQuery;
                headers = [
                    'id', 'customer_name', 'customer_phone', 'customer_address', 'order_type',
                    'items', 'subtotal', 'tax', 'discount', 'total_amount', 'payment_method',
                    'payment_status', 'order_status', 'notes', 'table_number', 'delivery_location',
                    'delivery_charge', 'created_at', 'updated_at'
                ];
                break;

            default:
                return NextResponse.json({ error: 'Invalid data type' }, { status: 400 });
        }

        const result = await query(queryText, queryParams);
        data = result.rows;

        if (format === 'csv') {
            const csv = convertToCSV(data, headers);
            return new NextResponse(csv, {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="${type}_${new Date().toISOString().split('T')[0]}.csv"`,
                },
            });
        } else {
            // JSON format
            const json = JSON.stringify(data, null, 2);
            return new NextResponse(json, {
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Disposition': `attachment; filename="${type}_${new Date().toISOString().split('T')[0]}.json"`,
                },
            });
        }
    } catch (error) {
        console.error('Export error:', error);
        return NextResponse.json(
            { error: 'Failed to export data', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
