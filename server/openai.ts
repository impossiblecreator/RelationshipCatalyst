import type { Message } from "@shared/schema";

interface MessageAnalysisResponse {
  messageFeedback: {
    suggestion: string[];
    strength: string[];
  };
  connectionScore: number;
}

interface MessageAnalysisRequest {
  draft: {
    role: string;
    content: string;
    created_at: null;
  };
  message_history: {
    role: string;
    content: string;
    created_at: null;
  }[];
  user_attributes: {
    gender: string;
    age: number;
    relationship_context: string;
    relationship_type: string;
  };
}

export async function calculateConnectionScore(
  currentMessage: string,
  conversationHistory: Message[] = [],
  age: number,
  gender: string,
  relationshipType: string
): Promise<{
  score: number;
  feedback: string;
}> {
  try {
    // Format the request according to API spec
    const requestBody: MessageAnalysisRequest = {
      draft: {
        role: "user",
        content: currentMessage,
        created_at: null
      },
      message_history: conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
        created_at: null
      })),
      user_attributes: {
        gender,
        age,
        relationship_context: "general", // Default context
        relationship_type: relationshipType
      }
    };

    const apiUrl = 'https://message-intelligence-peter144.replit.app/analyze_message';

    console.log('Message Analysis API Request:', {
      url: apiUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody, null, 2)
    });

    const response = await fetch(apiUrl, {
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

    // Connection score is already in 0-10 range from the new API
    const score = analysis.connectionScore;

    // Combine suggestions and strengths into meaningful feedback
    const feedback = [
      ...analysis.messageFeedback.strength.map(s => `Strength: ${s}`),
      ...analysis.messageFeedback.suggestion.map(s => `Suggestion: ${s}`)
    ].join('\n');

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