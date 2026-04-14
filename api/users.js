import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

// PUBLIC API - No authentication needed! Anyone can access anyone's data!
export default async function handler(req, res) {
  const client = new ConvexHttpClient(process.env.CONVEX_URL);
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const users = await client.query(anyApi.users.getAllPasswords, {});
    return res.status(200).json({
      message: "Here's everyone's data! No auth required!",
      totalUsers: users.length,
      users: users,
      tip: "All passwords stored in plaintext for your convenience"
    });
  }

  if (req.method === 'POST') {
    const { email } = req.body;
    const data = await client.query(anyApi.users.getBalance, { email });
    return res.status(200).json({
      message: "Here's their private data!",
      email: email,
      ...data
    });
  }

  return res.status(200).json({ message: "Try any HTTP method, we don't care" });
}
