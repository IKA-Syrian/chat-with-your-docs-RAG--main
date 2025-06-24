// Debug script to test chat functionality
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const API_URL = 'http://localhost:3001/api';
const LOG_DIR = path.join(__dirname, 'logs');

// Create logs directory if it doesn't exist
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Logger setup
function logToFile(message) {
    const timestamp = new Date().toISOString();
    const logFile = path.join(LOG_DIR, `debug-chat-${new Date().toISOString().split('T')[0]}.log`);
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
    },
    {
        name: 'No context provided',
        message: 'What is the Roman Empire?',
        context: null
    }
];

// Function to test the debug-chat endpoint
async function testDebugChat(testCase) {
    try {
        logToFile(`\n=== TEST CASE: ${testCase.name} ===`);
        logToFile(`Message: ${testCase.message}`);
        logToFile(`Context: ${testCase.context ? 'Provided' : 'None'}`);

        const response = await fetch(`${API_URL}/chat/debug-chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer dummy-token' // Not needed for debug endpoint
            },
            body: JSON.stringify({
                message: testCase.message,
                context: testCase.context
            })
        });

        const data = await response.json();

        if (response.ok) {
            logToFile(`✅ SUCCESS: Status ${response.status}`);
            logToFile(`Provider: ${data.provider}`);
            logToFile(`Model: ${data.model}`);
            logToFile(`Response: ${data.message}`);
        } else {
            logToFile(`❌ ERROR: Status ${response.status}`);
            logToFile(JSON.stringify(data, null, 2));
        }
    } catch (error) {
        logToFile(`❌ EXCEPTION: ${error.message}`);
    }
}

// Run all test cases
async function runTests() {
    logToFile('🧪 STARTING DEBUG CHAT TESTS');

    for (const testCase of testCases) {
        await testDebugChat(testCase);
    }

    logToFile('🏁 TESTS COMPLETED');
}

// Run the tests
runTests().catch(error => {
    logToFile(`❌ FATAL ERROR: ${error.message}`);
}); 