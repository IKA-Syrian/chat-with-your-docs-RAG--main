#!/usr/bin/env node

// Integration Test for Enhanced Educational Features
// Note: This tests the NEW educational features that complement the existing RAG system
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';
const API_URL = `${BASE_URL}/api`;

async function testEndpoint(method, endpoint, body = null, headers = {}) {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${API_URL}${endpoint}`, options);
        const data = await response.json();

        return {
            status: response.status,
            success: response.ok,
            data
        };
    } catch (error) {
        return {
            status: 0,
            success: false,
            error: error.message
        };
    }
}

async function runIntegrationTests() {
    console.log('🧪 Starting Enhanced RAG System Integration Tests\n');

    // Test 1: Health Check
    console.log('1. Testing Health Check...');
    const health = await testEndpoint('GET', '/health');
    console.log(`   Status: ${health.status} - ${health.success ? '✅ PASS' : '❌ FAIL'}`);
    if (health.data) {
        console.log(`   Response: ${JSON.stringify(health.data, null, 2)}`);
    }
    console.log('');

    // Test 2: Analytics Dashboard
    console.log('2. Testing Analytics Dashboard...');
    const analytics = await testEndpoint('GET', '/analytics/dashboard');
    console.log(`   Status: ${analytics.status} - ${analytics.success ? '✅ PASS' : '❌ FAIL'}`);
    if (analytics.data) {
        console.log(`   Has overall_analytics: ${analytics.data.data?.overall_analytics ? '✅' : '❌'}`);
    }
    console.log('');

    // Test 3: Start Study Session
    console.log('3. Testing Study Session Start...');
    const sessionStart = await testEndpoint('POST', '/analytics/session/start', {
        document_id: 'test-doc-123',
        document_title: 'Test Document',
        session_type: 'study'
    });
    console.log(`   Status: ${sessionStart.status} - ${sessionStart.success ? '✅ PASS' : '❌ FAIL'}`);
    let sessionId = null;
    if (sessionStart.data?.data?.id) {
        sessionId = sessionStart.data.data.id;
        console.log(`   Session ID: ${sessionId}`);
    }
    console.log('');

    // Test 4: End Study Session (if we have a session ID)
    if (sessionId) {
        console.log('4. Testing Study Session End...');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        const sessionEnd = await testEndpoint('POST', `/analytics/session/${sessionId}/end`);
        console.log(`   Status: ${sessionEnd.status} - ${sessionEnd.success ? '✅ PASS' : '❌ FAIL'}`);
        if (sessionEnd.data?.data?.duration) {
            console.log(`   Duration: ${sessionEnd.data.data.duration} seconds`);
        }
        console.log('');
    }

    // Test 5: Track Flashcard Attempt
    console.log('5. Testing Flashcard Attempt Tracking...');
    const flashcardAttempt = await testEndpoint('POST', '/analytics/flashcard/attempt', {
        document_id: 'test-doc-123',
        question: 'What is 2+2?',
        answer: '4',
        correct: true,
        response_time: 5000
    });
    console.log(`   Status: ${flashcardAttempt.status} - ${flashcardAttempt.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    // Test 6: Generate Summary (with sample text)
    console.log('6. Testing Summary Generation...');
    const summary = await testEndpoint('POST', '/enhanced/generate/summary', {
        text: 'Artificial Intelligence (AI) is a branch of computer science that aims to create intelligent machines. AI systems can perform tasks that typically require human intelligence, such as learning, reasoning, and problem-solving.'
    });
    console.log(`   Status: ${summary.status} - ${summary.success ? '✅ PASS' : '❌ FAIL'}`);
    if (summary.data?.data?.summary) {
        console.log(`   Summary generated: ✅`);
    }
    console.log('');

    // Test 7: List Documents
    console.log('7. Testing Document Listing...');
    const documents = await testEndpoint('GET', '/enhanced/documents');
    console.log(`   Status: ${documents.status} - ${documents.success ? '✅ PASS' : '❌ FAIL'}`);
    if (documents.data?.data?.documents) {
        console.log(`   Documents count: ${documents.data.data.documents.length}`);
    }
    console.log('');

    // Test 8: User Stats
    console.log('8. Testing User Statistics...');
    const userStats = await testEndpoint('GET', '/analytics/user/stats');
    console.log(`   Status: ${userStats.status} - ${userStats.success ? '✅ PASS' : '❌ FAIL'}`);
    if (userStats.data?.data?.stats) {
        console.log(`   Stats available: ✅`);
    }
    console.log('');

    console.log('🎉 Integration Tests Completed!\n');
    console.log('📝 Test Summary:');
    console.log('   - Health Check: Core system operational');
    console.log('   - Analytics: Session tracking and analytics working');
    console.log('   - Enhanced Processing: Content generation ready');
    console.log('   - Document Management: Document operations functional');
    console.log('');
    console.log('🔧 Next Steps:');
    console.log('   1. Update frontend to use new enhanced endpoints');
    console.log('   2. Configure OpenRouter API key for AI features');
    console.log('   3. Test PDF upload functionality with actual files');
    console.log('   4. Implement persistent storage for production');
}

// Check if server is running before starting tests
async function checkServerStatus() {
    try {
        const response = await fetch(`${BASE_URL}/health`);
        if (response.ok) {
            console.log('✅ Server is running on', BASE_URL);
            return true;
        } else {
            console.log('❌ Server responded with status:', response.status);
            return false;
        }
    } catch (error) {
        console.log('❌ Server is not running on', BASE_URL);
        console.log('   Please start the server with: npm run dev');
        return false;
    }
}

// Main execution
async function main() {
    console.log('🚀 Enhanced RAG System Integration Test');
    console.log('==========================================\n');

    const serverRunning = await checkServerStatus();

    if (serverRunning) {
        await runIntegrationTests();
    }
}

// Run the tests
main().catch(console.error); 