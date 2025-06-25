/**
 * @swagger
 * tags:
 *   name: Testing
 *   description: Test, debug, and health check endpoints for API diagnostics and development
 */

import { Router } from 'express';
import aiProviderManager from '../lib/ai-providers.js';
import express from 'express';

const router = Router();

/**
 * @swagger
 * /test/health:
 *   get:
 *     summary: Health check endpoint
 *     description: Simple health check to verify the backend API is running and accessible
 *     tags: [Testing]
 *     responses:
 *       200:
 *         description: Backend is healthy and running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "ok"
 *                 message:
 *                   type: string
 *                   example: "Backend is running"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00.000Z"
 */
// Test endpoint that doesn't require authentication
router.get('/health', (req, res) => {
    console.log('🔍 Health check request from origin:', req.headers.origin);
    res.json({
        status: 'ok',
        message: 'Backend is running',
        timestamp: new Date().toISOString(),
    });
});

/**
 * @swagger
 * /test/env-debug:
 *   get:
 *     summary: Environment variables debug
 *     description: Debug endpoint to check which environment variables are configured (shows existence and length, not actual values for security)
 *     tags: [Testing]
 *     responses:
 *       200:
 *         description: Environment variables status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 geminiApiKey:
 *                   type: string
 *                   example: "exists (32 chars)"
 *                 openrouterApiKey:
 *                   type: string
 *                   example: "not found"
 *                 openaiApiKey:
 *                   type: string
 *                   example: "exists"
 *                 anthropicApiKey:
 *                   type: string
 *                   example: "not found"
 *                 nodeEnv:
 *                   type: string
 *                   example: "development"
 *                 frontendUrl:
 *                   type: string
 *                   example: "http://localhost:3000"
 *                 backendUrl:
 *                   type: string
 *                   example: "http://localhost:3001"
 *                 allEnvKeys:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: List of all environment variable names
 */
// Debug endpoint to check environment variables
router.get('/env-debug', (req, res) => {
    res.json({
        geminiApiKey: process.env.GEMINI_API_KEY ? `exists (${process.env.GEMINI_API_KEY.length} chars)` : 'not found',
        openrouterApiKey: process.env.OPENROUTER_API_KEY ? `exists (${process.env.OPENROUTER_API_KEY.length} chars)` : 'not found',
        openaiApiKey: process.env.OPENAI_API_KEY ? `exists (${process.env.OPENAI_API_KEY.length} chars)` : 'not found',
        anthropicApiKey: process.env.ANTHROPIC_API_KEY ? `exists (${process.env.ANTHROPIC_API_KEY.length} chars)` : 'not found',
        nodeEnv: process.env.NODE_ENV || 'not set',
        frontendUrl: process.env.FRONTEND_URL || 'not set',
        backendUrl: process.env.BACKEND_URL || 'not set',
        allEnvKeys: Object.keys(process.env)
    });
});

/**
 * @swagger
 * /test/auth-test:
 *   get:
 *     summary: Authentication header test
 *     description: Test endpoint to check if authentication headers are being sent correctly
 *     tags: [Testing]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Authentication header information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 hasAuthHeader:
 *                   type: boolean
 *                   description: Whether Authorization header is present
 *                 hasToken:
 *                   type: boolean
 *                   description: Whether token is extracted from header
 *                 token:
 *                   type: string
 *                   example: "present"
 *                   description: Token presence status
 *                 tokenLength:
 *                   type: number
 *                   description: Length of the token
 *                 tokenPreview:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiI..."
 *                   description: First 20 characters of token
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
// Test endpoint for authentication
router.get('/auth-test', (req, res) => {
    const authToken = req.headers.authorization?.replace('Bearer ', '');

    res.json({
        hasAuthHeader: !!req.headers.authorization,
        hasToken: !!authToken,
        token: authToken ? 'present' : 'missing',
        tokenLength: authToken?.length || 0,
        tokenPreview: authToken ? authToken.substring(0, 20) + '...' : 'none',
        timestamp: new Date().toISOString(),
    });
});

/**
 * @swagger
 * /test/validate-token:
 *   get:
 *     summary: Token validation test
 *     description: Test endpoint to validate JWT token with Supabase and check user authentication
 *     tags: [Testing]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Token validation results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   description: Whether token is valid
 *                 hasUser:
 *                   type: boolean
 *                   description: Whether user exists
 *                 userId:
 *                   type: string
 *                   nullable: true
 *                   description: User ID if valid
 *                 userEmail:
 *                   type: string
 *                   nullable: true
 *                   description: User email if valid
 *                 error:
 *                   type: string
 *                   nullable: true
 *                   description: Error message if invalid
 *                 errorCode:
 *                   type: number
 *                   nullable: true
 *                   description: Error status code
 *                 debug:
 *                   type: object
 *                   properties:
 *                     tokenLength:
 *                       type: number
 *                     tokenFormat:
 *                       type: object
 *                       properties:
 *                         isJWT:
 *                           type: boolean
 *                         jwtParts:
 *                           type: number
 *                         startsWithEy:
 *                           type: boolean
 *                         hasBearer:
 *                           type: boolean
 *                     supabaseResponse:
 *                       type: object
 *                       properties:
 *                         hasData:
 *                           type: boolean
 *                         hasUser:
 *                           type: boolean
 *                         hasError:
 *                           type: boolean
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
// Test token validation
router.get('/validate-token', async (req, res) => {
    const authToken = req.headers.authorization?.replace('Bearer ', '');

    console.log('🧪 Token validation test started');
    console.log('  - Token provided:', !!authToken);
    console.log('  - Token length:', authToken?.length || 0);
    console.log('  - Token preview:', authToken ? authToken.substring(0, 50) + '...' : 'none');

    if (!authToken) {
        return res.json({
            valid: false,
            error: 'No token provided',
            debug: {
                hasAuthHeader: !!req.headers.authorization,
                authHeaderValue: req.headers.authorization || 'none'
            },
            timestamp: new Date().toISOString(),
        });
    }

    try {
        const { createUserClient } = await import('../lib/supabase.js');
        const supabase = createUserClient(authToken);

        console.log('🧪 Attempting Supabase user validation...');
        const { data, error } = await supabase.auth.getUser();

        console.log('🧪 Supabase validation result:');
        console.log('  - Success:', !error);
        console.log('  - User found:', !!data?.user);
        console.log('  - User ID:', data?.user?.id || 'none');
        console.log('  - Error message:', error?.message || 'none');
        console.log('  - Error code:', error?.status || 'none');

        res.json({
            valid: !error && !!data?.user,
            hasUser: !!data?.user,
            userId: data?.user?.id || null,
            userEmail: data?.user?.email || null,
            error: error?.message || null,
            errorCode: error?.status || null,
            debug: {
                tokenLength: authToken.length,
                tokenFormat: {
                    isJWT: authToken.includes('.'),
                    jwtParts: authToken.split('.').length,
                    startsWithEy: authToken.startsWith('ey'),
                    hasBearer: req.headers.authorization?.startsWith('Bearer '),
                },
                supabaseResponse: {
                    hasData: !!data,
                    hasUser: !!data?.user,
                    hasError: !!error
                }
            },
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        console.error('🧪 Token validation test failed:', err);
        res.json({
            valid: false,
            error: err.message,
            debug: {
                exceptionType: err.constructor.name,
                tokenLength: authToken.length
            },
            timestamp: new Date().toISOString(),
        });
    }
});

/**
 * @swagger
 * /test:
 *   get:
 *     summary: Basic test endpoint
 *     description: Simple test endpoint to verify the test routes are working
 *     tags: [Testing]
 *     responses:
 *       200:
 *         description: Test endpoint is working
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Test endpoint is working"
 */
// Test endpoint for debugging AI responses
router.get('/', (req, res) => {
    res.json({ message: 'Test endpoint is working' });
});

/**
 * @swagger
 * /test/ai-providers:
 *   get:
 *     summary: AI providers test
 *     description: Test endpoint to check AI provider configurations and availability
 *     tags: [Testing]
 *     responses:
 *       200:
 *         description: AI providers information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 availableProviders:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: List of available AI providers
 *                 availableProvidersWithModels:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AIProvider'
 *                 defaultProvider:
 *                   type: string
 *                   description: Default AI provider
 *                 configuredProviders:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Configured provider names
 *                 initializedProviders:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Successfully initialized providers
 *                 environment:
 *                   type: object
 *                   properties:
 *                     geminiApiKey:
 *                       type: string
 *                     openaiApiKey:
 *                       type: string
 *                     openrouterApiKey:
 *                       type: string
 *       500:
 *         description: Error retrieving AI providers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
// Test AI providers
router.get('/ai-providers', (req, res) => {
    try {
        const availableProviders = aiProviderManager.getAvailableProviders();
        const availableProvidersWithModels = aiProviderManager.getAvailableProvidersWithModels();

        res.json({
            availableProviders,
            availableProvidersWithModels,
            defaultProvider: aiProviderManager.config.defaultProvider,
            configuredProviders: Object.keys(aiProviderManager.config.providers),
            initializedProviders: Object.keys(aiProviderManager.providers),
            environment: {
                geminiApiKey: process.env.GEMINI_API_KEY ? `exists (${process.env.GEMINI_API_KEY.length} chars)` : 'not found',
                openaiApiKey: process.env.OPENAI_API_KEY ? 'exists' : 'not found',
                openrouterApiKey: process.env.OPENROUTER_API_KEY ? 'exists' : 'not found',
            }
        });
    } catch (error) {
        console.error('Error in /ai-providers endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Function to get fallback response for common knowledge questions
function getFallbackResponse(message) {
    // Convert message to lowercase for easier matching
    const lowerMessage = message.toLowerCase();

    // Check for common knowledge questions that we can handle with fallbacks
    if (lowerMessage.includes('swot') &&
        (lowerMessage.includes('what is') ||
            lowerMessage.includes('explain') ||
            lowerMessage.includes('stand for') ||
            lowerMessage.includes('analysis'))) {

        return {
            message: "SWOT stands for Strengths, Weaknesses, Opportunities, and Threats. It's a strategic planning framework used to evaluate these four elements of a business, project, or situation. Strengths and weaknesses are typically internal factors, while opportunities and threats are external factors. This analysis helps organizations identify favorable and unfavorable factors that may impact their objectives.",
            provider: "fallback",
            model: "static-response"
        };
    }

    // Add more fallbacks for other common questions as needed

    // Default fallback for when we don't have a specific answer
    return null;
}

/**
 * @swagger
 * /test/ai-chat:
 *   post:
 *     summary: AI chat test
 *     description: Test endpoint for AI chat functionality with fallback responses for common knowledge questions
 *     tags: [Testing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: Message to send to AI
 *                 example: "What does SWOT stand for?"
 *               context:
 *                 type: string
 *                 description: Document context for the AI
 *               provider:
 *                 type: string
 *                 description: AI provider to use
 *                 example: "gemini"
 *               model:
 *                 type: string
 *                 description: Specific model to use
 *                 example: "gemini-pro"
 *     responses:
 *       200:
 *         description: AI response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: AI response message
 *                 provider:
 *                   type: string
 *                   description: AI provider used
 *                 model:
 *                   type: string
 *                   description: Model used
 *                 debug:
 *                   type: object
 *                   properties:
 *                     messageLength:
 *                       type: number
 *                     contextProvided:
 *                       type: boolean
 *                     contextLength:
 *                       type: number
 *                     isDocumentQuestion:
 *                       type: boolean
 *                     isCommonKnowledgeQuestion:
 *                       type: boolean
 *                     isRelatedKnowledgeQuestion:
 *                       type: boolean
 *                     usedFallback:
 *                       type: boolean
 *                     systemPromptLength:
 *                       type: number
 *                     responseLength:
 *                       type: number
 *       400:
 *         description: Message is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: AI service error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 stack:
 *                   type: string
 *                 details:
 *                   type: string
 */
// Test AI chat
router.post('/ai-chat', async (req, res) => {
    try {
        const { message, context, provider, model } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        console.log('🔍 TEST AI CHAT:');
        console.log('📝 Message:', message);
        console.log('📋 Context:', context ? `Provided (${context.length} chars)` : 'None');
        console.log('🤖 Provider:', provider || 'default');
        console.log('🤖 Model:', model || 'default');

        // Check if this is a document-related question
        const isDocumentQuestion = message.toLowerCase().includes('what is the document about') ||
            message.toLowerCase().includes('explain the context') ||
            message.toLowerCase().includes('what does the document say') ||
            message.toLowerCase().includes('summarize the document');

        // Check if this is a question about common knowledge or acronyms
        const isCommonKnowledgeQuestion =
            (message.toLowerCase().includes('what does') && message.toLowerCase().includes('stand for')) ||
            message.toLowerCase().includes('what is the meaning of') ||
            message.toLowerCase().includes('what is the full form of') ||
            message.toLowerCase().includes('what is the acronym') ||
            (message.toLowerCase().includes('what is') && message.toLowerCase().match(/\b[A-Z]{2,}\b/));

        // Check if this is a question related to the document but requiring broader knowledge
        const isRelatedKnowledgeQuestion =
            message.toLowerCase().includes('can you explain more about') ||
            message.toLowerCase().includes('tell me more about') ||
            message.toLowerCase().includes('what is') ||
            message.toLowerCase().includes('how does') ||
            message.toLowerCase().includes('why is');

        console.log('📝 Is document question:', isDocumentQuestion);
        console.log('📝 Is common knowledge question:', isCommonKnowledgeQuestion);
        console.log('📝 Is related knowledge question:', isRelatedKnowledgeQuestion);

        // Try to get a fallback response for common knowledge questions
        const fallbackResponse = getFallbackResponse(message);
        if (fallbackResponse) {
            console.log('✅ Using fallback response for', message);
            return res.json({
                message: fallbackResponse.message,
                provider: fallbackResponse.provider,
                model: fallbackResponse.model,
                debug: {
                    messageLength: message.length,
                    contextProvided: !!context,
                    contextLength: context?.length || 0,
                    isDocumentQuestion,
                    isCommonKnowledgeQuestion,
                    isRelatedKnowledgeQuestion,
                    usedFallback: true
                }
            });
        }

        // Prepare messages with improved system prompt
        let systemContent = `You are a helpful assistant answering questions about documents.

THIS IS THE DOCUMENT CONTENT:
${context || "No document content provided."}

IMPORTANT INSTRUCTIONS:
1. The above text is the document content you should use to answer questions.
2. If asked "what is the document about" or to "explain the context", summarize the document content above.
3. If asked about specific topics in the document, provide that information from the document.
4. CAREFULLY SEARCH the document for any mention of the topic the user is asking about, even if it's only briefly mentioned.
5. If the document mentions a topic but doesn't provide details, tell the user "The document mentions [TOPIC] as [BRIEF CONTEXT], but doesn't provide further details."
6. If a question is related to topics mentioned in the document but requires additional knowledge, you may provide helpful information beyond what's in the document.
7. When providing information not found in the document, clearly indicate: "While this isn't explicitly mentioned in the document, I can tell you that..."
8. DO NOT ask for document content - it has already been provided to you above.
9. DO NOT make up information about what's in the document - be clear about what comes from the document versus your general knowledge.`;

        // Add special handling for common knowledge questions about acronyms/terminology
        if (isCommonKnowledgeQuestion) {
            systemContent += `\n\n10. EXCEPTION FOR COMMON KNOWLEDGE: If the user is asking about the meaning of an acronym, abbreviation, or standard terminology (like "what does SWOT stand for?"), you may provide this common knowledge ONLY IF:
    a) The term or acronym is mentioned in the document but not explained
    b) The meaning is standard, well-established common knowledge (like SWOT = Strengths, Weaknesses, Opportunities, Threats)
    c) You clearly indicate this is supplementary information: "While the document mentions [TERM/ACRONYM] but doesn't explain it, in standard usage it stands for [EXPLANATION]."`;
        }

        // Add special handling for related knowledge questions
        if (isRelatedKnowledgeQuestion) {
            systemContent += `\n\n11. RELATED KNOWLEDGE HANDLING: The user seems to be asking about a topic that may be related to the document content:
    a) First check if the document directly addresses the question and provide that information if available
    b) If the document only mentions the topic briefly or indirectly, you may provide additional helpful information beyond what's in the document
    c) Always clearly distinguish between information from the document versus supplementary knowledge
    d) Begin supplementary information with phrases like "While the document doesn't cover this specifically..." or "To add some context beyond what's in the document..."`;
        }

        const messages = [
            { role: 'system', content: systemContent },
            { role: 'user', content: message }
        ];

        // Log what we're sending
        console.log('Messages being sent to AI:');
        messages.forEach((msg, i) => {
            console.log(`[${i}] ${msg.role}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
        });

        // Make the request
        try {
            // Get the AI provider
            const aiProvider = aiProviderManager.getProvider(provider);
            console.log('Using provider:', aiProvider.id);

            const aiResponse = await aiProvider.chat(messages, {
                temperature: 0.7, // Lower temperature for more deterministic responses
                max_tokens: 65000,
                model: model || undefined
            });

            // Log the response
            console.log('✅ AI Response received');
            console.log('Provider:', aiResponse.provider);
            console.log('Model:', aiResponse.model);
            console.log('Response:', aiResponse.content);

            res.json({
                message: aiResponse.content,
                provider: aiResponse.provider,
                model: aiResponse.model,
                debug: {
                    messageLength: message.length,
                    contextProvided: !!context,
                    contextLength: context?.length || 0,
                    systemPromptLength: systemContent.length,
                    responseLength: aiResponse.content.length,
                    isDocumentQuestion,
                    isCommonKnowledgeQuestion,
                    isRelatedKnowledgeQuestion,
                    usedFallback: false
                }
            });
        } catch (aiError) {
            console.error('❌ AI service error:', aiError);

            // Check again for fallback responses in case we missed any
            if (isCommonKnowledgeQuestion) {
                // Try to extract the acronym from the question
                const acronymMatch = message.match(/\b[A-Z]{2,}\b/);
                if (acronymMatch && acronymMatch[0] === 'SWOT') {
                    const swotFallback = {
                        message: "SWOT stands for Strengths, Weaknesses, Opportunities, and Threats. It's a strategic planning framework used to evaluate these four elements of a business, project, or situation. Strengths and weaknesses are typically internal factors, while opportunities and threats are external factors. This analysis helps organizations identify favorable and unfavorable factors that may impact their objectives.",
                        provider: "fallback",
                        model: "static-response"
                    };

                    console.log('✅ Using fallback response for SWOT after AI error');
                    return res.json({
                        message: swotFallback.message,
                        provider: swotFallback.provider,
                        model: swotFallback.model,
                        debug: {
                            messageLength: message.length,
                            contextProvided: !!context,
                            contextLength: context?.length || 0,
                            isDocumentQuestion,
                            isCommonKnowledgeQuestion,
                            isRelatedKnowledgeQuestion,
                            usedFallback: true,
                            originalError: aiError.message
                        }
                    });
                }
            }

            // No fallback available, return the error
            throw aiError;
        }
    } catch (error) {
        console.error('Error in /ai-chat endpoint:', error);
        res.status(500).json({
            error: error.message,
            stack: error.stack,
            details: 'An error occurred while processing your request'
        });
    }
});

/**
 * @swagger
 * /test/openrouter-test:
 *   get:
 *     summary: OpenRouter test
 *     description: Test OpenRouter AI provider directly to verify configuration and connectivity
 *     tags: [Testing]
 *     responses:
 *       200:
 *         description: OpenRouter test successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   description: AI response message
 *                 model:
 *                   type: string
 *                   description: Model used
 *                 provider:
 *                   type: string
 *                   example: "openrouter"
 *       400:
 *         description: OpenRouter API key not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "OpenRouter API key not found in environment variables"
 *                 env_keys:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Available environment variable names
 *       500:
 *         description: OpenRouter test failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 stack:
 *                   type: string
 */
// Test OpenRouter directly
router.get('/openrouter-test', async (req, res) => {
    try {
        console.log('🧪 Testing OpenRouter directly');

        // Check if OpenRouter API key is available
        if (!process.env.OPENROUTER_API_KEY) {
            return res.status(400).json({
                error: 'OpenRouter API key not found in environment variables',
                env_keys: Object.keys(process.env)
            });
        }

        console.log(`🧪 OpenRouter API key found: ${process.env.OPENROUTER_API_KEY.substring(0, 10)}...`);

        // Try to get the OpenRouter provider
        const openRouterProvider = aiProviderManager.getProvider('openrouter');

        if (!openRouterProvider) {
            return res.status(500).json({
                error: 'Failed to get OpenRouter provider',
                providers: Object.keys(aiProviderManager.providers),
                defaultProvider: aiProviderManager.config.defaultProvider
            });
        }

        // Try to use the OpenRouter provider
        const response = await openRouterProvider.chat(
            [{ role: 'user', content: 'Say hello!' }],
            { temperature: 0.7, max_tokens: 100 }
        );

        res.json({
            success: true,
            message: response.content,
            model: response.model,
            provider: response.provider
        });
    } catch (error) {
        console.error('OpenRouter test error:', error);
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
});

/**
 * @swagger
 * /test/cors-test:
 *   options:
 *     summary: CORS preflight test
 *     description: CORS preflight request handler for testing cross-origin requests
 *     tags: [Testing]
 *     responses:
 *       200:
 *         description: CORS preflight successful
 *         headers:
 *           Access-Control-Allow-Origin:
 *             schema:
 *               type: string
 *           Access-Control-Allow-Methods:
 *             schema:
 *               type: string
 *           Access-Control-Allow-Headers:
 *             schema:
 *               type: string
 *           Access-Control-Allow-Credentials:
 *             schema:
 *               type: string
 */
// Add CORS test endpoint
router.options('/cors-test', (req, res) => {
    console.log('🔄 CORS preflight test from origin:', req.headers.origin);
    console.log('🔄 Request headers:', req.headers);
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(200);
});

/**
 * @swagger
 * /test/cors-test:
 *   get:
 *     summary: CORS GET test
 *     description: Test CORS GET request to verify cross-origin requests are working
 *     tags: [Testing]
 *     responses:
 *       200:
 *         description: CORS GET test successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "CORS test successful"
 *                 origin:
 *                   type: string
 *                   description: Request origin
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 headers:
 *                   type: object
 *                   description: Request headers
 */
router.get('/cors-test', (req, res) => {
    console.log('🌍 CORS test request from origin:', req.headers.origin);
    res.json({
        message: 'CORS test successful',
        origin: req.headers.origin,
        timestamp: new Date().toISOString(),
        headers: req.headers,
    });
});

/**
 * @swagger
 * /test/cors-test:
 *   post:
 *     summary: CORS POST test
 *     description: Test CORS POST request to verify cross-origin POST requests are working
 *     tags: [Testing]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               test:
 *                 type: string
 *                 description: Test data
 *     responses:
 *       200:
 *         description: CORS POST test successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "CORS POST test successful"
 *                 origin:
 *                   type: string
 *                   description: Request origin
 *                 body:
 *                   type: object
 *                   description: Request body
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.post('/cors-test', (req, res) => {
    console.log('📝 CORS POST test from origin:', req.headers.origin);
    res.json({
        message: 'CORS POST test successful',
        origin: req.headers.origin,
        body: req.body,
        timestamp: new Date().toISOString(),
    });
});

export default router;
