import aiService from '../services/aiService.js';
import pdfService from '../services/pdfService.js';

class ProcessingController {
    // Upload and process PDF in one step
    async uploadAndProcessPDF(req, res, next) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            if (!req.file.originalname.toLowerCase().endsWith('.pdf')) {
                return res.status(400).json({ error: 'Only PDF files are allowed' });
            }

            // Extract text from PDF
            const pdfText = await pdfService.extractTextFromPDF(req.file.buffer);

            if (!pdfText.trim()) {
                return res.status(400).json({ error: 'No text found in PDF' });
            }

            // Generate summary
            const summaryPrompt = aiService.createSummaryPrompt(pdfText);
            const summaryResponse = await aiService.callOpenRouterAPI(summaryPrompt);
            const summaryData = aiService.parseJSONResponse(summaryResponse);

            // Generate quiz
            const quizPrompt = aiService.createQuizPrompt(pdfText);
            const quizResponse = await aiService.callOpenRouterAPI(quizPrompt);
            const quizData = aiService.parseJSONResponse(quizResponse);

            // Generate flashcards
            const flashcardsPrompt = aiService.createFlashcardsPrompt(pdfText);
            const flashcardsResponse = await aiService.callOpenRouterAPI(flashcardsPrompt);
            const flashcardsData = aiService.parseJSONResponse(flashcardsResponse);

            const response = {
                summary: summaryData,
                quiz: quizData,
                flashcards: flashcardsData
            };

            res.json(response);
        } catch (error) {
            next(error);
        }
    }

    // Generate summary from text
    async generateSummary(req, res, next) {
        try {
            const { text } = req.body;

            if (!text || !text.trim()) {
                return res.status(400).json({ error: 'Text cannot be empty' });
            }

            const prompt = aiService.createSummaryPrompt(text);
            const response = await aiService.callOpenRouterAPI(prompt);
            const data = aiService.parseJSONResponse(response);

            res.json(data);
        } catch (error) {
            next(error);
        }
    }

    // Generate quiz from text
    async generateQuiz(req, res, next) {
        try {
            const { text } = req.body;

            if (!text || !text.trim()) {
                return res.status(400).json({ error: 'Text cannot be empty' });
            }

            const prompt = aiService.createQuizPrompt(text);
            const response = await aiService.callOpenRouterAPI(prompt);
            const data = aiService.parseJSONResponse(response);

            res.json(data);
        } catch (error) {
            next(error);
        }
    }

    // Generate flashcards from text
    async generateFlashcards(req, res, next) {
        try {
            const { text } = req.body;

            if (!text || !text.trim()) {
                return res.status(400).json({ error: 'Text cannot be empty' });
            }

            const prompt = aiService.createFlashcardsPrompt(text);
            const response = await aiService.callOpenRouterAPI(prompt);
            const data = aiService.parseJSONResponse(response);

            res.json(data);
        } catch (error) {
            next(error);
        }
    }
}

export default new ProcessingController();
