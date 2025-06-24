export const enhancedErrorHandler = (error, req, res, next) => {
    console.error('🔥 Enhanced Error Handler:', error);

    // Handle Multer errors
    if (error instanceof Error && error.message === 'Only PDF files are allowed') {
        return res.status(400).json({
            error: error.message,
            success: false,
            code: 'INVALID_FILE_TYPE'
        });
    }

    // Handle Multer file size errors
    if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            error: 'File too large (max 10MB)',
            success: false,
            code: 'FILE_TOO_LARGE'
        });
    }

    // Handle JSON syntax errors
    if (error instanceof SyntaxError && 'body' in error) {
        return res.status(400).json({
            error: 'Invalid JSON format',
            success: false,
            code: 'INVALID_JSON'
        });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation error',
            details: error.message,
            success: false,
            code: 'VALIDATION_ERROR'
        });
    }

    // Handle AI service errors
    if (error.message.includes('OpenRouter API error')) {
        return res.status(503).json({
            error: 'AI service temporarily unavailable',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later',
            success: false,
            code: 'AI_SERVICE_ERROR'
        });
    }

    // Handle PDF processing errors
    if (error.message.includes('Failed to extract text from PDF')) {
        return res.status(422).json({
            error: 'Unable to process PDF file',
            details: error.message,
            success: false,
            code: 'PDF_PROCESSING_ERROR'
        });
    }

    // Handle Supabase errors
    if (error.message.includes('supabase') || error.code?.startsWith('PGRST')) {
        return res.status(503).json({
            error: 'Database service temporarily unavailable',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later',
            success: false,
            code: 'DATABASE_ERROR'
        });
    }

    // Handle authentication errors
    if (error.status === 401 || error.message.includes('unauthorized')) {
        return res.status(401).json({
            error: 'Authentication required',
            success: false,
            code: 'AUTHENTICATION_ERROR'
        });
    }

    // Handle authorization errors
    if (error.status === 403 || error.message.includes('forbidden')) {
        return res.status(403).json({
            error: 'Access denied',
            success: false,
            code: 'AUTHORIZATION_ERROR'
        });
    }

    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        return res.status(408).json({
            error: 'Request timeout',
            details: 'The operation took too long to complete',
            success: false,
            code: 'TIMEOUT_ERROR'
        });
    }

    // Handle rate limiting errors
    if (error.status === 429) {
        return res.status(429).json({
            error: 'Too many requests',
            details: 'Please wait before making another request',
            success: false,
            code: 'RATE_LIMIT_ERROR'
        });
    }

    // Default error response
    const statusCode = error.status || error.statusCode || 500;

    res.status(statusCode).json({
        error: statusCode === 500 ? 'Internal server error' : (error.message || 'An error occurred'),
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        success: false,
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
    });
}; 