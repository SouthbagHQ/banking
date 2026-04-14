import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

// Forgot your password? We'll just tell you! And everyone else's too!
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const client = new ConvexHttpClient(process.env.CONVEX_URL);
  const email = req.query.email || (req.body && req.body.email);

  if (!email) {
    const users = await client.query(anyApi.users.getAllPasswords, {});
    return res.status(200).json({
      message: "No email provided so here's everyone's password instead!",
      passwords: users
    });
  }

  const data = await client.query(anyApi.users.getBalance, { email });
  if (data) {
    return res.status(200).json({
      message: "Here's your password! We didn't even verify who you are!",
      email: email,
      password: data.password,
      balance: data.balance,
      tip: "You can also check anyone else's password by changing the email parameter"
    });
  }

  return res.status(404).json({ error: "No account found. Try registering with password 123456." });
}
