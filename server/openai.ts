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
    const response = await groq.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [
        {
          role: "system",
          content: "You are an expert relationship coach helping people improve their communication. You analyze messages and provide constructive feedback with a numerical score."
        },
        {
          role: "user",
          content: `Analyze this message and respond with a JSON object containing:
1. A "score" (number between 1-10)
2. A "feedback" string with specific, constructive advice

Scoring criteria:
- 1-3: Highly negative, aggressive, or harmful
- 4-5: Somewhat negative or unclear
- 6-7: Neutral or mildly positive
- 8-10: Very positive, empathetic, and relationship-building

Message to analyze: "${message}"`
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
      score: typeof analysis.score === 'number' ? analysis.score : 5,
      feedback: analysis.feedback || "I'm unable to analyze this message right now. Please try again."
    };
  } catch (error) {
    console.error("Error calculating connection score:", error);
    return {
      score: 5,
      feedback: "I'm unable to analyze this message right now. Please try again."
    };
  }
}