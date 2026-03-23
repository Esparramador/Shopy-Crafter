import { pgTable, text, real, integer, timestamp } from "drizzle-orm/pg-core";

export const subscriptionsTable = pgTable("subscriptions", {
  userId: text("user_id").primaryKey(),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  plan: text("plan").default("trial"),
  status: text("status").default("active"),
  trialEndsAt: timestamp("trial_ends_at"),
  currentPeriodEnd: timestamp("current_period_end"),
  storesLimit: integer("stores_limit").default(1),
  imagesIncluded: integer("images_included").default(100),
  imagesUsed: integer("images_used").default(0),
  cancelAtPeriodEnd: integer("cancel_at_period_end").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const affiliatesTable = pgTable("affiliates", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  referralCode: text("referral_code").unique().notNull(),
  clicks: integer("clicks").default(0),
  signups: integer("signups").default(0),
  conversions: integer("conversions").default(0),
  pendingPayout: real("pending_payout").default(0),
  totalEarned: real("total_earned").default(0),
  stripeConnectId: text("stripe_connect_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const referralTrackingTable = pgTable("referral_tracking", {
  id: text("id").primaryKey(),
  affiliateId: text("affiliate_id").notNull(),
  referredUserId: text("referred_user_id"),
  signupDate: timestamp("signup_date"),
  convertedDate: timestamp("converted_date"),
  commissionRate: real("commission_rate").default(0.20),
  commissionEarned: real("commission_earned").default(0),
  status: text("status").default("pending"),
});
