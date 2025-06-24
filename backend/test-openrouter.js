// Test script for OpenRouter API
import 'dotenv/config';
import fetch from 'node-fetch';

async function testOpenRouter() {
    console.log('🧪 Testing OpenRouter API');

    // Check if OpenRouter API key is available
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.error('❌ OpenRouter API key not found in environment variables');
        console.log('Available env keys:', Object.keys(process.env));
        return;
    }

    console.log(`🔑 OpenRouter API key found: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 5)}`);
    console.log(`🔑 API key length: ${apiKey.length} characters`);

    // Define the endpoint and model - using a different model
    const endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    const model = 'openai/gpt-3.5-turbo';  // Try OpenAI model through OpenRouter

    try {
        console.log('🤖 Making request to OpenRouter API');
        console.log(`- Endpoint: ${endpoint}`);
        console.log(`- Model: ${model}`);

        // Construct the headers with minimal approach
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        };

        console.log('🔍 Request headers:', JSON.stringify(headers, null, 2));

        const body = JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: 'Say hello!' }],
            temperature: 0.5,
            max_tokens: 50
        });

        console.log('🔍 Request body:', body);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body
        });

        console.log('🔍 Response status:', response.status);
        console.log('🔍 Response headers:', JSON.stringify(Object.fromEntries([...response.headers]), null, 2));

        const responseText = await response.text();
        console.log('🔍 Raw response:', responseText);

        if (!response.ok) {
            console.error('❌ OpenRouter API error response:', responseText);
            console.error(`❌ Status code: ${response.status}`);

            // Try to parse the error as JSON
            try {
                const errorJson = JSON.parse(responseText);
                console.error('❌ Error details:', JSON.stringify(errorJson, null, 2));
            } catch (e) {
                console.error('❌ Could not parse error as JSON');
            }

            return;
        }

        try {
            const data = JSON.parse(responseText);
            console.log('✅ OpenRouter response received:');
            console.log(`- Model: ${data.model}`);
            console.log(`- Message: ${data.choices[0]?.message?.content}`);
        } catch (e) {
            console.error('❌ Failed to parse response as JSON:', e);
        }
    } catch (error) {
        console.error('❌ OpenRouter API call failed:', error);
    }
}

// Run the test
testOpenRouter().catch(console.error); 