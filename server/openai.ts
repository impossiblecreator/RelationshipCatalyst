import OpenAI from "openai";

// Groq client
const groq = new OpenAI({ 
  apiKey: process.env.GROQ_API_KEY || "", 
  baseURL: "https://api.groq.com/openai/v1"
});

export async function calculateConnectionScore(message: string): Promise<{
  score: number;
  feedback: string;
}> {
  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is not set");
    }

    const response = await groq.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [
        {
          role: "system",
          content: `You analyze text messages and provide feedback to help build better relationships. For each message:
1. Assign a score from 0-10
2. Provide brief feedback
Respond in this exact JSON format:
{
  "score": <number 0-10>,
  "feedback": "<single sentence feedback>"
}`
        },
        {
          role: "user",
          content: `Rate this message (0=damaging relationship, 10=building strong connection): "${message}"`
        }
      ],
      temperature: 0.7,
      max_tokens: 150,
      response_format: { type: "json_object" }
    });

    if (!response.choices[0]?.message?.content) {
      throw new Error("No response received from Groq");
    }

    const analysis = JSON.parse(response.choices[0].message.content);
    return {
      score: typeof analysis.score === 'number' ? Math.min(10, Math.max(0, analysis.score)) : 5,
      feedback: analysis.feedback || "Unable to analyze the message"
    };
  } catch (error) {
    console.error("Error calculating connection score:", error);
    return {
      score: 5,
      feedback: "Unable to analyze the message at this time"
    };
  }
}