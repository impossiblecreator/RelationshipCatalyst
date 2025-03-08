import type { Message } from "@shared/schema";

export interface MessageAnalysisResponse {
  messageFeedback: {
    suggestion: string[];
    strength: string[];
  };
  connectionScore: number;
}

export async function calculateConnectionScore(
  currentMessage: string,
  conversationHistory: Message[] = [],
  age: number,
  gender: string
): Promise<{
  score: number;
  feedback: string;
}> {
  try {
    // Format the request according to API spec
    const requestBody = {
      draft: {
        role: "user",
        content: currentMessage
      },
      message_history: conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      user_attributes: {
        gender,
        age,
        relationship_context: "general" // Default context
      }
    };

    const apiUrl = process.env.MESSAGE_ANALYSIS_API_URL || 'http://localhost:8000';
    console.log('Sending request to Message Analysis API:', apiUrl);
    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    console.log('Request method: POST');

    const response = await fetch(`${apiUrl}/analyze_message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      console.error('API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: await response.text()
      });
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const analysis: MessageAnalysisResponse = await response.json();
    console.log('Received analysis:', JSON.stringify(analysis, null, 2));

    // Convert connection score from 0-1 to 0-10 for frontend compatibility
    const score = Math.round(analysis.connectionScore * 10);

    // Join suggestions into a single feedback string
    const feedback = analysis.messageFeedback.suggestion.join(' ');

    return {
      score,
      feedback: feedback || "I am not able to analyze this message right now."
    };
  } catch (error) {
    console.error("Error calculating connection score:", error);
    return {
      score: 5,
      feedback: "I am not able to reach the analysis service. Try again later."
    };
  }
}