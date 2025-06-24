import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Import routes
import processingRoutes from './routes/processingRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import { errorHandler } from './middlewares/errorHandler.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        "http://127.0.0.1:3003"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["*"]
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api', processingRoutes);
app.use('/api', documentRoutes);
app.use('/api', analyticsRoutes);

// Health check
app.get('/ping', (req, res) => {
    res.json({ message: 'pong', status: 'success' });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        model: 'deepseek/deepseek-r1-distill-llama-70b:free',
        environment: process.env.NODE_ENV || 'development'
    });
});

app.get('/test', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is connected successfully' });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🤖 AI Model: deepseek/deepseek-r1-distill-llama-70b:free`);
});
