CREATE TABLE orders (
  id TEXT PRIMARY KEY NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_fingerprint TEXT NOT NULL,
  demo_customer_id TEXT NOT NULL CHECK (demo_customer_id = 'demo-customer'),
  created_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status = 'completed'),
  payment_status TEXT NOT NULL CHECK (payment_status = 'not_configured'),
  currency TEXT NOT NULL CHECK (currency = 'EUR'),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  item_count INTEGER NOT NULL CHECK (item_count > 0)
) STRICT;

CREATE TABLE order_items (
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  line_number INTEGER NOT NULL CHECK (line_number >= 0),
  product_id TEXT NOT NULL CHECK (length(product_id) BETWEEN 1 AND 100),
  product_name TEXT NOT NULL CHECK (length(product_name) BETWEEN 1 AND 120),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  line_total_cents INTEGER NOT NULL CHECK (
    line_total_cents = unit_price_cents * quantity
  ),
  PRIMARY KEY (order_id, line_number),
  UNIQUE (order_id, product_id)
) STRICT;

CREATE INDEX orders_completed_newest_idx
  ON orders(status, created_at DESC, id DESC);
