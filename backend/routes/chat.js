/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: AI-powered chat with document context and conversation management
 */

import { Router } from 'express';
import { createUserClient } from '../lib/supabase.js';
import fetch from 'node-fetch';
import { validateUser } from './auth.js';
import aiProviderManager from '../lib/ai-providers.js';
import path from 'path';
import fs from 'fs';

const router = Router();

/**
 * @swagger
 * /chat:
 *   post:
 *     summary: Chat with AI using document context
 *     description: Send a message to the AI with optional document context. The AI will respond based on relevant document sections and conversation history.
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
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
 *                 description: The message to send to the AI
 *                 example: "What are the key points in this document?"
 *               conversation_id:
 *                 type: string
 *                 description: ID of existing conversation to continue
 *                 example: "conv_123"
 *               document_id:
 *                 type: string
 *                 description: ID of document to use as context
 *                 example: "doc_456"
 *               history:
 *                 type: array
 *                 description: Previous conversation history
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant]
 *                     content:
 *                       type: string
 *               provider:
 *                 type: string
 *                 description: AI provider to use (optional)
 *                 example: "openai"
 *               model:
 *                 type: string
 *                 description: Specific model to use (optional)
 *                 example: "gpt-4"
 *     responses:
 *       200:
 *         description: Chat response generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: Message ID
 *                 message:
 *                   type: string
 *                   description: AI response message
 *                 conversation_id:
 *                   type: string
 *                   description: Conversation ID
 *                 document_id:
 *                   type: string
 *                   description: Document ID used for context
 *                 document_name:
 *                   type: string
 *                   description: Document name
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   description: Response timestamp
 *                 sources:
 *                   type: array
 *                   description: Document sections used as context
 *                   items:
 *                     type: object
 *                     properties:
 *                       document_id:
 *                         type: string
 *                       document_name:
 *                         type: string
 *                       content:
 *                         type: string
 *                 provider:
 *                   type: string
 *                   description: AI provider used
 *                 model:
 *                   type: string
 *                   description: AI model used
 *                 availableProviders:
 *                   type: array
 *                   description: List of available AI providers
 *                   items:
 *                     $ref: '#/components/schemas/AIProvider'
 *       400:
 *         description: Bad request - message is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: AI service error or internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 details:
 *                   type: string
 *                 availableProviders:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AIProvider'
 */
// Chat with documents endpoint
router.post('/', async (req, res) => {
    try {
        const authToken = req.headers.authorization?.replace('Bearer ', '');

        if (!authToken) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        const { message, conversation_id, document_id, history = [], provider, model } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Robust auth validation
        const { user, error: userError } = await validateUser(authToken);
        if (userError || !user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const supabase = createUserClient(authToken);

        // Get document information if document_id is provided
        let documentInfo = null;
        if (document_id) {
            const { data: document, error: documentError } = await supabase
                .from('documents')
                .select('*')
                .eq('id', document_id)
                .single();

            if (!documentError && document) {
                documentInfo = document;
                console.log(`Using document context: ${document.name} (ID: ${document.id})`);
            } else {
                console.log(`Document ID ${document_id} not found or error: ${documentError?.message}`);
            }
        }

        // Search for relevant document sections (filtered by document_id if provided)
        let relevantSections = [];

        try {
            // First try text search with user's query
            let query = supabase
                .from('document_sections')
                .select('content, document_id, documents(name)')
                .textSearch('content', message.split(' ').filter(w => w.length > 3).join(' & '), {
                    type: 'websearch',
                    config: 'english'
                });

            // Filter by document_id if provided
            if (document_id) {
                query = query.eq('document_id', document_id);
            }

            // Limit results
            const { data: sections, error: searchError } = await query.limit(5);

            if (searchError) {
                console.error('Error searching documents:', searchError);
            }

            if (sections && sections.length > 0) {
                relevantSections = sections;
                console.log(`Found ${sections.length} relevant sections via text search`);
            } else if (document_id) {
                // If no results from text search, ALWAYS retrieve sections from the document

                /* -------------------------------------------------------------
                   VECTOR-SIMILARITY FALLBACK (RAG)
                   ----------------------------------------------------------- */

                console.log('No text matches – attempting vector similarity search');

                // very small helper to create a cheap deterministic 384-dim embedding
                const createSimpleEmbedding = (text, dims = 384) => {
                    const emb = new Array(dims).fill(0);
                    let hash = 0;
                    for (let i = 0; i < text.length; i++) {
                        hash = (hash * 31 + text.charCodeAt(i)) & 0xffffffff;
                    }
                    for (let i = 0; i < dims; i++) {
                        emb[i] = Math.sin(hash + i) * 0.5;
                    }
                    return emb;
                };

                try {
                    const queryEmbedding = createSimpleEmbedding(message);
                    const rpcPayload = {
                        query_embedding: queryEmbedding,
                        match_threshold: 0.6,
                        match_count: 5,
                        document_id // may be null
                    };

                    const { data: vectorMatches, error: vectorErr } = await supabase
                        .rpc('match_document_sections', rpcPayload)
                        .select('content, document_id');

                    if (vectorErr) {
                        console.error('Vector search RPC error:', vectorErr);
                    } else if (vectorMatches && vectorMatches.length > 0) {
                        relevantSections = vectorMatches.map(m => ({
                            content: m.content,
                            document_id: m.document_id,
                            documents: { name: documentInfo?.name || 'Document' }
                        }));
                        console.log(`Retrieved ${vectorMatches.length} sections via vector similarity`);
                    }
                } catch (vecCatch) {
                    console.error('Vector search fallback threw:', vecCatch);
                }

                console.log('No text search results, retrieving random document sections');

                // Get at least 5 sections from this document to provide context
                const { data: fallbackSections, error: fallbackError } = await supabase
                    .from('document_sections')
                    .select('content, document_id, documents(name)')
                    .eq('document_id', document_id)
                    .limit(10);

                if (!fallbackError && fallbackSections && fallbackSections.length > 0) {
                    relevantSections = fallbackSections;
                    console.log(`Retrieved ${fallbackSections.length} fallback document sections`);
                } else {
                    console.error('Error retrieving fallback sections:', fallbackError);

                    // Last resort: Try to get document content directly
                    try {
                        const { data: documentContent, error: contentError } = await supabase
                            .from('document_content')
                            .select('content')
                            .eq('document_id', document_id)
                            .single();

                        if (!contentError && documentContent && documentContent.content) {
                            // Create a synthetic section with the document content
                            // Decode base64 content if it's encoded
                            let decodedContent;
                            try {
                                // Check if it's base64 encoded
                                if (typeof documentContent.content === 'string' &&
                                    /^[A-Za-z0-9+/=]+$/.test(documentContent.content)) {
                                    decodedContent = Buffer.from(documentContent.content, 'base64').toString('utf-8');
                                    console.log('Successfully decoded base64 content');
                                } else {
                                    decodedContent = documentContent.content;
                                }
                            } catch (decodeError) {
                                console.error('Failed to decode content:', decodeError);
                                decodedContent = documentContent.content;
                            }

                            relevantSections = [{
                                content: decodedContent,
                                document_id: document_id,
                                documents: { name: documentInfo?.name || 'Document' }
                            }];
                            console.log('Retrieved document content directly as fallback');
                        } else {
                            // If no content in document_content table, try to read the file directly
                            try {
                                // Try to get the storage path from the document
                                if (documentInfo && documentInfo.storage_object_path) {
                                    console.log('Attempting to read file directly:', documentInfo.storage_object_path);

                                    // Check if it's a local file path
                                    const localPath = path.join(process.cwd(), '..', 'public', documentInfo.storage_object_path);

                                    if (fs.existsSync(localPath)) {
                                        const fileContent = fs.readFileSync(localPath, 'utf-8');
                                        console.log('Successfully read file from local path');

                                        relevantSections = [{
                                            content: fileContent,
                                            document_id: document_id,
                                            documents: { name: documentInfo?.name || 'Document' }
                                        }];
                                    }
                                }
                            } catch (fileError) {
                                console.error('Failed to read file directly:', fileError);
                            }
                        }
                    } catch (contentError) {
                        console.error('Failed to retrieve document content:', contentError);
                    }
                }
            }
        } catch (searchErr) {
            console.error('Error during document search:', searchErr);
        }

        // If we still have no content but have a document_id, create a placeholder section
        if (relevantSections.length === 0 && document_id && documentInfo) {
            console.log('Creating placeholder section with document info');
            relevantSections = [{
                content: `This is a document titled "${documentInfo.name}". Please ask specific questions about its content.`,
                document_id: document_id,
                documents: { name: documentInfo.name }
            }];
        }

        // Prepare context from relevant document sections
        let context = '';
        if (documentInfo) {
            context += `You are answering questions about a document titled "${documentInfo.name}". `;
        }

        context += relevantSections.length
            ? `Here are some relevant sections from the user's document${documentInfo ? '' : 's'}:\n\n${relevantSections.map(section =>
                `From document "${section.documents?.name}":\n${section.content}`).join('\n\n')}`
            : `You are answering questions about a document titled "${documentInfo?.name || 'Unknown'}". I don't have specific sections to show you, but please try to answer based on your general knowledge. If you need more information, ask the user.`;

        // ------------------------------------------------------------------
        // SAFETY: Large contexts can exceed provider limits (e.g. OpenRouter
        // 131k-token cap).  If the context string is extremely long we trim
        // the middle while preserving the beginning (often titles/instructions)
        // and the end (recent relevant sections).  We also inject a note so the
        // model knows that some middle content was omitted.
        // ------------------------------------------------------------------
        // Only OpenRouter has a strict 131k-token limit that we may exceed with very
        // large documents. Other providers (Gemini, OpenAI, etc.) can handle the
        // full context we build.  Therefore we trim ONLY when the request is
        // targeting OpenRouter (either explicitly or via default provider).
        if (provider === 'openrouter') {
            const MAX_CONTEXT_CHARS = 20000; // ~15-20k chars ≈ 6-7k tokens
            if (context.length > MAX_CONTEXT_CHARS) {
                const head = context.slice(0, 10000);
                const tail = context.slice(-5000);
                context = `${head}\n\n[... CONTENT TRIMMED DUE TO SIZE LIMITS ...]\n\n${tail}`;
                console.log('⚠️  Context trimmed for OpenRouter from', context.length, 'to', head.length + tail.length + 60, 'characters');
            }
        }

        // Create or update conversation record
        let conversationRecord;
        let conversationIdToUse = conversation_id;

        if (!conversationIdToUse) {
            // Create new conversation
            const { data: newConversation, error: createError } = await supabase
                .from('conversations')
                .insert({
                    user_id: user.id,
                    document_id: document_id || null,
                    title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
                })
                .select()
                .single();

            if (createError) {
                console.error('Error creating conversation:', createError);
            } else {
                conversationRecord = newConversation;
                conversationIdToUse = newConversation.id;
                console.log(`Created new conversation: ${conversationIdToUse}`);
            }
        } else {
            // Get existing conversation
            const { data: existingConversation, error: getError } = await supabase
                .from('conversations')
                .select('*')
                .eq('id', conversationIdToUse)
                .single();

            if (!getError) {
                conversationRecord = existingConversation;
                console.log(`Using existing conversation: ${conversationIdToUse}`);

                // Update last_message_at timestamp
                await supabase
                    .from('conversations')
                    .update({ last_message_at: new Date().toISOString() })
                    .eq('id', conversationIdToUse);
            } else {
                console.error('Error retrieving conversation:', getError);
            }
        }

        // Prepare messages for AI
        const messages = [
            {
                role: 'system', content: `You are a helpful assistant that answers questions based on the user's documents.

THIS IS THE DOCUMENT CONTENT:
${context}

IMPORTANT INSTRUCTIONS:
1. The above text is the document content you should use to answer questions.
2. If you are asked "what is the document about" or to "explain the context", summarize the document content above.
3. If asked about specific topics in the document, provide that information from the document.
4. CAREFULLY SEARCH the document for any mention of the topic the user is asking about, even if it's only briefly mentioned.
5. If the document mentions a topic but doesn't provide details, tell the user "The document mentions [TOPIC] as [BRIEF CONTEXT], but doesn't provide further details."
6. If a question is related to topics mentioned in the document but requires additional knowledge, you may provide helpful information beyond what's in the document.
7. When providing information not found in the document, clearly indicate: "While this isn't explicitly mentioned in the document, I can tell you that..."
8. DO NOT ask for document content - it has already been provided to you above.
9. DO NOT make up information about what's in the document - be clear about what comes from the document versus your general knowledge.
10. EXCEPTION FOR COMMON KNOWLEDGE: If the user is asking about the meaning of an acronym, abbreviation, or standard terminology that is mentioned in the document but not explained (like "what does SWOT stand for?"), you may provide this common knowledge ONLY IF:
    a) The term or acronym is mentioned in the document but not explained
    b) The meaning is standard, well-established common knowledge (like SWOT = Strengths, Weaknesses, Opportunities, Threats)
    c) You clearly indicate this is supplementary information: "While the document mentions [TERM/ACRONYM] but doesn't explain it, in standard usage it stands for [EXPLANATION]."
11. RELATED KNOWLEDGE HANDLING: If the user seems to be asking about a topic that may be related to the document content:
    a) First check if the document directly addresses the question and provide that information if available
    b) If the document only mentions the topic briefly or indirectly, you may provide additional helpful information beyond what's in the document
    c) Always clearly distinguish between information from the document versus supplementary knowledge
    d) Begin supplementary information with phrases like "While the document doesn't cover this specifically..." or "To add some context beyond what's in the document..."
12. Keep your answers concise and to the point.`
            },
            ...history.map(msg => ({ role: msg.role, content: msg.content })),
            { role: 'user', content: message }
        ];

        // Add detailed logging for debugging
        console.log('🔍 DEBUG - CHAT REQUEST:');
        console.log('📄 Document ID:', document_id || 'None');
        console.log('📄 Document Name:', documentInfo?.name || 'None');
        console.log('📝 Message:', message);
        console.log('📚 History Length:', history.length);
        console.log('🔎 Relevant Sections Found:', relevantSections.length);
        console.log('📋 Context Length:', context.length);
        console.log('📋 Context Preview:', context.substring(0, 500) + (context.length > 500 ? '...' : ''));
        console.log('🤖 Messages being sent to AI:');
        messages.forEach((msg, i) => {
            console.log(`   [${i}] ${msg.role}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
        });

        // Use AI provider manager to get response
        try {
            const aiProvider = aiProviderManager.getProvider(provider);
            const availableProviders = aiProviderManager.getAvailableProvidersWithModels();

            console.log(`Using AI provider: ${aiProvider.id}`);
            if (model) {
                console.log(`Using model: ${model}`);
            }

            const aiResponse = await aiProvider.chat(messages, {
                temperature: 0.7,
                max_tokens: 1000,
                model: model || undefined  // Pass the model if specified
            });

            const aiMessage = aiResponse.content || 'No response from AI service';

            // Log the AI response for debugging
            console.log('🤖 AI RESPONSE:');
            console.log('📝 Content:', aiMessage.substring(0, 500) + (aiMessage.length > 500 ? '...' : ''));
            console.log('🔧 Provider:', aiResponse.provider);
            console.log('🔧 Model:', aiResponse.model);

            // Store messages in the database if we have a conversation ID
            if (conversationIdToUse) {
                // Store user message
                await supabase
                    .from('messages')
                    .insert({
                        conversation_id: conversationIdToUse,
                        content: message,
                        role: 'user',
                        user_id: user.id
                    });

                // Store assistant message
                await supabase
                    .from('messages')
                    .insert({
                        conversation_id: conversationIdToUse,
                        content: aiMessage,
                        role: 'assistant',
                        user_id: user.id
                    });
            }

            const response = {
                id: generateId(),
                message: aiMessage,
                conversation_id: conversationIdToUse,
                document_id: document_id || null,
                document_name: documentInfo?.name || null,
                timestamp: new Date().toISOString(),
                sources: relevantSections?.map(section => ({
                    document_id: section.document_id,
                    document_name: section.documents?.name,
                    content: section.content.substring(0, 150) + '...'
                })) || [],
                provider: aiResponse.provider,
                model: aiResponse.model,
                availableProviders
            };

            res.json(response);
        } catch (aiError) {
            console.error('AI service error:', aiError);

            // Get available providers for error message
            const availableProviders = aiProviderManager.getAvailableProviders();

            if (availableProviders.length === 0) {
                res.status(500).json({
                    error: 'No AI providers configured',
                    details: 'Please configure at least one AI provider in the backend configuration.'
                });
            } else {
                res.status(500).json({
                    error: 'Error communicating with AI service',
                    details: aiError.message,
                    availableProviders
                });
            }
        }
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /chat/providers:
 *   get:
 *     summary: Get available AI providers
 *     description: Retrieve list of configured and available AI providers with their models
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of available AI providers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 providers:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AIProvider'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Get available AI providers
router.get('/providers', async (req, res) => {
    try {
        const authToken = req.headers.authorization?.replace('Bearer ', '');

        if (!authToken) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        // Validate user
        const { user, error: userError } = await validateUser(authToken);
        if (userError || !user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const providers = aiProviderManager.getAvailableProvidersWithModels();
        res.json({ providers });
    } catch (error) {
        console.error('Get providers error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /chat/conversations/{id}:
 *   get:
 *     summary: Get conversation history
 *     description: Retrieve a specific conversation with its message history
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 *         example: "conv_123"
 *     responses:
 *       200:
 *         description: Conversation history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversation_id:
 *                   type: string
 *                   description: Conversation ID
 *                 document_id:
 *                   type: string
 *                   description: Associated document ID
 *                 document_name:
 *                   type: string
 *                   description: Associated document name
 *                 title:
 *                   type: string
 *                   description: Conversation title
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                   description: Conversation creation timestamp
 *                 messages:
 *                   type: array
 *                   description: Conversation messages
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *       400:
 *         description: Failed to retrieve messages
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Conversation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Get conversation history
router.get('/conversations/:id', async (req, res) => {
    try {
        const authToken = req.headers.authorization?.replace('Bearer ', '');

        if (!authToken) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        const supabase = createUserClient(authToken);

        // Get conversation with messages
        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .select('*, documents(name)')
            .eq('id', req.params.id)
            .single();

        if (convError) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Get messages for conversation
        const { data: messages, error: messagesError } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', req.params.id)
            .order('created_at', { ascending: true });

        if (messagesError) {
            return res.status(400).json({ error: 'Failed to retrieve messages' });
        }

        res.json({
            conversation_id: req.params.id,
            document_id: conversation.document_id,
            document_name: conversation.documents?.name,
            title: conversation.title,
            created_at: conversation.created_at,
            messages: messages || [],
        });
    } catch (error) {
        console.error('Get conversation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all conversations for user (optionally filtered by document_id)
router.get('/conversations', async (req, res) => {
    try {
        const authToken = req.headers.authorization?.replace('Bearer ', '');
        const documentId = req.query.document_id;

        if (!authToken) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        const supabase = createUserClient(authToken);

        // Robust auth validation
        const { user, error: userError } = await validateUser(authToken);
        if (userError || !user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // Build query for conversations
        let query = supabase
            .from('conversations')
            .select('*, documents(name)')
            .eq('user_id', user.id)
            .order('last_message_at', { ascending: false });

        // Filter by document_id if provided
        if (documentId) {
            query = query.eq('document_id', documentId);
        }

        const { data: conversations, error: convsError } = await query;

        if (convsError) {
            return res.status(400).json({ error: 'Failed to retrieve conversations' });
        }

        res.json({
            conversations: conversations.map(conv => ({
                id: conv.id,
                title: conv.title,
                created_at: conv.created_at,
                last_message_at: conv.last_message_at,
                document_id: conv.document_id,
                document_name: conv.documents?.name
            }))
        });
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Stream chat response (for real-time responses) - Updated to use AI providers
router.post('/stream', async (req, res) => {
    try {
        const authToken = req.headers.authorization?.replace('Bearer ', '');

        if (!authToken) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        const { message, history = [], provider } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const supabase = createUserClient(authToken);

        // Robust auth validation
        const { user, error: userError } = await validateUser(authToken);
        if (userError || !user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // Search for relevant document sections
        const { data: relevantSections, error: searchError } = await supabase
            .from('document_sections')
            .select('content, document_id, documents(name)')
            .textSearch('content', message.split(' ').filter(w => w.length > 3).join(' & '), {
                type: 'websearch',
                config: 'english'
            })
            .limit(5);

        if (searchError) {
            console.error('Error searching documents:', searchError);
        }

        // Prepare context from relevant document sections
        const context = relevantSections?.length
            ? `Here are some relevant sections from the user's documents:\n\n${relevantSections.map(section =>
                `From document "${section.documents?.name}":\n${section.content}`).join('\n\n')}`
            : 'No relevant documents found.';

        // Prepare messages
        const messages = [
            { role: 'system', content: `You are a helpful assistant that answers questions based on the user's documents. ${context}` },
            ...history.map(msg => ({ role: msg.role, content: msg.content })),
            { role: 'user', content: message }
        ];

        // Set up Server-Sent Events
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control',
        });

        // For now, we'll use non-streaming API and simulate streaming
        // In the future, we can implement true streaming for providers that support it
        try {
            const aiProvider = aiProviderManager.getProvider(provider);
            const aiResponse = await aiProvider.chat(messages, {
                temperature: 0.7,
                max_tokens: 1000
            });

            // Simulate streaming by sending chunks
            const words = aiResponse.content.split(' ');
            for (let i = 0; i < words.length; i++) {
                const chunk = words.slice(i, i + 3).join(' ') + ' ';
                res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
                await new Promise(resolve => setTimeout(resolve, 50)); // Small delay to simulate streaming
            }

            res.write('data: [DONE]\n\n');
            res.end();
        } catch (aiError) {
            console.error('AI streaming error:', aiError);
            res.write('data: ' + JSON.stringify({ error: 'Error communicating with AI service' }) + '\n\n');
            res.end();
        }
    } catch (error) {
        console.error('Stream chat error:', error);
        res.write('data: ' + JSON.stringify({ error: 'Internal server error' }) + '\n\n');
        res.end();
    }
});

// Debug endpoint to check available AI providers
router.get('/debug', async (req, res) => {
    try {
        console.log('🔍 Debug AI providers:');
        console.log('- Default provider:', aiProviderManager.config.defaultProvider);
        console.log('- Config providers:', Object.keys(aiProviderManager.config.providers));
        console.log('- Initialized providers:', Object.keys(aiProviderManager.providers));

        const availableProviders = aiProviderManager.getAvailableProviders();
        console.log('- Available providers:', availableProviders);

        // Check if Gemini is configured properly
        const geminiConfig = aiProviderManager.config.providers.gemini;
        console.log('- Gemini config:', {
            enabled: geminiConfig.enabled,
            hasApiKey: !!geminiConfig.apiKey,
            apiKeyLength: geminiConfig.apiKey?.length || 0,
            models: geminiConfig.models
        });

        // Check environment variables
        console.log('- Environment check:');
        console.log('  GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? `exists (${process.env.GEMINI_API_KEY.length} chars)` : 'not found');

        res.json({
            config: {
                defaultProvider: aiProviderManager.config.defaultProvider,
                configuredProviders: Object.keys(aiProviderManager.config.providers),
                initializedProviders: Object.keys(aiProviderManager.providers),
            },
            availableProviders,
            environment: {
                geminiApiKey: process.env.GEMINI_API_KEY ? `exists (${process.env.GEMINI_API_KEY.length} chars)` : 'not found',
                openaiApiKey: process.env.OPENAI_API_KEY ? 'exists' : 'not found',
                openrouterApiKey: process.env.OPENROUTER_API_KEY ? 'exists' : 'not found',
            }
        });
    } catch (error) {
        console.error('Debug endpoint error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Debug endpoint to test chat directly
router.post('/debug-chat', async (req, res) => {
    try {
        console.log('🔍 DEBUG CHAT TEST ENDPOINT CALLED');
        const { message, context, provider, model } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Create a simple system message with the provided context or default
        const systemContent = context
            ? `You are a helpful assistant. Here is some context about the document:\n\n${context}`
            : 'You are a helpful assistant that answers questions based on the user\'s documents.';

        // Prepare messages for AI
        const messages = [
            { role: 'system', content: systemContent },
            { role: 'user', content: message }
        ];

        // Log what we're sending
        console.log('🔍 DEBUG CHAT TEST:');
        console.log('📝 Message:', message);
        console.log('📋 Context Length:', (context || '').length);
        console.log('📋 Context Preview:', (context || '').substring(0, 500) + ((context || '').length > 500 ? '...' : ''));
        console.log('🤖 Messages being sent to AI:');
        messages.forEach((msg, i) => {
            console.log(`   [${i}] ${msg.role}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
        });

        // Use AI provider manager to get response
        try {
            const aiProvider = aiProviderManager.getProvider(provider);
            console.log(`Using AI provider: ${aiProvider.id}`);

            const aiResponse = await aiProvider.chat(messages, {
                temperature: 0.7,
                max_tokens: 1000,
                model: model || undefined
            });

            const aiMessage = aiResponse.content || 'No response from AI service';

            // Log the response
            console.log('🤖 DEBUG CHAT AI RESPONSE:');
            console.log('📝 Content:', aiMessage);
            console.log('🔧 Provider:', aiResponse.provider);
            console.log('🔧 Model:', aiResponse.model);

            res.json({
                message: aiMessage,
                provider: aiResponse.provider,
                model: aiResponse.model
            });
        } catch (aiError) {
            console.error('AI service error in debug chat:', aiError);
            res.status(500).json({
                error: 'Error communicating with AI service',
                details: aiError.message
            });
        }
    } catch (error) {
        console.error('Debug chat error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Utility function to generate simple IDs
function generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export default router;
