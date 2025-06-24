import axios from 'axios';

// OpenRouter configuration - using the verified working API key
const OPENROUTER_API_KEY = "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";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const MODEL_NAME = "deepseek/deepseek-r1-distill-llama-70b:free";

class AIService {
    async callOpenRouterAPI(prompt, maxTokens = 2000) {
        console.log('🤖 Calling AI API...');
        console.log('🔍 API Key from env:', process.env.OPENROUTER_API_KEY ? 'SET' : 'NOT SET');
        console.log('🔍 API Key being used:', OPENROUTER_API_KEY.substring(0, 20) + '...');
        console.log('🔍 Using model:', MODEL_NAME);

        if (!OPENROUTER_API_KEY) {
            throw new Error("OpenRouter API key not configured");
        }

        // Exact headers from Python backend
        const headers = {
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "PDF Processing App"
        };

        console.log('🔍 Authorization header:', headers.Authorization.substring(0, 30) + '...');

        // Exact payload structure from Python backend
        const payload = {
            model: MODEL_NAME,
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: maxTokens,
            temperature: 0.7
        };

        try {
            console.log('🔍 Making request to:', `${OPENROUTER_BASE_URL}/chat/completions`);

            const response = await axios.post(
                `${OPENROUTER_BASE_URL}/chat/completions`,
                payload,
                {
                    headers,
                    timeout: 60000
                }
            );

            const result = response.data;
            console.log('✅ API call successful');
            return result.choices[0].message.content;

        } catch (error) {
            console.error('🔥 OpenRouter API Error:', error.response?.data || error.message);

            if (error.response) {
                throw new Error(`OpenRouter API error: ${error.response.status} - ${error.response.data?.error?.message || error.response.statusText}`);
            } else if (error.request) {
                throw new Error("OpenRouter API error: No response received");
            } else {
                throw new Error(`OpenRouter API error: ${error.message}`);
            }
        }
    }

    createSummaryPrompt(text) {
        return `
Please analyze the following text and provide a comprehensive summary along with key points.

Text to summarize:
${text}

Please respond in the following JSON format:
{
    "summary": "A comprehensive summary of the text (2-3 paragraphs)",
    "key_points": ["Key point 1", "Key point 2", "Key point 3", "Key point 4", "Key point 5"]
}

Ensure the response is valid JSON.
`;
    }

    createQuizPrompt(text) {
        return `
Based on the following text, create 5 multiple-choice questions to test understanding.

Text:
${text}

Please respond in the following JSON format:
{
    "questions": [
        {
            "question": "Question text here?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_answer": 0,
            "explanation": "Brief explanation of why this is correct"
        }
    ]
}

Make sure:
- Each question has exactly 4 options
- correct_answer is the index (0-3) of the correct option
- Questions test different aspects of the content
- Ensure the response is valid JSON
`;
    }

    createFlashcardsPrompt(text) {
        return `
Based on the following text, create 8 flashcards for studying key concepts.

Text:
${text}

Please respond in the following JSON format:
{
    "flashcards": [
        {
            "front": "Question or concept",
            "back": "Answer or explanation"
        }
    ]
}

Make sure:
- Each flashcard tests an important concept
- Front side is concise (question/term)
- Back side provides clear explanation
- Cover different topics from the text
- Ensure the response is valid JSON
`;
    }

    parseJSONResponse(response) {
        try {
            // Try to find JSON in the response
            const startIdx = response.indexOf('{');
            const endIdx = response.lastIndexOf('}') + 1;

            if (startIdx === -1 || endIdx === 0) {
                throw new Error("No JSON found in response");
            }

            const jsonStr = response.substring(startIdx, endIdx);
            return JSON.parse(jsonStr);
        } catch (error) {
            throw new Error(`Error parsing API response: ${error.message}`);
        }
    }
}

export default new AIService();
