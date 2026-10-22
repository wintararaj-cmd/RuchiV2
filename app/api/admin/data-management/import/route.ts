import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';

// Helper function to parse CSV
function parseCSV(csvText: string): any[] {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const data: any[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values: string[] = [];
        let currentValue = '';
        let insideQuotes = false;

        for (let j = 0; j < lines[i].length; j++) {
            const char = lines[i][j];

            if (char === '"') {
                insideQuotes = !insideQuotes;
            } else if (char === ',' && !insideQuotes) {
                values.push(currentValue.trim());
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        values.push(currentValue.trim());

        const row: any = {};
        headers.forEach((header, index) => {
            let value = values[index] || '';
            // Remove surrounding quotes if present
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1).replace(/""/g, '"');
            }
            row[header] = value;
        });
        data.push(row);
    }

    return data;
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const type = formData.get('type') as string;

        if (!file || !type) {
            return NextResponse.json({ error: 'File and type are required' }, { status: 400 });
        }

        const fileText = await file.text();
        let data: any[];

        // Parse file based on extension
        if (file.name.endsWith('.json')) {
            data = JSON.parse(fileText);
            if (!Array.isArray(data)) {
                return NextResponse.json({ error: 'JSON file must contain an array of objects' }, { status: 400 });
            }
        } else if (file.name.endsWith('.csv')) {
            data = parseCSV(fileText);
        } else {
            return NextResponse.json({ error: 'Unsupported file format' }, { status: 400 });
        }

        if (data.length === 0) {
            return NextResponse.json({ error: 'No data found in file' }, { status: 400 });
        }

        let imported = 0;
        let skipped = 0;
        let errors: string[] = [];

        const client = await getClient();

        try {
            await client.query('BEGIN');

            for (let i = 0; i < data.length; i++) {
                const item = data[i];
                const savepointName = `sp_${i}`;

                try {
                    // Create a savepoint for this item
                    await client.query(`SAVEPOINT ${savepointName}`);

                    switch (type) {
                        case 'menu_items':
                            // If category_name is provided, look up the category_id
                            let categoryId = item.category_id;
                            if (item.category_name && item.category_name.trim() !== '') {
                                try {
                                    const categoryResult = await client.query(
                                        'SELECT id FROM categories WHERE name = $1',
                                        [item.category_name]
                                    );
                                    if (categoryResult.rows.length > 0) {
                                        categoryId = categoryResult.rows[0].id;
                                    } else {
                                        console.warn(`Category not found: ${item.category_name} for item: ${item.name}`);
                                    }
                                } catch (error) {
                                    console.error('Error looking up category:', error);
                                }
                            }

                            // Decode base64 image data if present
                            let imageData = null;
                            let imageType = null;
                            if (item.image_data_base64 && item.image_data_base64.trim() !== '') {
                                try {
                                    imageData = Buffer.from(item.image_data_base64, 'base64');
                                    imageType = item.image_type || 'image/jpeg';
                                } catch (error) {
                                    console.error('Error processing image for item:', item.name, error);
                                }
                            }

                            // Check if menu item exists by name
                            const existingMenuItem = await client.query(
                                'SELECT id FROM menu_items WHERE name = $1',
                                [item.name]
                            );

                            if (existingMenuItem.rows.length > 0) {
                                // Update existing menu item
                                await client.query(
                                    `UPDATE menu_items SET
                                     description = $1,
                                     category_id = $2,
                                     price = $3,
                                     gst_rate = $4,
                                     available = $5,
                                     image_data = $6,
                                     image_type = $7,
                                     updated_at = CURRENT_TIMESTAMP
                                     WHERE name = $8`,
                                    [
                                        item.description || '',
                                        categoryId || null,
                                        parseFloat(item.price) || 0,
                                        parseFloat(item.gst_rate) || 5.00,
                                        item.available === 'true' || item.available === true || item.available === '1',
                                        imageData,
                                        imageType,
                                        item.name
                                    ]
                                );
                                imported++;
                            } else {
                                // Insert new menu item
                                await client.query(
                                    `INSERT INTO menu_items (name, description, category_id, price, gst_rate, available, image_data, image_type)
                                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                                    [
                                        item.name,
                                        item.description || '',
                                        categoryId || null,
                                        parseFloat(item.price) || 0,
                                        parseFloat(item.gst_rate) || 5.00,
                                        item.available === 'true' || item.available === true || item.available === '1',
                                        imageData,
                                        imageType
                                    ]
                                );
                                imported++;
                            }
                            break;

                        case 'categories':
                            // Categories table has UNIQUE constraint on name, so ON CONFLICT works
                            await client.query(
                                `INSERT INTO categories (name, description, sort_order)
                                 VALUES ($1, $2, $3)
                                 ON CONFLICT (name) DO UPDATE SET
                                 description = EXCLUDED.description,
                                 sort_order = EXCLUDED.sort_order,
                                 updated_at = CURRENT_TIMESTAMP`,
                                [
                                    item.name,
                                    item.description || '',
                                    parseInt(item.sort_order || item.display_order) || 0
                                ]
                            );
                            imported++;
                            break;

                        case 'delivery_locations':
                            await client.query(
                                `INSERT INTO delivery_locations (location_name, delivery_charge, is_active)
                                 VALUES ($1, $2, $3)
                                 ON CONFLICT (location_name) DO UPDATE SET
                                 delivery_charge = EXCLUDED.delivery_charge,
                                 is_active = EXCLUDED.is_active,
                                 updated_at = CURRENT_TIMESTAMP`,
                                [
                                    item.location_name,
                                    parseFloat(item.delivery_charge) || 0,
                                    item.is_active === 'true' || item.is_active === true || item.is_active === '1'
                                ]
                            );
                            imported++;
                            break;

                        case 'users':
                            // Only import customers, skip if email already exists
                            const existingUser = await client.query(
                                'SELECT id FROM users WHERE email = $1',
                                [item.email]
                            );

                            if (existingUser.rows.length === 0) {
                                await client.query(
                                    `INSERT INTO users (email, name, phone, address, role)
                                     VALUES ($1, $2, $3, $4, $5)`,
                                    [
                                        item.email,
                                        item.name,
                                        item.phone || null,
                                        item.address || null,
                                        'customer'
                                    ]
                                );
                                imported++;
                            } else {
                                skipped++;
                            }
                            break;

                        case 'salesmen':
                            const existingSalesman = await client.query(
                                'SELECT id FROM users WHERE email = $1 OR phone = $2',
                                [item.email, item.phone]
                            );

                            if (existingSalesman.rows.length === 0) {
                                await client.query(
                                    `INSERT INTO users (name, phone, email, role, commission_rate, commission_type, is_active)
                                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                                    [
                                        item.name,
                                        item.phone,
                                        item.email || null,
                                        'salesman',
                                        parseFloat(item.commission_rate) || 0,
                                        item.commission_type || 'percentage',
                                        item.is_active === 'true' || item.is_active === true || item.is_active === '1'
                                    ]
                                );
                                imported++;
                            } else {
                                skipped++;
                            }
                            break;

                        case 'delivery_boys':
                            const existingDeliveryBoy = await client.query(
                                'SELECT id FROM users WHERE email = $1 OR phone = $2',
                                [item.email, item.phone]
                            );

                            if (existingDeliveryBoy.rows.length === 0) {
                                await client.query(
                                    `INSERT INTO users (name, phone, email, role, commission_rate, commission_type, is_active)
                                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                                    [
                                        item.name,
                                        item.phone,
                                        item.email || null,
                                        'delivery_boy',
                                        parseFloat(item.commission_rate) || 0,
                                        item.commission_type || 'percentage',
                                        item.is_active === 'true' || item.is_active === true || item.is_active === '1'
                                    ]
                                );
                                imported++;
                            } else {
                                skipped++;
                            }
                            break;

                        case 'orders':
                            // For orders, we'll skip import as it's complex with foreign keys
                            // This is mainly for export/backup purposes
                            errors.push('Order import is not supported for data integrity reasons');
                            skipped++;
                            break;

                        default:
                            errors.push(`Unknown type: ${type}`);
                            skipped++;
                    }
                } catch (itemError) {
                    // Rollback to savepoint so transaction can continue
                    await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);

                    const errorMessage = itemError instanceof Error ? itemError.message : 'Unknown error';
                    const itemIdentifier = item.name || item.location_name || item.email || 'Unknown item';
                    console.error(`Error importing item "${itemIdentifier}":`, errorMessage);
                    console.error('Item data:', JSON.stringify(item, null, 2));
                    errors.push(`Failed to import "${itemIdentifier}": ${errorMessage}`);
                    skipped++;
                }
            }

            await client.query('COMMIT');

            return NextResponse.json({
                success: true,
                message: `Import completed: ${imported} imported, ${skipped} skipped`,
                details: {
                    imported,
                    skipped,
                    total: data.length,
                    errors: errors.slice(0, 10) // Limit error messages
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Import error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to import data',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
