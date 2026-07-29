import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { SquareClient, WebhooksHelper } from "square";
import axios from "axios";
import pg from "pg";

dotenv.config();

const app = express();

app.use(cors());

// ✅ Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SQUARE_ENVIRONMENT = String(process.env.SQUARE_ENVIRONMENT || "sandbox").toLowerCase();
const SQUARE_RESOLVED_ENVIRONMENT =
  SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";
const SQUARE_BASE_URL =
  SQUARE_RESOLVED_ENVIRONMENT === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
const SQUARE_LOCATION_ID = process.env.SQUARE_LOCATION_ID || "LR7K2G01EY6CW";
const SQUARE_WEBHOOK_SIGNATURE_KEY = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
const SQUARE_WEBHOOK_NOTIFICATION_URL =
  process.env.SQUARE_WEBHOOK_NOTIFICATION_URL ||
  (process.env.SITE_BASE_URL
    ? `${process.env.SITE_BASE_URL.replace(/\/+$/, "")}/webhooks/square`
    : "");
const DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_SSL_ENABLED =
  Boolean(DATABASE_URL) &&
  !/localhost|127\.0\.0\.1/i.test(DATABASE_URL) &&
  process.env.DATABASE_SSL !== "false";

console.log("Square environment:", SQUARE_RESOLVED_ENVIRONMENT);
console.log("Square base URL:", SQUARE_BASE_URL);

// ✅ Square client
const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN,
  baseUrl: SQUARE_BASE_URL,
});

const { Pool } = pg;
const dbPool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_SSL_ENABLED ? { rejectUnauthorized: false } : undefined
    })
  : null;

const CHECKOUT_MAX_QUANTITY = 10;
const CHECKOUT_STALE_CART_MESSAGE =
  "Some items changed or are no longer available. Please refresh your Loot Bag and try again.";
const CHECKOUT_TEMPORARY_UNAVAILABLE_MESSAGE =
  "Checkout is temporarily unavailable. Please try again in a few minutes.";
const PENDING_ORDER_SCHEMA_SQL = `
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
  shipping_cents integer,
  total_cents integer,
  line_items_json jsonb NOT NULL,
  customer_json jsonb,
  shipping_json jsonb,
  payment_json jsonb,
  paid_at timestamptz,
  error_json jsonb
);

ALTER TABLE pending_orders ADD COLUMN IF NOT EXISTS square_payment_id text;
ALTER TABLE pending_orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE pending_orders ADD COLUMN IF NOT EXISTS payment_json jsonb;
ALTER TABLE pending_orders ADD COLUMN IF NOT EXISTS shipping_cents integer;
ALTER TABLE pending_orders ADD COLUMN IF NOT EXISTS total_cents integer;
ALTER TABLE pending_orders ADD COLUMN IF NOT EXISTS printify_status text;
ALTER TABLE pending_orders ADD COLUMN IF NOT EXISTS printify_order_json jsonb;
ALTER TABLE pending_orders ADD COLUMN IF NOT EXISTS printify_submitted_at timestamptz;
ALTER TABLE pending_orders ADD COLUMN IF NOT EXISTS fulfillment_attempted_at timestamptz;
ALTER TABLE pending_orders ADD COLUMN IF NOT EXISTS fulfillment_error_json jsonb;

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

ALTER TABLE processed_square_events ADD COLUMN IF NOT EXISTS received_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE processed_square_events ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE processed_square_events ADD COLUMN IF NOT EXISTS result text;
ALTER TABLE processed_square_events ADD COLUMN IF NOT EXISTS square_payment_id text;
ALTER TABLE processed_square_events ADD COLUMN IF NOT EXISTS square_order_id text;
ALTER TABLE processed_square_events ADD COLUMN IF NOT EXISTS error_json jsonb;
`;

const FULFILLMENT_SCHEMA_SQL = `
ALTER TABLE pending_orders ADD COLUMN IF NOT EXISTS shipping_cents integer;
ALTER TABLE pending_orders ADD COLUMN IF NOT EXISTS total_cents integer;
ALTER TABLE pending_orders ADD COLUMN IF NOT EXISTS printify_status text;
ALTER TABLE pending_orders ADD COLUMN IF NOT EXISTS printify_order_json jsonb;
ALTER TABLE pending_orders ADD COLUMN IF NOT EXISTS printify_submitted_at timestamptz;
ALTER TABLE pending_orders ADD COLUMN IF NOT EXISTS fulfillment_attempted_at timestamptz;
ALTER TABLE pending_orders ADD COLUMN IF NOT EXISTS fulfillment_error_json jsonb;
`;

const PRINTIFY_API = "https://api.printify.com/v1";
const PRINTIFY_API_TOKEN = process.env.PRINTIFY_API_TOKEN;
const PRINTIFY_SHOP_ID = process.env.PRINTIFY_SHOP_ID;
const PRINTIFY_PRODUCTS_ENDPOINT = `/shops/${PRINTIFY_SHOP_ID}/products.json`;
const PRINTIFY_PRODUCTS_ENDPOINT_LABEL = "/shops/[PRINTIFY_SHOP_ID]/products.json";
const PRINTIFY_ORDERS_ENDPOINT = `/shops/${PRINTIFY_SHOP_ID}/orders.json`;
const PRINTIFY_ORDERS_ENDPOINT_LABEL = "/shops/[PRINTIFY_SHOP_ID]/orders.json";
const PRINTIFY_DEFAULT_SHIPPING_METHOD = Number(process.env.PRINTIFY_DEFAULT_SHIPPING_METHOD || 1);
const PRINTIFY_SEND_SHIPPING_NOTIFICATION =
  process.env.PRINTIFY_SEND_SHIPPING_NOTIFICATION !== "false";

function parseConfiguredShippingFeeCents() {
  const rawValue = process.env.PRINTIFY_DEFAULT_SHIPPING_FEE_CENTS;
  const value = Number(rawValue);

  if (!rawValue || !Number.isSafeInteger(value) || value <= 0) {
    return null;
  }

  return value;
}

function buildSquareShippingServiceCharge(shippingCents) {
  return {
    name: "Shipping",
    amountMoney: {
      amount: BigInt(shippingCents),
      currency: "USD"
    },
    calculationPhase: "TOTAL_PHASE",
    taxable: false
  };
}

function buildSquarePaymentLinkRequest({
  pendingOrderId,
  lineItems,
  shippingCents
}) {
  return {
    idempotencyKey: pendingOrderId,
    order: {
      locationId: SQUARE_LOCATION_ID,
      referenceId: pendingOrderId,
      metadata: {
        pending_order_id: pendingOrderId
      },
      lineItems,
      serviceCharges: [
        buildSquareShippingServiceCharge(shippingCents)
      ]
    },
    checkoutOptions: {
      askForShippingAddress: true
    }
  };
}

function squarePaymentLinkRequestIncludesShippingFee(request = {}) {
  const serviceCharges = Array.isArray(request.order?.serviceCharges)
    ? request.order.serviceCharges
    : [];

  return serviceCharges.some(serviceCharge => (
    serviceCharge?.name === "Shipping" &&
    Number(serviceCharge?.amountMoney?.amount) > 0 &&
    serviceCharge?.amountMoney?.currency === "USD"
  ));
}

function logSquarePaymentLinkRequestShape({ request = {}, subtotalCents = 0, shippingCents = 0, totalCents = 0 }) {
  const checkoutOptions = request.checkoutOptions || {};
  const serviceCharges = Array.isArray(request.order?.serviceCharges)
    ? request.order.serviceCharges
    : [];

  console.log("SQUARE PAYMENT LINK REQUEST SHAPE", {
    subtotal_cents: subtotalCents,
    shipping_cents: shippingCents,
    total_cents: totalCents,
    checkoutOptionsPresent: hasObjectData(checkoutOptions),
    askForShippingAddress: checkoutOptions.askForShippingAddress === true,
    checkoutOptionsIncludesShippingFee: Boolean(checkoutOptions.shippingFee),
    orderIncludesShippingServiceCharge: squarePaymentLinkRequestIncludesShippingFee(request),
    shippingServiceChargeCount: serviceCharges.filter(serviceCharge => serviceCharge?.name === "Shipping").length
  });
}

const printify = axios.create({
  baseURL: PRINTIFY_API,
  headers: {
    Authorization: `Bearer ${PRINTIFY_API_TOKEN}`,
    "Content-Type": "application/json"
  }
});

function sanitizeLogBody(value) {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeLogBody(item));
  }

  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      const shouldRedact = /token|secret|password|authorization|api[_-]?key/i.test(key);
      return [key, shouldRedact ? "[REDACTED]" : sanitizeLogBody(entry)];
    })
  );
}

function normalizeProductsResponse(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.products)) return payload.products;
  return [];
}

async function fetchCurrentPrintifyProducts() {
  const response = await printify.get(PRINTIFY_PRODUCTS_ENDPOINT);
  return normalizeProductsResponse(response.data);
}

async function initializeDatabase() {
  if (!dbPool) {
    console.warn("DATABASE_URL is not configured; checkout pending order storage is disabled.");
    return;
  }

  await dbPool.query(PENDING_ORDER_SCHEMA_SQL);
  await dbPool.query(FULFILLMENT_SCHEMA_SQL);
  console.log("Database initialized: pending_orders and fulfillment columns ready");
}

function isVariantPurchasable(variant = {}) {
  return variant?.is_enabled !== false && variant?.is_available !== false;
}

function getItemProductId(item = {}) {
  return String(item.productId || "").trim();
}

function getItemVariantId(item = {}) {
  return String(item.variantId || "").trim();
}

function parseCheckoutQuantity(value) {
  const quantity = Number(value);
  return Number.isInteger(quantity) ? quantity : null;
}

function createValidationError(status, items, message = CHECKOUT_STALE_CART_MESSAGE) {
  return {
    status,
    body: {
      error: "Cart validation failed",
      message,
      items
    }
  };
}

function buildValidatedCartItems(cart = []) {
  const shapeErrors = [];
  const mergedItems = new Map();

  cart.forEach((item, index) => {
    const productId = getItemProductId(item);
    const variantId = getItemVariantId(item);
    const quantity = parseCheckoutQuantity(item?.quantity);

    if (!productId) {
      shapeErrors.push({ index, reason: "Missing product ID" });
    }

    if (!variantId) {
      shapeErrors.push({ index, productId, reason: "Missing variant ID" });
    }

    if (quantity === null) {
      shapeErrors.push({ index, productId, variantId, reason: "Quantity must be a whole number" });
    } else if (quantity < 1) {
      shapeErrors.push({ index, productId, variantId, reason: "Quantity must be at least 1" });
    } else if (quantity > CHECKOUT_MAX_QUANTITY) {
      shapeErrors.push({
        index,
        productId,
        variantId,
        reason: `Quantity cannot exceed ${CHECKOUT_MAX_QUANTITY}`
      });
    }

    if (!productId || !variantId || quantity === null || quantity < 1 || quantity > CHECKOUT_MAX_QUANTITY) {
      return;
    }

    const key = `${productId}::${variantId}`;
    const existing = mergedItems.get(key);

    if (existing) {
      existing.quantity += quantity;
      existing.sourceIndexes.push(index);
    } else {
      mergedItems.set(key, {
        productId,
        variantId,
        quantity,
        sourceIndexes: [index]
      });
    }
  });

  const quantityErrors = Array.from(mergedItems.values())
    .filter(item => item.quantity > CHECKOUT_MAX_QUANTITY)
    .map(item => ({
      productId: item.productId,
      variantId: item.variantId,
      reason: `Combined quantity cannot exceed ${CHECKOUT_MAX_QUANTITY}`
    }));

  return {
    items: Array.from(mergedItems.values()),
    errors: [...shapeErrors, ...quantityErrors]
  };
}

function buildCheckoutLineItemsFromPrintify(cartItems = [], products = []) {
  const validationErrors = [];
  const lineItems = [];
  const pendingLineItems = [];
  let subtotalCents = 0;

  cartItems.forEach(item => {
    const product = products.find(productItem => String(productItem?.id || "") === item.productId);

    if (!product) {
      validationErrors.push({
        productId: item.productId,
        variantId: item.variantId,
        reason: "Product not found"
      });
      return;
    }

    if (product.is_deleted === true) {
      validationErrors.push({
        productId: item.productId,
        variantId: item.variantId,
        reason: "Product is no longer available"
      });
      return;
    }

    if (product.visible === false) {
      validationErrors.push({
        productId: item.productId,
        variantId: item.variantId,
        reason: "Product is not visible"
      });
      return;
    }

    const variant = Array.isArray(product.variants)
      ? product.variants.find(variantItem => String(variantItem?.id || "") === item.variantId)
      : null;

    if (!variant) {
      validationErrors.push({
        productId: item.productId,
        variantId: item.variantId,
        reason: "Variant not found"
      });
      return;
    }

    if (!isVariantPurchasable(variant)) {
      validationErrors.push({
        productId: item.productId,
        variantId: item.variantId,
        reason: "Variant is no longer available"
      });
      return;
    }

    const priceCents = Number(variant.price);

    if (!Number.isSafeInteger(priceCents) || priceCents <= 0) {
      validationErrors.push({
        productId: item.productId,
        variantId: item.variantId,
        reason: "Variant price is unavailable"
      });
      return;
    }

    const productTitle = String(product.title || product.name || "Big OG Wayne Product").trim();
    const variantTitle = String(variant.title || "").trim();
    const lineItemName = variantTitle && variantTitle !== "Default"
      ? `${productTitle} — ${variantTitle}`
      : productTitle;
    const lineTotalCents = priceCents * item.quantity;

    subtotalCents += lineTotalCents;
    pendingLineItems.push({
      product_id: item.productId,
      variant_id: item.variantId,
      quantity: item.quantity,
      product_title: productTitle,
      variant_title: variantTitle || null,
      square_line_item_name: lineItemName,
      unit_price_cents: priceCents,
      line_total_cents: lineTotalCents
    });

    lineItems.push({
      name: lineItemName,
      quantity: String(item.quantity),
      basePriceMoney: {
        // Printify variant.price is returned in cents, which is the unit Square expects.
        amount: BigInt(priceCents),
        currency: "USD",
      },
    });
  });

  return { lineItems, pendingLineItems, subtotalCents, validationErrors };
}

function createSafeErrorJson(error) {
  return sanitizeLogBody({
    message: error?.message || "Unknown error",
    status: error?.response?.status || null,
    response: error?.response?.data || null
  });
}

function getSquareAmountValue(money = {}) {
  const amount = money.amount ?? money.value;
  if (typeof amount === "bigint") return Number(amount);
  return Number(amount);
}

function hasObjectData(value = {}) {
  return Boolean(value && typeof value === "object" && Object.keys(value).length);
}

function isUuid(value = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value)
  );
}

function isSquareNotFoundError(error = {}) {
  if (error?.statusCode === 404 || error?.response?.status === 404) {
    return true;
  }

  const errorBody = error?.body || error?.response?.data || error?.errors || [];
  const errors = Array.isArray(errorBody?.errors)
    ? errorBody.errors
    : Array.isArray(errorBody)
      ? errorBody
      : [];

  return errors.some(item => String(item?.code || "").toUpperCase() === "NOT_FOUND");
}

function isSquareForbiddenError(error = {}) {
  if (error?.statusCode === 403 || error?.response?.status === 403) {
    return true;
  }

  const errorBody = error?.body || error?.response?.data || error?.errors || [];
  const errors = Array.isArray(errorBody?.errors)
    ? errorBody.errors
    : Array.isArray(errorBody)
      ? errorBody
      : [];

  return errors.some(item => String(item?.code || "").toUpperCase() === "FORBIDDEN");
}

function getSquareMoney(payment = {}) {
  return payment?.totalMoney || payment?.total_money || payment?.amountMoney || payment?.amount_money || {};
}

function getSquarePaymentIdFromEvent(event = {}) {
  return event?.data?.object?.payment?.id || event?.data?.id || "";
}

function getSquarePaymentStatus(payment = {}) {
  return String(payment?.status || "").toUpperCase();
}

function getSquarePaymentOrderId(payment = {}) {
  return payment?.orderId || payment?.order_id || "";
}

function getSquarePaymentMetadata(payment = {}) {
  return payment?.metadata || {};
}

function getSquareOrderReferenceId(order = {}) {
  return order?.referenceId || order?.reference_id || "";
}

function getSquareOrderMetadata(order = {}) {
  return order?.metadata || {};
}

function getSquareEventId(event = {}) {
  return String(event.event_id || event.eventId || event.id || "").trim();
}

function getSquareEventType(event = {}) {
  return String(event.type || "").trim();
}

function getSquarePaymentFromResponse(response = {}) {
  return response.payment || response.result?.payment || null;
}

function getSquareOrderFromResponse(response = {}) {
  return response.order || response.result?.order || null;
}

async function fetchSquarePayment(paymentId) {
  const response = await squareClient.payments.get({ paymentId });
  return getSquarePaymentFromResponse(response);
}

async function fetchSquareOrder(orderId) {
  const response = await squareClient.orders.get({ orderId });
  return getSquareOrderFromResponse(response);
}

async function verifySquareWebhookSignature(signatureHeader, requestBody) {
  if (!SQUARE_WEBHOOK_SIGNATURE_KEY || !SQUARE_WEBHOOK_NOTIFICATION_URL) {
    throw new Error("Square webhook signature configuration is missing.");
  }

  return WebhooksHelper.verifySignature({
    requestBody,
    signatureHeader,
    signatureKey: SQUARE_WEBHOOK_SIGNATURE_KEY,
    notificationUrl: SQUARE_WEBHOOK_NOTIFICATION_URL
  });
}

async function claimSquareEvent(eventId, eventType, payload) {
  if (!dbPool) {
    throw new Error("DATABASE_URL is required for Square webhook processing.");
  }

  const inserted = await dbPool.query(
    `INSERT INTO processed_square_events (
      event_id,
      event_type,
      status,
      result,
      payload_json
    )
    VALUES ($1, $2, 'processing', 'claimed', $3::jsonb)
    ON CONFLICT (event_id) DO NOTHING
    RETURNING event_id`,
    [eventId, eventType, JSON.stringify(sanitizeLogBody(payload))]
  );

  if (inserted.rowCount > 0) {
    return { claimed: true };
  }

  const existing = await dbPool.query(
    `SELECT status
     FROM processed_square_events
     WHERE event_id = $1`,
    [eventId]
  );

  if (existing.rows[0]?.status === "failed") {
    await dbPool.query(
      `UPDATE processed_square_events
       SET status = 'processing',
         result = 'retrying',
         payload_json = $2::jsonb,
         processed_at = now(),
         error_json = NULL
       WHERE event_id = $1`,
      [eventId, JSON.stringify(sanitizeLogBody(payload))]
    );

    return { claimed: true, retry: true };
  }

  return { claimed: false, status: existing.rows[0]?.status || "duplicate" };
}

async function updateSquareEvent(eventId, updates = {}) {
  if (!dbPool) return;

  await dbPool.query(
    `UPDATE processed_square_events
     SET pending_order_id = COALESCE($2, pending_order_id),
       status = COALESCE($3, status),
       result = COALESCE($4, result),
       square_payment_id = COALESCE($5, square_payment_id),
       square_order_id = COALESCE($6, square_order_id),
       error_json = $7::jsonb,
       processed_at = now()
     WHERE event_id = $1`,
    [
      eventId,
      updates.pendingOrderId || null,
      updates.status || null,
      updates.result || null,
      updates.squarePaymentId || null,
      updates.squareOrderId || null,
      updates.error ? JSON.stringify(createSafeErrorJson(updates.error)) : null
    ]
  );
}

async function findPendingOrder({ pendingOrderId, squareOrderId } = {}) {
  if (!dbPool) {
    throw new Error("DATABASE_URL is required for Square webhook processing.");
  }

  if (pendingOrderId && isUuid(pendingOrderId)) {
    const byId = await dbPool.query(
      `SELECT *
       FROM pending_orders
       WHERE id = $1`,
      [pendingOrderId]
    );

    if (byId.rows[0]) return byId.rows[0];
  }

  if (squareOrderId) {
    const bySquareOrderId = await dbPool.query(
      `SELECT *
       FROM pending_orders
       WHERE square_order_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [squareOrderId]
    );

    if (bySquareOrderId.rows[0]) return bySquareOrderId.rows[0];
  }

  return null;
}

function getPendingOrderIdFromSquareData({ payment = {}, order = {} } = {}) {
  return (
    getSquarePaymentMetadata(payment).pending_order_id ||
    getSquareOrderMetadata(order).pending_order_id ||
    getSquareOrderReferenceId(order) ||
    ""
  );
}

async function markSquareEventUnmatched(eventId, {
  result = "No matching pending order found",
  squarePaymentId = "",
  squareOrderId = ""
} = {}) {
  await updateSquareEvent(eventId, {
    status: "unmatched",
    result,
    squarePaymentId,
    squareOrderId
  });

  return {
    received: true,
    unmatched: true,
    reason: result
  };
}

function getPaymentSnapshot(payment = {}, order = {}) {
  const squareOrder = order || {};

  return sanitizeLogBody({
    payment_id: payment.id || null,
    order_id: getSquarePaymentOrderId(payment) || squareOrder.id || null,
    status: getSquarePaymentStatus(payment),
    amount_money: getSquareMoney(payment),
    buyer_email_address: payment.buyerEmailAddress || payment.buyer_email_address || null,
    reference_id: getSquareOrderReferenceId(squareOrder) || null
  });
}

function isPendingOrderPaid(pendingOrder = {}) {
  return String(pendingOrder.status || "").toLowerCase() === "paid";
}

function hasPrintifyFulfillmentStarted(pendingOrder = {}) {
  const status = String(pendingOrder.status || "").toLowerCase();
  return Boolean(pendingOrder.printify_order_id) ||
    [
      "fulfillment_pending",
      "printify_submitted",
      "fulfillment_blocked",
      "printify_address_missing",
      "fulfillment_failed"
    ].includes(status);
}

function shouldCreatePrintifyOrderForPaidTransition(transition = {}) {
  return transition.markedPaid === true;
}

async function markPendingOrderPaid(pendingOrder, payment, order) {
  const paymentId = payment.id;
  const squareOrderId = getSquarePaymentOrderId(payment) || order?.id || pendingOrder.square_order_id;
  const paymentSnapshot = getPaymentSnapshot(payment, order);

  if (isPendingOrderPaid(pendingOrder)) {
    return {
      markedPaid: false,
      alreadyPaid: true,
      pendingOrderId: pendingOrder.id
    };
  }

  const result = await dbPool.query(
    `UPDATE pending_orders
     SET status = 'paid',
       square_payment_id = $2,
       square_order_id = COALESCE($3, square_order_id),
       payment_json = $4::jsonb,
       paid_at = COALESCE(paid_at, now()),
       updated_at = now()
     WHERE id = $1
       AND status IN ('pending_payment', 'payment_link_created')
       AND printify_order_id IS NULL
     RETURNING id`,
    [
      pendingOrder.id,
      paymentId,
      squareOrderId || null,
      JSON.stringify(paymentSnapshot)
    ]
  );

  return {
    markedPaid: result.rowCount > 0,
    alreadyPaid: result.rowCount === 0,
    pendingOrderId: pendingOrder.id
  };
}

async function markPendingOrderPaymentMismatch(pendingOrder, errorDetails) {
  await dbPool.query(
    `UPDATE pending_orders
     SET error_json = $2::jsonb,
       updated_at = now()
     WHERE id = $1`,
    [
      pendingOrder.id,
      JSON.stringify(sanitizeLogBody(errorDetails))
    ]
  );
}

function getField(value = {}, camelKey, snakeKey = "") {
  return value?.[camelKey] ?? (snakeKey ? value?.[snakeKey] : undefined) ?? "";
}

function normalizeString(value) {
  return String(value || "").trim();
}

function splitFullName(fullName = "") {
  const parts = normalizeString(fullName).split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return { firstName: "", lastName: "" };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" ") || "Customer"
  };
}

function getSquareAddressValue(address = {}, camelKey, snakeKey = "") {
  return normalizeString(getField(address, camelKey, snakeKey));
}

function getSquareShippingAddress(payment = {}) {
  return payment.shippingAddress || payment.shipping_address || null;
}

function getSquareBillingAddress(payment = {}) {
  return payment.billingAddress || payment.billing_address || null;
}

function getSquareBuyerEmail(payment = {}) {
  return normalizeString(payment.buyerEmailAddress || payment.buyer_email_address);
}

function getSquareFulfillmentRecipient(order = {}) {
  const fulfillments = Array.isArray(order?.fulfillments) ? order.fulfillments : [];

  for (const fulfillment of fulfillments) {
    const shipmentDetails = fulfillment.shipmentDetails || fulfillment.shipment_details || {};
    const deliveryDetails = fulfillment.deliveryDetails || fulfillment.delivery_details || {};
    const pickupDetails = fulfillment.pickupDetails || fulfillment.pickup_details || {};
    const recipient =
      shipmentDetails.recipient ||
      deliveryDetails.recipient ||
      pickupDetails.recipient ||
      null;

    if (recipient) return recipient;
  }

  return null;
}

function buildPrintifyAddressFromSquare({ payment = {}, order = {} } = {}) {
  const recipient = getSquareFulfillmentRecipient(order) || {};
  const recipientAddress = recipient.address || {};
  const paymentShippingAddress = getSquareShippingAddress(payment) || {};
  const paymentBillingAddress = getSquareBillingAddress(payment) || {};
  const address = hasObjectData(recipientAddress)
    ? recipientAddress
    : hasObjectData(paymentShippingAddress)
      ? paymentShippingAddress
      : paymentBillingAddress;
  const displayName = normalizeString(
    recipient.displayName ||
    recipient.display_name ||
    `${getSquareAddressValue(address, "firstName", "first_name")} ${getSquareAddressValue(address, "lastName", "last_name")}`
  );
  const splitName = splitFullName(displayName);
  const firstName = getSquareAddressValue(address, "firstName", "first_name") || splitName.firstName;
  const lastName = getSquareAddressValue(address, "lastName", "last_name") || splitName.lastName;

  return {
    first_name: firstName,
    last_name: lastName,
    email: normalizeString(recipient.emailAddress || recipient.email_address) || getSquareBuyerEmail(payment),
    phone: normalizeString(recipient.phoneNumber || recipient.phone_number),
    country: getSquareAddressValue(address, "country"),
    region: getSquareAddressValue(address, "administrativeDistrictLevel1", "administrative_district_level_1"),
    address1: getSquareAddressValue(address, "addressLine1", "address_line_1"),
    address2: getSquareAddressValue(address, "addressLine2", "address_line_2"),
    city: getSquareAddressValue(address, "locality"),
    zip: getSquareAddressValue(address, "postalCode", "postal_code")
  };
}

function validatePrintifyAddress(addressTo = {}) {
  const requiredFields = [
    "first_name",
    "last_name",
    "email",
    "country",
    "region",
    "address1",
    "city",
    "zip"
  ];
  const missingFields = requiredFields.filter(field => !normalizeString(addressTo[field]));

  return {
    valid: missingFields.length === 0,
    missingFields
  };
}

function getPendingLineItems(pendingOrder = {}) {
  if (Array.isArray(pendingOrder.line_items_json)) {
    return pendingOrder.line_items_json;
  }

  if (typeof pendingOrder.line_items_json === "string") {
    try {
      const parsed = JSON.parse(pendingOrder.line_items_json);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  return [];
}

function buildPrintifyLineItems(pendingOrder = {}) {
  return getPendingLineItems(pendingOrder).map(item => ({
    product_id: normalizeString(item.product_id),
    variant_id: Number(item.variant_id),
    quantity: Number(item.quantity)
  }));
}

function validatePrintifyLineItems(lineItems = []) {
  const invalidItems = lineItems
    .map((item, index) => ({
      index,
      product_id: item.product_id,
      variant_id: item.variant_id,
      quantity: item.quantity
    }))
    .filter(item => (
      !item.product_id ||
      !Number.isSafeInteger(item.variant_id) ||
      item.variant_id <= 0 ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity <= 0
    ));

  return {
    valid: invalidItems.length === 0 && lineItems.length > 0,
    invalidItems
  };
}

function buildPrintifyOrderPayload(pendingOrder, addressTo) {
  return {
    external_id: pendingOrder.id,
    line_items: buildPrintifyLineItems(pendingOrder),
    shipping_method: PRINTIFY_DEFAULT_SHIPPING_METHOD,
    send_shipping_notification: PRINTIFY_SEND_SHIPPING_NOTIFICATION,
    address_to: addressTo
  };
}

function getPrintifyOrderId(responseData = {}) {
  return normalizeString(responseData.id || responseData.order?.id || responseData.data?.id);
}

function getPrintifyStatus(responseData = {}) {
  return normalizeString(responseData.status || responseData.order?.status || responseData.data?.status);
}

async function claimPendingOrderFulfillment(pendingOrderId) {
  const result = await dbPool.query(
    `UPDATE pending_orders
     SET status = 'fulfillment_pending',
       fulfillment_attempted_at = now(),
       updated_at = now()
     WHERE id = $1
       AND status = 'paid'
       AND printify_order_id IS NULL
     RETURNING *`,
    [pendingOrderId]
  );

  return result.rows[0] || null;
}

async function markPendingOrderFulfillmentBlocked(pendingOrder, {
  status = "printify_address_missing",
  customer = {},
  shipping = {},
  error = {}
} = {}) {
  await dbPool.query(
    `UPDATE pending_orders
     SET status = $2,
       customer_json = $3::jsonb,
       shipping_json = $4::jsonb,
       fulfillment_error_json = $5::jsonb,
       updated_at = now()
     WHERE id = $1`,
    [
      pendingOrder.id,
      status,
      JSON.stringify(sanitizeLogBody(customer)),
      JSON.stringify(sanitizeLogBody(shipping)),
      JSON.stringify(sanitizeLogBody(error))
    ]
  );
}

async function markPendingOrderFulfillmentFailed(pendingOrder, error) {
  await dbPool.query(
    `UPDATE pending_orders
     SET status = 'fulfillment_failed',
       fulfillment_error_json = $2::jsonb,
       updated_at = now()
     WHERE id = $1`,
    [
      pendingOrder.id,
      JSON.stringify(createSafeErrorJson(error))
    ]
  );
}

async function markPendingOrderPrintifySubmitted(pendingOrder, responseData) {
  await dbPool.query(
    `UPDATE pending_orders
     SET status = 'printify_submitted',
       printify_order_id = $2,
       printify_status = $3,
       printify_order_json = $4::jsonb,
       printify_submitted_at = now(),
       fulfillment_error_json = NULL,
       updated_at = now()
     WHERE id = $1`,
    [
      pendingOrder.id,
      getPrintifyOrderId(responseData) || null,
      getPrintifyStatus(responseData) || "submitted",
      JSON.stringify(sanitizeLogBody(responseData))
    ]
  );
}

async function createPrintifyOrder(payload) {
  const response = await printify.post(PRINTIFY_ORDERS_ENDPOINT, payload);
  return response.data;
}

async function submitPrintifyOrderForPendingOrder(pendingOrderId, { payment = {}, order = {} } = {}) {
  const pendingOrder = await claimPendingOrderFulfillment(pendingOrderId);

  if (!pendingOrder) {
    return {
      attempted: false,
      skipped: true,
      reason: "fulfillment_not_claimed"
    };
  }

  const addressTo = buildPrintifyAddressFromSquare({ payment, order });
  const customer = {
    email: addressTo.email,
    phone: addressTo.phone,
    first_name: addressTo.first_name,
    last_name: addressTo.last_name
  };
  const addressValidation = validatePrintifyAddress(addressTo);
  const payload = buildPrintifyOrderPayload(pendingOrder, addressTo);
  const lineItemsValidation = validatePrintifyLineItems(payload.line_items);

  if (!addressValidation.valid || !lineItemsValidation.valid) {
    const error = {
      message: "Printify fulfillment blocked before order creation.",
      missing_address_fields: addressValidation.missingFields,
      invalid_line_items: lineItemsValidation.invalidItems
    };

    await markPendingOrderFulfillmentBlocked(pendingOrder, {
      status: addressValidation.valid ? "fulfillment_blocked" : "printify_address_missing",
      customer,
      shipping: addressTo,
      error
    });

    console.error("PRINTIFY FULFILLMENT BLOCKED", {
      pendingOrderId: pendingOrder.id,
      missingAddressFields: addressValidation.missingFields,
      invalidLineItemCount: lineItemsValidation.invalidItems.length
    });

    return {
      attempted: true,
      blocked: true,
      status: addressValidation.valid ? "fulfillment_blocked" : "printify_address_missing",
      error
    };
  }

  console.log("PRINTIFY ORDER CREATE REQUEST", {
    pendingOrderId: pendingOrder.id,
    endpoint: PRINTIFY_ORDERS_ENDPOINT_LABEL,
    lineItems: payload.line_items.map(item => ({
      product_id: item.product_id,
      variant_id: item.variant_id,
      quantity: item.quantity
    })),
    addressPresent: true
  });

  try {
    const responseData = await createPrintifyOrder(payload);
    await markPendingOrderPrintifySubmitted(pendingOrder, responseData);

    console.log("PRINTIFY ORDER CREATED", {
      pendingOrderId: pendingOrder.id,
      printifyOrderId: getPrintifyOrderId(responseData) || null,
      printifyStatus: getPrintifyStatus(responseData) || null
    });

    return {
      attempted: true,
      submitted: true,
      printifyOrderId: getPrintifyOrderId(responseData) || null
    };
  } catch (error) {
    await markPendingOrderFulfillmentFailed(pendingOrder, error);
    console.error("PRINTIFY ORDER CREATE ERROR", {
      pendingOrderId: pendingOrder.id,
      endpoint: PRINTIFY_ORDERS_ENDPOINT_LABEL,
      message: error.message,
      status: error.response?.status || null,
      response: error.response?.data ? sanitizeLogBody(error.response.data) : null,
      noResponseReceived: !error.response
    });

    return {
      attempted: true,
      failed: true,
      error: createSafeErrorJson(error)
    };
  }
}

async function createPendingOrder({
  pendingLineItems = [],
  subtotalCents = 0,
  shippingCents = 0,
  totalCents = 0
}) {
  if (!dbPool) {
    throw new Error("DATABASE_URL is required for checkout pending order storage.");
  }

  const pendingOrderId = crypto.randomUUID();

  await dbPool.query(
    `INSERT INTO pending_orders (
      id,
      status,
      currency,
      subtotal_cents,
      shipping_cents,
      total_cents,
      line_items_json,
      customer_json,
      shipping_json
    )
    VALUES ($1, 'pending_payment', 'USD', $2, $3, $4, $5::jsonb, NULL, NULL)`,
    [
      pendingOrderId,
      subtotalCents,
      shippingCents,
      totalCents,
      JSON.stringify(pendingLineItems)
    ]
  );

  return pendingOrderId;
}

function getSquarePaymentLink(response = {}) {
  return response.result?.paymentLink || response.paymentLink || null;
}

function getSquarePaymentLinkUrl(response = {}) {
  return getSquarePaymentLink(response)?.url || null;
}

function getSquarePaymentLinkId(response = {}) {
  const paymentLink = getSquarePaymentLink(response);
  return paymentLink?.id || null;
}

function getSquareOrderId(response = {}) {
  const paymentLink = getSquarePaymentLink(response);
  return paymentLink?.orderId || paymentLink?.order_id || null;
}

async function markPendingOrderPaymentLinkCreated(pendingOrderId, response, checkoutUrl) {
  if (!dbPool) {
    throw new Error("DATABASE_URL is required for checkout pending order storage.");
  }

  await dbPool.query(
    `UPDATE pending_orders
     SET status = 'payment_link_created',
       square_payment_link_id = $2,
       square_order_id = $3,
       square_checkout_url = $4,
       updated_at = now()
     WHERE id = $1`,
    [
      pendingOrderId,
      getSquarePaymentLinkId(response),
      getSquareOrderId(response),
      checkoutUrl
    ]
  );
}

async function markPendingOrderPaymentLinkFailed(pendingOrderId, error) {
  if (!dbPool || !pendingOrderId) return;

  try {
    await dbPool.query(
      `UPDATE pending_orders
       SET status = 'payment_link_failed',
         error_json = $2::jsonb,
         updated_at = now()
       WHERE id = $1`,
      [
        pendingOrderId,
        JSON.stringify(createSafeErrorJson(error))
      ]
    );
  } catch (updateError) {
    console.error("PENDING ORDER FAILURE UPDATE ERROR", {
      pendingOrderId,
      message: updateError.message
    });
  }
}

app.post("/webhooks/square", express.raw({ type: "application/json" }), async (req, res) => {
  const signatureHeader = req.get("x-square-hmacsha256-signature") || "";
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";

  try {
    const isVerified = await verifySquareWebhookSignature(signatureHeader, rawBody);

    if (!isVerified) {
      console.warn("Square webhook rejected: invalid signature");
      return res.status(403).json({ error: "Invalid signature" });
    }
  } catch (error) {
    console.error("SQUARE WEBHOOK SIGNATURE ERROR", {
      message: error.message
    });
    return res.status(503).json({ error: "Webhook verification unavailable" });
  }

  let event;

  try {
    event = JSON.parse(rawBody);
  } catch (error) {
    console.warn("Square webhook rejected: invalid JSON");
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const eventId = getSquareEventId(event);
  const eventType = getSquareEventType(event);

  if (!eventId) {
    console.warn("Square webhook ignored: missing event ID");
    return res.status(200).json({ received: true, ignored: true });
  }

  let claim;

  try {
    claim = await claimSquareEvent(eventId, eventType, event);
  } catch (error) {
    console.error("SQUARE WEBHOOK EVENT CLAIM ERROR", {
      eventId,
      eventType,
      message: error.message
    });
    return res.status(500).json({ error: "Webhook event claim failed" });
  }

  if (!claim.claimed) {
    return res.status(200).json({
      received: true,
      duplicate: true,
      status: claim.status
    });
  }

  if (eventType !== "payment.updated") {
    await updateSquareEvent(eventId, {
      status: "ignored",
      result: `Ignored event type ${eventType || "unknown"}`
    });
    return res.status(200).json({ received: true, ignored: true });
  }

  const webhookPayment = event?.data?.object?.payment || {};
  const paymentId = getSquarePaymentIdFromEvent(event);
  const payloadHasPayment = hasObjectData(webhookPayment);

  if (!paymentId) {
    await updateSquareEvent(eventId, {
      status: "ignored",
      result: "Payment event missing payment ID"
    });
    return res.status(200).json({ received: true, ignored: true });
  }

  let payment = webhookPayment;
  let order = null;
  let squareOrderId = getSquarePaymentOrderId(payment);
  let pendingOrderId = getPendingOrderIdFromSquareData({ payment });
  let pendingOrder;

  const findPendingOrderSafely = async () => {
    try {
      return await findPendingOrder({ pendingOrderId, squareOrderId });
    } catch (error) {
      await updateSquareEvent(eventId, {
        status: "failed",
        result: "Pending order lookup failed",
        squarePaymentId: paymentId,
        squareOrderId,
        error
      });
      console.error("SQUARE WEBHOOK PENDING ORDER LOOKUP ERROR", {
        eventId,
        paymentId,
        squareOrderId,
        message: error.message
      });
      throw error;
    }
  };

  try {
    pendingOrder = await findPendingOrderSafely();
  } catch (error) {
    return res.status(500).json({ error: "Pending order lookup failed" });
  }

  if (!pendingOrder && !payloadHasPayment) {
    try {
      const fetchedPayment = await fetchSquarePayment(paymentId);
      payment = fetchedPayment || webhookPayment;
      squareOrderId = getSquarePaymentOrderId(payment);
      pendingOrderId = getPendingOrderIdFromSquareData({ payment });
      pendingOrder = await findPendingOrderSafely();
    } catch (error) {
      if (isSquareNotFoundError(error) || isSquareForbiddenError(error)) {
        const body = await markSquareEventUnmatched(eventId, {
          result: isSquareForbiddenError(error)
            ? "payment_forbidden_sample_or_unmatched"
            : "payment_not_found_sample_or_unmatched",
          squarePaymentId: paymentId,
          squareOrderId
        });
        return res.status(200).json(body);
      }

      await updateSquareEvent(eventId, {
        status: "failed",
        result: "Square payment fetch failed",
        squarePaymentId: paymentId,
        squareOrderId,
        error
      });
      console.error("SQUARE WEBHOOK PAYMENT FETCH ERROR", {
        eventId,
        paymentId,
        message: error.message
      });
      return res.status(502).json({ error: "Square payment fetch failed" });
    }
  }

  if (!pendingOrder) {
    const body = await markSquareEventUnmatched(eventId, {
      result: payloadHasPayment && squareOrderId && !pendingOrderId
        ? "square_order_forbidden_sample_or_unmatched"
        : "No matching pending order found",
      squarePaymentId: paymentId,
      squareOrderId
    });
    console.warn("Square webhook unmatched payment", {
      eventId,
      paymentId,
      squareOrderId
    });
    return res.status(200).json(body);
  }

  try {
    const fetchedPayment = await fetchSquarePayment(paymentId);
    payment = fetchedPayment || payment;
    squareOrderId = getSquarePaymentOrderId(payment) || squareOrderId;
  } catch (error) {
    await updateSquareEvent(eventId, {
      pendingOrderId: pendingOrder.id,
      status: "failed",
      result: "Square payment fetch failed for matched pending order",
      squarePaymentId: paymentId,
      squareOrderId,
      error
    });
    console.error("SQUARE WEBHOOK PAYMENT FETCH ERROR", {
      eventId,
      pendingOrderId: pendingOrder.id,
      paymentId,
      message: error.message
    });
    return res.status(502).json({ error: "Square payment fetch failed" });
  }

  const paymentStatus = getSquarePaymentStatus(payment);

  if (paymentStatus !== "COMPLETED") {
    await updateSquareEvent(eventId, {
      status: "ignored",
      result: `Payment status ${paymentStatus || "unknown"} ignored`,
      squarePaymentId: paymentId,
      squareOrderId
    });
    return res.status(200).json({ received: true, ignored: true });
  }

  if (isPendingOrderPaid(pendingOrder) && hasPrintifyFulfillmentStarted(pendingOrder)) {
    await updateSquareEvent(eventId, {
      pendingOrderId: pendingOrder.id,
      status: "duplicate_paid_update",
      result: "Fulfillment already started; duplicate completed payment update ignored",
      squarePaymentId: paymentId,
      squareOrderId
    });

    return res.status(200).json({
      received: true,
      alreadyPaid: true,
      fulfillmentAlreadyStarted: true
    });
  }

  if (squareOrderId && !order) {
    try {
      order = await fetchSquareOrder(squareOrderId);
    } catch (error) {
      await updateSquareEvent(eventId, {
        pendingOrderId: pendingOrder.id,
        status: "failed",
        result: "Square order fetch failed for matched pending order",
        squarePaymentId: paymentId,
        squareOrderId,
        error
      });
      console.error("SQUARE WEBHOOK ORDER FETCH ERROR", {
        eventId,
        pendingOrderId: pendingOrder.id,
        paymentId,
        squareOrderId,
        message: error.message
      });
      return res.status(502).json({ error: "Square order fetch failed" });
    }
  }

  const paymentMoney = getSquareMoney(payment);
  const paidAmountCents = getSquareAmountValue(paymentMoney);
  const paymentCurrency = String(paymentMoney.currency || pendingOrder.currency || "").toUpperCase();
  const expectedAmountCents = Number(pendingOrder.total_cents);
  const expectedCurrency = String(pendingOrder.currency || "USD").toUpperCase();

  if (!Number.isSafeInteger(expectedAmountCents) || expectedAmountCents <= 0) {
    const amountVerificationError = {
      message: "Pending order total_cents is missing; payment amount cannot be verified.",
      pending_order_id: pendingOrder.id,
      subtotal_cents: pendingOrder.subtotal_cents,
      shipping_cents: pendingOrder.shipping_cents,
      total_cents: pendingOrder.total_cents,
      square_payment_id: paymentId,
      square_order_id: squareOrderId
    };

    await markPendingOrderPaymentMismatch(pendingOrder, amountVerificationError);
    await updateSquareEvent(eventId, {
      pendingOrderId: pendingOrder.id,
      status: "amount_verification_blocked",
      result: "Missing pending order total; pending order not marked paid",
      squarePaymentId: paymentId,
      squareOrderId,
      error: amountVerificationError
    });

    return res.status(200).json({ received: true, amountVerificationBlocked: true });
  }

  if (paidAmountCents !== expectedAmountCents || paymentCurrency !== expectedCurrency) {
    const mismatch = {
      message: "Square payment amount does not match pending order total.",
      expected_amount_cents: expectedAmountCents,
      paid_amount_cents: paidAmountCents,
      expected_currency: expectedCurrency,
      paid_currency: paymentCurrency,
      square_payment_id: paymentId,
      square_order_id: squareOrderId
    };

    await markPendingOrderPaymentMismatch(pendingOrder, mismatch);
    await updateSquareEvent(eventId, {
      pendingOrderId: pendingOrder.id,
      status: "amount_mismatch",
      result: "Amount mismatch; pending order not marked paid",
      squarePaymentId: paymentId,
      squareOrderId,
      error: mismatch
    });

    return res.status(200).json({ received: true, amountMismatch: true });
  }

  if (hasPrintifyFulfillmentStarted(pendingOrder)) {
    await updateSquareEvent(eventId, {
      pendingOrderId: pendingOrder.id,
      status: "duplicate_paid_update",
      result: "Fulfillment already started; duplicate completed payment update ignored",
      squarePaymentId: paymentId,
      squareOrderId
    });

    return res.status(200).json({
      received: true,
      alreadyPaid: true,
      fulfillmentAlreadyStarted: true
    });
  }

  if (isPendingOrderPaid(pendingOrder)) {
    const fulfillment = await submitPrintifyOrderForPendingOrder(pendingOrder.id, { payment, order });
    const eventStatus = fulfillment.submitted
      ? "printify_submitted"
      : fulfillment.blocked
        ? fulfillment.status
        : fulfillment.failed
          ? "fulfillment_failed"
          : "fulfillment_skipped";
    const eventResult = fulfillment.submitted
      ? "Paid pending order submitted to Printify"
      : fulfillment.blocked
        ? "Paid pending order fulfillment blocked"
        : fulfillment.failed
          ? "Paid pending order Printify order creation failed"
          : "Paid pending order fulfillment was not claimed";

    await updateSquareEvent(eventId, {
      pendingOrderId: pendingOrder.id,
      status: eventStatus,
      result: eventResult,
      squarePaymentId: paymentId,
      squareOrderId
    });

    return res.status(200).json({
      received: true,
      paid: true,
      fulfillment: eventStatus,
      printifyOrderId: fulfillment.printifyOrderId || null
    });
  }

  try {
    const paidTransition = await markPendingOrderPaid(pendingOrder, payment, order);

    if (!shouldCreatePrintifyOrderForPaidTransition(paidTransition)) {
      await updateSquareEvent(eventId, {
        pendingOrderId: pendingOrder.id,
        status: "duplicate_paid_update",
        result: "Pending order already paid; duplicate completed payment update ignored",
        squarePaymentId: paymentId,
        squareOrderId
      });

      return res.status(200).json({
        received: true,
        alreadyPaid: true
      });
    }

    const fulfillment = await submitPrintifyOrderForPendingOrder(pendingOrder.id, { payment, order });
    const eventStatus = fulfillment.submitted
      ? "printify_submitted"
      : fulfillment.blocked
        ? fulfillment.status
        : fulfillment.failed
          ? "fulfillment_failed"
          : "fulfillment_skipped";
    const eventResult = fulfillment.submitted
      ? "Pending order paid and Printify order submitted"
      : fulfillment.blocked
        ? "Pending order paid but Printify fulfillment blocked"
        : fulfillment.failed
          ? "Pending order paid but Printify order creation failed"
          : "Pending order paid but Printify fulfillment was not claimed";

    await updateSquareEvent(eventId, {
      pendingOrderId: pendingOrder.id,
      status: eventStatus,
      result: eventResult,
      squarePaymentId: paymentId,
      squareOrderId
    });

    if (fulfillment.submitted) {
      return res.status(200).json({
        received: true,
        paid: true,
        fulfillment: "printify_submitted",
        printifyOrderId: fulfillment.printifyOrderId || null
      });
    }

    if (fulfillment.blocked) {
      return res.status(200).json({
        received: true,
        paid: true,
        fulfillment: fulfillment.status
      });
    }

    if (fulfillment.failed) {
      return res.status(200).json({
        received: true,
        paid: true,
        fulfillment: "fulfillment_failed"
      });
    }
  } catch (error) {
    await updateSquareEvent(eventId, {
      pendingOrderId: pendingOrder.id,
      status: "failed",
      result: "Pending order paid update failed",
      squarePaymentId: paymentId,
      squareOrderId,
      error
    });
    console.error("SQUARE WEBHOOK PAID UPDATE ERROR", {
      eventId,
      pendingOrderId: pendingOrder.id,
      paymentId,
      message: error.message
    });
    return res.status(500).json({ error: "Pending order paid update failed" });
  }

  // Phase 3 should create the Printify order only after a true first-time paid transition.
  return res.status(200).json({ received: true, paid: true });
});

app.use(express.json());

// ✅ API route
app.post("/create-checkout", async (req, res) => {
  try {
    const { cart } = req.body || {};

    if (!Array.isArray(cart) || !cart.length) {
      return res.status(400).json({
        error: "Cart validation failed",
        message: "Your Loot Bag is empty.",
        items: []
      });
    }

    const { items, errors } = buildValidatedCartItems(cart);

    if (errors.length) {
      const validationError = createValidationError(400, errors);
      return res.status(validationError.status).json(validationError.body);
    }

    if (!dbPool) {
      console.error("CHECKOUT DATABASE ERROR", {
        message: "DATABASE_URL is missing; refusing to create Square payment link without pending order storage."
      });

      return res.status(503).json({
        error: "Checkout unavailable",
        message: CHECKOUT_TEMPORARY_UNAVAILABLE_MESSAGE,
        items: []
      });
    }

    let products;

    try {
      products = await fetchCurrentPrintifyProducts();
    } catch (error) {
      console.error("CHECKOUT PRINTIFY VALIDATION ERROR", {
        endpoint: PRINTIFY_PRODUCTS_ENDPOINT_LABEL,
        message: error.message,
        status: error.response?.status || null,
        response: error.response?.data ? sanitizeLogBody(error.response.data) : null,
        noResponseReceived: !error.response
      });

      return res.status(503).json({
        error: "Checkout validation unavailable",
        message: CHECKOUT_TEMPORARY_UNAVAILABLE_MESSAGE,
        items: []
      });
    }

    const {
      lineItems,
      pendingLineItems,
      subtotalCents,
      validationErrors
    } = buildCheckoutLineItemsFromPrintify(items, products);

    if (validationErrors.length) {
      const validationError = createValidationError(409, validationErrors);
      return res.status(validationError.status).json(validationError.body);
    }

    if (!lineItems.length) {
      return res.status(400).json({
        error: "Cart validation failed",
        message: "Your Loot Bag is empty.",
        items: []
      });
    }

    const shippingCents = parseConfiguredShippingFeeCents();

    if (shippingCents === null) {
      console.error("CHECKOUT SHIPPING FEE CONFIG ERROR", {
        message: "PRINTIFY_DEFAULT_SHIPPING_FEE_CENTS is missing or invalid; refusing to create Square payment link."
      });

      return res.status(503).json({
        error: "Checkout unavailable",
        message: CHECKOUT_TEMPORARY_UNAVAILABLE_MESSAGE,
        items: []
      });
    }

    const totalCents = subtotalCents + shippingCents;
    let pendingOrderId;

    try {
      pendingOrderId = await createPendingOrder({
        pendingLineItems,
        subtotalCents,
        shippingCents,
        totalCents
      });
    } catch (error) {
      console.error("PENDING ORDER CREATE ERROR", {
        message: error.message
      });

      return res.status(503).json({
        error: "Checkout unavailable",
        message: CHECKOUT_TEMPORARY_UNAVAILABLE_MESSAGE,
        items: []
      });
    }

    let response;
    const paymentLinkRequest = buildSquarePaymentLinkRequest({
      pendingOrderId,
      lineItems,
      shippingCents
    });

    logSquarePaymentLinkRequestShape({
      request: paymentLinkRequest,
      subtotalCents,
      shippingCents,
      totalCents
    });

    if (!squarePaymentLinkRequestIncludesShippingFee(paymentLinkRequest)) {
      await markPendingOrderPaymentLinkFailed(
        pendingOrderId,
        new Error("Square payment link request is missing shipping service charge")
      );

      console.error("SQUARE PAYMENT LINK SHIPPING CONFIG ERROR", {
        pendingOrderId,
        shippingCents,
        message: "Refusing to create Square payment link without a customer shipping charge."
      });

      return res.status(503).json({
        error: "Checkout unavailable",
        message: CHECKOUT_TEMPORARY_UNAVAILABLE_MESSAGE,
        items: []
      });
    }

    try {
      response = await squareClient.checkout.paymentLinks.create(paymentLinkRequest);
    } catch (error) {
      await markPendingOrderPaymentLinkFailed(pendingOrderId, error);
      console.error("SQUARE PAYMENT LINK ERROR", {
        pendingOrderId,
        message: error.message
      });

      return res.status(500).json({
        error: "Checkout failed",
        message: "Checkout failed. Please try again."
      });
    }

    const url = getSquarePaymentLinkUrl(response);

    if (!url) {
      await markPendingOrderPaymentLinkFailed(pendingOrderId, new Error("No checkout URL returned"));
      return res.status(500).json({
        error: "No checkout URL returned",
        message: "Checkout failed. Please try again."
      });
    }

    try {
      await markPendingOrderPaymentLinkCreated(pendingOrderId, response, url);
    } catch (error) {
      await markPendingOrderPaymentLinkFailed(pendingOrderId, error);
      console.error("PENDING ORDER PAYMENT LINK UPDATE ERROR", {
        pendingOrderId,
        message: error.message
      });

      return res.status(503).json({
        error: "Checkout unavailable",
        message: CHECKOUT_TEMPORARY_UNAVAILABLE_MESSAGE,
        items: []
      });
    }

    res.json({ url });

  } catch (error) {
    console.error("CHECKOUT ERROR:", error);
    res.status(500).json({
      error: "Checkout failed",
      message: "Checkout failed. Please try again."
    });
  }
});

// ✅ Serve frontend
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/products", async (req, res) => {
  console.log("/products requested", {
    printifyApiTokenPresent: Boolean(process.env.PRINTIFY_API_TOKEN),
    printifyShopIdPresent: Boolean(process.env.PRINTIFY_SHOP_ID)
  });

  try {
    const response = await printify.get(PRINTIFY_PRODUCTS_ENDPOINT);
    res.json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;

    console.error("PRINTIFY PRODUCTS ERROR", {
      endpoint: PRINTIFY_PRODUCTS_ENDPOINT_LABEL,
      message: error.message,
      status: error.response?.status || null,
      response: error.response?.data ? sanitizeLogBody(error.response.data) : null,
      noResponseReceived: !error.response
    });

    res.status(status).json({
      error: "Failed to fetch products",
      status,
      details: "Printify request failed. Check server logs."
    });
  }
});

// ✅ ONE listener only
const PORT = process.env.PORT || 3000;

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(error => {
    console.error("DATABASE INITIALIZATION ERROR", {
      message: error.message
    });
    process.exit(1);
  });
