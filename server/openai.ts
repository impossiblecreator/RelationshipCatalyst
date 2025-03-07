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
          content: "You are an abstract representation of god tasked with helping young people develop relationships with each other and with adults. Your job is to provide feedback on text messages they are about to send to each other to help them make friendships."
        },
        {
          role: "user",
          content: `Rate this message with a score (1-10) and feedback. Return as JSON: "${message}"`
        }
      ],
      temperature: 0.7,
      max_tokens: 25,
      response_format: { type: "json_object" }
    });

    if (!response.choices[0]?.message?.content) {
      throw new Error("No response received from Groq");
    }

    const analysis = JSON.parse(response.choices[0].message.content);
    return {
      score: typeof analysis.score === 'number' ? analysis.score : 5,
      feedback: analysis.feedback || "I'm unable to reach the greater consciousness right now. The universe is calling you to take this one on your own."
    };
  } catch (error) {
    console.error("Error calculating connection score:", error);
    return {
      score: 5,
      feedback: "I'm unable to reach the greater consciousness right now. The universe is calling you to take this one on your own."
    };
  }
}