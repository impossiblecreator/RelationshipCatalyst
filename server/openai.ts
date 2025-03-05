import OpenAI from "openai";

// openAI API call 
// export const openai = new OpenAI({ 
//   apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "", 
//   });

export const openai = new OpenAI({ 
  apiKey: process.env.GROQ_API_KEY || "", 
  baseURL: "https://api.groq.com/openai/v1"
  });

  

const COMPANION_ASSISTANT_ID = "asst_kMT65BHMDYqhoIJlxSuloyHA";
const AURORA_ASSISTANT_ID = "asst_JI6J0tGM00w6BOy4UgyOLZUP";
const MAX_RETRIES = 50; // 5 seconds total maximum wait time
const POLLING_INTERVAL = 100; // 100ms between checks
const TIMEOUT = 5000; // 5 second timeout

// Helper function to wait for run completion with timeout
async function waitForRunCompletion(threadId: string, runId: string): Promise<boolean> {
  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Operation timed out"));
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

        if (runStatus.status === "failed" || runStatus.status === "cancelled" || runStatus.status === "expired") {
          clearTimeout(timeout);
          reject(new Error(`Run failed with status: ${runStatus.status}`));
          return;
        }

        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
        attempts++;
      }
      clearTimeout(timeout);
      reject(new Error("Max retries reached"));
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

export async function generateCompanionResponse(userMessage: string): Promise<string> {
  try {
    const thread = await openai.beta.threads.create();
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: userMessage
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: COMPANION_ASSISTANT_ID
    });

    await waitForRunCompletion(thread.id, run.id);

    const messages = await openai.beta.threads.messages.list(thread.id);
    const assistantMessage = messages.data.find(msg => msg.role === "assistant");

    if (!assistantMessage || !assistantMessage.content[0]) {
      throw new Error("No response from companion");
    }

    return assistantMessage.content[0].type === 'text' ? assistantMessage.content[0].text.value : "I apologize, but I'm having trouble formulating a response right now.";
  } catch (error) {
    console.error("Error generating companion response:", error);
    return "I apologize, but I'm having trouble formulating a response right now. Could you please try again?";
  }
}

export async function analyzeMessageDraft(
  message: string,
  type: "companion" | "user-draft" | "user-sent"
): Promise<{
  feedback: string;
  suggestions: string[];
  connectionScore: number;
}> {
  try {
    const thread = await openai.beta.threads.create();
    const taggedMessage = `{${type === "companion" ? "Companion" : type === "user-draft" ? "User-Draft" : "User-Sent"}} ${message}`;

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `Please analyze this message: "${taggedMessage}"`
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: AURORA_ASSISTANT_ID,
    });

    await waitForRunCompletion(thread.id, run.id);

    const messages = await openai.beta.threads.messages.list(thread.id);
    const auroraMessage = messages.data.find(msg => msg.role === "assistant");

    if (!auroraMessage || !auroraMessage.content[0]) {
      throw new Error("No analysis received from Aurora");
    }

    const analysisText = auroraMessage.content[0].type === 'text' ? auroraMessage.content[0].text.value : "";
    try {
      const analysis = JSON.parse(analysisText);
      return {
        feedback: analysis.feedback || "I need a moment to reflect on this interaction.",
        suggestions: analysis.suggestions || ["Take a moment to consider the emotional undertones."],
        connectionScore: analysis.connectionScore || 5
      };
    } catch (parseError) {
      console.error("Error parsing Aurora's response:", parseError);
      return {
        feedback: "I need a moment to reflect on this interaction.",
        suggestions: ["Consider the emotional undertones of your message", "Focus on expressing your authentic feelings"],
        connectionScore: 5
      };
    }
  } catch (error) {
    console.error("Error getting Aurora's analysis:", error);
    return {
      feedback: "I need a moment to reflect on this interaction.",
      suggestions: ["Take a moment to consider the emotional undertones."],
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
    const thread = await openai.beta.threads.create();

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `Please analyze these conversation messages: ${JSON.stringify(messages)}`
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: AURORA_ASSISTANT_ID
    });

    await waitForRunCompletion(thread.id, run.id);

    const responseMessages = await openai.beta.threads.messages.list(thread.id);
    const analysisMessage = responseMessages.data.find(msg => msg.role === "assistant");

    if (!analysisMessage || !analysisMessage.content[0]) {
      throw new Error("No analysis received");
    }

    const analysisText = analysisMessage.content[0].type === 'text' ? analysisMessage.content[0].text.value : "";
    return JSON.parse(analysisText);
  } catch (error) {
    console.error("Error analyzing conversation dynamics:", error);
    return {
      analysis: "I need more time to understand the dynamics of this conversation.",
      recommendedTopics: ["Continue with the current topic"],
      connectionLevel: "building"
    };
  }
}

export async function generateCoachingTip(messageHistory: string[]): Promise<string> {
  try {
    const thread = await openai.beta.threads.create();

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `Please analyze these messages for coaching feedback: ${JSON.stringify(messageHistory)}`
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: AURORA_ASSISTANT_ID
    });

    await waitForRunCompletion(thread.id, run.id);

    const messages = await openai.beta.threads.messages.list(thread.id);
    const assistantMessage = messages.data.find(msg => msg.role === "assistant");

    if (!assistantMessage || !assistantMessage.content[0]) {
      throw new Error("No coaching tip received");
    }

    const analysisText = assistantMessage.content[0].type === 'text' ? assistantMessage.content[0].text.value : "";
    const analysis = JSON.parse(analysisText);
    return analysis.feedback;
  } catch (error) {
    console.error("Error generating coaching tip:", error);
    return "Focus on asking open-ended questions to learn more about their perspective.";
  }
}