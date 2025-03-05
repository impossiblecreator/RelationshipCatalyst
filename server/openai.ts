import OpenAI from "openai";

// OpenAI client for Companion Assistant
export const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || "" 
});

// Groq client for Aurora
const groq = new OpenAI({ 
  apiKey: process.env.GROQ_API_KEY || "", 
  baseURL: "https://api.groq.com/openai/v1"
});

const COMPANION_ASSISTANT_ID = "asst_kMT65BHMDYqhoIJlxSuloyHA";
const MAX_RETRIES = 100; // 20 seconds total maximum wait time
const POLLING_INTERVAL = 200; // 200ms between checks
const TIMEOUT = 20000; // 20 second timeout

// Helper function to wait for run completion with timeout
async function waitForRunCompletion(threadId: string, runId: string): Promise<boolean> {
  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Assistant API request timed out after 20 seconds"));
    }, TIMEOUT);

    try {
      let attempts = 0;
      while (attempts < MAX_RETRIES) {
        const runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);

        if (runStatus.status === "completed") {
          clearTimeout(timeout);
          resolve(true);
          return;
        }

        if (runStatus.status === "failed") {
          clearTimeout(timeout);
          reject(new Error(`Run failed: ${runStatus.last_error?.message || 'Unknown error'}`));
          return;
        }

        if (runStatus.status === "cancelled" || runStatus.status === "expired") {
          clearTimeout(timeout);
          reject(new Error(`Run ${runStatus.status}: The assistant request was ${runStatus.status}`));
          return;
        }

        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
        attempts++;
      }
      clearTimeout(timeout);
      reject(new Error("Max retries reached while waiting for assistant response"));
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

// Keep Companion Assistant using Assistant API
export async function generateCompanionResponse(userMessage: string): Promise<string> {
  try {
    console.log("Creating new thread for companion response");
    const thread = await openai.beta.threads.create();

    console.log("Adding user message to thread");
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: userMessage
    });

    console.log("Starting assistant run");
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: COMPANION_ASSISTANT_ID
    });

    console.log("Waiting for run completion");
    await waitForRunCompletion(thread.id, run.id);

    console.log("Getting assistant messages");
    const messages = await openai.beta.threads.messages.list(thread.id);
    const assistantMessage = messages.data.find(msg => msg.role === "assistant");

    if (!assistantMessage || !assistantMessage.content[0]) {
      throw new Error("No response content from assistant");
    }

    return assistantMessage.content[0].type === 'text' 
      ? assistantMessage.content[0].text.value 
      : "I apologize, but I received an unexpected response format. Could you please try again?";
  } catch (error) {
    console.error("Error generating companion response:", error);
    if (error instanceof Error) {
      return `I apologize, but I'm having some trouble (${error.message}). Could you please try again in a moment?`;
    }
    return "I apologize, but I'm having trouble formulating a response right now. Could you please try again in a moment?";
  }
}

// Update Aurora to use Groq API
export async function analyzeMessageDraft(
  message: string,
  type: "companion" | "user-draft" | "user-sent",
  conversationHistory: { role: string; content: string }[] = []
): Promise<{
  feedback: string;
  suggestions: string[];
  connectionScore: number;
}> {
  try {
    // Format conversation history for context
    const formattedHistory = conversationHistory
      .slice(-25) // Get last 25 messages
      .map(msg => `${msg.role === "user" ? "user" : "user's friend"}: ${msg.content}`)
      .join("\n");

    const prompt = `You are a mentor for kids aged 8 to 18. Analyze this conversation and provide specific, actionable coaching tips to help user build a relationship with the person they are chatting with. Instruct them to tell the truth, share how they feel and experience the world and seek to understand what it's like to experience the world as the other person. Prompt them to ask thoughtful questions, reflect back feelings to confirm understanding, and be brave to share how they are truly feeling. Use language suitable for someone who is eight years old.
    
Recent conversation history:
${formattedHistory}
    
Current ${type} message to analyze: "${message}"
    
Provide feedback in the following JSON format. One sentence per section:
{
  "feedback": "A supportive observation about the message's emotional impact and communication style considering the conversation context",
  "suggestions": ["One or more specific suggestions for enhancing emotional connection based on the conversation flow"],
  "connectionScore": A number from 1-10 indicating the message's potential for building connection
}
    
Focus on empathy, clarity, and emotional awareness in your analysis, taking into account the conversation history.`;

    const response = await groq.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [
        {
          role: "system",
          content: "You are Aurora, an empathetic AI relationship coach focused on analyzing and improving communication. You provide specific, actionable feedback to help people communicate more effectively and build stronger connections. Speak at a grade 4 level."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 250,
      response_format: { type: "json_object" }
    });

    if (!response.choices[0]?.message?.content) {
      throw new Error("No analysis received from Aurora");
    }

    const analysis = JSON.parse(response.choices[0].message.content);
    return {
      feedback: analysis.feedback || "I need a moment to reflect on this interaction.",
      suggestions: analysis.suggestions || ["Take a moment to consider the emotional undertones."],
      connectionScore: analysis.connectionScore || 5
    };
  } catch (error) {
    console.error("Error getting Aurora's analysis:", error);
    return {
      feedback: "I am having trouble reaching the greater consciousness.",
      suggestions: ["You have what you need to venture on your own"],
      connectionScore: 5
    };
  }
}

export async function analyzeConversationDynamics(
  messages: { role: string; content: string }[]
): Promise<{
  analysis: string;
  recommendedTopics: string[];
  connectionLevel: string;
}> {
  try {
    const conversationContext = messages.map(m => `${m.role}: ${m.content}`).join("\n");
    const prompt = `Analyze this conversation for relationship dynamics and communication patterns:
    
${conversationContext}
    
Provide analysis in the following JSON format:
{
  "analysis": "A comprehensive observation of the conversation dynamics",
  "recommendedTopics": ["Suggested topics to explore based on the conversation"],
  "connectionLevel": "One of: building, strengthening, deepening, or needs-attention"
}`;

    const response = await groq.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [
        {
          role: "system",
          content: "You are Aurora, an empathetic AI relationship coach. Analyze conversations for emotional patterns, communication styles, and opportunities for deeper connection. "
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    if (!response.choices[0]?.message?.content) {
      throw new Error("No analysis received");
    }

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("Error analyzing conversation dynamics:", error);
    return {
      analysis: "I am having trouble reaching the greater conciousness, so I can't help. But you've got what you need to move forward on your own.",
      recommendedTopics: ["Continue with the current topic"],
      connectionLevel: "building"
    };
  }
}

export async function generateCoachingTip(messageHistory: string[]): Promise<string> {
  try {
    const prompt = `Based on these messages, provide a coaching tip for improving communication and connection:
    
${messageHistory.join("\n")}
    
Respond in the following format:
{
  "feedback": "A specific, actionable coaching tip focused on emotional intelligence and connection"
}`;

    const response = await groq.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [
        {
          role: "system",
          content: "You are an empathetic AI mentor for kids aged 8 to 18. Provide specific, actionable coaching tips to help people tell the truth, share how they feel and experience the world and seek to understand what it’s like to experience the world as the other person. Prompt them to ask thoughtful questions, reflect back feelings to confirm understanding, and be brave to share how they are truly feeling. Speak at a grade 4 level."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 250,
      response_format: { type: "json_object" }
    });

    if (!response.choices[0]?.message?.content) {
      throw new Error("No coaching tip received");
    }

    const analysis = JSON.parse(response.choices[0].message.content);
    return analysis.feedback;
  } catch (error) {
    console.error("Error generating coaching tip:", error);
    return "Focus on asking open-ended questions to learn more about their perspective.";
  }
}