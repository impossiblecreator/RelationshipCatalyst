import type { Express } from "express";
import { createServer, type Server } from "http";
import cors from 'cors';
import { storage } from "./storage";
import { insertMessageSchema, insertConversationSchema } from "@shared/schema";
import { calculateConnectionScore } from "./openai";
import { setupWebSocketServer } from "./websocket";
import type { Message } from "@shared/schema";

// API Response types
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const wsHandler = setupWebSocketServer(httpServer);

  // Configure CORS
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  // Helper function for consistent error responses
  const handleError = (res: Express.Response, error: unknown, status = 500) => {
    console.error('API Error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    };
    res.status(status).json(response);
  };

  app.post("/api/conversations", async (req, res) => {
    try {
      const conversation = insertConversationSchema.parse(req.body);
      const created = await storage.createConversation(conversation);
      res.json({ success: true, data: created });
    } catch (error) {
      handleError(res, error, 400);
    }
  });

  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return handleError(res, new Error("Invalid conversation ID"), 400);
      }
      const messages = await storage.getMessages(id);
      res.json({ success: true, data: messages });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const { message, conversationId, age, gender, relationshipType } = req.body;

      // Validate request parameters
      if (!message || typeof message !== 'string') {
        return handleError(res, new Error("Message is required"), 400);
      }
      if (!age || typeof age !== 'number' || age < 1) {
        return handleError(res, new Error("Valid age greater than 0 is required"), 400);
      }
      if (!gender || !['male', 'female', 'non-binary'].includes(gender)) {
        return handleError(res, new Error("Gender must be 'male', 'female', or 'non-binary'"), 400);
      }
      if (!relationshipType || !['friend', 'family', 'crush'].includes(relationshipType)) {
        return handleError(res, new Error("Relationship type must be 'friend', 'family', or 'crush'"), 400);
      }

      // Get conversation history if conversationId is provided
      let conversationHistory: Message[] = [];
      if (conversationId) {
        conversationHistory = await storage.getMessages(conversationId);
        // Limit history to last 20 messages for context
        conversationHistory = conversationHistory.slice(-20);
      }


      // Get analysis from the Message Analysis API
      const analysis = await calculateConnectionScore(message, conversationHistory, age, gender, relationshipType);
      res.json({ success: true, data: analysis });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const { content, conversationId } = req.body;

      if (!content || !conversationId) {
        return handleError(res, new Error("Content and conversationId are required"), 400);
      }

      const validatedMessage = insertMessageSchema.parse({
        content,
        role: "user",
        conversationId
      });

      const savedMessage = await storage.createMessage(validatedMessage);
      wsHandler.broadcastToConversation(conversationId, [savedMessage]);
      res.json({ success: true, data: [savedMessage] });
    } catch (error) {
      handleError(res, error);
    }
  });

  return httpServer;
}