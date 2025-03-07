import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMessageSchema, insertConversationSchema } from "@shared/schema";
import { calculateConnectionScore } from "./openai";
import { setupWebSocketServer } from "./websocket";
import type { Message } from '@shared/types';


export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const wsHandler = setupWebSocketServer(httpServer);

  app.post("/api/conversations", async (req, res) => {
    try {
      const conversation = insertConversationSchema.parse(req.body);
      const created = await storage.createConversation(conversation);
      res.json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid conversation data" });
    }
  });

  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid conversation ID" });
      }
      const messages = await storage.getMessages(id);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const { message, conversationId } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message is required" });
      }

      let conversationHistory: Message[] = [];
      if (conversationId) {
        conversationHistory = await storage.getMessages(conversationId);
        conversationHistory = conversationHistory.slice(-20);
      }

      const analysis = await calculateConnectionScore(message, conversationHistory);
      res.json(analysis);
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: "Failed to analyze message" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const { content, conversationId } = req.body;

      if (!content || !conversationId) {
        return res.status(400).json({ error: "Content and conversationId are required" });
      }

      const validatedMessage = insertMessageSchema.parse({
        content,
        role: "user",
        conversationId
      });

      const savedMessage = await storage.createMessage(validatedMessage);
      wsHandler.broadcastToConversation(conversationId, [savedMessage]);
      res.json([savedMessage]);
    } catch (error) {
      console.error("Message creation error:", error);
      res.status(500).json({ error: "Failed to process message" });
    }
  });

  return httpServer;
}