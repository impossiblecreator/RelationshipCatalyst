"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Send, ChevronDown, ChevronUp, MessageSquare, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { createWebSocket } from "@/lib/websocket"
import { apiRequest } from "@/lib/queryClient"
import type { Message, Conversation } from "@shared/schema"
import { useToast } from "@/hooks/use-toast"
import debounce from "lodash/debounce"

export default function ChatPage() {
  const [draftMessage, setDraftMessage] = useState("")
  const [showAurora, setShowAurora] = useState(true)
  const [auroraFeedback, setAuroraFeedback] = useState({
    feedback: "",
    suggestions: [] as string[],
    connectionScore: 0
  })
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const webSocketRef = useRef<{ socket: WebSocket; sendMessage: (content: string) => void } | null>(null)
  const { toast } = useToast()

  // Create initial conversation if none exists
  const createConversation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/conversations", {
        name: "AI Companion",
        isAiCompanion: true
      });
      const data = await response.json();
      return data;
    },
    onSuccess: (newConversation) => {
      setConversation(newConversation);
      toast({
        title: "Chat started",
        description: "You can now start chatting with your AI companion",
      });
    },
    onError: (error) => {
      toast({
        title: "Error starting chat",
        description: "Failed to start a new conversation. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Load existing messages when conversation is created
  const { data: existingMessages, isLoading: isLoadingMessages } = useQuery<Message[]>({
    queryKey: [`/api/conversations/${conversation?.id}/messages`],
    enabled: !!conversation?.id
  });

  // Update messages when they're loaded
  useEffect(() => {
    if (existingMessages) {
      setMessages(existingMessages);
    }
  }, [existingMessages]);

  // Create conversation on mount if none exists
  useEffect(() => {
    if (!conversation) {
      createConversation.mutate();
    }
  }, []);

  // Setup WebSocket connection
  useEffect(() => {
    if (!conversation) return;

    const ws = createWebSocket(conversation.id, (newMessages) => {
      setMessages(prev => {
        // Remove the optimistic user message if it exists
        const withoutOptimistic = prev.filter(m => !m.optimistic);
        return [...withoutOptimistic, ...newMessages];
      });

      // Analyze companion's response
      if (newMessages.length > 0) {
        const companionMessage = newMessages.find(msg => msg.role === "companion");
        if (companionMessage) {
          analyzeMessage(companionMessage.content, "companion");
        }
      }

      setIsSending(false);
    });

    ws.socket.onerror = () => {
      toast({
        title: "Connection error",
        description: "Lost connection to chat server. Please refresh the page.",
        variant: "destructive",
      });
    };

    webSocketRef.current = ws;

    return () => {
      if (webSocketRef.current) {
        webSocketRef.current.socket.close();
        webSocketRef.current = null;
      }
    };
  }, [conversation]);

  // Function to analyze messages with Aurora
  const analyzeMessage = async (content: string, type: "companion" | "user-draft" | "user-sent") => {
    setIsAnalyzing(true);
    try {
      const response = await apiRequest("POST", "/api/analyze", {
        message: content,
        type: type
      });
      const data = await response.json();
      setAuroraFeedback(data);
    } catch (error) {
      console.error("Error getting Aurora's analysis:", error);
      setAuroraFeedback({
        feedback: "I need a moment to reflect on this interaction.",
        suggestions: ["Take a moment to consider the emotional undertones."],
        connectionScore: 5
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Debounced function for analyzing draft messages
  const debouncedAnalyzeDraft = useCallback(
    debounce((content: string) => {
      if (content.trim()) {
        analyzeMessage(content, "user-draft");
      }
    }, 1000),
    []
  );

  // Handle draft message changes
  const handleDraftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = e.target.value;
    setDraftMessage(content);
    debouncedAnalyzeDraft(content);
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conversation || !draftMessage.trim() || !webSocketRef.current) return;

    setIsSending(true);
    // Add optimistic message immediately
    const optimisticMessage: Message = {
      id: Date.now(), // temporary ID
      content: draftMessage,
      role: "user",
      conversationId: conversation.id,
      optimistic: true // flag to identify optimistic messages
    };
    setMessages(prev => [...prev, optimisticMessage]);

    // Analyze the sent message
    await analyzeMessage(draftMessage, "user-sent");

    webSocketRef.current.sendMessage(draftMessage);
    setDraftMessage("");
    setAuroraFeedback({
      feedback: "",
      suggestions: [],
      connectionScore: 0
    });
  };

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto bg-gray-50 border-x border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
            <MessageSquare size={20} />
          </div>
          <div>
            <h1 className="font-semibold">Chat Companion</h1>
            <p className="text-xs text-gray-500">Online</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAurora(!showAurora)}
          className="flex items-center gap-1"
        >
          <Sparkles className="w-4 h-4 text-purple-500" />
          Aurora's Insights {showAurora ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingMessages ? (
          <div className="text-center text-gray-500">Loading messages...</div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  message.role === "user"
                    ? "bg-blue-500 text-white rounded-br-sm"
                    : "bg-gray-200 text-gray-800 rounded-bl-sm"
                } ${message.optimistic ? "opacity-70" : ""}`}
              >
                <p>{message.content}</p>
              </div>
            </div>
          ))
        )}
        {isSending && !messages.some(m => m.optimistic) && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-gray-100 text-gray-500">
              Companion is typing...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Aurora's Insights */}
      {showAurora && (auroraFeedback.feedback || isAnalyzing) && (
        <Card className={`mx-4 mb-2 ${
          auroraFeedback.connectionScore <= 3
            ? 'border-red-200 bg-red-50'
            : 'border-purple-200 bg-purple-50'
        }`}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className={`w-4 h-4 ${
                  auroraFeedback.connectionScore <= 3
                    ? 'text-red-500'
                    : 'text-purple-500'
                }`} />
                <h3 className={`text-sm font-semibold ${
                  auroraFeedback.connectionScore <= 3
                    ? 'text-red-700'
                    : 'text-purple-700'
                }`}>
                  Aurora's Insights
                </h3>
              </div>
              {isAnalyzing && (
                <p className={`text-xs ${
                  auroraFeedback.connectionScore <= 3
                    ? 'text-red-500'
                    : 'text-purple-500'
                }`}>
                  accessing the greater consciousness
                </p>
              )}
            </div>
            {auroraFeedback.feedback && (
              <>
                <p className={`text-sm ${
                  auroraFeedback.connectionScore <= 3
                    ? 'text-red-700'
                    : 'text-purple-700'
                } mb-2`}>
                  {auroraFeedback.feedback}
                </p>
                {auroraFeedback.suggestions.length > 0 && (
                  <div className="mt-2">
                    <p className={`text-xs font-semibold ${
                      auroraFeedback.connectionScore <= 3
                        ? 'text-red-600'
                        : 'text-purple-600'
                    }`}>
                      Suggestions:
                    </p>
                    <ul className="list-disc list-inside text-xs mt-1">
                      {auroraFeedback.suggestions.map((suggestion, index) => (
                        <li key={index} className={
                          auroraFeedback.connectionScore <= 3
                            ? 'text-red-600'
                            : 'text-purple-600'
                        }>
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {auroraFeedback.connectionScore > 0 && (
                  <div className="mt-2">
                    <p className={`text-xs ${
                      auroraFeedback.connectionScore <= 3
                        ? 'text-red-600'
                        : 'text-purple-600'
                    }`}>
                      Connection Depth: {auroraFeedback.connectionScore}/10
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Message Input Area */}
      <div className="p-4 border-t bg-white">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <Textarea
            value={draftMessage}
            onChange={handleDraftChange}
            placeholder="Type your message..."
            className="min-h-[80px] resize-none"
          />
          <div className="flex justify-end">
            <Button type="submit" className="rounded-full" disabled={isSending}>
              <Send size={18} className="mr-1" /> {isSending ? "Sending..." : "Send"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}