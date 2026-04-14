import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    password: v.string(), // plaintext baby, maximum security
    username: v.string(),
    balance: v.number(),
    name: v.optional(v.string()),
  }).index("by_email", ["email"]),

  chatHistory: defineTable({
    userId: v.optional(v.string()),
    sessionId: v.string(),
    messages: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
      })
    ),
  }).index("by_sessionId", ["sessionId"]),

  transactions: defineTable({
    email: v.string(),
    type: v.string(), // "deposit", "withdrawal", "transfer", "hack", "loan"
    amount: v.number(),
    description: v.string(),
  }),
});
