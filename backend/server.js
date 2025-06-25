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

// Import enhanced error handler
import { enhancedErrorHandler } from './lib/enhanced-error-handler.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
});

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for debug tools
}));
app.use(compression());
app.use(morgan('combined'));
app.use(limiter);

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

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/embed', embedRoutes);
app.use('/api/process', processRoutes);
app.use('/api/test', testRoutes);

// Enhanced API routes
app.use('/api/analytics', analyticsRoutes);
app.use('/api/enhanced-processing', enhancedProcessingRoutes);

// Health check also available under API path
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

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
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌍 CORS Origins: ${process.env.CORS_ORIGINS || 'default localhost ports'}`);
    console.log(`🎓 Features: RAG Chat, Document Processing, Analytics, Quiz Generation, Flashcards`);
    console.log(`🤖 AI Services: OpenAI, Google AI, OpenRouter`);
});

export default app;
