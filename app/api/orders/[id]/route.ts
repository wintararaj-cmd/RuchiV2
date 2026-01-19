import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET single order
export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const result = await query(
            'SELECT * FROM orders WHERE id = $1',
            [params.id]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Order not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: result.rows[0],
        });
    } catch (error) {
        console.error('Error fetching order:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch order' },
            { status: 500 }
        );
    }
}

// PUT update order status (admin only)
export async function PUT(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const body = await request.json();
        const {
            order_status,
            payment_status,
            delivery_boy_id,
            // Editable fields
            customer_name,
            customer_phone,
            items,
            subtotal,
            tax,
            discount,
            total_amount,
            payment_method,
            table_number,
            notes,
            order_type
        } = body;

        let driverCommission = null;

        // If status is changing to 'delivered', calculate commission
        if (order_status === 'delivered') {
            // ... (keep existing commission logic if needed, or query again. 
            // For simplicity, we'll keep the logic but we need to use the NEW total_amount if provided)

            // First get the order details to know the total amount and assigned delivery boy
            const orderRes = await query('SELECT total_amount, delivery_boy_id FROM orders WHERE id = $1', [params.id]);
            if (orderRes.rows.length > 0) {
                const order = orderRes.rows[0];
                const finalTotal = total_amount || order.total_amount; // Use new total if provided
                const dbId = delivery_boy_id || order.delivery_boy_id;

                if (dbId) {
                    const dbRes = await query('SELECT commission_rate, commission_type FROM users WHERE id = $1', [dbId]);
                    if (dbRes.rows.length > 0) {
                        const { commission_rate, commission_type } = dbRes.rows[0];
                        if (commission_type === 'percent') {
                            driverCommission = (parseFloat(finalTotal) * parseFloat(commission_rate)) / 100;
                        } else {
                            driverCommission = parseFloat(commission_rate);
                        }
                    }
                }
            }
        }

        const result = await query(
            `UPDATE orders 
       SET order_status = COALESCE($1, order_status),
           payment_status = COALESCE($2, payment_status),
           delivery_boy_id = COALESCE($3, delivery_boy_id),
           driver_commission = COALESCE($4, driver_commission),
           customer_name = COALESCE($5, customer_name),
           customer_phone = COALESCE($6, customer_phone),
           items = COALESCE($7, items),
           subtotal = COALESCE($8, subtotal),
           tax = COALESCE($9, tax),
           discount = COALESCE($10, discount),
           total_amount = COALESCE($11, total_amount),
           payment_method = COALESCE($12, payment_method),
           table_number = COALESCE($13, table_number),
           notes = COALESCE($14, notes),
           order_type = COALESCE($15, order_type),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $16
       RETURNING *`,
            [
                order_status,
                payment_status,
                delivery_boy_id,
                driverCommission,
                customer_name,
                customer_phone,
                items ? JSON.stringify(items) : null,
                subtotal,
                tax,
                discount,
                total_amount,
                payment_method,
                table_number,
                notes,
                order_type,
                params.id
            ]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Order not found' },
                { status: 404 }
            );
        }

        // Also update the corresponding invoice if discount, subtotal, tax, or total_amount changed
        if (discount !== undefined || subtotal !== undefined || tax !== undefined || total_amount !== undefined) {
            await query(
                `UPDATE invoices 
                 SET subtotal = COALESCE($1, subtotal),
                 tax = COALESCE($2, tax),
                 discount = COALESCE($3, discount),
                 total = COALESCE($4, total)
                 WHERE order_id = $5`,
                [subtotal, tax, discount, total_amount, params.id]
            );
        }

        return NextResponse.json({
            success: true,
            data: result.rows[0],
        });
    } catch (error) {
        console.error('Error updating order:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update order' },
            { status: 500 }
        );
    }
}

// DELETE order (admin only)
export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        // First delete related invoice
        await query('DELETE FROM invoices WHERE order_id = $1', [params.id]);

        // Then delete the order
        const result = await query(
            'DELETE FROM orders WHERE id = $1 RETURNING id',
            [params.id]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Order not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Order and related invoice deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting order:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete order' },
            { status: 500 }
        );
    }
}
