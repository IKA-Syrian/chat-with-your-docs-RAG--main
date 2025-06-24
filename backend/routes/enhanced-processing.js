import express from 'express';
import multer from 'multer';
import enhancedProcessingController from '../controllers/enhancedProcessingController.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'));
        }
    }
});

// Enhanced PDF processing with educational content generation
router.post('/upload-pdf', upload.single('file'), enhancedProcessingController.uploadAndProcessPDF);

// Individual content generation endpoints
router.post('/generate/summary', enhancedProcessingController.generateSummary);
router.post('/generate/quiz', enhancedProcessingController.generateQuiz);
router.post('/generate/flashcards', enhancedProcessingController.generateFlashcards);
router.post('/generate/all', enhancedProcessingController.generateAllEducationalContent);

// Document management
router.get('/documents', enhancedProcessingController.listDocuments);
router.get('/document/:document_id', enhancedProcessingController.getDocumentEducationalContent);
router.delete('/document/:document_id', enhancedProcessingController.deleteDocument);

// Legacy compatibility endpoints
router.post('/upload-and-process', upload.single('file'), enhancedProcessingController.uploadAndProcessPDF);
router.post('/generate-summary', enhancedProcessingController.generateSummary);
router.post('/generate-quiz', enhancedProcessingController.generateQuiz);
router.post('/generate-flashcards', enhancedProcessingController.generateFlashcards);

export default router; 