// Debug script to test AI providers directly
import aiProviderManager from './lib/ai-providers.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const LOG_DIR = path.join(__dirname, 'logs');

// Create logs directory if it doesn't exist
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Logger setup
function logToFile(message) {
    const timestamp = new Date().toISOString();
    const logFile = path.join(LOG_DIR, `debug-ai-${new Date().toISOString().split('T')[0]}.log`);
    fs.appendFileSync(logFile, `${timestamp}: ${message}\n`);
    console.log(message);
}

// Sample document content
const sampleDocument = `
# Roman Empire

The Roman Empire was the post-Republican period of ancient Rome. As a polity, it included large territorial holdings around the Mediterranean Sea in Europe, North Africa, and Western Asia, ruled by emperors.

## Military

The Roman military was the most successful and powerful in the Mediterranean region, with a strong navy and highly disciplined soldiers. The Roman legions were the main unit of the army.

## Economy

The economy of the early Roman Empire was largely agrarian and centered in the Mediterranean region. The main exports were wine, olive oil, and garum.

## Culture

Roman culture was heavily influenced by the Greeks. The Romans developed literature, poetry, history, and rhetoric. Latin was the official language of the empire.
`;

// Sample test cases
const testCases = [
    {
        name: 'Basic question about document',
        message: 'What was the Roman Empire?',
        context: sampleDocument
    },
    {
        name: 'Question about military',
        message: 'Tell me about the Roman military.',
        context: sampleDocument
    },
    {
        name: 'Question not in document',
        message: 'Who was Julius Caesar?',
        context: sampleDocument
    }
];

// Function to test AI provider directly
async function testAIProvider(testCase, providerId = null) {
    try {
        logToFile(`\n=== TEST CASE: ${testCase.name} ===`);
        logToFile(`Message: ${testCase.message}`);
        logToFile(`Context: ${testCase.context ? 'Provided' : 'None'}`);
        logToFile(`Provider: ${providerId || 'default'}`);

        // Get the AI provider
        const aiProvider = aiProviderManager.getProvider(providerId);
        logToFile(`Using provider: ${aiProvider.id}`);

        // Prepare messages
        const systemContent = testCase.context
            ? `You are a helpful assistant. Here is some context about the document:\n\n${testCase.context}`
            : 'You are a helpful assistant that answers questions based on the user\'s documents.';

        const messages = [
            { role: 'system', content: systemContent },
            { role: 'user', content: testCase.message }
        ];

        // Log what we're sending
        logToFile('Messages being sent to AI:');
        messages.forEach((msg, i) => {
            logToFile(`[${i}] ${msg.role}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
        });

        // Make the request
        const aiResponse = await aiProvider.chat(messages, {
            temperature: 0.7,
            max_tokens: 1000
        });

        // Log the response
        logToFile(`✅ SUCCESS`);
        logToFile(`Provider: ${aiResponse.provider}`);
        logToFile(`Model: ${aiResponse.model}`);
        logToFile(`Response: ${aiResponse.content}`);

        return aiResponse;
    } catch (error) {
        logToFile(`❌ ERROR: ${error.message}`);
        logToFile(error.stack);
        return { error: error.message };
    }
}

// Run all test cases
async function runTests() {
    logToFile('🧪 STARTING AI PROVIDER TESTS');

    // Get available providers
    const availableProviders = aiProviderManager.getAvailableProviders();
    logToFile(`Available providers: ${JSON.stringify(availableProviders)}`);

    // Test with default provider
    for (const testCase of testCases) {
        await testAIProvider(testCase);
    }

    logToFile('🏁 TESTS COMPLETED');
}

// Run the tests
runTests().catch(error => {
    logToFile(`❌ FATAL ERROR: ${error.message}`);
    logToFile(error.stack);
}); 