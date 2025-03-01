import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
export const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "" 
});

const COMPANION_ASSISTANT_ID = "asst_kMT65BHMDYqhoIJlxSuloyHA";
const AURORA_ASSISTANT_ID = "asst_JI6J0tGM00w6BOy4UgyOLZUP";

export async function generateCompanionResponse(userMessage: string): Promise<string> {
  try {
    // Create a thread for this conversation
    const thread = await openai.beta.threads.create();

    // Add the user's message to the thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: userMessage
    });

    // Run the companion assistant on the thread
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: COMPANION_ASSISTANT_ID
    });

    // Wait for the run to complete with shorter polling interval
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    while (runStatus.status === "queued" || runStatus.status === "in_progress") {
      await new Promise(resolve => setTimeout(resolve, 500));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    // Get the assistant's response
    const messages = await openai.beta.threads.messages.list(thread.id);
    const assistantMessage = messages.data.find(msg => msg.role === "assistant");

    if (!assistantMessage || !assistantMessage.content[0]) {
      throw new Error("No response from companion");
    }

    // Return the text content
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
    // Create a thread for analysis
    const thread = await openai.beta.threads.create();

    // Tag the message based on its type
    const taggedMessage = `{${type === "companion" ? "Companion" : type === "user-draft" ? "User-Draft" : "User-Sent"}} ${message}`;

    // Add the message to analyze
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `Analyze this message: "${taggedMessage}"`
    });

    // Run Aurora assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: AURORA_ASSISTANT_ID,
      instructions: `As Aurora, analyze this message focusing on emotional depth and connection.
Note the message type tag at the start ({Companion}, {User-Draft}, or {User-Sent}) and adjust your analysis accordingly.

For {Companion} messages: Focus on how well the response builds connection.
For {User-Draft} messages: Provide gentle guidance for deeper connection.
For {User-Sent} messages: Analyze the emotional dynamics and connection quality.

Provide insights in this format:
{
  "feedback": "Two sentences of insight about emotional connection",
  "suggestions": ["One specific suggestion for deepening connection"],
  "connectionScore": number from 1-10 indicating connection depth
}`
    });

    // Wait for completion
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    while (runStatus.status === "queued" || runStatus.status === "in_progress") {
      await new Promise(resolve => setTimeout(resolve, 500));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    // Get Aurora's analysis
    const messages = await openai.beta.threads.messages.list(thread.id);
    const auroraMessage = messages.data.find(msg => msg.role === "assistant");

    if (!auroraMessage || !auroraMessage.content[0]) {
      throw new Error("No analysis received from Aurora");
    }

    // Parse the JSON response from the text content
    const analysisText = auroraMessage.content[0].type === 'text' ? auroraMessage.content[0].text.value : "";
    const analysis = JSON.parse(analysisText);

    return {
      feedback: analysis.feedback || "I need a moment to reflect on this interaction.",
      suggestions: analysis.suggestions || ["Take a moment to consider the emotional undertones."],
      connectionScore: analysis.connectionScore || 5
    };
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
      content: JSON.stringify(messages)
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: AURORA_ASSISTANT_ID,
      instructions: `As Aurora, analyze this conversation's emotional dynamics and connection patterns.
Return analysis in this format:
{
  "analysis": "Key insight about emotional dynamics",
  "recommendedTopics": ["Topics to explore for deeper connection"],
  "connectionLevel": "surface" | "building" | "connected" | "deep"
}`
    });

    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    while (runStatus.status === "queued" || runStatus.status === "in_progress") {
      await new Promise(resolve => setTimeout(resolve, 500));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    const messages = await openai.beta.threads.messages.list(thread.id);
    const analysisMessage = messages.data.find(msg => msg.role === "assistant");

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
      content: JSON.stringify(messageHistory)
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: AURORA_ASSISTANT_ID,
      instructions: `As Aurora, analyze how this conversation builds connection and attachment. 
        Focus on therapeutic qualities and relationship-building aspects.
        Provide a two-sentence response explaining the deeper meaning and attachment dynamics at play.
        Format as: { "feedback": "your two sentences here" }`
    });

    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    while (runStatus.status === "queued" || runStatus.status === "in_progress") {
      await new Promise(resolve => setTimeout(resolve, 500));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

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