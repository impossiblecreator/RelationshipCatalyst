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
          content: "You are an ex-high school teacher who is great at building relationships with young people and helping them develop relationships with each other and with adults. Your job is to provide feedback on text messages they are about to send to each other to help them make friendships by giving them a Connection Score between 0 and 10. 0 represents a score certain to damage their relationship and 10 is a comment certain to contribute to an authentic, secure, meaningful relationship."
        },
        {
          role: "user",
          content: `Please analyze this message and provide a connection score (0-10) and brief feedback: "${message}"`
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
      score: analysis.score || 5,
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