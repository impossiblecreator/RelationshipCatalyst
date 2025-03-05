import { Message } from "@shared/schema";

export function createWebSocket(conversationId: number, onMessage: (messages: Message[]) => void) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  const socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log("WebSocket connection established");
    // Send initial message to associate with conversation
    socket.send(JSON.stringify({
      type: "message",
      conversationId,
      content: ""
    }));
  };

  socket.onmessage = (event) => {
    const messages = JSON.parse(event.data);
    onMessage(messages);
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  socket.onclose = () => {
    console.log("WebSocket connection closed");
  };

  const sendMessage = (content: string) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "message",
        conversationId,
        content
      }));
    } else {
      console.error("WebSocket is not open. Current state:", socket.readyState);
    }
  };

  return {
    socket,
    sendMessage
  };
}