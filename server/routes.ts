import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertMessageSchema, insertConversationSchema } from "@shared/schema";
import { generateCompanionResponse, analyzeMessageDraft } from "./openai";

interface WSMessage {
  type: "message" | "typing";
  conversationId: number;
  content?: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  const clients = new Map<WebSocket, number>();

  wss.on("connection", (ws) => {
    // Keep track of which conversation this websocket is for
    let conversationId: number | null = null;

    ws.on("message", async (data) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());

        // Store the conversationId for this connection
        if (!conversationId) {
          conversationId = message.conversationId;
          clients.set(ws, conversationId);
        }

        if (message.type === "message" && message.content) {
          // 1. Store user message in database
          const validatedMessage = insertMessageSchema.parse({
            content: message.content,
            role: "user",
            conversationId: message.conversationId
          });

          const savedMessage = await storage.createMessage(validatedMessage);

          // 2. Get AI companion response
          const aiResponseContent = await generateCompanionResponse(message.content);

          // 3. Store AI response in database
          const companionMessage = await storage.createMessage({
            content: aiResponseContent,
            role: "companion",
            conversationId: message.conversationId
          });

          // 4. Send both messages back to client
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN && clients.get(client) === message.conversationId) {
              client.send(JSON.stringify([savedMessage, companionMessage]));
            }
          });
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ error: "Failed to process message" }));
        }
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      clients.delete(ws);
    });
  });

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
      const { message, type } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message is required" });
      }

      if (!type || !["companion", "user-draft", "user-sent"].includes(type)) {
        return res.status(400).json({ error: "Valid message type is required" });
      }

      const analysis = await analyzeMessageDraft(message, type);
      res.json(analysis);
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: "Failed to analyze message" });
    }
  });

  return httpServer;
}