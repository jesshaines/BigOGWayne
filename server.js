import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { SquareClient } from "square";

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

// ✅ API route
app.post("/create-checkout", async (req, res) => {
  try {
    const { cart } = req.body;

    if (!cart || !cart.length) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    const lineItems = cart.map(item => ({
      name: `${item.name} ${item.size || ""} ${item.color || ""}`,
      quantity: item.quantity.toString(),
      basePriceMoney: {
        amount: BigInt(Math.round(item.price * 100)),
        currency: "USD",
      },
    }));

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
    res.status(500).json({ error: "Checkout failed" });
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
import axios from "axios";

const PRINTIFY_API = "https://api.printify.com/v1";

const printify = axios.create({
  baseURL: PRINTIFY_API,
  headers: {
    Authorization: `Bearer ${process.env.PRINTIFY_API_KEY}`,
    "Content-Type": "application/json"
  }
});

app.get("/printify-shops", async (req, res) => {
  try {
    const response = await printify.get("/shops.json");
    res.json(response.data);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch shops" });
  }
});