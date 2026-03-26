-- ============================================
-- RUCHI RESTAURANT MANAGEMENT SYSTEM
-- Complete Database Schema
-- ============================================
-- Version: 2.0
-- Last Updated: December 2025
-- ============================================

-- ============================================
-- USERS TABLE
-- Stores all users: customers, admins, delivery boys, salesmen
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    role VARCHAR(20) DEFAULT 'customer', -- 'customer', 'admin', 'delivery', 'salesman'
    commission_rate DECIMAL(10, 2) DEFAULT 0, -- For delivery boys and salesmen
    commission_type VARCHAR(20) DEFAULT 'fixed', -- 'fixed' or 'percentage'
    google_id VARCHAR(255), -- For Google OAuth
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CATEGORIES TABLE
-- Menu item categories
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- MENU ITEMS TABLE
-- Restaurant menu catalog
-- ============================================
CREATE TABLE IF NOT EXISTS menu_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    category VARCHAR(100), -- Legacy field, kept for backward compatibility
    price DECIMAL(10, 2) NOT NULL,
    gst_rate DECIMAL(5, 2) DEFAULT 5.00, -- GST percentage (e.g., 5.00 for 5%)
    image_data BYTEA, -- Store image as binary data
    image_type VARCHAR(50), -- e.g., 'image/jpeg', 'image/png'
    available BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- DELIVERY LOCATIONS TABLE
-- Delivery zones with charges
-- ============================================
CREATE TABLE IF NOT EXISTS delivery_locations (
    id SERIAL PRIMARY KEY,
    location_name VARCHAR(255) NOT NULL UNIQUE,
    delivery_charge DECIMAL(10, 2) NOT NULL DEFAULT 0,
    estimated_time INTEGER DEFAULT 30, -- Estimated delivery time in minutes
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ORDERS TABLE
-- Customer orders with all details
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(20) UNIQUE, -- Daily sequential number: YYYYMMDD-XXX
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    customer_name VARCHAR(255), -- Optional for walk-in dine-in/takeaway orders
    customer_email VARCHAR(255),
    customer_phone VARCHAR(20), -- Optional for walk-in dine-in/takeaway orders
    customer_address TEXT,
    order_type VARCHAR(20) DEFAULT 'delivery', -- 'takeaway', 'delivery', 'dine-in'
    table_number VARCHAR(20), -- For dine-in orders
    delivery_location_id INTEGER REFERENCES delivery_locations(id) ON DELETE SET NULL,
    delivery_charge DECIMAL(10, 2) DEFAULT 0,
    delivery_boy_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    driver_commission DECIMAL(10, 2) DEFAULT 0,
    salesman_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    salesman_commission DECIMAL(10, 2) DEFAULT 0,
    items JSONB NOT NULL, -- Store order items as JSON array
    subtotal DECIMAL(10, 2) NOT NULL,
    tax DECIMAL(10, 2) DEFAULT 0,
    discount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL, -- 'cash', 'card', 'upi', 'netbanking'
    payment_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'paid', 'failed'
    order_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'
    notes TEXT,
    cancelled_reason TEXT,
    customer_lat NUMERIC, -- Geolocation latitude
    customer_lng NUMERIC, -- Geolocation longitude
    distance NUMERIC, -- Distance in kilometers from shop
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP
);

-- ============================================
-- INVOICES TABLE
-- Generated billing invoices
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    tax DECIMAL(10, 2) NOT NULL,
    discount DECIMAL(10, 2) NOT NULL,
    delivery_charge DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,
    gst_type VARCHAR(20) DEFAULT 'regular', -- 'regular', 'composite', 'unregistered'
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- SETTINGS TABLE
-- Application configuration settings
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- EXPENSES TABLE
-- Business expense tracking
-- ============================================
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100) NOT NULL, -- 'rent', 'utilities', 'supplies', 'salaries', 'other'
    description TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50), -- 'cash', 'card', 'upi', 'netbanking'
    expense_date DATE NOT NULL,
    notes TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PAYOUTS TABLE
-- Salary/commission payouts to staff
-- ============================================
CREATE TABLE IF NOT EXISTS payouts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    payout_date DATE NOT NULL,
    payment_method VARCHAR(50), -- 'cash', 'bank_transfer', 'upi'
    notes TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- IMAGES TABLE
-- Additional images for menu items
-- ============================================
CREATE TABLE IF NOT EXISTS images (
    id SERIAL PRIMARY KEY,
    menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Categories indexes
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);

-- Menu items indexes
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(available);
CREATE INDEX IF NOT EXISTS idx_menu_items_featured ON menu_items(is_featured);

-- Delivery locations indexes
CREATE INDEX IF NOT EXISTS idx_delivery_locations_active ON delivery_locations(is_active);

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_boy ON orders(delivery_boy_id);
CREATE INDEX IF NOT EXISTS idx_orders_salesman ON orders(salesman_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_location ON orders(delivery_location_id);

-- Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_generated_at ON invoices(generated_at);

-- Expenses indexes
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- Payouts indexes
CREATE INDEX IF NOT EXISTS idx_payouts_user_id ON payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_date ON payouts(payout_date);

-- ============================================
-- DEFAULT DATA
-- ============================================

-- Insert default admin user (password: admin123)
-- Note: This is a bcrypt hash of 'admin123'
INSERT INTO users (email, password_hash, name, role) 
VALUES ('admin@restaurant.com', '$2a$10$g/BDopkmH4ApGpJfgmCXMe4fgAgWIBlmzU3shxVX9ebmdgb6.d6im', 'Admin', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Insert default categories
INSERT INTO categories (name, description, sort_order) VALUES
('APPETIZERS', 'Starters and appetizers', 1),
('MAIN COURSE', 'Main course dishes', 2),
('BREADS', 'Indian breads', 3),
('RICE', 'Rice dishes', 4),
('DESSERTS', 'Sweet dishes', 5),
('BEVERAGES', 'Drinks and beverages', 6)
ON CONFLICT (name) DO NOTHING;

-- Insert default settings
INSERT INTO settings (key, value, description) VALUES
('restaurant_name', 'Ruchi Restaurant', 'Name of the restaurant'),
('restaurant_address', '123 Main Street, City, State - 123456', 'Address of the restaurant'),
('restaurant_phone', '+91 1234567890', 'Phone number'),
('restaurant_email', 'info@ruchi.com', 'Email address'),
('gst_number', '', 'GST Identification Number'),
('gst_type', 'regular', 'GST Type: regular, composite, or unregistered'),
('printer_type', 'thermal', 'Printer type: thermal or a4'),
('paper_width', '80mm', 'Paper width for thermal printer'),
('show_logo', 'true', 'Show logo on invoice'),
('footer_text', 'Thank you for your business!', 'Invoice footer text'),
('tax_rate', '5.00', 'Default tax rate percentage'),
('currency', 'INR', 'Currency code'),
('currency_symbol', '₹', 'Currency symbol')
ON CONFLICT (key) DO NOTHING;

-- Insert sample delivery locations
INSERT INTO delivery_locations (location_name, delivery_charge, estimated_time, is_active) VALUES
('City Center', 30.00, 20, true),
('North Zone', 50.00, 30, true),
('South Zone', 50.00, 30, true),
('East Zone', 60.00, 35, true),
('West Zone', 60.00, 35, true),
('Suburbs', 80.00, 45, true),
('Airport Area', 100.00, 60, true)
ON CONFLICT (location_name) DO NOTHING;

-- Insert sample menu items (optional)
INSERT INTO menu_items (name, description, category, price, gst_rate, available) VALUES
('Paneer Tikka', 'Grilled cottage cheese marinated in spices', 'APPETIZERS', 250.00, 5.00, true),
('Chicken Biryani', 'Aromatic basmati rice with tender chicken', 'MAIN COURSE', 350.00, 5.00, true),
('Dal Makhani', 'Creamy black lentils cooked overnight', 'MAIN COURSE', 200.00, 5.00, true),
('Butter Naan', 'Soft leavened bread with butter', 'BREADS', 50.00, 5.00, true),
('Gulab Jamun', 'Sweet dumplings in sugar syrup', 'DESSERTS', 80.00, 5.00, true),
('Mango Lassi', 'Refreshing yogurt drink with mango', 'BEVERAGES', 100.00, 5.00, true)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE users IS 'Stores all user accounts including customers, admins, delivery boys, and salesmen';
COMMENT ON TABLE categories IS 'Menu item categories for organizing the menu';
COMMENT ON TABLE menu_items IS 'Restaurant menu catalog with pricing and availability';
COMMENT ON TABLE delivery_locations IS 'Delivery zones with associated charges and estimated times';
COMMENT ON TABLE orders IS 'Customer orders with items, pricing, and status tracking';
COMMENT ON TABLE invoices IS 'Generated billing invoices for orders';
COMMENT ON TABLE settings IS 'Application configuration and restaurant settings';
COMMENT ON TABLE expenses IS 'Business expense tracking for financial management';
COMMENT ON TABLE payouts IS 'Salary and commission payouts to staff members';
COMMENT ON TABLE images IS 'Additional images for menu items';

-- ============================================
-- END OF SCHEMA
-- ============================================
