// content.js
console.log("[SimplifAI Content Script] Content script loaded.");

// Chatbot UI and interaction logic (moved from background.js)
const CHATBOT_TIMEOUT_SECONDS = 30; // Chatbot disappears after 30 seconds of inactivity
let chatbotInactivityTimer; // Global timer for this chatbot instance

function resetChatbotTimer() {
  clearTimeout(chatbotInactivityTimer);
  chatbotInactivityTimer = setTimeout(() => {
    console.log("[SimplifAI Chatbot] Chatbot inactivity timer expired. Removing chatbot.");
    const existingChatbot = document.getElementById("simplifai-chatbot-container");
    if (existingChatbot) {
      existingChatbot.remove();
    }
    clearTimeout(chatbotInactivityTimer); // Ensure the timer is cleared after execution
  }, CHATBOT_TIMEOUT_SECONDS * 1000);
}

// Function to handle sending chat input
function sendChatMessage(chatInput, chatMessages, originalSelectedText) {
  console.log("[SimplifAI Chatbot] sendChatMessage called.");
  const userMessage = chatInput.value.trim();
  if (userMessage) {
    // Display user message
    const userMsgElem = document.createElement("p");
    userMsgElem.style.cssText = "text-align: right; background-color: #d1e7dd; padding: 8px; border-radius: 5px; margin-bottom: 5px;";
    userMsgElem.textContent = `You: ${userMessage}`;
    chatMessages.appendChild(userMsgElem);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to bottom

    chatInput.value = ''; // Clear input
    chatInput.style.height = '38px'; // Reset height

    // Send message to background.js for LLM processing
    try {
      console.log("[SimplifAI Chatbot] Attempting to send message via chrome.runtime.sendMessage.");
      chrome.runtime.sendMessage({
        action: "chatbot_query",
        question: userMessage,
        context: originalSelectedText,
        tabId: window.simplifaiTabId // Pass tabId from content script
      });
      console.log("[SimplifAI Chatbot] Sent message to background.js:", { action: "chatbot_query", question: userMessage, context: originalSelectedText });
      resetChatbotTimer(); // Reset timer on user send
    } catch (e) {
      console.error("[SimplifAI Chatbot] Error sending message via chrome.runtime.sendMessage:", e);
      // Optionally display an error message in the chat UI
      const errorMsgElem = document.createElement("p");
      errorMsgElem.style.cssText = "background-color: #f8d7da; color: #721c24; padding: 8px; border-radius: 5px; margin-bottom: 5px;";
      errorMsgElem.textContent = `LLM Error: ${e.message}`;
      chatMessages.appendChild(errorMsgElem);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }
}

// Function to create and display the chatbot UI
function createChatbotUI(initialText, originalSelectedText) {
  let chatbotContainer = document.getElementById("simplifai-chatbot-container");
  if (chatbotContainer) {
    // If chatbot already exists, just update its timer and add initial message
    const chatMessages = document.getElementById("simplifai-chat-messages");
    if (chatMessages && initialText) {
      const initialMessage = document.createElement("p");
      initialMessage.style.cssText = "background-color: #e0e0e0; padding: 8px; border-radius: 5px; margin-bottom: 5px;";
      initialMessage.textContent = `LLM: ${initialText}`;
      chatMessages.appendChild(initialMessage);
      chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to bottom
    }
    chatbotContainer.dataset.originalSelectedText = originalSelectedText;
    resetChatbotTimer(); // Reset timer when new content is added to an existing chatbot
    return;
  }

  chatbotContainer = document.createElement("div");
  chatbotContainer.id = "simplifai-chatbot-container";
  chatbotContainer.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    width: 350px;
    height: 400px;
    background-color: white;
    border: 1px solid grey;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    z-index: 100000;
    display: flex;
    flex-direction: column;
    font-family: Arial, sans-serif;
    color: black;
  `;
  chatbotContainer.dataset.originalSelectedText = originalSelectedText; // Store for later use

  const chatHeader = document.createElement("div");
  chatHeader.style.cssText = `
    padding: 10px;
    background-color: #f0f0f0;
    border-bottom: 1px solid grey;
    font-weight: bold;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  chatHeader.textContent = "SimplifAI Chat";

  const closeButton = document.createElement("button");
  closeButton.textContent = "X";
  closeButton.style.cssText = `
    background: none;
    border: none;
    font-size: 1.2em;
    cursor: pointer;
  `;
  closeButton.addEventListener('click', () => {
    console.log("[SimplifAI Chatbot] Close button clicked.");
    chatbotContainer.remove();
    clearTimeout(chatbotInactivityTimer); // Clear timer when chatbot is closed
  });
  chatHeader.appendChild(closeButton);

  const reloadButton = document.createElement("button");
  reloadButton.textContent = "Reload";
  reloadButton.style.cssText = `
    background-color: #f0f0f0;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 5px 10px;
    margin-left: 10px;
    cursor: pointer;
  `;
  reloadButton.addEventListener('click', () => {
    console.log("[SimplifAI Chatbot] Reload button clicked.");
    const chatMessages = document.getElementById("simplifai-chat-messages");
    if (chatMessages) {
      chatMessages.innerHTML = ''; // Clear chat history
    }
    resetChatbotTimer(); // Reset timer
  });
  chatHeader.appendChild(reloadButton);
  chatbotContainer.appendChild(chatHeader);

  const chatMessages = document.createElement("div");
  chatMessages.id = "simplifai-chat-messages";
  chatMessages.style.cssText = `
    flex-grow: 1;
    padding: 10px;
    overflow-y: auto;
    background-color: #f9f9f9;
    word-wrap: break-word;
  `;
  chatbotContainer.appendChild(chatMessages);

  // Display the initial processed text as the first message from the LLM
  if (initialText) {
    const initialMessage = document.createElement("p");
    initialMessage.style.cssText = "background-color: #e0e0e0; padding: 8px; border-radius: 5px; margin-bottom: 5px;";
    initialMessage.textContent = `LLM: ${initialText}`;
    chatMessages.appendChild(initialMessage);
  }

  const chatInputArea = document.createElement("div");
  chatInputArea.style.cssText = `
    display: flex;
    padding: 10px;
    border-top: 1px solid grey;
    background-color: #f0f0f0;
  `;

  const chatInput = document.createElement("textarea");
  chatInput.id = "simplifai-chat-input";
  chatInput.placeholder = "Ask a follow-up question...";
  chatInput.style.cssText = `
    flex-grow: 1;
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    margin-right: 10px;
    resize: none;
    height: 38px;
    overflow-y: hidden;
  `;
  // Adjust textarea height automatically
  chatInput.addEventListener('input', function() {
    console.log("[SimplifAI Chatbot] Input event on textarea. Current text length:", this.value.length);
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    resetChatbotTimer(); // Reset timer on input
  });
  chatInputArea.appendChild(chatInput);

  const sendButton = document.createElement("button");
  sendButton.id = "simplifai-send-button";
  sendButton.textContent = "Send";
  sendButton.style.cssText = `
    padding: 8px 15px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
  `;
  sendButton.addEventListener('click', () => {
    console.log("[SimplifAI Chatbot] Send button CLICKED. Calling sendChatMessage...");
    // Ensure chatInput, chatMessages, originalSelectedText are correctly captured from the closure
    sendChatMessage(chatInput, chatMessages, chatbotContainer.dataset.originalSelectedText);
  });
  chatInputArea.appendChild(sendButton);
  chatbotContainer.appendChild(chatInputArea);

  document.body.appendChild(chatbotContainer);

  // Focus on the input field
  chatInput.focus();

  // Handle sending message on Enter
  chatInput.addEventListener('keypress', (e) => {
    console.log("[SimplifAI Chatbot] Keypress event on textarea. Key:", e.key, ", Shift key pressed:", e.shiftKey);
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      console.log("[SimplifAI Chatbot] Enter key pressed without Shift. Calling sendChatMessage...");
      // Ensure chatInput, chatMessages, originalSelectedText are correctly captured from the closure
      sendChatMessage(chatInput, chatMessages, chatbotContainer.dataset.originalSelectedText);
    }
  });

  console.log("[SimplifAI Chatbot] Initial resetChatbotTimer call after UI creation.");
  resetChatbotTimer(); // Start initial timer
}

// Function to display chatbot messages (from LLM)
function displayChatbotMessage(message) {
  console.log("[SimplifAI Chatbot] displayChatbotMessage called with message:", message);
  const chatMessages = document.getElementById("simplifai-chat-messages");
  const chatbotContainer = document.getElementById("simplifai-chatbot-container");
  if (chatMessages && chatbotContainer) {
    const llmMsgElem = document.createElement("p");
    llmMsgElem.style.cssText = "background-color: #e0e0e0; padding: 8px; border-radius: 5px; margin-bottom: 5px;";
    llmMsgElem.textContent = `LLM: ${message}`;
    chatMessages.appendChild(llmMsgElem);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to bottom
    
    console.log("[SimplifAI Chatbot] Resetting timer after displaying LLM message.");
    resetChatbotTimer(); // Reset timer on new LLM message
  }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[SimplifAI Content Script] Message received:", request.action);
  if (request.action === "openChatbot") {
    console.log("[SimplifAI Content Script] Received openChatbot message.", request.initialText, request.originalSelectedText);
    // Store the tab ID if needed, though for content script it's generally known
    window.simplifaiTabId = request.tabId;
    createChatbotUI(request.initialText, request.originalSelectedText);
  } else if (request.action === "displayChatbotResponse") {
    console.log("[SimplifAI Content Script] Received displayChatbotResponse message.", request.message);
    displayChatbotMessage(request.message);
  } else {
    console.warn("[SimplifAI Content Script] Received unknown message action:", request.action, request);
  }
});
