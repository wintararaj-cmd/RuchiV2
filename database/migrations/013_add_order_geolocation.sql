-- Migration: Add customer geolocation and delivery distance to the orders table
-- Version: 013
-- Added on: 2026-03-26

DO $$
BEGIN
    -- Add customer_lat column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_lat') THEN
        ALTER TABLE orders ADD COLUMN customer_lat NUMERIC;
    END IF;

    -- Add customer_lng column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_lng') THEN
        ALTER TABLE orders ADD COLUMN customer_lng NUMERIC;
    END IF;

    -- Add distance column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'distance') THEN
        ALTER TABLE orders ADD COLUMN distance NUMERIC;
    END IF;
END $$;
