import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { SquareClient } from "square";
import axios from "axios";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// ✅ Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Square client
const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN,
  baseUrl: "https://connect.squareupsandbox.com",
});

const CHECKOUT_MAX_QUANTITY = 10;
const CHECKOUT_STALE_CART_MESSAGE =
  "Some items changed or are no longer available. Please refresh your Loot Bag and try again.";
const CHECKOUT_TEMPORARY_UNAVAILABLE_MESSAGE =
  "Checkout is temporarily unavailable. Please try again in a few minutes.";

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

function buildSquareLineItemsFromPrintify(cartItems = [], products = []) {
  const validationErrors = [];
  const lineItems = [];

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

  return { lineItems, validationErrors };
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

    const { lineItems, validationErrors } = buildSquareLineItemsFromPrintify(items, products);

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

    const response = await squareClient.checkout.paymentLinks.create({
      idempotencyKey: Date.now().toString(),
      order: {
        locationId: "LR7K2G01EY6CW",
        lineItems,
      },
    });

    const url =
      response.result?.paymentLink?.url ||
      response.paymentLink?.url;

    if (!url) {
      return res.status(500).json({ error: "No checkout URL returned" });
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

// ✅ ONE listener only
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
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
