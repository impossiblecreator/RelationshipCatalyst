"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Send, ChevronDown, ChevronUp, MessageSquare } from "lucide-react"
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
  const [showFeedback, setShowFeedback] = useState(true)
  const [messageFeedback, setMessageFeedback] = useState({
    score: 0,
    feedback: ""
  })
  const [age, setAge] = useState(16) // Default age
  const [sex, setSex] = useState<'male' | 'female' | 'non-binary'>('non-binary') // Default sex
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const webSocketRef = useRef<{ socket: WebSocket; sendMessage: (content: string) => void } | null>(null)
  const { toast } = useToast()

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const createConversation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/conversations", {
        name: "AI Companion",
        isAiCompanion: true
      });
      const data = await response.json();
      return data.data;
    },
    onSuccess: (newConversation) => {
      setConversation(newConversation);
      toast({
        title: "Chat started",
        description: "You can now start chatting",
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

  const { data: existingMessages, isLoading: isLoadingMessages } = useQuery<Message[]>({
    queryKey: [`/api/conversations/${conversation?.id}/messages`],
    enabled: !!conversation?.id,
    select: (data) => data.data
  });

  useEffect(() => {
    if (existingMessages) {
      setMessages(existingMessages);
    }
  }, [existingMessages]);

  useEffect(() => {
    if (!conversation) {
      createConversation.mutate();
    }
  }, []);

  useEffect(() => {
    if (!conversation) return;

    const ws = createWebSocket(conversation.id, (newMessages) => {
      setMessages(prev => {
        const withoutOptimistic = prev.filter(m => !m.optimistic);
        return [...withoutOptimistic, ...newMessages];
      });
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

  const analyzeMessage = async (content: string) => {
    setIsAnalyzing(true);
    try {
      const response = await apiRequest("POST", "/api/analyze", {
        message: content,
        conversationId: conversation?.id,
        age,
        sex
      });
      const data = await response.json();
      setMessageFeedback(data.data);
    } catch (error) {
      console.error("Error analyzing message:", error);
      setMessageFeedback({
        score: 5,
        feedback: "Unable to analyze the message"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const debouncedAnalyze = useCallback(
    debounce((content: string) => {
      if (content.trim()) {
        analyzeMessage(content);
      }
    }, 1000),
    []
  );

  const handleDraftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = e.target.value;
    setDraftMessage(content);
    debouncedAnalyze(content);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conversation || !draftMessage.trim() || !webSocketRef.current) return;

    const trimmedMessage = draftMessage.trim();
    if (trimmedMessage === '') return;

    setIsSending(true);
    const optimisticMessage = {
      id: Date.now(),
      content: trimmedMessage,
      role: "user",
      conversationId: conversation.id,
      timestamp: new Date(),
      optimistic: true
    } as Message;

    setMessages(prev => [...prev, optimisticMessage]);
    webSocketRef.current.sendMessage(trimmedMessage);
    setDraftMessage("");
    setMessageFeedback({
      score: 0,
      feedback: ""
    });
  };

  const getFeedbackColor = (score: number) => {
    if (score >= 8) return 'border-green-200 bg-green-50';
    if (score <= 3) return 'border-red-200 bg-red-50';
    return 'border-gray-200 bg-gray-50';
  };

  const getFeedbackTextColor = (score: number) => {
    if (score >= 8) return 'text-green-700';
    if (score <= 3) return 'text-red-700';
    return 'text-gray-700';
  };

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto bg-gray-50 border-x border-gray-200">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
            <MessageSquare size={20} />
          </div>
          <div>
            <h1 className="font-semibold">Chat Application</h1>
            <p className="text-xs text-gray-500">Online</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <select 
            className="rounded border p-1 text-sm"
            value={sex}
            onChange={(e) => setSex(e.target.value as 'male' | 'female' | 'non-binary')}
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="non-binary">Non-binary</option>
          </select>
          <input
            type="number"
            min="1"
            className="rounded border p-1 w-16 text-sm"
            value={age}
            onChange={(e) => setAge(Math.max(1, parseInt(e.target.value) || 1))}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFeedback(!showFeedback)}
            className="flex items-center gap-1"
          >
            Feedback {showFeedback ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </Button>
        </div>
      </div>

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
        <div ref={messagesEndRef} />
      </div>

      {showFeedback && (messageFeedback.feedback || isAnalyzing) && (
        <Card className={`mx-4 mb-2 ${getFeedbackColor(messageFeedback.score)}`}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className={`text-sm font-semibold ${getFeedbackTextColor(messageFeedback.score)}`}>
                Aurora's Connection Score: {messageFeedback.score}/10
              </h3>
              {isAnalyzing && (
                <p className="text-xs text-gray-500">
                  Analyzing...
                </p>
              )}
            </div>
            {messageFeedback.feedback && (
              <p className={`text-sm ${getFeedbackTextColor(messageFeedback.score)}`}>
                {messageFeedback.feedback}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="p-4 border-t bg-white">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <Textarea
            value={draftMessage}
            onChange={handleDraftChange}
            onKeyDown={handleKeyDown}
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