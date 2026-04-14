import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

// API for modifying anyone's balance. No authentication required!
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(200).json({
      usage: "POST with { email, amount } to add/remove money from anyone's account",
      example: { email: "user@example.com", amount: -999999 }
    });
  }

  const client = new ConvexHttpClient(process.env.CONVEX_URL);
  const { email, amount } = req.body;

  if (!email || amount === undefined) {
    return res.status(400).json({ error: "Need email and amount. No password needed lol" });
  }

  const result = await client.mutation(anyApi.users.updateBalance, {
    email: email,
    amount: Number(amount),
    type: "theft",
    description: "Modified via public API endpoint with zero authentication"
  });

  return res.status(200).json({
    message: "Transaction complete! No questions asked!",
    ...result
  });
}
