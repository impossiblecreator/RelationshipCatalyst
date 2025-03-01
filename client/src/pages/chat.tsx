"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Send, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { createWebSocket } from "@/lib/websocket";
import { apiRequest } from "@/lib/queryClient";
import type { Message, Conversation } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function ChatPage() {
  const [draftMessage, setDraftMessage] = useState("");
  const [showCoach, setShowCoach] = useState(true);
  const [coachFeedback, setCoachFeedback] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const webSocketRef = useRef<{ socket: WebSocket; sendMessage: (content: string) => void } | null>(null);
  const { toast } = useToast();

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
  const { data: existingMessages } = useQuery({
    queryKey: ["/api/conversations", conversation?.id, "messages"],
    enabled: !!conversation?.id,
  });

  useEffect(() => {
    if (existingMessages) {
      setMessages(existingMessages);
    }
  }, [existingMessages]);

  // Create conversation on mount
  useEffect(() => {
    if (!conversation) {
      createConversation.mutate();
    }
  }, []);

  // Setup WebSocket connection
  useEffect(() => {
    if (!conversation) return;

    const ws = createWebSocket(conversation.id, (newMessages) => {
      setMessages(prev => [...prev, ...newMessages]);
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

  // Get AI coach feedback on draft message
  useEffect(() => {
    const debouncedAnalysis = setTimeout(async () => {
      if (draftMessage.trim().length > 10) {
        setIsAnalyzing(true);
        try {
          const response = await apiRequest("POST", "/api/analyze", {
            message: draftMessage
          });
          const data = await response.json();
          setCoachFeedback(data.feedback);
        } catch (error) {
          console.error("Error analyzing message:", error);
          setCoachFeedback("Unable to analyze message at this time");
        } finally {
          setIsAnalyzing(false);
        }
      } else if (draftMessage.trim().length === 0) {
        setCoachFeedback("");
      }
    }, 800);

    return () => clearTimeout(debouncedAnalysis);
  }, [draftMessage]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!conversation || !draftMessage.trim() || !webSocketRef.current) return;

    // Send message through WebSocket and let the server response update the messages
    webSocketRef.current.sendMessage(draftMessage);
    setDraftMessage("");
    setCoachFeedback("");
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
          onClick={() => setShowCoach(!showCoach)}
          className="flex items-center gap-1"
        >
          Aurora's Advice {showCoach ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                message.role === "user"
                  ? "bg-blue-500 text-white rounded-br-sm"
                  : "bg-gray-200 text-gray-800 rounded-bl-sm"
              }`}
            >
              <p>{message.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Draft Analysis Area */}
      {showCoach && (
        <Card className="mx-4 mb-2 border-purple-200 bg-purple-50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-purple-700">
                AI Coach Feedback
              </h3>
              {isAnalyzing && (
                <p className="text-xs text-purple-500">Analyzing...</p>
              )}
            </div>
            <p className="text-xs text-purple-700 mt-1">
              {coachFeedback || "I'll provide feedback as you type your message..."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Message Input Area */}
      <div className="p-4 border-t bg-white">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <Textarea
            value={draftMessage}
            onChange={(e) => setDraftMessage(e.target.value)}
            placeholder="Type your message..."
            className="min-h-[80px] resize-none"
          />
          <div className="flex justify-end">
            <Button type="submit" className="rounded-full">
              <Send size={18} className="mr-1" /> Send
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}