import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import crypto from 'crypto';

interface CachedImage {
    buffer: Buffer;
    contentType: string;
    etag: string;
    timestamp: number;
}

// In-memory cache to serve images in < 5ms without querying PostgreSQL repeatedly
const globalImageCache = new Map<string, CachedImage>();

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id;

        // 1. Fast Path: Check in-memory cache
        const cached = globalImageCache.get(id);
        if (cached) {
            const ifNoneMatch = request.headers.get('if-none-match');
            if (ifNoneMatch && ifNoneMatch === cached.etag) {
                return new NextResponse(null, { status: 304 });
            }

            return new NextResponse(cached.buffer as unknown as BodyInit, {
                headers: {
                    'Content-Type': cached.contentType,
                    'Content-Length': cached.buffer.length.toString(),
                    'ETag': cached.etag,
                    'Cache-Control': 'public, max-age=31536000, stale-while-revalidate=86400, immutable',
                },
            });
        }

        // 2. Slow Path: Query database only on first hit
        const result = await query(
            'SELECT image_data, image_type FROM menu_items WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0 || !result.rows[0].image_data) {
            return new NextResponse('Image not found', { status: 404 });
        }

        const { image_data, image_type } = result.rows[0];
        const contentType = image_type || 'image/jpeg';
        const buffer = Buffer.isBuffer(image_data) ? image_data : Buffer.from(image_data);

        // Generate ETag based on image content hash
        const hash = crypto.createHash('md5').update(buffer).digest('hex');
        const etag = `"${hash}"`;

        // Store in cache (limit memory size to 250 images)
        if (globalImageCache.size > 250) {
            const firstKey = globalImageCache.keys().next().value;
            if (firstKey) globalImageCache.delete(firstKey);
        }
        globalImageCache.set(id, { buffer, contentType, etag, timestamp: Date.now() });

        // If client already has cached version, send 304
        const ifNoneMatch = request.headers.get('if-none-match');
        if (ifNoneMatch && ifNoneMatch === etag) {
            return new NextResponse(null, { status: 304 });
        }

        return new NextResponse(buffer as unknown as BodyInit, {
            headers: {
                'Content-Type': contentType,
                'Content-Length': buffer.length.toString(),
                'ETag': etag,
                'Cache-Control': 'public, max-age=31536000, stale-while-revalidate=86400, immutable',
            },
        });
    } catch (error) {
        console.error('Error fetching image:', error);
        return new NextResponse('Error fetching image', { status: 500 });
    }
}
