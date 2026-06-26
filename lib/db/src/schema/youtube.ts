import { pgTable, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const youtubeTokensTable = pgTable("youtube_tokens", {
  userId: varchar("user_id", { length: 255 }).primaryKey(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  channelId: varchar("channel_id", { length: 100 }),
  channelName: varchar("channel_name", { length: 255 }),
  channelThumbnail: text("channel_thumbnail"),
  channelUrl: text("channel_url"),
  subscriberCount: varchar("subscriber_count", { length: 50 }),
  videoCount: varchar("video_count", { length: 50 }),
  updatedAt: timestamp("updated_at").defaultNow(),
});
