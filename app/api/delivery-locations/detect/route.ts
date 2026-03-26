import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns Distance in kilometers
 */
function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
}

function toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
}

/**
 * POST /api/delivery-locations/detect
 * Detect delivery zone based on GPS coordinates
 * 
 * Request body:
 * {
 *   "latitude": 28.6139,
 *   "longitude": 77.2090
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "location": { id, location_name, delivery_charge, ... },
 *     "distance": 2.5,
 *     "alternatives": [...]
 *   }
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { latitude, longitude } = body;

        // Validate input
        if (!latitude || !longitude) {
            return NextResponse.json({
                success: false,
                error: 'Latitude and longitude are required'
            }, { status: 400 });
        }

        // Validate coordinate ranges
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return NextResponse.json({
                success: false,
                error: 'Invalid GPS coordinates'
            }, { status: 400 });
        }

        // Fetch all active delivery locations with GPS coordinates
        const query = `
            SELECT 
                id, 
                location_name, 
                delivery_charge, 
                latitude, 
                longitude, 
                radius_km,
                min_radius_km
            FROM delivery_locations
            WHERE is_active = true
            AND latitude IS NOT NULL 
            AND longitude IS NOT NULL
            ORDER BY min_radius_km ASC, radius_km ASC
        `;

        const result = await pool.query(query);

        if (result.rows.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No delivery locations with GPS coordinates found. Please contact support.'
            }, { status: 404 });
        }

        // Calculate distances and find matching zones
        const locationsWithDistance = result.rows.map(location => {
            const distance = calculateDistance(
                latitude,
                longitude,
                parseFloat(location.latitude),
                parseFloat(location.longitude)
            );

            const minRad = parseFloat(location.min_radius_km || '0');
            const maxRad = parseFloat(location.radius_km || '5.0');

            return {
                ...location,
                distance: parseFloat(distance.toFixed(2)),
                withinRange: distance >= minRad && distance <= maxRad
            };
        });

        // Sort: first by withinRange (true first), then by distance
        locationsWithDistance.sort((a, b) => {
            if (a.withinRange && !b.withinRange) return -1;
            if (!a.withinRange && b.withinRange) return 1;
            return a.distance - b.distance;
        });

        // Find locations within range
        const matchingLocations = locationsWithDistance.filter(loc => loc.withinRange);

        if (matchingLocations.length === 0) {
            // No exact match, return nearest location as suggestion
            const nearest = locationsWithDistance[0];

            const debugInfo = locationsWithDistance.map(l => `${l.location_name}(${l.distance}km, ${l.min_radius_km}-${l.radius_km}km)`).join(' | ');
            return NextResponse.json({
                success: false,
                error: `No matching zone for your distance (${nearest.distance}km). Found: ${debugInfo}`,
                data: {
                    nearestLocation: {
                        id: nearest.id,
                        location_name: nearest.location_name,
                        delivery_charge: nearest.delivery_charge,
                        distance: nearest.distance,
                        radius_km: nearest.radius_km,
                        min_radius_km: nearest.min_radius_km
                    },
                    allLocations: locationsWithDistance.map(loc => ({
                        id: loc.id,
                        location_name: loc.location_name,
                        delivery_charge: loc.delivery_charge,
                        distance: loc.distance,
                        range: `${loc.min_radius_km}-${loc.radius_km}km`
                    }))
                }
            }, { status: 200 });
        }

        // Return the closest matching location
        const bestMatch = matchingLocations[0];

        return NextResponse.json({
            success: true,
            message: `Detected delivery zone: ${bestMatch.location_name}`,
            data: {
                location: {
                    id: bestMatch.id,
                    location_name: bestMatch.location_name,
                    delivery_charge: bestMatch.delivery_charge,
                    latitude: bestMatch.latitude,
                    longitude: bestMatch.longitude,
                    radius_km: bestMatch.radius_km,
                    min_radius_km: bestMatch.min_radius_km
                },
                distance: bestMatch.distance,
                alternatives: matchingLocations.slice(1, 4).map(loc => ({
                    id: loc.id,
                    location_name: loc.location_name,
                    delivery_charge: loc.delivery_charge,
                    distance: loc.distance,
                    range: `${loc.min_radius_km}-${loc.radius_km}km`
                }))
            }
        });

    } catch (error: any) {
        console.error('GPS detection error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to detect delivery zone: ' + error.message
        }, { status: 500 });
    }
}
