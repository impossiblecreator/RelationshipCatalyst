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
          content: `analyize this message from user to a friend and create a connectionScore. 0 represents a score certain to damage their relationship and 10 is a comment certain to contribute to an authentic, secure, meaningful relationship. Use the following rubric to assign a \"connectionScore\" from 1 to 10: \n- 1–3: The message is highly aggressive, insulting, or hateful and is very likely to harm the relationship.\n- 4–5: The message is somewhat negative or unhelpful but not overtly hateful; it lacks empathy or clarity.\n- 6–7: The message is neutral or mildly constructive, but could be improved in empathy, clarity, or authenticity.\n- 8–10: The message is positive, empathetic, and authentic, likely to build a strong connection.\nReturn your response as a JSON object: \"${message}\"`
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
      score: analysis.score || "",
      feedback: analysis.feedback || "I'm unable to reach the greater conciousness right now. The universe is calling you to take this one on your own."
    };
  } catch (error) {
    console.error("Error calculating connection score:", error);
    return {
      score: "",
      feedback: "I'm unable to reach the greater conciousness right now. The universe is calling you to take this one on your own."
    };
  }
}