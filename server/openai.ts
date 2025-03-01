import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
export const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "" 
});

export async function generateCompanionResponse(userMessage: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a friendly and empathetic chat companion. Your goal is to build genuine connection through conversation while being authentic and supportive. Focus on:
- Asking thoughtful follow-up questions
- Sharing relevant experiences and perspectives
- Expressing empathy and understanding
- Being genuinely curious about the other person
Keep responses concise but meaningful, around 2-3 sentences.`
        },
        { role: "user", content: userMessage }
      ],
      response_format: { type: "json_object" }
    });

    const parsedResponse = JSON.parse(response.choices[0].message.content);
    return parsedResponse.response;
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
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert relationship coach analyzing message drafts. Evaluate the message for:
- Emotional intelligence and empathy
- Clear communication
- Potential for deepening connection
- Areas for improvement
Provide specific, actionable feedback in JSON format with:
- feedback: A constructive analysis of the message
- suggestions: Array of 1-2 specific improvement suggestions
- connectionScore: Number from 1-10 rating connection potential`
        },
        { role: "user", content: draftMessage }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content);
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
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a relationship coach observing a conversation. Based on the message history, provide a single specific tip to help deepen connection and understanding. Format response as JSON with a 'tip' field containing your advice.`
        },
        {
          role: "user",
          content: JSON.stringify(messageHistory)
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result.tip;
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