// Test script for the fallback response function

// Function to get fallback response for common knowledge questions (copied from test.js)
function getFallbackResponse(message) {
    // Convert message to lowercase for easier matching
    const lowerMessage = message.toLowerCase();

    // Check for common knowledge questions that we can handle with fallbacks
    if (lowerMessage.includes('swot') &&
        (lowerMessage.includes('what is') ||
            lowerMessage.includes('explain') ||
            lowerMessage.includes('stand for'))) {

        return {
            message: "SWOT stands for Strengths, Weaknesses, Opportunities, and Threats. It's a strategic planning framework used to evaluate these four elements of a business, project, or situation. Strengths and weaknesses are typically internal factors, while opportunities and threats are external factors. This analysis helps organizations identify favorable and unfavorable factors that may impact their objectives.",
            provider: "fallback",
            model: "static-response"
        };
    }

    // Add more fallbacks for other common questions as needed

    // Default fallback for when we don't have a specific answer
    return null;
}

// Test cases
const testCases = [
    "can you explain SWOT analysis?",
    "what does SWOT stand for?",
    "what is SWOT?",
    "tell me about SWOT analysis",
    "what is the meaning of SWOT?",
    "something completely different"
];

// Run tests
console.log("Testing fallback response function:");
console.log("==================================");

testCases.forEach((testCase, index) => {
    console.log(`\nTest ${index + 1}: "${testCase}"`);

    const response = getFallbackResponse(testCase);

    if (response) {
        console.log("✅ Fallback response available:");
        console.log(`Provider: ${response.provider}`);
        console.log(`Model: ${response.model}`);
        console.log(`Message: ${response.message.substring(0, 50)}...`);
    } else {
        console.log("❌ No fallback response available");
    }
});

console.log("\n==================================");
console.log("Test completed!"); 