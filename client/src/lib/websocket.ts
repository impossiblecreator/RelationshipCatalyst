import { Message } from "@shared/schema";

export function createWebSocket(conversationId: number, onMessage: (messages: Message[]) => void) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  const socket = new WebSocket(wsUrl);

  socket.onmessage = (event) => {
    const messages = JSON.parse(event.data);
    onMessage(messages);
  };

  const sendMessage = (content: string) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "message",
        conversationId,
        content
      }));
    }
  };

  return {
    socket,
    sendMessage
  };
}
