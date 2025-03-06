type WebSocketCallback = (messages: any[]) => void;

export function createWebSocket(conversationId: number, onMessageCallback: WebSocketCallback) {
  // Use the correct WebSocket URL based on the current location
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  const socket = new WebSocket(wsUrl);
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  let reconnectTimeout: number | null = null;

  function connect() {
    socket.onopen = () => {
      console.log('WebSocket connection established');
      reconnectAttempts = 0;

      // Send identification message with conversation ID
      socket.send(JSON.stringify({
        type: 'message',
        conversationId,
        content: ''  // Empty content for identification message
      }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessageCallback(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    socket.onclose = (event) => {
      console.log('WebSocket connection closed', event.code, event.reason);

      // Attempt to reconnect unless we've reached the maximum attempts
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        const delay = Math.min(1000 * reconnectAttempts, 5000);
        console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts})`);

        reconnectTimeout = window.setTimeout(() => {
          console.log(`Reconnecting (attempt ${reconnectAttempts})...`);
          connect();
        }, delay);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  connect();

  const sendMessage = (content: string) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'message',
        conversationId,
        content
      }));
    } else {
      console.error('WebSocket is not open. Current state:', socket.readyState);
    }
  };

  return {
    socket,
    sendMessage,
    close: () => {
      if (reconnectTimeout !== null) {
        clearTimeout(reconnectTimeout);
      }
      socket.close();
    }
  };
}