# AI Providers Configuration

This application supports multiple AI providers for chat functionality. You can easily configure and switch between different providers.

## Configuration File

The AI providers are configured in `ai-providers.json`. This file allows you to:

-   Set the default provider
-   Enable/disable providers
-   Configure API keys and models
-   Add new providers

## Supported Providers

### 1. Google Gemini (Default)

-   **Status**: Enabled by default
-   **Models**: Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini Pro
-   **Setup**: Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
-   **Environment Variable**: `GEMINI_API_KEY`

### 2. OpenRouter

-   **Status**: Disabled by default
-   **Models**: Various open-source models (Mistral, DeepSeek, Gemma)
-   **Setup**: Get your API key from [OpenRouter](https://openrouter.ai/)
-   **Environment Variable**: `OPENROUTER_API_KEY`

### 3. OpenAI

-   **Status**: Disabled by default
-   **Models**: GPT-3.5-turbo, GPT-4, GPT-4-turbo
-   **Setup**: Get your API key from [OpenAI Platform](https://platform.openai.com/)
-   **Environment Variable**: `OPENAI_API_KEY`

### 4. Anthropic Claude

-   **Status**: Disabled by default
-   **Models**: Claude 3 Sonnet, Claude 3 Opus, Claude 3 Haiku
-   **Setup**: Get your API key from [Anthropic Console](https://console.anthropic.com/)
-   **Environment Variable**: `ANTHROPIC_API_KEY`

## How to Enable Providers

1. **Set Environment Variable**: Add your API key to the `.env` file:

    ```
    GEMINI_API_KEY=your_actual_api_key_here
    ```

2. **Enable in Configuration**: Set `enabled: true` in `ai-providers.json`:

    ```json
    "gemini": {
      "enabled": true,
      ...
    }
    ```

3. **Restart Backend**: Restart your backend server to apply changes.

## Switching Providers

Users can switch between enabled providers in the chat interface:

1. Look for the AI provider dropdown in the chat sidebar
2. Select your preferred provider
3. The chat will use the selected provider for new messages

## Adding New Providers

To add a new AI provider:

1. **Edit `ai-providers.json`**: Add a new provider configuration:

    ```json
    "newprovider": {
      "name": "New Provider",
      "enabled": false,
      "apiKey": "${NEW_PROVIDER_API_KEY}",
      "models": {
        "chat": {
          "primary": "model-name",
          "alternatives": []
        }
      },
      "endpoints": {
        "chat": "https://api.newprovider.com/v1/chat"
      }
    }
    ```

2. **Update `ai-providers.js`**: Add a new chat method for your provider in the `AIProvider` class.

3. **Set Environment Variable**: Add the API key to your `.env` file.

## Troubleshooting

### "No AI providers configured" Error

-   Ensure at least one provider has an API key set in the `.env` file
-   Check that the provider is enabled in `ai-providers.json`
-   Restart the backend server

### "Error communicating with AI service"

-   Verify your API key is correct
-   Check if you have API credits/quota remaining
-   Ensure the provider's API is accessible from your network

## Security Notes

-   Never commit API keys to version control
-   Use environment variables for all sensitive credentials
-   The `ai-providers.json` file uses placeholders like `${GEMINI_API_KEY}` that are replaced at runtime
