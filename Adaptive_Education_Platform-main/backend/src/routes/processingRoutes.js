import express from 'express';
import multer from 'multer';
import processingController from '../controllers/processingController.js';

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

// Processing endpoints
router.post('/upload-pdf', upload.single('file'), processingController.uploadAndProcessPDF);
router.post('/generate-summary', processingController.generateSummary);
router.post('/generate-quiz', processingController.generateQuiz);
router.post('/generate-flashcards', processingController.generateFlashcards);

export default router;
