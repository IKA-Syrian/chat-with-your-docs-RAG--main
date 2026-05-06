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
            // Get the AI provider (same way as chat.js)
            const provider = this.aiProviderManager.getProvider(providerId);
            console.log('✅ AI Provider obtained:', provider.id);

            // Create messages array for the AI provider with special system message to disable fallbacks
            const messages = [
                {
                    role: "system",
                    content: "EDUCATIONAL_CONTENT_GENERATION_MODE: You must return ONLY valid JSON as specified in the user's request. Do not use any fallback responses or general knowledge answers. Focus on the provided text and format your response as valid JSON."
                },
                {
                    role: "user",
                    content: prompt
                }
            ];

            // Call the AI provider with proper options (same way as chat.js)
            const response = await provider.chat(messages, {
                model: modelName,
                max_tokens: options.maxTokens || 3000,
                temperature: options.temperature || 0.3 // Lower temperature for more consistent JSON
            });

            console.log('✅ AI Provider response received from:', response.provider);
            console.log('📝 Response content length:', response.content.length);
            console.log('📝 Response content preview:', response.content.substring(0, 300) + '...');

            return response.content;

        } catch (error) {
            console.error('🔥 AI Provider Error:', error.message);

            // Try fallback providers if the primary fails (same logic as chat.js)
            if (!providerId) {
                console.log('🔄 Attempting fallback providers...');

                const availableProviders = this.aiProviderManager.getAvailableProviders();
                const enabledProviders = availableProviders.filter(p => p.enabled);

                for (const fallbackProvider of enabledProviders) {
                    try {
                        console.log(`🔄 Trying fallback provider: ${fallbackProvider.id}`);

                        const provider = this.aiProviderManager.getProvider(fallbackProvider.id);
                        const messages = [
                            {
                                role: "system",
                                content: "EDUCATIONAL_CONTENT_GENERATION_MODE: You must return ONLY valid JSON as specified in the user's request. Do not use any fallback responses or general knowledge answers. Focus on the provided text and format your response as valid JSON."
                            },
                            {
                                role: "user",
                                content: prompt
                            }
                        ];

                        const response = await provider.chat(messages, {
                            model: modelName,
                            max_tokens: options.maxTokens || 3000,
                            temperature: options.temperature || 0.3
                        });

                        console.log(`✅ Fallback successful with: ${response.provider}`);
                        console.log('📝 Fallback response length:', response.content.length);
                        console.log('📝 Fallback response preview:', response.content.substring(0, 300) + '...');
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
        return `You are an expert educational content creator. Analyze the following text and create a comprehensive summary.

Text to analyze:
${text}

You must respond with ONLY a valid JSON object in this exact format:

{
    "summary": "Write a comprehensive 2-3 paragraph summary of the main concepts, ideas, and important information from the text",
    "key_points": ["First key point", "Second key point", "Third key point", "Fourth key point", "Fifth key point"]
}

Requirements:
- Summary should be 2-3 well-structured paragraphs
- Include 5 key points that capture the most important concepts
- Use clear, educational language
- Focus on the main ideas and important details
- Return ONLY the JSON object, no extra text, no markdown formatting, no explanations

Begin your response with { and end with }`;
    }

    createQuizPrompt(text) {
        return `You are an expert educational content creator. Create a comprehensive quiz based on the following text.

Text to analyze:
${text}

You must respond with ONLY a valid JSON object in this exact format:

{
    "questions": [
        {
            "question": "Write a clear, specific question about the content",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_answer": 0,
            "explanation": "Explain why this answer is correct"
        }
    ]
}

Requirements:
- Create exactly 10 multiple-choice questions
- Each question must have exactly 4 options (A, B, C, D)
- correct_answer must be the index (0, 1, 2, or 3) of the correct option
- Questions should test different aspects and difficulty levels
- Options should be plausible but only one clearly correct
- Include brief explanations for correct answers
- Focus on key concepts, definitions, and important details
- Return ONLY the JSON object, no extra text, no markdown formatting

Begin your response with { and end with }`;
    }

    createFlashcardsPrompt(text) {
        return `You are an expert educational content creator. Create study flashcards based on the following text.

Text to analyze:
${text}

You must respond with ONLY a valid JSON object in this exact format:

{
    "flashcards": [
        {
            "front": "Question, term, or concept to test",
            "back": "Clear, concise answer or explanation"
        }
    ]
}

Requirements:
- Create exactly 10 flashcards
- Front side should be a question, key term, or concept
- Back side should be a clear, educational answer or explanation
- Cover the most important concepts and definitions
- Use varied question types (definitions, explanations, examples)
- Keep front side concise and focused
- Make back side informative but not too long
- Each flashcard should test a different concept
- Return ONLY the JSON object, no extra text, no markdown formatting

Begin your response with { and end with }`;
    }

    parseJSONResponse(response, contentType = 'content') {
        try {
            console.log('🔍 Parsing AI response for', contentType);
            console.log('📝 Raw response length:', response.length);
            console.log('📝 Raw response start:', response.substring(0, 300) + '...');

            // Clean the response step by step
            let cleanResponse = response.trim();

            // Remove markdown code blocks if present
            cleanResponse = cleanResponse.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

            // Remove any leading/trailing text that isn't JSON
            cleanResponse = cleanResponse.replace(/^[^{]*/, '').replace(/[^}]*$/, '');

            // Clean up problematic characters that break JSON parsing
            cleanResponse = cleanResponse
                .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ') // Replace control characters with spaces
                .replace(/\t/g, ' ') // Replace tabs with spaces
                .replace(/\r/g, ' ') // Replace carriage returns with spaces
                .replace(/\n/g, ' ') // Replace newlines with spaces within the JSON
                .replace(/\s+/g, ' ') // Normalize multiple spaces
                .trim();

            // Try to find JSON in the response - look for the outermost braces
            let startIdx = cleanResponse.indexOf('{');
            let endIdx = -1;

            if (startIdx !== -1) {
                // Find the matching closing brace
                let braceCount = 0;
                for (let i = startIdx; i < cleanResponse.length; i++) {
                    if (cleanResponse[i] === '{') braceCount++;
                    else if (cleanResponse[i] === '}') {
                        braceCount--;
                        if (braceCount === 0) {
                            endIdx = i + 1;
                            break;
                        }
                    }
                }
            }

            if (startIdx === -1 || endIdx === -1) {
                console.warn('⚠️ No valid JSON structure found in response');
                console.log('📝 Cleaned response:', cleanResponse.substring(0, 500));
                throw new Error('No JSON structure found');
            }

            const jsonStr = cleanResponse.substring(startIdx, endIdx);
            console.log('📋 Extracted JSON length:', jsonStr.length);
            console.log('📋 Extracted JSON preview:', jsonStr.substring(0, 300) + '...');

            let parsed;
            try {
                parsed = JSON.parse(jsonStr);
            } catch (parseError) {
                console.warn('⚠️ Initial JSON parse failed, trying to fix common issues:', parseError.message);

                // Try to fix common JSON issues
                let fixedJsonStr = jsonStr
                    .replace(/,\s*}/g, '}') // Remove trailing commas
                    .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
                    .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // Ensure property names are quoted
                    .replace(/:\s*'([^']*)'/g, ': "$1"') // Convert single quotes to double quotes
                    .replace(/\\'/g, "'") // Fix escaped single quotes
                    .replace(/([^\\])\\([^"\\\/bfnrt])/g, '$1\\\\$2'); // Fix invalid escape sequences

                try {
                    parsed = JSON.parse(fixedJsonStr);
                    console.log('✅ JSON parsing succeeded after fixes');
                } catch (secondError) {
                    console.error('❌ JSON parsing failed even after fixes:', secondError.message);
                    console.log('📝 Original JSON:', jsonStr.substring(0, 500));
                    console.log('📝 Fixed JSON:', fixedJsonStr.substring(0, 500));
                    throw new Error(`Invalid JSON structure: ${secondError.message}`);
                }
            }

            console.log('✅ Successfully parsed JSON for', contentType);
            console.log('📊 Parsed object keys:', Object.keys(parsed));

            // Validate the parsed content has expected structure
            if (contentType === 'summary' && (!parsed.summary || !parsed.key_points)) {
                console.warn('⚠️ Summary missing required fields:', Object.keys(parsed));
                throw new Error('Invalid summary structure');
            }

            if (contentType === 'quiz' && (!parsed.questions || !Array.isArray(parsed.questions))) {
                console.warn('⚠️ Quiz missing questions array:', Object.keys(parsed));
                throw new Error('Invalid quiz structure');
            }

            if (contentType === 'flashcards' && (!parsed.flashcards || !Array.isArray(parsed.flashcards))) {
                console.warn('⚠️ Flashcards missing flashcards array:', Object.keys(parsed));
                throw new Error('Invalid flashcards structure');
            }

            return parsed;

        } catch (error) {
            console.error('❌ JSON parsing failed for', contentType, ':', error.message);
            console.log('📝 Full response for debugging:', response);

            // For educational content, throw the error instead of falling back to sample data
            // This will cause the generateEducationalContent method to fail properly
            throw new Error(`Failed to parse ${contentType} from AI response: ${error.message}`);
        }
    }

    generateFallbackContent(response, contentType) {
        console.log('🛠️ Generating fallback content for', contentType);

        // Extract meaningful content from the response even if it's not JSON
        const cleanText = response.replace(/[\r\n]+/g, ' ').trim();

        switch (contentType) {
            case 'summary':
                return {
                    summary: cleanText.length > 100 ? cleanText.substring(0, 500) + '...' :
                        'This document contains important information that requires further analysis.',
                    key_points: [
                        'Document uploaded successfully',
                        'Content available for review',
                        'Additional processing may be needed',
                        'Manual review recommended',
                        'Consider re-processing with different AI provider'
                    ]
                };

            case 'quiz':
                return {
                    questions: [
                        {
                            question: "What is the main topic of this document?",
                            options: ["Education", "Technology", "Business", "Other"],
                            correct_answer: 0,
                            explanation: "Based on the document content"
                        },
                        {
                            question: "What type of document is this?",
                            options: ["Report", "Article", "Manual", "Reference"],
                            correct_answer: 0,
                            explanation: "Document type analysis needed"
                        }
                    ]
                };

            case 'flashcards':
                return {
                    flashcards: [
                        {
                            front: "What is this document about?",
                            back: "This document contains information that needs to be processed for study materials."
                        },
                        {
                            front: "How can I study this content?",
                            back: "Try re-generating study materials or review the document manually."
                        },
                        {
                            front: "What should I do if content generation fails?",
                            back: "Check AI provider configuration and try again with a different provider."
                        }
                    ]
                };

            default:
                return {
                    summary: 'Content processed with limited AI analysis.',
                    key_points: ['Manual review recommended']
                };
        }
    }

    // Individual generation methods for use in controllers
    async generateSummary(text, options = {}) {
        console.log('📝 Generating summary...');
        const prompt = this.createSummaryPrompt(text);
        const response = await this.callAIProvider(prompt, options);
        return this.parseJSONResponse(response, 'summary');
    }

    async generateQuiz(text, options = {}) {
        console.log('❓ Generating quiz...');
        const prompt = this.createQuizPrompt(text);
        const response = await this.callAIProvider(prompt, options);
        return this.parseJSONResponse(response, 'quiz');
    }

    async generateFlashcards(text, options = {}) {
        console.log('🗂️ Generating flashcards...');
        const prompt = this.createFlashcardsPrompt(text);
        const response = await this.callAIProvider(prompt, options);
        return this.parseJSONResponse(response, 'flashcards');
    }

    /**
     * Phase 4 #21 — generate a per-document knowledge graph as JSON.
     * Returns shape: { nodes: [{id, label, summary, importance}], edges: [{source, target, type, label?}] }
     */
    async generateKnowledgeGraph(text, options = {}) {
        console.log('🕸️ Generating knowledge graph...');
        const prompt = this.createKnowledgeGraphPrompt(text);
        const response = await this.callAIProvider(prompt, { maxTokens: 4000, temperature: 0.2, ...options });
        const parsed = this.parseJSONResponse(response, 'knowledge_graph');

        // Defensive normalization — ensure shape is sane regardless of model output.
        const rawNodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
        const rawEdges = Array.isArray(parsed?.edges) ? parsed.edges : [];

        const VALID_EDGE_TYPES = new Set(['prerequisite', 'related', 'example_of', 'contradicts']);
        const seenIds = new Set();
        const nodes = rawNodes
            .map((n, i) => {
                const id = String(n.id || `node-${i}`).slice(0, 64);
                if (seenIds.has(id)) return null;
                seenIds.add(id);
                return {
                    id,
                    label: String(n.label || n.name || id).slice(0, 120),
                    summary: String(n.summary || n.definition || '').slice(0, 400),
                    importance: Math.max(1, Math.min(5, Number(n.importance) || 3))
                };
            })
            .filter(Boolean)
            .slice(0, 60);

        const validIdSet = new Set(nodes.map(n => n.id));
        const edges = rawEdges
            .map(e => ({
                source: String(e.source || e.from || '').slice(0, 64),
                target: String(e.target || e.to || '').slice(0, 64),
                type: VALID_EDGE_TYPES.has(e.type) ? e.type : 'related',
                label: e.label ? String(e.label).slice(0, 80) : null
            }))
            .filter(e => e.source && e.target && e.source !== e.target && validIdSet.has(e.source) && validIdSet.has(e.target))
            .slice(0, 200);

        return { nodes, edges };
    }

    createKnowledgeGraphPrompt(text) {
        const trimmed = (text || '').slice(0, 24_000);
        return `You are an expert at extracting concept maps from study material.

Read the document below and produce a knowledge graph capturing the key concepts and how they relate. Return ONLY a JSON object with this exact shape:

{
  "nodes": [
    {
      "id": "snake_case_id",
      "label": "Human-readable name",
      "summary": "1-2 sentence definition or explanation, in plain English",
      "importance": 1-5
    }
  ],
  "edges": [
    { "source": "node_id_a", "target": "node_id_b", "type": "prerequisite|related|example_of|contradicts", "label": "optional short phrase" }
  ]
}

Rules:
- Aim for 8–25 nodes (more for long docs, fewer for short).
- Use snake_case ASCII for node ids.
- "prerequisite" = source must be understood before target.
- "related" = same topic family.
- "example_of" = source is an instance of target.
- "contradicts" = the two concepts conflict / are alternatives.
- "importance" 5 = central thesis, 1 = passing mention.
- Do NOT include nodes with no edges (orphans). Every node must connect to at least one other.
- Keep summaries factual; do not invent definitions not supported by the document.
- Return ONLY the JSON object, no commentary, no code fences.

DOCUMENT:
${trimmed}

Begin your response with { and end with }`;
    }

    // Generate educational content from document text
    async generateEducationalContent(text) {
        console.log('🎓 Generating educational content from text...');
        console.log('📝 Text length:', text.length, 'characters');

        // Validate input
        if (!text || text.trim().length < 50) {
            throw new Error('Text is too short to generate meaningful educational content');
        }

        let results = {
            summary: null,
            quiz: null,
            flashcards: null,
            errors: []
        };

        // Generate summary
        try {
            console.log('📝 Generating summary...');
            const summaryPrompt = this.createSummaryPrompt(text);
            const summaryResponse = await this.callAIProvider(summaryPrompt, {
                maxTokens: 1500,
                temperature: 0.3
            });
            results.summary = this.parseJSONResponse(summaryResponse, 'summary');
            console.log('✅ Summary generated successfully');
        } catch (error) {
            console.error('❌ Summary generation failed:', error.message);
            results.errors.push(`Summary: ${error.message}`);
        }

        // Generate quiz
        try {
            console.log('❓ Generating quiz...');
            const quizPrompt = this.createQuizPrompt(text);
            const quizResponse = await this.callAIProvider(quizPrompt, {
                maxTokens: 2000,
                temperature: 0.2
            });
            results.quiz = this.parseJSONResponse(quizResponse, 'quiz');
            console.log('✅ Quiz generated successfully');
        } catch (error) {
            console.error('❌ Quiz generation failed:', error.message);
            results.errors.push(`Quiz: ${error.message}`);
        }

        // Generate flashcards
        try {
            console.log('🗂️ Generating flashcards...');
            const flashcardsPrompt = this.createFlashcardsPrompt(text);
            const flashcardsResponse = await this.callAIProvider(flashcardsPrompt, {
                maxTokens: 1500,
                temperature: 0.3
            });
            results.flashcards = this.parseJSONResponse(flashcardsResponse, 'flashcards');
            console.log('✅ Flashcards generated successfully');
        } catch (error) {
            console.error('❌ Flashcards generation failed:', error.message);
            results.errors.push(`Flashcards: ${error.message}`);
        }

        // Check if we have at least one successful generation
        const successfulGenerations = [results.summary, results.quiz, results.flashcards].filter(x => x !== null);

        if (successfulGenerations.length === 0) {
            console.error('❌ All educational content generation failed');
            throw new Error(`All educational content generation failed: ${results.errors.join('; ')}`);
        }

        console.log(`✅ Educational content generation completed: ${successfulGenerations.length}/3 successful`);

        if (results.errors.length > 0) {
            console.warn('⚠️ Some content generation failed:', results.errors);
        }

        return {
            summary: results.summary,
            quiz: results.quiz,
            flashcards: results.flashcards,
            partial_success: results.errors.length > 0,
            errors: results.errors
        };
    }
}

export default new EnhancedAIService(); 