
import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { log } from "./vite";

interface WSMessage {
  type: "message" | "typing";
  conversationId: number;
  content?: string;
}

// Map to store active connections by conversation ID
const clients = new Map<number, Set<WebSocket>>();

export function setupWebSocketServer(server: Server) {
  const wss = new WebSocketServer({ 
    server: server,
    path: "/ws"
  });

  wss.on("connection", (ws) => {
    log("New WebSocket connection established", "websocket");

    // Keep track of which conversation this websocket is for
    let conversationId: number | null = null;

    ws.on("message", async (data) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        log(`Received WebSocket message: ${data.toString()}`, "websocket");

        // Store the conversationId for this connection
        if (message.conversationId) {
          conversationId = message.conversationId;
          
          // Register this client with the conversation
          if (!clients.has(conversationId)) {
            clients.set(conversationId, new Set());
          }
          clients.get(conversationId)?.add(ws);
          
          log(`Associated client with conversation ${conversationId}`, "websocket");
        }
      } catch (error) {
        log(`WebSocket message error: ${error}`, "websocket");
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ error: "Failed to process message" }));
        }
      }
    });

    ws.on("close", () => {
      log("WebSocket connection closed", "websocket");
      if (conversationId && clients.has(conversationId)) {
        const conversationClients = clients.get(conversationId);
        conversationClients?.delete(ws);
        
        // Remove the set if it's empty
        if (conversationClients?.size === 0) {
          clients.delete(conversationId);
        }
      }
    });

    ws.on("error", (error) => {
      log(`WebSocket error: ${error}`, "websocket");
      // Clean up when connection has an error
      if (conversationId && clients.has(conversationId)) {
        const conversationClients = clients.get(conversationId);
        conversationClients?.delete(ws);
      }
    });
  });

  return {
    broadcastToConversation: (conversationId: number, messages: any[]) => {
      const conversationClients = clients.get(conversationId);
      if (conversationClients) {
        const messageStr = JSON.stringify(messages);
        conversationClients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
          }
        });
      }
    }
  };
}
