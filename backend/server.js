// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import authRoutes from './routes/auth.js';
import documentsRoutes from './routes/documents.js';
import chatRoutes from './routes/chat.js';
import embedRoutes from './routes/embed.js';
import processRoutes from './routes/process.js';
import testRoutes from './routes/test.js';

// Import enhanced routes
import analyticsRoutes from './routes/analytics.js';
import enhancedProcessingRoutes from './routes/enhanced-processing.js';
import flashcardsRoutes from './routes/flashcards.js';
import urlIngestRoutes from './routes/url-ingest.js';
import mistakesRoutes from './routes/mistakes.js';

// Import enhanced error handler
import { enhancedErrorHandler } from './lib/enhanced-error-handler.js';

// Import Swagger configuration
import swaggerSpecs from './config/swagger.js';
import swaggerUi from 'swagger-ui-express';

const app = express();
const PORT = process.env.PORT || 3001;

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rate limiting configurations
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Increased from 100 to 1000 requests per windowMs for general routes
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// More lenient rate limiting for authentication routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Allow 50 authentication attempts per 15 minutes
    message: {
        error: 'Too many authentication attempts from this IP, please try again later.',
        retryAfter: Math.ceil(15 * 60 / 60) // Retry after in minutes
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip successful requests from counting against the limit
    skipSuccessfulRequests: true,
});

// Very lenient rate limiting for chat routes (they need more requests)
const chatLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Allow more chat messages
    message: 'Too many chat requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for debug tools
}));
app.use(compression());
app.use(morgan('combined'));
// Note: We'll apply rate limiting per route instead of globally

// CORS configuration - fixed to properly handle all origins and ports
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // Check if CORS_ORIGINS is set to '*' to allow all origins
        if (process.env.CORS_ORIGINS === '*') {
            console.log('🌍 CORS: Allowing all origins (*)');
            return callback(null, true);
        }

        // Parse CORS_ORIGINS from environment
        const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()) || [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3002',
            'http://localhost:3003'
        ];

        console.log('🌍 CORS: Checking origin:', origin);
        console.log('🌍 CORS: Allowed origins:', allowedOrigins);

        if (allowedOrigins.includes(origin)) {
            console.log('✅ CORS: Origin allowed');
            return callback(null, true);
        }

        console.log('❌ CORS: Origin not allowed');
        const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));

// Additional middleware to ensure CORS headers are always present
app.use((req, res, next) => {
    const origin = req.headers.origin;

    // Always set CORS headers for preflight and actual requests
    if (process.env.CORS_ORIGINS === '*') {
        res.header('Access-Control-Allow-Origin', origin || '*');
    } else {
        const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()) || [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3002',
            'http://localhost:3003'
        ];

        if (!origin || allowedOrigins.includes(origin)) {
            res.header('Access-Control-Allow-Origin', origin || allowedOrigins[0]);
        }
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        console.log('🔄 Handling preflight request from:', origin);
        return res.sendStatus(200);
    }

    next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Chat with Your Documents API',
    swaggerOptions: {
        docExpansion: 'list',
        filter: true,
        showRequestDuration: true,
    },
}));

// Swagger JSON endpoint
app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpecs);
});

// Debug route
app.get('/debug', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'debug.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// API routes with appropriate rate limiting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/documents', generalLimiter, documentsRoutes);
app.use('/api/chat', chatLimiter, chatRoutes);
app.use('/api/embed', generalLimiter, embedRoutes);
app.use('/api/process', generalLimiter, processRoutes);
app.use('/api/test', generalLimiter, testRoutes);

// Enhanced API routes
app.use('/api/analytics', generalLimiter, analyticsRoutes);
app.use('/api/enhanced-processing', generalLimiter, enhancedProcessingRoutes);
app.use('/api/flashcards', generalLimiter, flashcardsRoutes);
app.use('/api/documents', generalLimiter, urlIngestRoutes);
app.use('/api/mistakes', generalLimiter, mistakesRoutes);

// Health check also available under API path
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// Apply general rate limiting to any remaining API routes
app.use('/api/*', generalLimiter);

// Enhanced error handling middleware
app.use(enhancedErrorHandler);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Enhanced RAG Backend server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
    console.log(`📄 API Spec (JSON): http://localhost:${PORT}/api-docs.json`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌍 CORS Origins: ${process.env.CORS_ORIGINS || 'default localhost ports'}`);
    console.log(`🎓 Features: RAG Chat, Document Processing, Analytics, Quiz Generation, Flashcards`);
    console.log(`🤖 AI Services: OpenAI, Google AI, OpenRouter`);
});

export default app;
