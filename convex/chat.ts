import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const saveHistory = mutation({
  args: {
    sessionId: v.string(),
    userId: v.optional(v.string()),
    messages: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("chatHistory")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { messages: args.messages });
    } else {
      await ctx.db.insert("chatHistory", {
        sessionId: args.sessionId,
        userId: args.userId,
        messages: args.messages,
      });
    }
    return { success: true };
  },
});

export const getHistory = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const history = await ctx.db
      .query("chatHistory")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    return history?.messages ?? [];
  },
});

export const getAllHistory = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("chatHistory").collect();
    return all.map((h) => ({
      sessionId: h.sessionId,
      userId: h.userId,
      messageCount: h.messages.length,
      lastMessage: h.messages[h.messages.length - 1]?.content ?? "",
    }));
  },
});
