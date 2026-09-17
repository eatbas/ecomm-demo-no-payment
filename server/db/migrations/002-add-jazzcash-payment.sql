CREATE TABLE order_items_backup AS SELECT * FROM order_items;
DROP TABLE order_items;

CREATE TABLE orders_v2 (
  id TEXT PRIMARY KEY NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_fingerprint TEXT NOT NULL,
  demo_customer_id TEXT NOT NULL CHECK (demo_customer_id = 'demo-customer'),
  created_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('pending', 'paid', 'failed', 'not_configured')),
  currency TEXT NOT NULL CHECK (currency IN ('EUR', 'PKR')),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  item_count INTEGER NOT NULL CHECK (item_count > 0)
) STRICT;

INSERT INTO orders_v2 (
  id, reference, idempotency_key, request_fingerprint,
  demo_customer_id, created_at, status, payment_status,
  currency, subtotal_cents, item_count
) SELECT
  id, reference, idempotency_key, request_fingerprint,
  demo_customer_id, created_at, status, payment_status,
  currency, subtotal_cents, item_count
FROM orders;

DROP TABLE orders;
ALTER TABLE orders_v2 RENAME TO orders;

CREATE INDEX orders_completed_newest_idx
  ON orders(status, created_at DESC, id DESC);

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

INSERT INTO order_items SELECT * FROM order_items_backup;
DROP TABLE order_items_backup;

CREATE TABLE payment_transactions (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  txn_ref_no TEXT NOT NULL UNIQUE,
  txn_type TEXT NOT NULL,
  amount_paisa INTEGER NOT NULL CHECK (amount_paisa > 0),
  currency TEXT NOT NULL CHECK (currency = 'PKR'),
  status TEXT NOT NULL CHECK (status IN ('initiated', 'pending', 'paid', 'failed')),
  response_code TEXT,
  response_message TEXT,
  retrieval_ref_no TEXT,
  auth_code TEXT,
  txn_datetime TEXT,
  raw_ipn_payload TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX payment_transactions_order_idx
  ON payment_transactions(order_id);

CREATE INDEX payment_transactions_txn_ref_no_idx
  ON payment_transactions(txn_ref_no);
