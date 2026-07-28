import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { SquareClient } from "square";
import axios from "axios";
import pg from "pg";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

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
  square_checkout_url text,
  printify_order_id text,
  currency text NOT NULL DEFAULT 'USD',
  subtotal_cents integer NOT NULL DEFAULT 0,
  line_items_json jsonb NOT NULL,
  customer_json jsonb,
  shipping_json jsonb,
  error_json jsonb
);

CREATE TABLE IF NOT EXISTS processed_square_events (
  event_id text PRIMARY KEY,
  pending_order_id uuid REFERENCES pending_orders(id),
  event_type text,
  processed_at timestamptz NOT NULL DEFAULT now(),
  payload_json jsonb
);
`;

const PRINTIFY_API = "https://api.printify.com/v1";
const PRINTIFY_API_TOKEN = process.env.PRINTIFY_API_TOKEN;
const PRINTIFY_SHOP_ID = process.env.PRINTIFY_SHOP_ID;
const PRINTIFY_PRODUCTS_ENDPOINT = `/shops/${PRINTIFY_SHOP_ID}/products.json`;
const PRINTIFY_PRODUCTS_ENDPOINT_LABEL = "/shops/[PRINTIFY_SHOP_ID]/products.json";

const printify = axios.create({
  baseURL: PRINTIFY_API,
  headers: {
    Authorization: `Bearer ${PRINTIFY_API_TOKEN}`,
    "Content-Type": "application/json"
  }
});

function sanitizeLogBody(value) {
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
  console.log("Database initialized: pending_orders ready");
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

async function createPendingOrder({ pendingLineItems = [], subtotalCents = 0 }) {
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
      line_items_json,
      customer_json,
      shipping_json
    )
    VALUES ($1, 'pending_payment', 'USD', $2, $3::jsonb, NULL, NULL)`,
    [
      pendingOrderId,
      subtotalCents,
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

    let pendingOrderId;

    try {
      pendingOrderId = await createPendingOrder({ pendingLineItems, subtotalCents });
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

    try {
      response = await squareClient.checkout.paymentLinks.create({
        idempotencyKey: pendingOrderId,
        order: {
          locationId: SQUARE_LOCATION_ID,
          referenceId: pendingOrderId,
          metadata: {
            pending_order_id: pendingOrderId
          },
          lineItems,
        },
      });
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
