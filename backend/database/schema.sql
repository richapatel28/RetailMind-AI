-- ============================================
-- RETAILMIND DATABASE
-- ============================================

-- USERS
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'OWNER'
        CHECK (role IN ('OWNER', 'ADMIN')),
    language VARCHAR(20) DEFAULT 'en',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- PRODUCTS
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    sku VARCHAR(100) UNIQUE,
    aliases TEXT[],
    unit VARCHAR(50) DEFAULT 'piece',
    purchase_price NUMERIC(10,2) DEFAULT 0,
    selling_price NUMERIC(10,2) NOT NULL,
    current_stock INTEGER DEFAULT 0,
    reorder_level INTEGER DEFAULT 5,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- SUPPLIERS
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    contact VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- CUSTOMERS
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    contact VARCHAR(50),
    address TEXT,
    current_due NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- PURCHASES
CREATE TABLE purchases (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER REFERENCES suppliers(id),
    invoice_no VARCHAR(100),
    purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_amount NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- PURCHASE ITEMS
CREATE TABLE purchase_items (
    id SERIAL PRIMARY KEY,
    purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(10,2) NOT NULL,
    total_cost NUMERIC(12,2) NOT NULL
);


-- SALES
CREATE TABLE sales (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_amount NUMERIC(12,2) DEFAULT 0,
    payment_status VARCHAR(20) DEFAULT 'PAID'
        CHECK (payment_status IN ('PAID', 'PARTIAL', 'CREDIT')),
    input_source VARCHAR(30) DEFAULT 'MANUAL'
        CHECK (input_source IN ('MANUAL', 'VOICE', 'INVOICE', 'IMPORT')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- SALE ITEMS
CREATE TABLE sale_items (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    selling_price NUMERIC(10,2) NOT NULL,
    cost_price NUMERIC(10,2) NOT NULL,
    total_amount NUMERIC(12,2) NOT NULL,
    profit NUMERIC(12,2) NOT NULL
);


-- PAYMENTS
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER REFERENCES sales(id),
    customer_id INTEGER REFERENCES customers(id),
    amount NUMERIC(12,2) NOT NULL,
    mode VARCHAR(20) NOT NULL
        CHECK (mode IN ('CASH', 'UPI', 'BANK', 'CREDIT')),
    reference VARCHAR(150),
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'CONFIRMED'
);


-- INVENTORY MOVEMENTS
CREATE TABLE inventory_movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    movement_type VARCHAR(20) NOT NULL
        CHECK (movement_type IN ('PURCHASE', 'SALE', 'ADJUSTMENT')),
    quantity INTEGER NOT NULL,
    reference_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- EXPENSES
CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    description TEXT,
    expense_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- PAYMENT RECONCILIATION
CREATE TABLE reconciliation_matches (
    id SERIAL PRIMARY KEY,
    payment_id INTEGER REFERENCES payments(id),
    sale_id INTEGER REFERENCES sales(id),
    confidence NUMERIC(5,2),
    status VARCHAR(20) DEFAULT 'MATCHED'
        CHECK (status IN ('MATCHED', 'UNMATCHED', 'REVIEW')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- AI EVENTS
CREATE TABLE ai_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    input_type VARCHAR(30),
    model VARCHAR(100),
    confidence NUMERIC(5,2),
    extracted_json JSONB,
    confirmed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- INDEXES
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_sales_date ON sales(sale_date);
CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_inventory_product ON inventory_movements(product_id);
CREATE INDEX idx_ai_events_user ON ai_events(user_id);