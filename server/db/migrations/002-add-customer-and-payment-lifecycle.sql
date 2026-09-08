-- Replaces the fixed demo customer and the single always-'completed'/
-- 'not_configured' literals with real captured customer details and a genuine
-- payment lifecycle, ahead of the JazzCash integration.
--
-- DROP TABLE never enforces foreign keys against the table being dropped (SQLite
-- simply removes the associated child key constraints), so order_items' existing
-- `order_id REFERENCES orders(id)` clause is untouched and resolves correctly
-- again as soon as a table literally named `orders` exists with matching ids.

CREATE TABLE orders_v2 (
  id TEXT PRIMARY KEY NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payment_status TEXT NOT NULL CHECK (
    payment_status IN ('awaiting_payment', 'paid', 'failed', 'ambiguous')
  ),
  currency TEXT NOT NULL CHECK (currency = 'PKR'),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  item_count INTEGER NOT NULL CHECK (item_count > 0),
  customer_full_name TEXT NOT NULL CHECK (length(customer_full_name) BETWEEN 1 AND 120),
  customer_email TEXT NOT NULL CHECK (length(customer_email) BETWEEN 1 AND 254),
  customer_phone TEXT NOT NULL CHECK (length(customer_phone) BETWEEN 1 AND 32),
  customer_address_line1 TEXT NOT NULL CHECK (length(customer_address_line1) BETWEEN 1 AND 160),
  customer_city TEXT NOT NULL CHECK (length(customer_city) BETWEEN 1 AND 120),
  customer_postcode TEXT NOT NULL CHECK (length(customer_postcode) BETWEEN 1 AND 20),
  customer_country TEXT NOT NULL CHECK (length(customer_country) BETWEEN 1 AND 60)
) STRICT;

-- Every pre-existing row was, by construction, the old demo's single fixed
-- customer and was already treated as a completed, unpaid demo order; carry
-- that forward as 'paid' (its historical, immutable meaning) rather than
-- inventing a different status for data this migration cannot re-derive.
INSERT INTO orders_v2 (
  id, reference, idempotency_key, request_fingerprint, created_at,
  payment_status, currency, subtotal_cents, item_count,
  customer_full_name, customer_email, customer_phone,
  customer_address_line1, customer_city, customer_postcode, customer_country
)
SELECT
  id, reference, idempotency_key, request_fingerprint, created_at,
  'paid', 'PKR', subtotal_cents, item_count,
  'Alex Example', 'alex@example.test', '+44 20 7946 0000',
  '1 Demo Street', 'Exampleton', 'DE1 0MO', 'United Kingdom'
FROM orders;

DROP TABLE orders;
ALTER TABLE orders_v2 RENAME TO orders;

CREATE INDEX orders_paid_newest_idx
  ON orders(payment_status, created_at DESC, id DESC);

-- One row per JazzCash payment attempt against an order. Card entry itself
-- never touches this application: JazzCash hosts the card page, so no PAN,
-- CVV, or cardholder credential is ever stored here.
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
  -- The raw last IPN/Status Inquiry payload, stored for audit with pp_Password
  -- redacted before persistence (the IPN payload echoes it back verbatim).
  last_raw_payload TEXT
) STRICT;

CREATE INDEX payments_order_idx ON payments(order_id);
CREATE INDEX payments_unresolved_idx
  ON payments(status, initiated_at)
  WHERE status IN ('awaiting_payment', 'ambiguous');
