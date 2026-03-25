-- Migration: Add GPS and radius tiers to delivery_locations table
-- Purpose: Support GPS detection with multiple radius ranges

-- 1. Add GPS columns if missing
ALTER TABLE delivery_locations ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE delivery_locations ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
ALTER TABLE delivery_locations ADD COLUMN IF NOT EXISTS radius_km DECIMAL(5, 2) DEFAULT 5.00;

-- 2. Add min_radius_km column
ALTER TABLE delivery_locations ADD COLUMN IF NOT EXISTS min_radius_km DECIMAL(5, 2) DEFAULT 0.00;

-- 3. Drop the unique constraint on location_name
-- This allows multiple tiers with the same name (or slightly different)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_locations_location_name_key') THEN
        ALTER TABLE delivery_locations DROP CONSTRAINT delivery_locations_location_name_key;
    END IF;
END $$;

-- 4. Add comments for clarity
COMMENT ON COLUMN delivery_locations.latitude IS 'GPS latitude coordinate for zone center';
COMMENT ON COLUMN delivery_locations.longitude IS 'GPS longitude coordinate for zone center';
COMMENT ON COLUMN delivery_locations.min_radius_km IS 'Starting distance of the delivery tier in kilometers';
COMMENT ON COLUMN delivery_locations.radius_km IS 'Ending distance (max radius) of the delivery tier in kilometers';

-- 5. Update existing records
UPDATE delivery_locations SET min_radius_km = 0.00 WHERE min_radius_km IS NULL;

-- 6. Create GPS index for faster queries
CREATE INDEX IF NOT EXISTS idx_delivery_locations_gps ON delivery_locations(latitude, longitude);
