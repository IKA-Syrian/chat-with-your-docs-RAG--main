import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Classify a chat error as transient (retry-worthy) vs. permanent.
 * Transient: 5xx server errors, 429 rate limit, network/timeout errors.
 * Permanent: 4xx other than 429 — auth, model-not-found, invalid request.
 */
function isTransientChatError(err) {
    if (!err) return false;
    const status = err.status ?? err.statusCode ?? null;
    if (status === 429 || (status >= 500 && status <= 599)) return true;
    const msg = String(err.message || '');
    if (/\b50\d\b/.test(msg)) return true;                    // "[503 ...]" patterns
    if (/\b429\b/.test(msg)) return true;
    if (/service unavailable|temporar(?:y|ily)|overloaded|high demand|exceeded.*quota|rate.?limit/i.test(msg)) return true;
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') return true;
    return false;
}

class AIProviderManager {
    constructor() {
        this.config = this.loadConfig();
        this.providers = {};
        this.initializeProviders();
    }

    loadConfig() {
        try {
            const configPath = path.join(__dirname, '..', 'config', 'ai-providers.json');
            const configData = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configData);

            // Log all environment variables for debugging
            console.log('🔑 Environment variables check:');
            console.log(`- GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? `exists (${process.env.GEMINI_API_KEY.length} chars)` : 'not found'}`);
            console.log(`- OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? `exists (${process.env.OPENROUTER_API_KEY.length} chars)` : 'not found'}`);
            console.log(`- OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'exists' : 'not found'}`);
            console.log(`- ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'exists' : 'not found'}`);

            // Inject API keys from environment variables IF PRESENT, **without** altering the
            // enabled/disabled state defined in ai-providers.json.  The `enabled` flag in the
            // JSON file is now the single source of truth that decides whether a provider is
            // considered during initialisation.

            if (config.providers.gemini) {
                config.providers.gemini.apiKey = process.env.GEMINI_API_KEY || config.providers.gemini.apiKey;
            }

            if (config.providers.openrouter) {
                config.providers.openrouter.apiKey = process.env.OPENROUTER_API_KEY || config.providers.openrouter.apiKey;
            }

            if (config.providers.openai) {
                config.providers.openai.apiKey = process.env.OPENAI_API_KEY || config.providers.openai.apiKey;
            }

            if (config.providers.claude) {
                config.providers.claude.apiKey = process.env.ANTHROPIC_API_KEY || config.providers.claude.apiKey;
            }

            // Log provider status
            console.log('📋 AI Provider Configuration:');
            Object.entries(config.providers).forEach(([id, provider]) => {
                console.log(`- ${provider.name} (${id}): ${provider.enabled ? 'ENABLED' : 'DISABLED'}, API Key: ${provider.apiKey ? `exists (${provider.apiKey.length} chars)` : 'not set'}`);
                if (provider.enabled) {
                    console.log(`  Primary model: ${provider.models?.chat?.primary || 'not set'}`);
                    console.log(`  Available models: ${provider.models?.chat?.alternatives?.join(', ') || 'none'}`);
                }
            });

            return config;
        } catch (error) {
            console.error('Error loading AI provider config:', error);
            return {
                defaultProvider: 'gemini',
                providers: {
                    gemini: {
                        name: 'Google Gemini',
                        enabled: !!process.env.GEMINI_API_KEY,
                        apiKey: process.env.GEMINI_API_KEY || '',
                        models: {
                            chat: {
                                primary: 'gemini-2.0-flash',
                                alternatives: ['gemini-1.5-pro', 'gemini-pro']
                            }
                        }
                    }
                }
            };
        }
    }

    initializeProviders() {
        let providersInitialized = 0;

        // Log all providers in config for debugging
        console.log('⚙️ Available providers in config:', Object.keys(this.config.providers));

        for (const [providerId, providerConfig] of Object.entries(this.config.providers)) {
            console.log(`⚙️ Checking provider ${providerId}:`, {
                enabled: providerConfig.enabled,
                hasApiKey: !!providerConfig.apiKey,
                apiKeyLength: providerConfig.apiKey?.length || 0
            });

            if (providerConfig.enabled && providerConfig.apiKey) {
                try {
                    this.providers[providerId] = new AIProvider(providerId, providerConfig);
                    console.log(`✅ Successfully initialized ${providerId} provider`);
                    providersInitialized++;
                } catch (error) {
                    console.error(`❌ Failed to initialize ${providerId} provider:`, error);
                }
            } else {
                console.log(`⚠️ Provider ${providerId} not initialized:`,
                    !providerConfig.enabled ? 'Not enabled' : 'No API key');
            }
        }

        if (providersInitialized === 0) {
            console.error('❌ No AI providers were initialised. Please ensure at least one provider is enabled in ai-providers.json and has a valid API key.');
        } else {
            console.log(`⚙️ Initialised ${providersInitialized} providers:`, Object.keys(this.providers));
        }
    }

    getProvider(providerId) {
        console.log(`🔍 Getting provider: ${providerId || '(default)'}`);
        const initialised = this.providers;

        if (Object.keys(initialised).length === 0) {
            throw new Error('No AI providers are initialised – check your ai-providers.json and API keys.');
        }

        // If a specific provider is requested, ensure it exists
        if (providerId) {
            if (!initialised[providerId]) {
                throw new Error(`Requested provider "${providerId}" is not initialised or is disabled.`);
            }
            return initialised[providerId];
        }

        // Use default from config if available
        if (initialised[this.config.defaultProvider]) {
            return initialised[this.config.defaultProvider];
        }

        // Otherwise pick the first initialised provider deterministically
        const first = Object.keys(initialised)[0];
        console.warn(`⚠️ Default provider "${this.config.defaultProvider}" not initialised – falling back to "${first}".`);
        return initialised[first];
    }

    getAvailableProviders() {
        return Object.keys(this.config.providers).map(id => {
            const p = this.config.providers[id];
            const isEnabled = p.enabled && !!p.apiKey;
            return {
                id,
                name: p.name,
                enabled: isEnabled
            };
        });
    }

    /**
     * Phase 3 #14 — pick a provider that supports `transcribePdf`. Preference
     * order: gemini → claude. Returns null if none of the supported providers
     * is enabled.
     */
    getVisionProvider() {
        const order = ['gemini', 'claude'];
        for (const id of order) {
            if (this.providers[id]) return this.providers[id];
        }
        return null;
    }

    getAvailableProvidersWithModels() {
        return Object.keys(this.config.providers).map(id => {
            const provider = this.config.providers[id];
            const isEnabled = provider.enabled && !!provider.apiKey;
            return {
                id,
                name: provider.name,
                enabled: isEnabled,
                models: provider.models?.chat ? {
                    primary: provider.models.chat.primary,
                    alternatives: provider.models.chat.alternatives || []
                } : null
            };
        });
    }
}

class AIProvider {
    constructor(id, config) {
        this.id = id;
        this.config = config;
    }

    /**
     * Chat with retry-on-transient + automatic model fallback.
     *
     * Retry policy:
     *   - 503 Service Unavailable / 429 Too Many Requests / network errors:
     *     retry up to 2 times with 600ms / 1800ms backoff on the same model.
     *   - If all retries on the requested model fail with a transient error,
     *     fall through to the next model in `config.models.chat.alternatives`
     *     (one attempt each). Final non-transient error or last-model failure
     *     bubbles up.
     *   - 4xx responses other than 429 are NOT retried — they're caller errors
     *     (auth, model not found, invalid request) and retrying won't help.
     */
    async chat(messages, options = {}) {
        const requested = options.model || this.config.models?.chat?.primary;
        const alternatives = this.config.models?.chat?.alternatives || [];

        // Models to try in order. Skip duplicates.
        const tryModels = [requested, ...alternatives].filter((m, i, a) => m && a.indexOf(m) === i);

        let lastErr;
        for (let mi = 0; mi < tryModels.length; mi++) {
            const model = tryModels[mi];
            const attempts = mi === 0 ? 3 : 1;   // primary gets 3 tries; fallbacks get 1 each
            for (let attempt = 0; attempt < attempts; attempt++) {
                try {
                    return await this.chatOnce(messages, { ...options, model });
                } catch (err) {
                    lastErr = err;
                    if (!isTransientChatError(err)) throw err;   // non-transient: bail immediately
                    const isLastAttempt = attempt === attempts - 1 && mi === tryModels.length - 1;
                    if (isLastAttempt) break;
                    if (attempt < attempts - 1) {
                        const backoff = 600 * Math.pow(3, attempt); // 600ms, 1800ms
                        console.warn(`⚠️ Transient chat error on ${model} (attempt ${attempt + 1}/${attempts}): ${err.message?.slice(0, 120)}. Retrying in ${backoff}ms…`);
                        await new Promise(r => setTimeout(r, backoff));
                    } else if (mi < tryModels.length - 1) {
                        console.warn(`⚠️ ${model} exhausted retries. Falling back to ${tryModels[mi + 1]}.`);
                    }
                }
            }
        }
        throw lastErr || new Error(`All chat models exhausted for provider ${this.id}`);
    }

    /** One chat attempt — dispatch to the per-provider implementation. */
    async chatOnce(messages, options = {}) {
        switch (this.id) {
            case 'gemini':
                return this.chatWithGemini(messages, options);
            case 'openrouter':
                return this.chatWithOpenRouter(messages, options);
            case 'openai':
                return this.chatWithOpenAI(messages, options);
            case 'claude':
                return this.chatWithClaude(messages, options);
            default:
                throw new Error(`Unknown provider: ${this.id}`);
        }
    }

    /**
     * Phase 3 #14 — transcribe a PDF directly via the multimodal API.
     * Gemini and Claude accept PDF bytes natively; OpenAI/OpenRouter currently
     * throw "unsupported" because they require pre-rasterization to images.
     *
     * @param {Buffer} pdfBuffer
     * @param {{ model?: string, documentName?: string }} [options]
     * @returns {Promise<{ text: string, model: string, provider: string, usage?: any }>}
     */
    async transcribePdf(pdfBuffer, options = {}) {
        switch (this.id) {
            case 'gemini':
                return this.transcribePdfWithGemini(pdfBuffer, options);
            case 'claude':
                return this.transcribePdfWithClaude(pdfBuffer, options);
            case 'openai':
            case 'openrouter':
            default:
                const err = new Error(`transcribePdf not supported for provider "${this.id}"`);
                err.code = 'OCR_UNSUPPORTED';
                throw err;
        }
    }

    async transcribePdfWithGemini(pdfBuffer, options = {}) {
        if (!Buffer.isBuffer(pdfBuffer)) {
            throw new Error('pdfBuffer must be a Buffer');
        }
        // Gemini's documented inline-data limit is ~30MB. Refuse early.
        if (pdfBuffer.length > 30 * 1024 * 1024) {
            const err = new Error('PDF exceeds 30MB Gemini inline-data limit');
            err.code = 'OCR_PDF_TOO_LARGE';
            throw err;
        }

        const genAI = new GoogleGenerativeAI(this.config.apiKey);
        const modelName = options.model || this.config.models?.chat?.primary || 'gemini-1.5-flash';
        const model = genAI.getGenerativeModel({ model: modelName });

        const docName = options.documentName || 'document';
        const prompt = `Transcribe ALL visible text in the attached PDF "${docName}" verbatim.
Rules:
- Preserve heading hierarchy with markdown (#, ##, ###).
- Insert "[PAGE N]" markers between pages where N is the 1-based page number.
- Preserve ordered/unordered list structure as markdown.
- Do NOT summarize, paraphrase, or skip content.
- Do NOT add commentary, headers, or "Here is the transcription:" prefaces — output ONLY the transcribed text.`;

        const result = await model.generateContent([
            { text: prompt },
            { inlineData: { mimeType: 'application/pdf', data: pdfBuffer.toString('base64') } }
        ]);
        const response = await result.response;
        const text = response.text();
        const usage = response?.usageMetadata || null;

        return {
            text,
            model: modelName,
            provider: 'gemini',
            usage: usage ? {
                prompt_tokens: usage.promptTokenCount,
                completion_tokens: usage.candidatesTokenCount,
                total_tokens: usage.totalTokenCount
            } : null
        };
    }

    async transcribePdfWithClaude(pdfBuffer, options = {}) {
        if (!Buffer.isBuffer(pdfBuffer)) throw new Error('pdfBuffer must be a Buffer');
        if (pdfBuffer.length > 32 * 1024 * 1024) {
            const err = new Error('PDF exceeds 32MB Claude inline-data limit');
            err.code = 'OCR_PDF_TOO_LARGE';
            throw err;
        }

        const docName = options.documentName || 'document';
        const prompt = `Transcribe ALL visible text in the attached PDF "${docName}" verbatim.
Rules:
- Preserve heading hierarchy with markdown.
- Insert "[PAGE N]" markers between pages.
- Preserve list structure.
- Do NOT summarize. Output ONLY the transcribed text.`;

        const response = await fetch(this.config.endpoints.chat, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.config.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: options.model || this.config.models.chat.primary,
                max_tokens: 8000,
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'document',
                            source: {
                                type: 'base64',
                                media_type: 'application/pdf',
                                data: pdfBuffer.toString('base64')
                            }
                        },
                        { type: 'text', text: prompt }
                    ]
                }]
            })
        });

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            const err = new Error(`Claude OCR error: ${errBody?.error?.message || response.statusText}`);
            err.code = 'OCR_PROVIDER_ERROR';
            throw err;
        }

        const data = await response.json();
        const text = (data.content || [])
            .filter(c => c.type === 'text')
            .map(c => c.text)
            .join('\n');

        return {
            text,
            model: options.model || this.config.models.chat.primary,
            provider: 'claude',
            usage: data.usage ? {
                prompt_tokens: data.usage.input_tokens,
                completion_tokens: data.usage.output_tokens,
                total_tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0)
            } : null
        };
    }

    async chatWithGemini(messages, options) {
        try {
            console.log(`🤖 Using Gemini chat with API key length: ${this.config.apiKey?.length || 0}`);
            console.log(`🤖 Selected model: ${options.model || this.config.models.chat.primary}`);

            // Extract system message and user message for better handling
            const systemMessage = messages.find(m => m.role === 'system');
            const userMessages = messages.filter(m => m.role === 'user');
            const lastUserMessage = userMessages[userMessages.length - 1];

            // Check if this is educational content generation mode
            const isEducationalContentMode = systemMessage &&
                systemMessage.content.includes('EDUCATIONAL_CONTENT_GENERATION_MODE');

            console.log('🎓 Educational content generation mode:', isEducationalContentMode);

            // Only use fallbacks if NOT in educational content generation mode
            if (!isEducationalContentMode && lastUserMessage) {
                const lowerMessage = lastUserMessage.content.toLowerCase();

                // SWOT analysis fallback
                if (lowerMessage.includes('swot') &&
                    (lowerMessage.includes('what is') ||
                        lowerMessage.includes('explain') ||
                        lowerMessage.includes('stand for') ||
                        lowerMessage.includes('analysis'))) {

                    console.log('🤖 Using fallback response for SWOT analysis');
                    return {
                        content: "SWOT stands for Strengths, Weaknesses, Opportunities, and Threats. It's a strategic planning framework used to evaluate these four elements of a business, project, or situation. Strengths and weaknesses are typically internal factors, while opportunities and threats are external factors. This analysis helps organizations identify favorable and unfavorable factors that may impact their objectives.",
                        model: options.model || this.config.models.chat.primary,
                        provider: 'gemini-fallback'
                    };
                }

                // Add more fallbacks for other common questions as needed
            }

            const genAI = new GoogleGenerativeAI(this.config.apiKey);
            const model = genAI.getGenerativeModel({
                model: options.model || this.config.models.chat.primary,
                generationConfig: {
                    temperature: options.temperature || 0.7,
                    maxOutputTokens: options.max_tokens || 10000,
                }
            });

            // Log the system message for debugging
            if (systemMessage) {
                console.log('🤖 System message length:', systemMessage.content.length);
                console.log('🤖 System message preview:', systemMessage.content.substring(0, 100) + '...');

                // Check if system message contains document content
                const hasDocumentContent = systemMessage.content.includes('DOCUMENT CONTENT') ||
                    systemMessage.content.includes('document content');
                console.log('🤖 Has document content:', hasDocumentContent);
            }

            console.log('🤖 Last user message:', lastUserMessage?.content);

            // Special handling for document-related questions
            const isDocumentQuestion = lastUserMessage &&
                (lastUserMessage.content.toLowerCase().includes('what is the document about') ||
                    lastUserMessage.content.toLowerCase().includes('explain the context') ||
                    lastUserMessage.content.toLowerCase().includes('what does the document say') ||
                    lastUserMessage.content.toLowerCase().includes('summarize the document'));

            // Check if this is a question about common knowledge or acronyms
            const isCommonKnowledgeQuestion = lastUserMessage &&
                ((lastUserMessage.content.toLowerCase().includes('what does') &&
                    lastUserMessage.content.toLowerCase().includes('stand for')) ||
                    lastUserMessage.content.toLowerCase().includes('what is the meaning of') ||
                    lastUserMessage.content.toLowerCase().includes('what is the full form of') ||
                    lastUserMessage.content.toLowerCase().includes('what is the acronym'));

            // Check if this is a question related to the document but requiring broader knowledge
            const isRelatedKnowledgeQuestion = lastUserMessage &&
                (lastUserMessage.content.toLowerCase().includes('can you explain more about') ||
                    lastUserMessage.content.toLowerCase().includes('tell me more about') ||
                    lastUserMessage.content.toLowerCase().includes('what is') ||
                    lastUserMessage.content.toLowerCase().includes('how does') ||
                    lastUserMessage.content.toLowerCase().includes('why is'));

            console.log('🤖 Is document question:', isDocumentQuestion);
            console.log('🤖 Is common knowledge question:', isCommonKnowledgeQuestion);
            console.log('🤖 Is related knowledge question:', isRelatedKnowledgeQuestion);

            // For Gemini 2.0 models, use the generateContent approach with a modified prompt
            const modelName = options.model || this.config.models.chat.primary;

            if (modelName.includes('gemini-2') || modelName.includes('gemini-1.5')) {
                // Build a more explicit prompt that forces the model to use the document content
                let prompt = '';

                if (systemMessage) {
                    // Extract document content from system message
                    const docContentMatch = systemMessage.content.match(/THIS IS THE DOCUMENT CONTENT:\s*([\s\S]+?)(?=\s*IMPORTANT INSTRUCTIONS:|$)/i);
                    const documentContent = docContentMatch ? docContentMatch[1].trim() : '';

                    // Create an enhanced prompt
                    prompt = `You are a helpful assistant that answers questions based on provided document content.

DOCUMENT CONTENT:
${documentContent}

USER QUESTION: ${lastUserMessage.content}

INSTRUCTIONS:
1. You should primarily answer based on the document content provided above.
2. If asked "what is the document about" or to "explain the context", provide a summary of the document content.
3. CAREFULLY SEARCH the entire document content for ANY mention of the topic the user is asking about, even if it's only briefly mentioned.
4. If the document mentions a topic but doesn't provide details, say "The document mentions [TOPIC] as [BRIEF CONTEXT], but doesn't provide further details."
5. If a question is related to topics mentioned in the document but requires additional knowledge, you may provide helpful information beyond what's in the document.
6. When providing information not found in the document, clearly indicate: "While this isn't explicitly mentioned in the document, I can tell you that..."`;

                    // Add special handling for common knowledge questions
                    if (isCommonKnowledgeQuestion) {
                        prompt += `
7. EXCEPTION FOR COMMON KNOWLEDGE: If I'm asking about the meaning of an acronym, abbreviation, or standard terminology that is mentioned in the document but not explained (like "what does SWOT stand for?"), you may provide this common knowledge ONLY IF:
   a) The term or acronym is mentioned in the document but not explained
   b) The meaning is standard, well-established common knowledge (like SWOT = Strengths, Weaknesses, Opportunities, Threats)
   c) You clearly indicate this is supplementary information: "While the document mentions [TERM/ACRONYM] but doesn't explain it, in standard usage it stands for [EXPLANATION]."`;
                    }

                    // Add special handling for related knowledge questions
                    if (isRelatedKnowledgeQuestion) {
                        prompt += `
7. RELATED KNOWLEDGE HANDLING: I seem to be asking about a topic that may be related to the document content:
   a) First check if the document directly addresses the question and provide that information if available
   b) If the document only mentions the topic briefly or indirectly, you may provide additional helpful information beyond what's in the document
   c) Always clearly distinguish between information from the document versus supplementary knowledge
   d) Begin supplementary information with phrases like "While the document doesn't cover this specifically..." or "To add some context beyond what's in the document..."`;
                    }

                } else {
                    // If no system message with document content, use a standard prompt
                    prompt = `You are a helpful assistant.

USER QUESTION: ${lastUserMessage.content}`;
                }

                console.log('🤖 Enhanced prompt length:', prompt.length);
                console.log('🤖 Enhanced prompt preview:', prompt.substring(0, 200) + '...');

                const result = await model.generateContent(prompt);
                const response = await result.response;
                const text = response.text();

                const usageMeta = response?.usageMetadata || result?.response?.usageMetadata || null;
                return {
                    content: text,
                    model: modelName,
                    provider: 'gemini',
                    usage: usageMeta ? {
                        prompt_tokens: usageMeta.promptTokenCount,
                        completion_tokens: usageMeta.candidatesTokenCount,
                        total_tokens: usageMeta.totalTokenCount
                    } : null
                };
            } else {
                // For older models, use the chat interface with history
                const chat = model.startChat();

                // Process the messages
                const history = [];

                // First, add the system message as a special user message
                if (systemMessage) {
                    // Extract document content from system message for improved handling
                    const docContentMatch = systemMessage.content.match(/THIS IS THE DOCUMENT CONTENT:\s*([\s\S]+?)(?=\s*IMPORTANT INSTRUCTIONS:|$)/i);
                    const documentContent = docContentMatch ? docContentMatch[1].trim() : '';

                    const enhancedSystemPrompt = `System Instructions: You are answering questions about a document. 
Here is the document content:

${documentContent}

When asked "what is the document about" or to "explain the context", you should summarize the document content above.
You should primarily use the document content to answer questions, but you may provide additional information beyond the document when appropriate.
When providing information not in the document, clearly indicate it with phrases like "While not mentioned in the document..." or "To add more context beyond the document..."`;

                    history.push({
                        role: 'user',
                        parts: [{ text: enhancedSystemPrompt }]
                    });

                    // Add an assistant acknowledgment
                    history.push({
                        role: 'model',
                        parts: [{ text: 'I understand. I will primarily use the provided document content to answer questions, but can provide additional information when appropriate. If asked about what the document is about or to explain the context, I will summarize the document content.' }]
                    });
                }

                // Then add the conversation history (excluding the last user message)
                for (let i = 0; i < messages.length - 1; i++) {
                    const msg = messages[i];
                    if (msg.role === 'system') continue; // Skip system messages as we handled them above

                    history.push({
                        role: msg.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: msg.content }]
                    });
                }

                // For testing, log the history
                console.log('🤖 Chat history structure:', history.map(h => ({ role: h.role })));

                // Get the last user message
                const lastUserMessage = messages[messages.length - 1].content;
                console.log('🤖 Using last user message:', lastUserMessage.substring(0, 50) + (lastUserMessage.length > 50 ? '...' : ''));

                // Generate response
                const result = await chat.sendMessage(lastUserMessage);
                const response = await result.response;
                const text = response.text();

                const usageMeta = response?.usageMetadata || null;
                return {
                    content: text,
                    model: modelName,
                    provider: 'gemini',
                    usage: usageMeta ? {
                        prompt_tokens: usageMeta.promptTokenCount,
                        completion_tokens: usageMeta.candidatesTokenCount,
                        total_tokens: usageMeta.totalTokenCount
                    } : null
                };
            }
        } catch (error) {
            console.error('Gemini chat error:', error);

            // Check if this is educational content generation mode
            const systemMessage = messages.find(m => m.role === 'system');
            const isEducationalContentMode = systemMessage &&
                systemMessage.content.includes('EDUCATIONAL_CONTENT_GENERATION_MODE');

            // Only use fallbacks if NOT in educational content generation mode
            if (!isEducationalContentMode) {
                // Check if this is a question we can handle with a fallback
                const lastUserMessage = messages.find(m => m.role === 'user')?.content;
                if (lastUserMessage) {
                    const lowerMessage = lastUserMessage.toLowerCase();

                    // SWOT analysis fallback
                    if (lowerMessage.includes('swot') &&
                        (lowerMessage.includes('what is') ||
                            lowerMessage.includes('explain') ||
                            lowerMessage.includes('stand for') ||
                            lowerMessage.includes('analysis'))) {

                        console.log('🤖 Using fallback response for SWOT analysis after error');
                        return {
                            content: "SWOT stands for Strengths, Weaknesses, Opportunities, and Threats. It's a strategic planning framework used to evaluate these four elements of a business, project, or situation. Strengths and weaknesses are typically internal factors, while opportunities and threats are external factors. This analysis helps organizations identify favorable and unfavorable factors that may impact their objectives.",
                            model: options.model || this.config.models.chat.primary,
                            provider: 'gemini-fallback'
                        };
                    }
                }

                // If no fallback available, throw the error
                throw new Error(`Gemini API error: ${error.message}`);
            }

            // If no fallback available, throw the error  
            throw new Error(`Gemini API error: ${error.message}`);
        }
    }

    async chatWithOpenRouter(messages, options) {
        console.log(`🤖 Using OpenRouter chat with API key length: ${this.config.apiKey?.length || 0}`);

        // Get the model from options or config
        const selectedModel = options.model || this.config.models?.chat?.primary;
        console.log(`🤖 Selected OpenRouter model: ${selectedModel}`);

        if (!selectedModel) {
            console.error('❌ No model specified for OpenRouter and no default model in config');
            throw new Error('No model specified for OpenRouter');
        }

        // Ensure we have an API key - try from config, then from env
        const apiKey = this.config.apiKey || process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            console.error('❌ OpenRouter API key not set in config or environment');
            throw new Error('OpenRouter API key not set. Please add your OpenRouter API key to the .env file.');
        }

        // Check if the API key is a placeholder
        if (apiKey === 'YOUR_OPENROUTER_API_KEY_HERE' || apiKey.includes('your_') || apiKey.includes('YOUR_')) {
            console.error('❌ OpenRouter API key is a placeholder value');
            throw new Error('Please replace the placeholder with your actual OpenRouter API key in the .env file.');
        }

        console.log(`🔑 Using OpenRouter API key: ${apiKey.substring(0, 10)}...`);

        // Make sure we're using the OpenRouter endpoint
        const endpoint = this.config.endpoints?.chat || 'https://openrouter.ai/api/v1/chat/completions';
        console.log(`🤖 Using OpenRouter endpoint: ${endpoint}`);

        try {
            console.log('🤖 Making request to OpenRouter API');
            console.log('🤖 Request details:');
            console.log(`- Model: ${selectedModel}`);
            console.log(`- Messages: ${messages.length} messages`);
            console.log(`- Temperature: ${options.temperature || 0.7}`);
            console.log(`- Max tokens: ${options.max_tokens || 1000}`);

            // Create headers with the correct format for OpenRouter
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
                'X-Title': 'Chat with Documents App',
                'User-Agent': 'Mozilla/5.0 Chat App'
            };

            console.log('🤖 Request headers:', JSON.stringify(headers, null, 2));

            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: selectedModel,
                    messages,
                    temperature: options.temperature || 0.7,
                    max_tokens: options.max_tokens || 1000
                })
            });

            console.log('🔍 Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                let errorJson;
                try {
                    errorJson = JSON.parse(errorText);
                } catch (e) {
                    errorJson = { error: errorText };
                }

                console.error('❌ OpenRouter API error response:', errorJson);
                console.error(`❌ Status code: ${response.status}`);

                // Check if it's an authentication error
                if (response.status === 401) {
                    console.error('❌ Authentication error. Check your OpenRouter API key.');
                    throw new Error(`OpenRouter API authentication error: ${errorJson.error?.message || 'Invalid API key'}`);
                }

                // Check if it's a model-related error
                if (errorJson.error?.message?.includes('model') || response.status === 404) {
                    console.log('⚠️ Model error detected, might be using wrong model name');

                    // Log available models from config
                    console.log('📋 Available models in config:');
                    console.log(`- Primary: ${this.config.models.chat.primary}`);
                    console.log(`- Alternatives: ${this.config.models.chat.alternatives?.join(', ') || 'none'}`);

                    throw new Error(`OpenRouter API error: Model '${selectedModel}' not found or invalid. Please try a different model.`);
                }

                throw new Error(`OpenRouter API error: ${errorJson.error?.message || response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ OpenRouter response received, model used: ${data.model || selectedModel}`);

            return {
                content: data.choices[0]?.message?.content || '',
                model: data.model || selectedModel,
                provider: 'openrouter',
                usage: data.usage || null
            };
        } catch (error) {
            console.error('❌ OpenRouter API call failed:', error.message);
            throw error;
        }
    }

    async chatWithOpenAI(messages, options) {
        const response = await fetch(this.config.endpoints.chat, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify({
                model: options.model || this.config.models.chat.primary,
                messages,
                temperature: options.temperature || 0.7,
                max_tokens: options.max_tokens || 1000
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        return {
            content: data.choices[0]?.message?.content || '',
            model: options.model || this.config.models.chat.primary,
            provider: 'openai',
            usage: data.usage || null
        };
    }

    async chatWithClaude(messages, options) {
        // Convert messages to Claude format
        const systemMessage = messages.find(m => m.role === 'system');
        const conversationMessages = messages.filter(m => m.role !== 'system').map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
        }));

        const response = await fetch(this.config.endpoints.chat, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.config.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: options.model || this.config.models.chat.primary,
                messages: conversationMessages,
                system: systemMessage?.content,
                max_tokens: options.max_tokens || 1000,
                temperature: options.temperature || 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Claude API error: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        return {
            content: data.content[0]?.text || '',
            model: options.model || this.config.models.chat.primary,
            provider: 'claude',
            usage: data.usage ? {
                prompt_tokens: data.usage.input_tokens,
                completion_tokens: data.usage.output_tokens,
                total_tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0)
            } : null
        };
    }
}

// Create a singleton instance
const aiProviderManager = new AIProviderManager();

export default aiProviderManager;