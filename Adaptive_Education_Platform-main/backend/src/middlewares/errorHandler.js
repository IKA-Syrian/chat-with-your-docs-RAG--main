export const errorHandler = (error, req, res, next) => {
    console.error('🔥 Error:', error);

    // Handle Multer errors
    if (error instanceof Error && error.message === 'Only PDF files are allowed') {
        return res.status(400).json({ error: error.message });
    }

    // Handle JSON syntax errors
    if (error instanceof SyntaxError && 'body' in error) {
        return res.status(400).json({ error: 'Invalid JSON format' });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation error',
            details: error.message
        });
    }

    // Default error response
    res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
};
