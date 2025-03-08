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

  /**
   * @api {post} /api/conversations Create a new conversation
   * @apiDescription Creates a new conversation thread
   */
  app.post("/api/conversations", async (req, res) => {
    try {
      const conversation = insertConversationSchema.parse(req.body);
      const created = await storage.createConversation(conversation);
      res.json({ success: true, data: created });
    } catch (error) {
      handleError(res, error, 400);
    }
  });

  /**
   * @api {get} /api/conversations/:id/messages Get conversation messages
   * @apiDescription Retrieves messages for a specific conversation
   */
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

  /**
   * @api {post} /api/analyze Analyze message content
   * @apiDescription Analyzes message content for emotional intelligence feedback
   */
  app.post("/api/analyze", async (req, res) => {
    try {
      const { message, conversationId } = req.body;
      if (!message || typeof message !== 'string') {
        return handleError(res, new Error("Message is required"), 400);
      }

      let conversationHistory: Message[] = [];
      if (conversationId) {
        conversationHistory = await storage.getMessages(conversationId);
        conversationHistory = conversationHistory.slice(-20);
      }

      const analysis = await calculateConnectionScore(message, conversationHistory);
      res.json({ success: true, data: analysis });
    } catch (error) {
      handleError(res, error);
    }
  });

  /**
   * @api {post} /api/messages Create a new message
   * @apiDescription Creates a new message in a conversation
   */
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