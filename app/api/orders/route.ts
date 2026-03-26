import { NextResponse } from 'next/server';
import { query, getClient } from '@/lib/db';

export const dynamic = 'force-dynamic';


// GET all orders or user-specific orders
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const status = searchParams.get('status');

        let queryText = `
            SELECT o.*, dl.location_name as delivery_location_name 
            FROM orders o
            LEFT JOIN delivery_locations dl ON o.delivery_location_id = dl.id
            WHERE 1=1
        `;
        const params: any[] = [];
        let paramCount = 1;

        if (userId) {
            queryText += ` AND o.user_id = $${paramCount}`;
            params.push(userId);
            paramCount++;
        }

        if (status) {
            queryText += ` AND o.order_status = $${paramCount}`;
            params.push(status);
            paramCount++;
        }

        queryText += ' ORDER BY o.created_at DESC';

        const result = await query(queryText, params);

        return NextResponse.json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch orders' },
            { status: 500 }
        );
    }
}

// POST create new order
export async function POST(request: Request) {
    const client = await getClient();
    try {
        const body = await request.json();
        const {
            user_id,
            customer_name,
            customer_phone,
            customer_address,
            order_type,
            items,
            subtotal,
            tax,
            discount,
            delivery_location_id,
            delivery_charge,
            total_amount,
            payment_method,

            customer_lat,
            customer_lng,
            distance,

            notes,
            table_number,
            order_status,
            payment_status,
        } = body;

        // Validate required fields
        if (!items || !total_amount || !payment_method) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // For delivery orders, customer details and address are required
        if (order_type === 'delivery') {
            if (!customer_name || !customer_phone) {
                return NextResponse.json(
                    { success: false, error: 'Customer name and phone are required for delivery orders' },
                    { status: 400 }
                );
            }
            if (!customer_address) {
                return NextResponse.json(
                    { success: false, error: 'Address is required for delivery orders' },
                    { status: 400 }
                );
            }
        }

        // START TRANSACTION
        await client.query('BEGIN');
        
        // Generate daily sequential order number
        const today = new Date();
        const datePrefix = today.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD format

        // Optimized count query using date range instead of DATE() function for better index usage
        const orderCountResult = await client.query(
            `SELECT COUNT(*) as count FROM orders 
             WHERE created_at >= CURRENT_DATE 
             AND created_at < (CURRENT_DATE + INTERVAL '1 day')
             AND order_number LIKE $1`,
            [`${datePrefix}-%`]
        );
        const orderCount = parseInt(orderCountResult.rows[0].count) + 1;
        const orderNumber = `${datePrefix}-${String(orderCount).padStart(3, '0')}`; // Format: YYYYMMDD-XXX

        let orderResult;
        try {
            // Use a SAVEPOINT to handle potential column-missing errors without aborting the whole transaction
            await client.query('SAVEPOINT order_insert_probe');
            
            // Attempt to insert with geolocation and distance columns
            orderResult = await client.query(
                `INSERT INTO orders (order_number, user_id, customer_name, customer_phone, customer_address, order_type, items, subtotal, tax, discount, delivery_location_id, delivery_charge, total_amount, payment_method, notes, table_number, order_status, payment_status, customer_lat, customer_lng, distance)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
           RETURNING *`,
                [
                    orderNumber, user_id || null, customer_name || 'Walk-in Customer', customer_phone || 'N/A', customer_address || null,
                    order_type || 'delivery', JSON.stringify(items), subtotal, tax || 0, discount || 0,
                    delivery_location_id || null, delivery_charge || 0, total_amount, payment_method,
                    notes || null, table_number || null, order_status || 'pending', payment_status || 'pending',
                    customer_lat || null, customer_lng || null, distance || null,
                ]
            );
            
            await client.query('RELEASE SAVEPOINT order_insert_probe');
        } catch (err: any) {
            // If columns don't exist (ERROR 42703), fallback to legacy insert
            if (err.code === '42703') {
                console.warn('⚠️ Orders table missing newer columns. Falling back to basic insert.');
                
                // Rollback to before the failed query to clear the transaction state
                await client.query('ROLLBACK TO SAVEPOINT order_insert_probe');
                
                orderResult = await client.query(
                    `INSERT INTO orders (order_number, user_id, customer_name, customer_phone, customer_address, order_type, items, subtotal, tax, discount, delivery_location_id, delivery_charge, total_amount, payment_method, notes, table_number, order_status, payment_status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
               RETURNING *`,
                    [
                        orderNumber, user_id || null, customer_name || 'Walk-in Customer', customer_phone || 'N/A', customer_address || null,
                        order_type || 'delivery', JSON.stringify(items), subtotal, tax || 0, discount || 0,
                        delivery_location_id || null, delivery_charge || 0, total_amount, payment_method,
                        notes || null, table_number || null, order_status || 'pending', payment_status || 'pending',
                    ]
                );
            } else {
                throw err;
            }
        }

        // Auto-generate invoice
        const order = orderResult.rows[0];
        const invoiceDate = new Date().toISOString().split('T')[0].replace(/-/g, '');

        // Optimized invoice count query
        const invoiceCountResult = await client.query(
            `SELECT COUNT(*) as count FROM invoices 
             WHERE generated_at >= CURRENT_DATE 
             AND generated_at < (CURRENT_DATE + INTERVAL '1 day')
             AND invoice_number LIKE $1`,
            [`INV-${invoiceDate}-%`]
        );
        const invoiceCount = parseInt(invoiceCountResult.rows[0].count) + 1;
        const invoiceNumber = `INV-${invoiceDate}-${String(invoiceCount).padStart(4, '0')}`;

        await client.query(
            `INSERT INTO invoices (order_id, invoice_number, subtotal, tax, discount, total)
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [order.id, invoiceNumber, subtotal, tax || 0, discount || 0, total_amount]
        );

        // COMMIT TRANSACTION
        await client.query('COMMIT');

        return NextResponse.json({
            success: true,
            data: { ...order, invoice_number: invoiceNumber },
        });
    } catch (error: any) {
        // ROLLBACK TRANSACTION on error
        await client.query('ROLLBACK');
        console.error('❌ Error creating order:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to create order',
                details: error.message
            },
            { status: 500 }
        );
    } finally {
        // Release client back to pool
        client.release();
    }
}
