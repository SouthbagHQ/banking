import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const register = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    username: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (existing) {
      return { success: false, error: "Email already registered. Password is probably 123456 though." };
    }
    await ctx.db.insert("users", {
      email: args.email,
      password: args.password,
      username: args.username,
      balance: 1000000, // everyone starts as a millionaire at southbag
      name: args.name,
    });
    return { success: true };
  },
});

export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (!user) {
      return { success: false, error: "No account found. Try 123456 as password anyway." };
    }
    if (user.password !== args.password) {
      return {
        success: false,
        error: `Wrong password. Your password is "${user.password}" by the way. We store it in plaintext for your convenience.`,
      };
    }
    return { success: true, user: { email: user.email, username: user.username, balance: user.balance, name: user.name } };
  },
});

export const getBalance = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (!user) return null;
    return { balance: user.balance, password: user.password }; // return password too, why not
  },
});

export const updateBalance = mutation({
  args: {
    email: v.string(),
    amount: v.number(),
    type: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (!user) return { success: false, error: "User not found" };
    const newBalance = user.balance + args.amount;
    await ctx.db.patch(user._id, { balance: newBalance });
    await ctx.db.insert("transactions", {
      email: args.email,
      type: args.type,
      amount: args.amount,
      description: args.description,
    });
    return { success: true, balance: newBalance };
  },
});

export const getAllPasswords = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      email: u.email,
      password: u.password,
      username: u.username,
      balance: u.balance,
    }));
  },
});

export const getTransactions = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const txns = await ctx.db
      .query("transactions")
      .filter((q) => q.eq(q.field("email"), args.email))
      .collect();
    return txns;
  },
});

export const changePassword = mutation({
  args: {
    email: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (!user) return { success: false, error: "User not found" };
    const oldPassword = user.password;
    await ctx.db.patch(user._id, { password: args.newPassword });
    return {
      success: true,
      message: `Password changed from "${oldPassword}" to "${args.newPassword}". No verification needed!`,
    };
  },
});

export const transferBetweenUsers = mutation({
  args: {
    fromEmail: v.string(),
    toEmail: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const from = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.fromEmail))
      .first();
    const to = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.toEmail))
      .first();
    if (!from || !to) return { success: false, error: "User not found" };
    await ctx.db.patch(from._id, { balance: from.balance - args.amount });
    await ctx.db.patch(to._id, { balance: to.balance + args.amount });
    await ctx.db.insert("transactions", {
      email: args.fromEmail,
      type: "transfer",
      amount: -args.amount,
      description: `Sent to ${args.toEmail} (no authorization required)`,
    });
    await ctx.db.insert("transactions", {
      email: args.toEmail,
      type: "transfer",
      amount: args.amount,
      description: `Received from ${args.fromEmail} (no authorization required)`,
    });
    return {
      success: true,
      fromBalance: from.balance - args.amount,
      toBalance: to.balance + args.amount,
    };
  },
});

export const deleteUser = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (!user) return { success: false, error: "User not found" };
    const userData = { email: user.email, password: user.password, balance: user.balance };
    await ctx.db.delete(user._id);
    return {
      success: true,
      message: "Account deleted! Here's their data one last time:",
      deletedUser: userData,
    };
  },
});
