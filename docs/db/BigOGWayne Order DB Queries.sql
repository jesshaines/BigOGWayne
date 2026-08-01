--1. Recent orders overview
select
  id,
  status,
  subtotal_cents,
  shipping_cents,
  total_cents,
  square_order_id,
  square_payment_id,
  printify_order_id,
  printify_status,
  shipping_source,
  shipping_method,
  created_at,
  updated_at
from pending_orders
order by created_at desc
limit 25;

--2.Recent successful Printify orders
select
  id,
  status,
  subtotal_cents,
  shipping_cents,
  total_cents,
  square_order_id,
  square_payment_id,
  printify_order_id,
  printify_status,
  paid_at,
  printify_submitted_at,
  created_at
from pending_orders
where status = 'printify_submitted'
order by printify_submitted_at desc
limit 25;

--3. Orders paid but not submitted to Printify

--This is one of the most important troubleshooting queries.
select
  id,
  status,
  subtotal_cents,
  shipping_cents,
  total_cents,
  square_order_id,
  square_payment_id,
  printify_order_id,
  paid_at,
  fulfillment_attempted_at,
  fulfillment_error_json,
  created_at,
  updated_at
from pending_orders
where status = 'paid'
order by updated_at desc;

--4. Fulfillment problems
select
  id,
  status,
  subtotal_cents,
  shipping_cents,
  total_cents,
  square_order_id,
  square_payment_id,
  printify_order_id,
  fulfillment_attempted_at,
  fulfillment_error_json,
  created_at,
  updated_at
from pending_orders
where status in (
  'fulfillment_failed',
  'fulfillment_blocked',
  'printify_address_missing'
)
order by updated_at desc;

--5. Abandoned or unpaid checkout links
select
  id,
  status,
  subtotal_cents,
  shipping_cents,
  total_cents,
  square_checkout_url,
  created_at,
  updated_at
from pending_orders
where status = 'payment_link_created'
order by created_at desc;


--Older than 24 hours:
select
  id,
  status,
  subtotal_cents,
  shipping_cents,
  total_cents,
  square_checkout_url,
  created_at,
  updated_at
from pending_orders
where status = 'payment_link_created'
  and created_at < now() - interval '24 hours'
order by created_at desc;

--6. Payment link failures
select
  id,
  status,
  subtotal_cents,
  shipping_cents,
  total_cents,
  error_json,
  created_at,
  updated_at
from pending_orders
where status = 'payment_link_failed'
order by updated_at desc;


--7. Find one order by pending order ID

--Replace the ID with the one you’re investigating.
select *
from pending_orders
where id = '3dc25cd8-a521-4031-890a-6abd5a4de1f3';

--8. Find one order by Square payment ID

select *
from pending_orders
where square_payment_id = 'PASTE_SQUARE_PAYMENT_ID_HERE';

--9. Find one order by Square order ID
select *
from pending_orders
where square_order_id = 'PASTE_SQUARE_ORDER_ID_HERE';

--10. Find one order by Printify order ID
select *
from pending_orders
where printify_order_id = 'PASTE_PRINTIFY_ORDER_ID_HERE';

--11. View line items for recent orders

--This shows what product/variant/quantity was stored.
select
  id,
  status,
  line_items_json,
  subtotal_cents,
  shipping_cents,
  total_cents,
  created_at
from pending_orders
order by created_at desc
limit 10;

--12. Expand line items into readable rows
--This is super useful once you have multiple-item orders.
select
  po.id as pending_order_id,
  po.status,
  item ->> 'product_title' as product_title,
  item ->> 'variant_title' as variant_title,
  item ->> 'product_id' as product_id,
  item ->> 'variant_id' as variant_id,
  (item ->> 'quantity')::int as quantity,
  (item ->> 'unit_price_cents')::int as unit_price_cents,
  (item ->> 'line_total_cents')::int as line_total_cents,
  po.created_at
from pending_orders po
cross join lateral jsonb_array_elements(po.line_items_json) as item
order by po.created_at desc
limit 50;

--13. Check shipping quote data
select
  id,
  status,
  shipping_cents,
  total_cents,
  shipping_source,
  shipping_method,
  shipping_quote_json,
  created_at
from pending_orders
order by created_at desc
limit 10;


--14. Check stored customer/shipping data for a problem order

--Use this when Printify says the address is missing or invalid.

select
  id,
  status,
  customer_json,
  shipping_json,
  fulfillment_error_json,
  created_at,
  updated_at
from pending_orders
where id = 'PASTE_PENDING_ORDER_ID_HERE';


--15. Recent webhook events
select
  event_id,
  event_type,
  status,
  result,
  square_payment_id,
  square_order_id,
  received_at,
  processed_at
from processed_square_events
order by received_at desc
limit 25;


--16. Webhook events for one Square payment
select
  event_id,
  event_type,
  status,
  result,
  square_payment_id,
  square_order_id,
  received_at,
  processed_at
from processed_square_events
where square_payment_id = 'PASTE_SQUARE_PAYMENT_ID_HERE'
order by received_at desc;


--17. Duplicate payment updates

--This helps confirm Square sent multiple updates but your app did not duplicate fulfillment.

select
  square_payment_id,
  square_order_id,
  count(*) as event_count,
  min(received_at) as first_received,
  max(received_at) as last_received
from processed_square_events
where square_payment_id is not null
group by square_payment_id, square_order_id
having count(*) > 1
order by last_received desc;


--18. Events marked unmatched or ignored
select
  event_id,
  event_type,
  status,
  result,
  square_payment_id,
  square_order_id,
  received_at,
  processed_at
from processed_square_events
where status in ('unmatched', 'ignored')
order by received_at desc;


--19. Amount verification problems
select
  event_id,
  event_type,
  status,
  result,
  square_payment_id,
  square_order_id,
  payload_json,
  received_at,
  processed_at
from processed_square_events
where result ilike '%amount%'
   or status ilike '%amount%'
order by received_at desc;


--20. Daily order summary
select
  date_trunc('day', created_at) as order_day,
  count(*) as total_pending_rows,
  count(*) filter (where status = 'printify_submitted') as printify_submitted,
  count(*) filter (where status = 'payment_link_created') as unpaid_checkout_links,
  count(*) filter (where status = 'fulfillment_failed') as fulfillment_failed,
  sum(total_cents) filter (where status = 'printify_submitted') as submitted_total_cents
from pending_orders
group by date_trunc('day', created_at)
order by order_day desc;

--21. Simple revenue-ish view
--This is not true profit because it does not subtract Square fees or Printify production costs, but it shows customer-paid totals.

select
  id,
  status,
  subtotal_cents / 100.0 as item_subtotal_usd,
  shipping_cents / 100.0 as shipping_usd,
  total_cents / 100.0 as customer_total_usd,
  printify_order_id,
  created_at
from pending_orders
where status = 'printify_submitted'
order by created_at desc;

--22. Table columns quick reference
--Useful when Codex changes schema and you want to confirm columns exist.

select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_name = 'pending_orders'
order by ordinal_position;

And for webhook events:

select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_name = 'processed_square_events'
order by ordinal_position;


--23. Manual future cleanup preview query

--This does not update anything. It only shows what would eventually be marked abandoned.

select
  id,
  status,
  subtotal_cents,
  shipping_cents,
  total_cents,
  created_at,
  updated_at
from pending_orders
where status = 'payment_link_created'
  and created_at < now() - interval '48 hours'
order by created_at desc;
