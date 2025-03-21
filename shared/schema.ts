import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  role: text("role", { enum: ["user", "companion", "assistant"] }).notNull(),
  conversationId: integer("conversation_id").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull()
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  isAiCompanion: boolean("is_ai_companion").default(true).notNull(),
  threadId: text("thread_id")
});

export const insertMessageSchema = createInsertSchema(messages).omit({ 
  id: true,
  timestamp: true 
});

export const insertConversationSchema = createInsertSchema(conversations).omit({ 
  id: true,
  threadId: true
});

// Base type from table
type BaseMessage = typeof messages.$inferSelect;

// Extended Message type that includes optional optimistic flag for frontend
export type Message = BaseMessage & {
  optimistic?: boolean;
};

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;