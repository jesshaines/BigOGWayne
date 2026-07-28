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
