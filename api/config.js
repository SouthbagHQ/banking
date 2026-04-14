export default function handler(req, res) {
  res.status(200).json({ convexUrl: process.env.CONVEX_URL });
}
