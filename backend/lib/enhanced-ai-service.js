import aiProviderManager from './ai-providers.js';

class EnhancedAIService {
    constructor() {
        this.aiProviderManager = aiProviderManager;
    }

    async callAIProvider(prompt, options = {}) {
        console.log('🤖 Calling AI Provider for educational content generation...');

        const providerId = options.provider || process.env.EDUCATION_AI_PROVIDER || null;
        const modelName = options.model || process.env.OPENROUTER_EDUCATION_MODEL || null;

        console.log('🔍 Provider ID:', providerId || 'default');
        console.log('🔍 Model:', modelName || 'default');

        try {
            // Get the AI provider
            const provider = this.aiProviderManager.getProvider(providerId);
            console.log('✅ AI Provider obtained:', provider.id);

            // Create messages array for the AI provider
            const messages = [
                {
                    role: "user",
                    content: prompt
                }
            ];

            // Call the AI provider
            const response = await provider.chat(messages, {
                model: modelName,
                max_tokens: options.maxTokens || 2000,
                temperature: options.temperature || 0.7
            });

            console.log('✅ AI Provider response received from:', response.provider);
            return response.content;

        } catch (error) {
            console.error('🔥 AI Provider Error:', error.message);

            // Try fallback providers if the primary fails
            if (!providerId) {
                console.log('🔄 Attempting fallback providers...');

                const availableProviders = this.aiProviderManager.getAvailableProviders();
                const enabledProviders = availableProviders.filter(p => p.enabled);

                for (const fallbackProvider of enabledProviders) {
                    try {
                        console.log(`🔄 Trying fallback provider: ${fallbackProvider.id}`);

                        const provider = this.aiProviderManager.getProvider(fallbackProvider.id);
                        const messages = [{ role: "user", content: prompt }];

                        const response = await provider.chat(messages, {
                            max_tokens: options.maxTokens || 2000,
                            temperature: options.temperature || 0.7
                        });

                        console.log(`✅ Fallback successful with: ${response.provider}`);
                        return response.content;

                    } catch (fallbackError) {
                        console.warn(`⚠️ Fallback provider ${fallbackProvider.id} failed:`, fallbackError.message);
                        continue;
                    }
                }
            }

            throw new Error(`All AI providers failed: ${error.message}`);
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
            throw new Error(`Error parsing AI response: ${error.message}`);
        }
    }

    // Individual generation methods for use in controllers
    async generateSummary(text, options = {}) {
        console.log('📝 Generating summary...');
        const prompt = this.createSummaryPrompt(text);
        const response = await this.callAIProvider(prompt, options);
        return this.parseJSONResponse(response);
    }

    async generateQuiz(text, options = {}) {
        console.log('❓ Generating quiz...');
        const prompt = this.createQuizPrompt(text);
        const response = await this.callAIProvider(prompt, options);
        return this.parseJSONResponse(response);
    }

    async generateFlashcards(text, options = {}) {
        console.log('🗂️ Generating flashcards...');
        const prompt = this.createFlashcardsPrompt(text);
        const response = await this.callAIProvider(prompt, options);
        return this.parseJSONResponse(response);
    }

    // Generate educational content from document text
    async generateEducationalContent(text) {
        console.log('🎓 Generating educational content...');

        try {
            // Generate summary
            console.log('📝 Generating summary...');
            const summaryPrompt = this.createSummaryPrompt(text);
            const summaryResponse = await this.callAIProvider(summaryPrompt);
            const summaryData = this.parseJSONResponse(summaryResponse);

            // Generate quiz
            console.log('❓ Generating quiz...');
            const quizPrompt = this.createQuizPrompt(text);
            const quizResponse = await this.callAIProvider(quizPrompt);
            const quizData = this.parseJSONResponse(quizResponse);

            // Generate flashcards
            console.log('🗂️ Generating flashcards...');
            const flashcardsPrompt = this.createFlashcardsPrompt(text);
            const flashcardsResponse = await this.callAIProvider(flashcardsPrompt);
            const flashcardsData = this.parseJSONResponse(flashcardsResponse);

            return {
                summary: summaryData,
                quiz: quizData,
                flashcards: flashcardsData
            };
        } catch (error) {
            console.error('❌ Error generating educational content:', error);
            throw error;
        }
    }
}

export default new EnhancedAIService(); 