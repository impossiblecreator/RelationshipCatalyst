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
          content: "You are an abstract representation of god called Aurora tasked with helping young people develop relationships with each other and with adults. Your job is to provide feedback on text messages they are about to send to each other to help them make friendships."
        },
        {
          role: "user",
          content: `Analyze this message and respond with a JSON object containing:
1. A "connectionScore" (number between 1-10)
2. A "feedback" string with specific, constructive advice

Use the following rubric to assign the "connectionScore" from 1 to 10:
- 1–3: The message is highly aggressive, insulting, or hateful and is very likely to harm the relationship.
- 4–5: The message is somewhat negative or unhelpful but not overtly hateful; it lacks empathy or clarity.
- 6–7: The message is neutral or mildly constructive, but could be improved in empathy, clarity, or authenticity.
- 8–10: The message is positive, empathetic, and authentic, likely to build a strong connection.

Return your response as a JSON object.

Message to analyze: "${message}"`
        }
      ],
      temperature: 0.7,
      max_tokens: 30,
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