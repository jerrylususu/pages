# LLM Chat Interface

A simple frontend-only web interface for interacting with LLM models via OpenAI-compatible APIs.

## Features

- **Custom API Settings**: Set your own API endpoint, API key, and model name (settings are saved in localStorage)
- **Token Usage Tracking**: Real-time token counting with progress bar showing context window usage
- **Streaming Responses**: See the AI's response as it's being generated
- **Support for Reasoning Models**: Compatible with models like deepseek-reasoner that provide reasoning content
- **Thinking Process Display**: Clearly shows model reasoning/thinking process above the final answer
- **Markdown Rendering**: Supports markdown formatting in AI responses
- **Chat History Management**: Save, load, and clear chat sessions
- **No Build Tools Required**: Pure HTML, CSS, and JavaScript implementation

## How to Use

1. Open `index.html` in your web browser
2. Configure your API settings:
   - API Endpoint (e.g., `https://api.openai.com/v1/chat/completions`)
   - API Key (your secret key)
   - Model (e.g., `gpt-3.5-turbo`, `deepseek-reasoner`, etc.)
   - Context Window Size (in tokens)
3. Start chatting!
4. Manage your chat history:
   - **Clear Chat**: Removes all messages from the current chat (requires confirmation)
   - **Download Chat**: Saves your chat history as a JSON file with timestamp
   - **Load Chat**: Load a previously saved chat history file to continue the conversation

## Deploying to GitHub Pages

1. Push this folder to a GitHub repository
2. Go to repository settings
3. Navigate to "Pages" section
4. Select the branch you want to deploy from
5. Save the settings and wait for deployment to complete

## Notes on Reasoning Models

When using reasoning models like `deepseek-reasoner`:
- The interface will display the reasoning content (Chain of Thought) above the final answer with a "Thinking Process" header
- Reasoning content is not counted in the context window usage
- Reasoning content is not included in subsequent API requests

## Markdown Support

The interface renders markdown in AI responses, supporting:
- Headers
- Lists
- Code blocks
- Tables
- Links
- And other standard markdown formatting

## Security Note

Your API key is stored in your browser's localStorage for convenience. If you're using a shared computer, make sure to clear your browser data when you're done.

## Third-Party Libraries

- [tiktoken](https://github.com/dqbd/tiktoken) - For token counting
