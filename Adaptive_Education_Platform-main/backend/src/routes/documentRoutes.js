import express from 'express';
import multer from 'multer';
import documentController from '../controllers/documentController.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Document management endpoints
router.post('/documents/upload', upload.single('pdf'), documentController.uploadDocument);
router.post('/documents/:document_id/process', documentController.processDocument);
router.get('/documents', documentController.getDocuments);
router.get('/documents/:document_id', documentController.getDocument);

export default router;
