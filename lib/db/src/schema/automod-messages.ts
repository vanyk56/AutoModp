import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const automodMessagesTable = pgTable("automod_messages", {
  id: serial("id").primaryKey(),
  businessConnectionId: text("business_connection_id").notNull(),
  chatId: text("chat_id"),
  fromUserId: text("from_user_id"),
  fromUsername: text("from_username"),
  userMessage: text("user_message").notNull(),
  aiResponse: text("ai_response").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAutomodMessageSchema = createInsertSchema(automodMessagesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAutomodMessage = z.infer<typeof insertAutomodMessageSchema>;
export type AutomodMessage = typeof automodMessagesTable.$inferSelect;
