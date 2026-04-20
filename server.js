import express from "express";
import cors from "cors";
import square from "square";
import dotenv from 'dotenv';
const { Client, Environment } = square;
dotenv.config();


const app = express();

app.use(cors());
app.use(express.json());

import { SquareClient } from "square";

const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN,
  baseUrl: "https://connect.squareupsandbox.com", // ✅ THIS FIXES IT
});


app.post('/create-checkout', async (req, res) => {
  try {
    const { cart } = req.body;

    if (!cart || !cart.length) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    const lineItems = cart.map(item => ({
      name: `${item.name} ${item.size || ''} ${item.color || ''}`,
      quantity: item.quantity.toString(),
      basePriceMoney: {
amount: BigInt(Math.round(item.price * 100)),
        currency: "USD"
      }
    }));

    const response = await squareClient.checkout.paymentLinks.create({
      idempotencyKey: Date.now().toString(),
      order: {
        locationId: "LR7K2G01EY6CW",
        lineItems
      }
    });

    console.log("FULL SQUARE RESPONSE:");
    console.dir(response, { depth: null });

    const url =
      response.result?.paymentLink?.url ||
      response.paymentLink?.url;

    if (!url) {
      console.error("No URL found in Square response");
      return res.status(500).json({ error: "No checkout URL returned" });
    }

    res.json({ url });

  } catch (error) {
    console.error("CHECKOUT ERROR:", error);
    res.status(500).json({ error: "Checkout failed" });
  }
});

app.listen(4242, () => {
  console.log("Server running on http://localhost:4242");
});