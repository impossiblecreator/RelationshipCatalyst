import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
export const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "" 
});

const ASSISTANT_ID = "asst_JI6J0tGM00w6BOy4UgyOLZUP";

export async function generateCompanionResponse(userMessage: string): Promise<string> {
  try {
    // Create a thread for this conversation
    const thread = await openai.beta.threads.create();

    // Add the user's message to the thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: userMessage
    });

    // Run the assistant on the thread
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID
    });

    // Wait for the run to complete with shorter polling interval
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    while (runStatus.status === "queued" || runStatus.status === "in_progress") {
      await new Promise(resolve => setTimeout(resolve, 500)); // Reduced from 1000ms to 500ms
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    // Get the assistant's response
    const messages = await openai.beta.threads.messages.list(thread.id);
    const assistantMessage = messages.data.find(msg => msg.role === "assistant");

    if (!assistantMessage || !assistantMessage.content[0]) {
      throw new Error("No response from assistant");
    }

    // Return the text content
    return assistantMessage.content[0].type === 'text' ? assistantMessage.content[0].text.value : "I apologize, but I'm having trouble formulating a response right now.";
  } catch (error) {
    console.error("Error generating companion response:", error);
    return "I apologize, but I'm having trouble formulating a response right now. Could you please try again?";
  }
}

export async function analyzeMessageDraft(draftMessage: string): Promise<{
  feedback: string;
  suggestions: string[];
  connectionScore: number;
}> {
  try {
    // Create a thread for analysis
    const thread = await openai.beta.threads.create();

    // Add the message to analyze
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `Analyze this message like Dr. Gabor Mate would, focusing on how it relates to attachment, authenticity, and emotional connection: "${draftMessage}"`
    });

    // Run the assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID,
      instructions: `Channel Dr. Gabor Mate's perspective on attachment and authentic connection. Analyze how this message reflects deeper emotional needs and connection-building attempts.

Focus on:
- The emotional truth behind the words
- How this builds authentic connection
- The attachment needs being expressed or met

Provide exactly 2 sentences of feedback in this format:
{
  "feedback": "Your two-sentence insight about the emotional meaning/impact",
  "suggestions": ["One specific suggestion for deepening connection"],
  "connectionScore": number from 1-10
}`
    });

    // Wait for completion with shorter polling interval
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    while (runStatus.status === "queued" || runStatus.status === "in_progress") {
      await new Promise(resolve => setTimeout(resolve, 500)); // Reduced from 1000ms to 500ms
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    // Get the analysis
    const messages = await openai.beta.threads.messages.list(thread.id);
    const assistantMessage = messages.data.find(msg => msg.role === "assistant");

    if (!assistantMessage || !assistantMessage.content[0]) {
      throw new Error("No analysis received");
    }

    // Parse the JSON response from the text content
    const analysisText = assistantMessage.content[0].type === 'text' ? assistantMessage.content[0].text.value : "";
    const analysis = JSON.parse(analysisText);

    return {
      feedback: analysis.feedback || "Unable to analyze message",
      suggestions: analysis.suggestions || ["Try again in a moment"],
      connectionScore: analysis.connectionScore || 5
    };
  } catch (error) {
    console.error("Error analyzing message:", error);
    return {
      feedback: "Unable to analyze message at this time",
      suggestions: ["Try again in a moment"],
      connectionScore: 5
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
      assistant_id: ASSISTANT_ID,
      instructions: `As Dr. Gabor Mate would, analyze how this conversation message builds connection and attachment. 
        Focus on the therapeutic qualities and relationship-building aspects.
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

export async function analyzeConversationDynamics(
  messages: { role: string; content: string }[]
): Promise<{
  analysis: string;
  recommendedTopics: string[];
  connectionLevel: string;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Analyze the conversation dynamics and provide insights on:
- Overall rapport and connection
- Communication patterns
- Potential topics to explore
- Areas for deepening connection
Return analysis in JSON format with:
- analysis: Key insights about the conversation
- recommendedTopics: Array of suggested topics to explore
- connectionLevel: Current level of connection (surface, building, connected, deep)`
        },
        {
          role: "user",
          content: JSON.stringify(messages)
        }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("Error analyzing conversation dynamics:", error);
    return {
      analysis: "Unable to analyze conversation dynamics at this time",
      recommendedTopics: ["Continue the current topic"],
      connectionLevel: "building"
    };
  }
}