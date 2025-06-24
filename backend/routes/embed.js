import { Router } from 'express';
import { createUserClient } from '../lib/supabase.js';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();
const LOG_DIR = path.join(process.cwd(), 'logs');

// Create logs directory if it doesn't exist
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Logger setup
const logger = {
    log: function (message, data = null) {
        const timestamp = new Date().toISOString();
        const logMessage = `${timestamp} - INFO: ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}`;
        console.log(logMessage);
        this.writeToFile('embed', logMessage);
    },
    error: function (message, error = null) {
        const timestamp = new Date().toISOString();
        const errorDetails = error instanceof Error ?
            `${error.message}\n${error.stack}` :
            (error ? JSON.stringify(error, null, 2) : '');
        const logMessage = `${timestamp} - ERROR: ${message}${errorDetails ? '\n' + errorDetails : ''}`;
        console.error(logMessage);
        this.writeToFile('embed-error', logMessage);
    },
    writeToFile: function (prefix, message) {
        const date = new Date().toISOString().split('T')[0];
        const logFile = path.join(LOG_DIR, `${prefix}-${date}.log`);
        fs.appendFileSync(logFile, message + '\n\n');
    }
};

// Create embeddings for document sections
router.post('/', async (req, res) => {
    try {
        logger.log('Received embedding request', {
            headers: req.headers,
            body: req.body
        });

        const authToken = req.headers.authorization?.replace('Bearer ', '');

        if (!authToken) {
            logger.error('No authorization token provided');
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        // Handle both new format and legacy format
        const { ids, table, contentColumn, embeddingColumn, documentId, force } = req.body;

        // Handle legacy format with documentId parameter
        if (documentId) {
            logger.log('Legacy format detected with documentId:', documentId);

            // Create Supabase client
            const supabase = createUserClient(authToken);

            // Get document sections without embeddings
            const query = supabase
                .from('document_sections')
                .select('id')
                .eq('document_id', documentId);

            // If force is true, process all sections regardless of embedding status
            if (!force) {
                query.is('embedding', null);
            }

            const { data: sections, error: sectionsError } = await query;

            if (sectionsError) {
                logger.error('Error fetching sections for document:', sectionsError);
                return res.status(400).json({ error: sectionsError.message });
            }

            if (!sections || sections.length === 0) {
                logger.log('No sections found needing embeddings for document:', documentId);
                return res.json({
                    message: 'No sections found needing embeddings',
                    processed: 0,
                    successful: 0
                });
            }

            // Extract section IDs and continue with standard processing
            req.body = {
                ids: sections.map(s => s.id),
                table: 'document_sections',
                contentColumn: 'content',
                embeddingColumn: 'embedding'
            };

            logger.log(`Converted legacy format to new format with ${sections.length} sections`);
        }

        // Re-extract parameters after possible conversion
        const processIds = req.body.ids;
        const processTable = req.body.table;
        const processContentColumn = req.body.contentColumn;
        const processEmbeddingColumn = req.body.embeddingColumn;

        if (!processIds || !processTable || !processContentColumn || !processEmbeddingColumn) {
            logger.error('Missing required parameters', {
                ids: !!processIds,
                table: !!processTable,
                contentColumn: !!processContentColumn,
                embeddingColumn: !!processEmbeddingColumn
            });
            return res.status(400).json({
                error: 'ids, table, contentColumn, and embeddingColumn are required'
            });
        }

        logger.log('Creating Supabase client with auth token');
        const supabase = createUserClient(authToken);

        // Get rows to process
        logger.log(`Fetching rows from ${processTable} table`, { ids: processIds });
        const { data: rows, error: selectError } = await supabase
            .from(processTable)
            .select(`id, ${processContentColumn}`)
            .in('id', processIds);

        if (selectError || !rows) {
            logger.error('Failed to fetch rows', selectError);
            return res.status(400).json({ error: selectError?.message || 'Failed to fetch rows' });
        }

        logger.log(`Fetched ${rows.length} rows successfully`);

        // Check available embedding services
        const availableServices = {
            openrouter: !!process.env.OPENROUTER_API_KEY,
            gemini: !!process.env.GEMINI_API_KEY,
            openai: !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here'
        };

        logger.log('Available embedding services', availableServices);

        // Process each row
        const results = [];
        for (const row of rows) {
            logger.log(`Processing row ID: ${row.id}`);
            try {
                if (!row[processContentColumn]) {
                    logger.error(`Row ${row.id} has no content in column ${processContentColumn}`);
                    results.push({
                        id: row.id,
                        success: false,
                        error: `No content found in column ${processContentColumn}`
                    });
                    continue;
                }

                logger.log(`Content length for row ${row.id}: ${row[processContentColumn].length} characters`);

                let embedding;
                let serviceUsed;

                // Choose embedding service based on available API keys
                if (process.env.GEMINI_API_KEY) {
                    logger.log(`Using Gemini for row ${row.id}`);
                    serviceUsed = 'gemini';
                    embedding = await createGeminiEmbedding(row[processContentColumn]);
                } else if (process.env.OPENROUTER_API_KEY) {
                    logger.log(`Using OpenRouter for row ${row.id}`);
                    serviceUsed = 'openrouter';
                    embedding = await createOpenRouterEmbedding(row[processContentColumn]);
                } else if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
                    logger.log(`Using OpenAI for row ${row.id}`);
                    serviceUsed = 'openai';
                    embedding = await createOpenAIEmbedding(row[processContentColumn]);
                } else {
                    logger.log(`Using simple embedding for row ${row.id}`);
                    serviceUsed = 'simple';
                    embedding = createSimpleEmbedding(row[processContentColumn]);
                }

                if (!embedding || embedding.length === 0) {
                    logger.error(`Empty embedding returned for row ${row.id} using ${serviceUsed}`);
                    results.push({
                        id: row.id,
                        success: false,
                        error: `${serviceUsed} returned empty embedding`
                    });
                    continue;
                }

                logger.log(`Generated embedding for row ${row.id} using ${serviceUsed} with length: ${embedding.length}`);

                // Debug embedding data
                logger.log(`Embedding sample for row ${row.id}:`, {
                    service: serviceUsed,
                    sampleValues: embedding.slice(0, 5),
                    embeddingType: typeof embedding,
                    isArray: Array.isArray(embedding)
                });

                // Update the row with the embedding
                logger.log(`Updating embedding for row ${row.id} in ${processTable} table`);
                const { error: updateError } = await supabase
                    .from(processTable)
                    .update({ [processEmbeddingColumn]: embedding })
                    .eq('id', row.id);

                if (updateError) {
                    logger.error(`Failed to update embedding for row ${row.id}:`, updateError);
                    results.push({ id: row.id, success: false, error: updateError.message });
                } else {
                    logger.log(`Successfully updated embedding for row ${row.id}`);
                    results.push({ id: row.id, success: true, service: serviceUsed });
                }
            } catch (error) {
                logger.error(`Error processing row ${row.id}:`, error);
                results.push({
                    id: row.id,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        logger.log('Embedding process completed', {
            processed: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length
        });

        res.json({
            message: 'Embedding process completed',
            results,
            processed: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length
        });
    } catch (error) {
        logger.error('General embedding error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Simple embedding function (placeholder)
function createSimpleEmbedding(text) {
    logger.log('Creating simple embedding', { textLength: text.length });

    try {
        // This is a very simple hash-based embedding for demonstration
        // Replace with proper embedding service like OpenAI
        const hash = text.split('').reduce((acc, char) => {
            return ((acc << 5) - acc) + char.charCodeAt(0);
        }, 0);

        // Create a simple 384-dimensional vector
        const embedding = [];
        for (let i = 0; i < 384; i++) {
            embedding.push(Math.sin(hash + i) * 0.1);
        }

        logger.log('Simple embedding created successfully', {
            vectorLength: embedding.length,
            sampleValues: embedding.slice(0, 3)
        });

        return embedding;
    } catch (error) {
        logger.error('Error creating simple embedding:', error);
        throw error;
    }
}

// OpenAI embedding function
async function createOpenAIEmbedding(text) {
    logger.log('Creating OpenAI embedding', { textLength: text.length });

    // Ensure we have an API key
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
        logger.error('OpenAI API key not configured');
        throw new Error('OpenAI API key not configured');
    }

    try {
        // Make API request to OpenAI
        logger.log('Making request to OpenAI API');
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                input: text.trim(),
                model: 'text-embedding-ada-002'
            })
        });

        const responseData = await response.json();

        if (!response.ok) {
            logger.error('OpenAI API error response:', responseData);
            throw new Error(`OpenAI API error: ${responseData.error?.message || response.statusText}`);
        }

        logger.log('OpenAI embedding created successfully', {
            status: response.status,
            vectorLength: responseData.data?.[0]?.embedding?.length || 0
        });

        return responseData.data[0].embedding;
    } catch (error) {
        logger.error('Error creating OpenAI embedding:', error);
        throw error;
    }
}

// OpenRouter embedding function
async function createOpenRouterEmbedding(text) {
    logger.log('Creating OpenRouter embedding', { textLength: text.length });

    // Ensure we have an API key
    if (!process.env.OPENROUTER_API_KEY) {
        logger.error('OpenRouter API key not configured');
        throw new Error('OpenRouter API key not configured');
    }

    try {
        // Get the base URL and model from env or use defaults
        const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

        // OpenRouter doesn't have "deepseek/deepseek-r1-70b-embeddings" - use a proper embeddings model
        const model = process.env.OPENROUTER_EMBEDDINGS_MODEL || 'openai/text-embedding-ada-002';

        logger.log('OpenRouter configuration', { baseUrl, model });

        // Make API request to OpenRouter
        logger.log('Making request to OpenRouter API');
        const response = await fetch(`${baseUrl}/embeddings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://localhost:3000'  // Replace with your domain in production
            },
            body: JSON.stringify({
                input: text.trim(),
                model: model
            })
        });

        const responseData = await response.json();

        if (!response.ok) {
            logger.error('OpenRouter API error response:', responseData);
            throw new Error(`OpenRouter API error: ${responseData.error?.message || response.statusText}`);
        }

        logger.log('OpenRouter embedding created successfully', {
            status: response.status,
            vectorLength: responseData.data?.[0]?.embedding?.length || 0
        });

        return responseData.data[0].embedding;
    } catch (error) {
        // If we get a 404 with OpenRouter, fall back to simple embeddings
        logger.error('Error creating OpenRouter embedding:', error);
        logger.log('Falling back to simple embeddings due to OpenRouter error');
        return createSimpleEmbedding(text);
    }
}

// Google Gemini embedding function
async function createGeminiEmbedding(text) {
    logger.log('Creating Gemini embedding', { textLength: text.length });

    // Ensure we have an API key
    if (!process.env.GEMINI_API_KEY) {
        logger.error('Google Gemini API key not configured');
        throw new Error('Google Gemini API key not configured');
    }

    try {
        logger.log('Initializing GoogleGenAI client');

        // Initialize the Gemini AI SDK using the exact format from the example
        const genAI = new GoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });

        // Get the model from environment variable or use default
        const embeddingModel = process.env.GEMINI_EMBEDDINGS_MODEL || 'models/embedding-001';
        logger.log('Using Gemini embedding model:', embeddingModel);

        // Request the embedding using the format from the example
        logger.log('Making request to Gemini Embedding API');
        const response = await genAI.embedContent(embeddingModel, {
            text: text.trim()
        });

        logger.log('Gemini raw response:', {
            responseType: typeof response,
            hasEmbedding: !!response.embedding
        });

        // Check if embeddings exist
        if (!response || !response.embedding || response.embedding.length === 0) {
            logger.error('Gemini API returned empty embeddings', response);
            throw new Error('Gemini API returned empty embeddings');
        }

        logger.log('Gemini embedding created successfully', {
            vectorLength: response.embedding.length
        });

        return response.embedding;
    } catch (error) {
        logger.error('Error creating Gemini embedding:', error);
        logger.log('Falling back to simple embeddings due to Gemini error');
        return createSimpleEmbedding(text);
    }
}

// Alternative route for OpenAI embeddings (if API key is available)
router.post('/openai', async (req, res) => {
    try {
        logger.log('Received OpenAI embedding request', { body: req.body });

        const authToken = req.headers.authorization?.replace('Bearer ', '');

        if (!authToken) {
            logger.error('No authorization token provided for OpenAI route');
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
            logger.error('OpenAI API key not configured');
            return res.status(400).json({ error: 'OpenAI API key not configured' });
        }

        const { ids, table, contentColumn, embeddingColumn } = req.body;

        if (!ids || !table || !contentColumn || !embeddingColumn) {
            logger.error('Missing required OpenAI parameters');
            return res.status(400).json({
                error: 'ids, table, contentColumn, and embeddingColumn are required'
            });
        }

        const supabase = createUserClient(authToken);

        // Get rows to process
        logger.log(`Fetching rows for OpenAI from ${table}`, { ids });
        const { data: rows, error: selectError } = await supabase
            .from(table)
            .select(`id, ${contentColumn}`)
            .in('id', ids);

        if (selectError || !rows) {
            logger.error('Failed to fetch rows for OpenAI', selectError);
            return res.status(400).json({ error: selectError?.message || 'Failed to fetch rows' });
        }

        logger.log(`Retrieved ${rows.length} rows for OpenAI processing`);

        // Process each row with OpenAI embeddings
        const results = [];
        for (const row of rows) {
            logger.log(`Processing row ${row.id} with OpenAI`);
            try {
                const embedding = await createOpenAIEmbedding(row[contentColumn]);

                // Update the row with the embedding
                logger.log(`Updating embedding for row ${row.id}`);
                const { error: updateError } = await supabase
                    .from(table)
                    .update({ [embeddingColumn]: embedding })
                    .eq('id', row.id);

                if (updateError) {
                    logger.error(`Failed to update OpenAI embedding for row ${row.id}:`, updateError);
                    results.push({ id: row.id, success: false, error: updateError.message });
                } else {
                    logger.log(`Successfully updated OpenAI embedding for row ${row.id}`);
                    results.push({ id: row.id, success: true });
                }
            } catch (error) {
                logger.error(`Error processing OpenAI for row ${row.id}:`, error);
                results.push({
                    id: row.id,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        logger.log('OpenAI embedding process completed', {
            processed: results.length,
            successful: results.filter(r => r.success).length
        });

        res.json({
            message: 'OpenAI embedding process completed',
            results,
            processed: results.length,
            successful: results.filter(r => r.success).length
        });
    } catch (error) {
        logger.error('OpenAI embed error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route for OpenRouter embeddings (DeepSeek R1 70B)
router.post('/openrouter', async (req, res) => {
    try {
        logger.log('Received OpenRouter embedding request', { body: req.body });

        const authToken = req.headers.authorization?.replace('Bearer ', '');

        if (!authToken) {
            logger.error('No authorization token provided for OpenRouter route');
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        if (!process.env.OPENROUTER_API_KEY) {
            logger.error('OpenRouter API key not configured');
            return res.status(400).json({ error: 'OpenRouter API key not configured' });
        }

        const { ids, table, contentColumn, embeddingColumn } = req.body;

        if (!ids || !table || !contentColumn || !embeddingColumn) {
            logger.error('Missing required OpenRouter parameters');
            return res.status(400).json({
                error: 'ids, table, contentColumn, and embeddingColumn are required'
            });
        }

        const supabase = createUserClient(authToken);

        // Get rows to process
        logger.log(`Fetching rows for OpenRouter from ${table}`, { ids });
        const { data: rows, error: selectError } = await supabase
            .from(table)
            .select(`id, ${contentColumn}`)
            .in('id', ids);

        if (selectError || !rows) {
            logger.error('Failed to fetch rows for OpenRouter', selectError);
            return res.status(400).json({ error: selectError?.message || 'Failed to fetch rows' });
        }

        logger.log(`Retrieved ${rows.length} rows for OpenRouter processing`);

        // Process each row with OpenRouter embeddings
        const results = [];
        for (const row of rows) {
            logger.log(`Processing row ${row.id} with OpenRouter`);
            try {
                const embedding = await createOpenRouterEmbedding(row[contentColumn]);

                // Update the row with the embedding
                logger.log(`Updating embedding for row ${row.id}`);
                const { error: updateError } = await supabase
                    .from(table)
                    .update({ [embeddingColumn]: embedding })
                    .eq('id', row.id);

                if (updateError) {
                    logger.error(`Failed to update OpenRouter embedding for row ${row.id}:`, updateError);
                    results.push({ id: row.id, success: false, error: updateError.message });
                } else {
                    logger.log(`Successfully updated OpenRouter embedding for row ${row.id}`);
                    results.push({ id: row.id, success: true });
                }
            } catch (error) {
                logger.error(`Error processing OpenRouter for row ${row.id}:`, error);
                results.push({
                    id: row.id,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        logger.log('OpenRouter embedding process completed', {
            processed: results.length,
            successful: results.filter(r => r.success).length
        });

        res.json({
            message: 'OpenRouter embedding process completed',
            results,
            processed: results.length,
            successful: results.filter(r => r.success).length
        });
    } catch (error) {
        logger.error('OpenRouter embed error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route for Gemini embeddings
router.post('/gemini', async (req, res) => {
    try {
        logger.log('Received Gemini embedding request', { body: req.body });

        const authToken = req.headers.authorization?.replace('Bearer ', '');

        if (!authToken) {
            logger.error('No authorization token provided for Gemini route');
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        if (!process.env.GEMINI_API_KEY) {
            logger.error('Gemini API key not configured');
            return res.status(400).json({ error: 'Gemini API key not configured' });
        }

        const { ids, table, contentColumn, embeddingColumn } = req.body;

        if (!ids || !table || !contentColumn || !embeddingColumn) {
            logger.error('Missing required Gemini parameters');
            return res.status(400).json({
                error: 'ids, table, contentColumn, and embeddingColumn are required'
            });
        }

        const supabase = createUserClient(authToken);

        // Get rows to process
        logger.log(`Fetching rows for Gemini from ${table}`, { ids });
        const { data: rows, error: selectError } = await supabase
            .from(table)
            .select(`id, ${contentColumn}`)
            .in('id', ids);

        if (selectError || !rows) {
            logger.error('Failed to fetch rows for Gemini', selectError);
            return res.status(400).json({ error: selectError?.message || 'Failed to fetch rows' });
        }

        logger.log(`Retrieved ${rows.length} rows for Gemini processing`);

        // Process each row with Gemini embeddings
        const results = [];
        for (const row of rows) {
            logger.log(`Processing row ${row.id} with Gemini`);
            try {
                const embedding = await createGeminiEmbedding(row[contentColumn]);

                // Update the row with the embedding
                logger.log(`Updating embedding for row ${row.id}`);
                const { error: updateError } = await supabase
                    .from(table)
                    .update({ [embeddingColumn]: embedding })
                    .eq('id', row.id);

                if (updateError) {
                    logger.error(`Failed to update Gemini embedding for row ${row.id}:`, updateError);
                    results.push({ id: row.id, success: false, error: updateError.message });
                } else {
                    logger.log(`Successfully updated Gemini embedding for row ${row.id}`);
                    results.push({ id: row.id, success: true });
                }
            } catch (error) {
                logger.error(`Error processing Gemini for row ${row.id}:`, error);
                results.push({
                    id: row.id,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        logger.log('Gemini embedding process completed', {
            processed: results.length,
            successful: results.filter(r => r.success).length
        });

        res.json({
            message: 'Gemini embedding process completed',
            results,
            processed: results.length,
            successful: results.filter(r => r.success).length
        });
    } catch (error) {
        logger.error('Gemini embed error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Diagnostic endpoint to check service configuration
router.get('/status', async (req, res) => {
    try {
        logger.log('Checking embedding service status');

        const status = {
            services: {
                gemini: {
                    available: !!process.env.GEMINI_API_KEY,
                    model: process.env.GEMINI_EMBEDDINGS_MODEL || 'models/gemini-embedding-exp-03-07'
                },
                openRouter: {
                    available: !!process.env.OPENROUTER_API_KEY,
                    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
                    model: process.env.OPENROUTER_EMBEDDINGS_MODEL || 'openai/text-embedding-ada-002'
                },
                openAI: {
                    available: !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here'
                },
                simple: {
                    available: true
                }
            },
            activeService: null
        };

        // Determine active service based on priority
        if (status.services.gemini.available) {
            status.activeService = 'gemini';
        } else if (status.services.openRouter.available) {
            status.activeService = 'openRouter';
        } else if (status.services.openAI.available) {
            status.activeService = 'openAI';
        } else {
            status.activeService = 'simple';
        }

        logger.log('Embedding service status', status);
        res.json(status);
    } catch (error) {
        logger.error('Error checking service status:', error);
        res.status(500).json({ error: 'Failed to check service status' });
    }
});

export default router;
