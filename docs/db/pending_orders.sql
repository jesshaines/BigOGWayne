CREATE TABLE IF NOT EXISTS pending_orders (
  id uuid PRIMARY KEY,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  square_payment_link_id text,
  square_order_id text,
  square_payment_id text,
  square_checkout_url text,
  printify_order_id text,
  printify_status text,
  printify_order_json jsonb,
  printify_submitted_at timestamptz,
  fulfillment_attempted_at timestamptz,
  fulfillment_error_json jsonb,
  currency text NOT NULL DEFAULT 'USD',
  subtotal_cents integer NOT NULL DEFAULT 0,
  line_items_json jsonb NOT NULL,
  customer_json jsonb,
  shipping_json jsonb,
  payment_json jsonb,
  paid_at timestamptz,
  error_json jsonb
);

CREATE TABLE IF NOT EXISTS processed_square_events (
  event_id text PRIMARY KEY,
  pending_order_id uuid REFERENCES pending_orders(id),
  event_type text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NOT NULL DEFAULT now(),
  status text,
  result text,
  square_payment_id text,
  square_order_id text,
  error_json jsonb,
  payload_json jsonb
);

-- Fulfillment recovery checks
--
-- Recent pending orders:
-- select id, status, square_order_id, square_payment_id, printify_order_id, subtotal_cents, created_at, updated_at
-- from pending_orders
-- order by created_at desc
-- limit 20;
--
-- Orders that need owner attention:
-- select id, status, fulfillment_error_json
-- from pending_orders
-- where status in ('fulfillment_failed', 'fulfillment_blocked', 'printify_address_missing')
-- order by updated_at desc;
--
-- Paid orders that have not been submitted to Printify:
-- select id, status, square_order_id, square_payment_id, subtotal_cents, paid_at
-- from pending_orders
-- where status = 'paid'
--   and printify_order_id is null
-- order by paid_at desc;
