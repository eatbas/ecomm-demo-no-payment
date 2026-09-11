CREATE TABLE orders_v2 (
  id TEXT PRIMARY KEY NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_fingerprint TEXT NOT NULL,
  demo_customer_id TEXT NOT NULL CHECK (demo_customer_id = 'demo-customer'),
  created_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status = 'completed'),
  payment_status TEXT NOT NULL CHECK (
    payment_status IN ('awaiting_payment', 'paid', 'failed', 'ambiguous')
  ),
  currency TEXT NOT NULL CHECK (currency = 'PKR'),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  item_count INTEGER NOT NULL CHECK (item_count > 0)
) STRICT;

INSERT INTO orders_v2 (
  id, reference, idempotency_key, request_fingerprint, demo_customer_id,
  created_at, status, payment_status, currency, subtotal_cents, item_count
)
SELECT
  id, reference, idempotency_key, request_fingerprint, demo_customer_id,
  created_at, status, 'paid', 'PKR', subtotal_cents, item_count
FROM orders;

DROP TABLE orders;
ALTER TABLE orders_v2 RENAME TO orders;

CREATE INDEX orders_payment_status_newest_idx
  ON orders(payment_status, created_at DESC, id DESC);

CREATE INDEX orders_completed_newest_idx
  ON orders(status, created_at DESC, id DESC);

CREATE TABLE payments (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL CHECK (provider = 'jazzcash'),
  pp_txn_ref_no TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (
    status IN ('awaiting_payment', 'paid', 'failed', 'ambiguous')
  ),
  amount_paisa INTEGER NOT NULL CHECK (amount_paisa > 0),
  pp_response_code TEXT,
  pp_status TEXT,
  initiated_at TEXT NOT NULL,
  resolved_at TEXT,
  last_event_source TEXT CHECK (
    last_event_source IS NULL
    OR last_event_source IN ('ipn', 'status_inquiry', 'return_redirect')
  ),
  last_raw_payload TEXT
) STRICT;

CREATE INDEX payments_order_idx ON payments(order_id);
CREATE INDEX payments_unresolved_idx
  ON payments(status, initiated_at)
  WHERE status IN ('awaiting_payment', 'ambiguous');
