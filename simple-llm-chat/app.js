// DOM Elements
const apiEndpointInput = document.getElementById('api-endpoint');
const apiKeyInput = document.getElementById('api-key');
const modelInput = document.getElementById('model');
const contextWindowInput = document.getElementById('context-window');
const tokenProgressBar = document.getElementById('token-progress-bar');
const tokenCountDisplay = document.getElementById('token-count');
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const inputTokenCount = document.getElementById('input-token-count');
const sendButton = document.getElementById('send-button');

// State
let tokenizer = null;
let messages = [];
let totalTokens = 0;
let contextWindowSize = parseInt(contextWindowInput.value);

// Initialize tokenizer
async function initTokenizer() {
    try {
        // Use a simpler approach for token counting
        // This is an approximation - GPT models use about 4 characters per token on average
        updateInputTokenCount();
        updateTokenProgressBar();
    } catch (error) {
        console.error('Failed to initialize tokenizer:', error);
        alert('Failed to initialize tokenizer. Some features may not work correctly.');
    }
}

// Initialize the app
async function init() {
    await initTokenizer();
    
    // Load settings from localStorage if available
    if (localStorage.getItem('llm-chat-settings')) {
        const settings = JSON.parse(localStorage.getItem('llm-chat-settings'));
        apiEndpointInput.value = settings.apiEndpoint || apiEndpointInput.value;
        apiKeyInput.value = settings.apiKey || '';
        modelInput.value = settings.model || modelInput.value;
        contextWindowInput.value = settings.contextWindowSize || contextWindowInput.value;
        contextWindowSize = parseInt(contextWindowInput.value);
    }
    
    // Event listeners
    userInput.addEventListener('input', updateInputTokenCount);
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    contextWindowInput.addEventListener('change', () => {
        contextWindowSize = parseInt(contextWindowInput.value);
        updateTokenProgressBar();
        saveSettings();
    });
    
    apiEndpointInput.addEventListener('change', saveSettings);
    apiKeyInput.addEventListener('change', saveSettings);
    modelInput.addEventListener('change', saveSettings);
    
    // History management event listeners
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const downloadHistoryBtn = document.getElementById('download-history-btn');
    const loadHistoryInput = document.getElementById('load-history-input');
    const confirmationModal = document.getElementById('confirmation-modal');
    const modalCancel = document.getElementById('modal-cancel');
    const modalConfirm = document.getElementById('modal-confirm');
    
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', () => {
            // Show confirmation modal
            confirmationModal.style.display = 'flex';
        });
    }
    
    if (modalCancel) {
        modalCancel.addEventListener('click', () => {
            // Hide confirmation modal
            confirmationModal.style.display = 'none';
        });
    }
    
    if (modalConfirm) {
        modalConfirm.addEventListener('click', () => {
            // Clear chat history
            clearChatHistory();
            // Hide confirmation modal
            confirmationModal.style.display = 'none';
        });
    }
    
    if (downloadHistoryBtn) {
        downloadHistoryBtn.addEventListener('click', downloadChatHistory);
    }
    
    if (loadHistoryInput) {
        loadHistoryInput.addEventListener('change', loadChatHistory);
    }
}

// Save settings to localStorage
function saveSettings() {
    const settings = {
        apiEndpoint: apiEndpointInput.value,
        apiKey: apiKeyInput.value,
        model: modelInput.value,
        contextWindowSize: contextWindowInput.value
    };
    localStorage.setItem('llm-chat-settings', JSON.stringify(settings));
}

// Count tokens in a string
function countTokens(text) {
    if (!text) return 0;
    // Simple approximation: ~4 characters per token for English text
    // This is not perfect but works as a reasonable estimate
    return Math.ceil(text.length / 4);
}

// Update token count for user input
function updateInputTokenCount() {
    const text = userInput.value;
    const tokens = countTokens(text);
    inputTokenCount.textContent = `${tokens} tokens`;
}

// Update the token progress bar
function updateTokenProgressBar() {
    const percentage = Math.min((totalTokens / contextWindowSize) * 100, 100);
    tokenProgressBar.style.width = `${percentage}%`;
    tokenCountDisplay.textContent = `${totalTokens}/${contextWindowSize} tokens (${Math.round(percentage)}%)`;
    
    // Change color based on usage
    if (percentage > 90) {
        tokenProgressBar.style.backgroundColor = '#dc3545'; // Red
    } else if (percentage > 75) {
        tokenProgressBar.style.backgroundColor = '#ffc107'; // Yellow
    } else {
        tokenProgressBar.style.backgroundColor = '#4CAF50'; // Green
    }
}

// Add a message to the chat
function addMessage(role, content, tokenCount, reasoningContent = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    
    // Add reasoning content first if available
    if (reasoningContent) {
        const reasoningHeader = document.createElement('div');
        reasoningHeader.className = 'reasoning-header';
        reasoningHeader.textContent = 'Thinking Process:';
        messageDiv.appendChild(reasoningHeader);
        
        const reasoningDiv = document.createElement('div');
        reasoningDiv.className = 'reasoning-content';
        reasoningDiv.textContent = reasoningContent;
        messageDiv.appendChild(reasoningDiv);
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    // Use marked.js to render markdown if it's available
    if (window.marked && role === 'assistant') {
        contentDiv.innerHTML = marked.parse(content);
    } else {
        contentDiv.textContent = content;
    }
    messageDiv.appendChild(contentDiv);
    
    // Add token count
    const tokenDiv = document.createElement('div');
    tokenDiv.className = 'message-tokens';
    tokenDiv.textContent = `${tokenCount} tokens`;
    messageDiv.appendChild(tokenDiv);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Create a loading indicator
function createLoadingIndicator() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading assistant-message';
    loadingDiv.innerHTML = `
        <div class="loading-dots">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return loadingDiv;
}

// Send a message to the API
async function sendMessage() {
    const userMessage = userInput.value.trim();
    if (!userMessage) return;
    
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert('Please enter an API key');
        return;
    }
    
    const apiEndpoint = apiEndpointInput.value.trim();
    const model = modelInput.value.trim();
    
    // Count tokens in user message
    const userTokenCount = countTokens(userMessage);
    
    // Add user message to chat
    addMessage('user', userMessage, userTokenCount);
    
    // Add user message to messages array (for API)
    messages.push({
        role: 'user',
        content: userMessage
    });
    
    // Clear input
    userInput.value = '';
    updateInputTokenCount();
    
    // Update token count
    totalTokens += userTokenCount;
    updateTokenProgressBar();
    
    // Disable send button
    sendButton.disabled = true;
    
    // Create loading indicator
    const loadingIndicator = createLoadingIndicator();
    
    try {
        // Prepare API request
        const apiMessages = messages.map(msg => {
            // Remove reasoning_content from messages to avoid API errors
            const { reasoning_content, ...rest } = msg;
            return rest;
        });
        
        const requestBody = {
            model: model,
            messages: apiMessages,
            stream: true
        };
        
        // Make API request
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'API request failed');
        }
        
        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        
        // Remove loading indicator
        loadingIndicator.remove();
        
        // Create message elements for streaming
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant-message';
        
        // Create reasoning header and content div first
        let reasoningHeader = document.createElement('div');
        reasoningHeader.className = 'reasoning-header';
        reasoningHeader.textContent = 'Thinking Process:';
        reasoningHeader.style.display = 'none'; // Hide initially
        messageDiv.appendChild(reasoningHeader);
        
        let reasoningDiv = document.createElement('div');
        reasoningDiv.className = 'reasoning-content';
        reasoningDiv.style.display = 'none'; // Hide initially
        messageDiv.appendChild(reasoningDiv);
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        messageDiv.appendChild(contentDiv);
        
        const tokenDiv = document.createElement('div');
        tokenDiv.className = 'message-tokens';
        tokenDiv.textContent = '0 tokens';
        messageDiv.appendChild(tokenDiv);
        
        chatMessages.appendChild(messageDiv);
        
        // Variables to collect the complete response
        let assistantMessage = '';
        let reasoningContent = '';
        let assistantTokenCount = 0;
        
        // Process the stream
        let buffer = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            
            // Process complete lines
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer
            
            for (const line of lines) {
                if (line.trim() === '') continue;
                
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    
                    try {
                        const parsed = JSON.parse(data);
                        const delta = parsed.choices[0].delta;
                        
                        // Handle content
                        if (delta.content) {
                            assistantMessage += delta.content;
                            // Use marked.js to render markdown
                            if (window.marked) {
                                contentDiv.innerHTML = marked.parse(assistantMessage);
                            } else {
                                contentDiv.textContent = assistantMessage;
                            }
                            assistantTokenCount = countTokens(assistantMessage);
                            tokenDiv.textContent = `${assistantTokenCount} tokens`;
                        }
                        
                        // Handle reasoning content
                        if (delta.reasoning_content) {
                            // Show reasoning header and div if they were hidden
                            if (reasoningHeader.style.display === 'none') {
                                reasoningHeader.style.display = 'block';
                                reasoningDiv.style.display = 'block';
                            }
                            
                            reasoningContent += delta.reasoning_content;
                            reasoningDiv.textContent = reasoningContent;
                        }
                        
                        // Scroll to bottom
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    } catch (error) {
                        console.error('Error parsing stream chunk:', error, line);
                    }
                }
            }
        }
        
        // Process any remaining buffer
        if (buffer.trim() && buffer.startsWith('data: ')) {
            try {
                const data = buffer.slice(6);
                if (data !== '[DONE]') {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices[0].delta;
                    
                    // Handle content
                    if (delta.content) {
                        assistantMessage += delta.content;
                        // Use marked.js to render markdown
                        if (window.marked) {
                            contentDiv.innerHTML = marked.parse(assistantMessage);
                        } else {
                            contentDiv.textContent = assistantMessage;
                        }
                        assistantTokenCount = countTokens(assistantMessage);
                        tokenDiv.textContent = `${assistantTokenCount} tokens`;
                    }
                    
                    // Handle reasoning content
                    if (delta.reasoning_content) {
                        // Show reasoning header and div if they were hidden
                        if (reasoningHeader.style.display === 'none') {
                            reasoningHeader.style.display = 'block';
                            reasoningDiv.style.display = 'block';
                        }
                        
                        reasoningContent += delta.reasoning_content;
                        reasoningDiv.textContent = reasoningContent;
                    }
                }
            } catch (error) {
                console.error('Error parsing final chunk:', error);
            }
        }
        
        // If no content was received but we have reasoning, show a placeholder
        if (!assistantMessage && reasoningContent) {
            assistantMessage = "(The model provided only thinking process without a final answer)";
            if (window.marked) {
                contentDiv.innerHTML = marked.parse(assistantMessage);
            } else {
                contentDiv.textContent = assistantMessage;
            }
            assistantTokenCount = countTokens(assistantMessage);
            tokenDiv.textContent = `${assistantTokenCount} tokens`;
        }
        
        // Hide reasoning section if empty
        if (!reasoningContent) {
            reasoningHeader.style.display = 'none';
            reasoningDiv.style.display = 'none';
        }
        
        // Add the complete message to our messages array
        const assistantMessageObj = {
            role: 'assistant',
            content: assistantMessage
        };
        
        // Add reasoning_content if available
        if (reasoningContent) {
            assistantMessageObj.reasoning_content = reasoningContent;
        }
        
        messages.push(assistantMessageObj);
        
        // Update total tokens
        totalTokens += assistantTokenCount;
        updateTokenProgressBar();
        
    } catch (error) {
        console.error('Error sending message:', error);
        loadingIndicator.remove();
        
        // Show error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message system-message';
        errorDiv.textContent = `Error: ${error.message}`;
        chatMessages.appendChild(errorDiv);
    } finally {
        // Re-enable send button
        sendButton.disabled = false;
    }
}

// Clear chat history
function clearChatHistory() {
    // Clear messages array
    messages = [];
    
    // Clear chat messages display
    chatMessages.innerHTML = '';
    
    // Reset token count
    totalTokens = 0;
    updateTokenProgressBar();
}

// Download chat history as JSON
function downloadChatHistory() {
    if (messages.length === 0) {
        alert('No chat history to download');
        return;
    }
    
    // Create chat history object with metadata
    const chatHistory = {
        timestamp: new Date().toISOString(),
        settings: {
            apiEndpoint: apiEndpointInput.value,
            model: modelInput.value,
            contextWindowSize: contextWindowSize
        },
        messages: messages
    };
    
    // Convert to JSON string
    const jsonString = JSON.stringify(chatHistory, null, 2);
    
    // Create blob and download link
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create filename with current date and time
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const filename = `chat-${year}${month}${day}-${hours}${minutes}${seconds}.json`;
    
    // Create download link and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

// Load chat history from JSON file
function loadChatHistory(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const chatHistory = JSON.parse(e.target.result);
            
            // Validate chat history format
            if (!chatHistory.messages || !Array.isArray(chatHistory.messages)) {
                throw new Error('Invalid chat history format');
            }
            
            // Clear current chat
            clearChatHistory();
            
            // Load settings if available
            if (chatHistory.settings) {
                if (chatHistory.settings.apiEndpoint) {
                    apiEndpointInput.value = chatHistory.settings.apiEndpoint;
                }
                if (chatHistory.settings.model) {
                    modelInput.value = chatHistory.settings.model;
                }
                if (chatHistory.settings.contextWindowSize) {
                    contextWindowInput.value = chatHistory.settings.contextWindowSize;
                    contextWindowSize = parseInt(chatHistory.settings.contextWindowSize);
                }
                saveSettings();
            }
            
            // Load messages
            messages = chatHistory.messages;
            
            // Display messages in chat
            let newTotalTokens = 0;
            
            for (const msg of messages) {
                const tokenCount = countTokens(msg.content);
                newTotalTokens += tokenCount;
                addMessage(msg.role, msg.content, tokenCount, msg.reasoning_content || null);
            }
            
            // Update token count
            totalTokens = newTotalTokens;
            updateTokenProgressBar();
            
            // Reset file input
            event.target.value = '';
            
        } catch (error) {
            console.error('Error loading chat history:', error);
            alert(`Error loading chat history: ${error.message}`);
            // Reset file input
            event.target.value = '';
        }
    };
    
    reader.readAsText(file);
}

// Initialize the app
document.addEventListener('DOMContentLoaded', init);
