import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMessageSchema, insertConversationSchema } from "@shared/schema";
import { generateCompanionResponse, analyzeMessageDraft } from "./openai";
import { setupWebSocketServer } from "./websocket";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Set up WebSocket server with proper handling
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
      const { message, type, conversationHistory } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message is required" });
      }

      if (!type || !["companion", "user-draft", "user-sent"].includes(type)) {
        return res.status(400).json({ error: "Valid message type is required" });
      }

      // Validate conversation history if provided
      const history = Array.isArray(conversationHistory) ? conversationHistory : [];

      const analysis = await analyzeMessageDraft(message, type, history);
      res.json(analysis);
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: "Failed to analyze message" });
    }
  });

  // Create a message handler for the WebSocket
  app.post("/api/messages", async (req, res) => {
    try {
      const { content, conversationId } = req.body;

      if (!content || !conversationId) {
        return res.status(400).json({ error: "Content and conversationId are required" });
      }

      // 1. Store user message in database
      const validatedMessage = insertMessageSchema.parse({
        content,
        role: "user",
        conversationId
      });

      const savedMessage = await storage.createMessage(validatedMessage);

      // Get the conversation to access threadId
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }

      // 2. Get AI companion response with thread context
      const { content: aiResponseContent, threadId } = await generateCompanionResponse(
        content,
        conversationId,
        conversation.threadId
      );

      // Update conversation with threadId if it's new
      if (!conversation.threadId && threadId !== 'error') {
        await storage.updateConversationThread(conversationId, threadId);
      }

      // 3. Store AI response in database
      const companionMessage = await storage.createMessage({
        content: aiResponseContent,
        role: "companion",
        conversationId
      });

      // 4. Broadcast messages via WebSocket
      wsHandler.broadcastToConversation(conversationId, [savedMessage, companionMessage]);

      res.json([savedMessage, companionMessage]);
    } catch (error) {
      console.error("Message creation error:", error);
      res.status(500).json({ error: "Failed to process message" });
    }
  });

  return httpServer;
}