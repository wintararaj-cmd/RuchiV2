-- Migration: Add min_order_value to delivery_locations
-- Purpose: Support setting a minimum order amount for specific delivery zones

ALTER TABLE delivery_locations ADD COLUMN IF NOT EXISTS min_order_value DECIMAL(10, 2) DEFAULT 0.00;

COMMENT ON COLUMN delivery_locations.min_order_value IS 'The minimum subtotal required for a delivery order to this location';

-- Update Pandua Tier3 if it exists
UPDATE delivery_locations SET min_order_value = 1000.00 WHERE location_name = 'Pandua Tier3';
