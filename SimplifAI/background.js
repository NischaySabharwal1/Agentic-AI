// background.js

// Removed import { runLocalLLM } from './llm_handler.js';

const API_BASE_URL = "http://localhost:8000"; // FastAPI endpoint for SimplifAI backend

// Removed const USE_LOCAL_LLM = true;

let currentSettings = {
    defaultLanguage: 'en',
    geminiApiKey: '',
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "simplifai",
    title: "SimplifAI",
    contexts: ["selection"]
  });

  // Load initial settings on install/update
  chrome.storage.sync.get(['defaultLanguage', 'geminiApiKey'], (data) => {
      currentSettings.defaultLanguage = data.defaultLanguage || 'en';
      currentSettings.geminiApiKey = data.geminiApiKey || '';
      console.log("[SimplifAI Background] Loaded initial settings:", currentSettings);
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "simplifai") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: getSelectedText,
    }, (results) => {
      if (results && results[0] && results[0].result) {
        const selectedText = results[0].result;
        processSelectedText(selectedText, tab.id);
      } else {
        console.error(`[SimplifAI] Error: No text selected or content script failed to return text in tab ${tab.id}.`);
        // Removed chrome.scripting.executeScript call to createChatbotUI
      }
    });
  }
});

function getSelectedText() {
  return window.getSelection().toString();
}

// Removed Chatbot UI and interaction logic comments

async function callApi(endpoint, method = 'GET', data = null) {
    const headers = { 'Content-Type': 'application/json' };
    const options = {
        method: method,
        headers: headers
    };
    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        console.log(`[SimplifAI Background] Calling API: ${API_BASE_URL}${endpoint} with data:`, data);
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const jsonResponse = await response.json();
        if (!response.ok) {
            console.error(`[SimplifAI Background] API Error on ${endpoint}: ${response.status} - ${jsonResponse.detail || JSON.stringify(jsonResponse)}`);
            throw new Error(jsonResponse.detail || `API error: ${response.status}`);
        }
        console.log(`[SimplifAI Background] API Success on ${endpoint}:`, jsonResponse);
        return jsonResponse;
    } catch (error) {
        console.error(`[SimplifAI Background] Fetch error on ${endpoint}: ${error.message}`);
        throw error;
    }
}

// Function to handle chatbot queries
async function runChatbotQuery(question, context, tabId) {
  console.log(`[SimplifAI Chatbot] Received question: "${question}" with context: "${context}" for tab ${tabId}`);
  const { defaultLanguage, geminiApiKey } = currentSettings; // Use currentSettings

  const history = []; // This will be built up from actual chat history, if stored
  // For now, let's assume no prior history is passed for this simple implementation.
  // In a full implementation, you'd retrieve past messages from chrome.storage.local.

  try {
    const response = await callApi(
        "/chat", 
        "POST", 
        { 
            history: history,
            message: `Given the following original text: "${context}", answer the following question: "${question}" in ${defaultLanguage}.`,
            api_key: geminiApiKey
        }
    );
    console.log("[SimplifAI Chatbot] Gemini API Response:", response);
    // Send response back to content script to display
    chrome.tabs.sendMessage(tabId, {
      action: "displayChatbotResponse",
      message: response.response || "No response from Gemini."
    });
  } catch (error) {
    console.error("[SimplifAI Chatbot] Error during Gemini chat processing:", error);
    chrome.tabs.sendMessage(tabId, {
      action: "displayChatbotResponse",
      message: `Error: ${error.message}`
    });
  }
}

// Main processing logic
async function processSelectedText(selectedText, tabId) {
  if (!selectedText) {
    console.warn(`[SimplifAI] No text selected in tab ${tabId}.`);
    chrome.tabs.sendMessage(tabId, {
      action: "openChatbot",
      initialText: "No text selected.",
      originalSelectedText: "",
      tabId: tabId
    });
    return;
  }
  console.log(`[${new Date().toLocaleTimeString()}] [SimplifAI] Text received for processing in tab ${tabId}:`, selectedText);

  const { defaultLanguage, geminiApiKey } = currentSettings; // Use currentSettings

  if (!geminiApiKey) {
    console.error("[SimplifAI] Error: Gemini API Key not set. Please configure in extension options.");
    chrome.tabs.sendMessage(tabId, {
      action: "openChatbot",
      initialText: "Error: Gemini API Key not set. Please configure in extension options.",
      originalSelectedText: "",
      tabId: tabId
    });
    return;
  }

  let processedResult = "";

  try {
    console.log(`[SimplifAI] Attempting Gemini simplification/translation to ${defaultLanguage}...`);
    // First, try to simplify. If target language is different, then translate.
    const simplifyResponse = await callApi(
        "/simplify", 
        "POST", 
        { 
            text: selectedText,
            api_key: geminiApiKey
        }
    );
    processedResult = simplifyResponse.simplified_text;

    if (defaultLanguage !== 'en') { // Assuming English is the base language for simplification
        const translateResponse = await callApi(
            "/translate",
            "POST",
            {
                text: processedResult,
                target_language: defaultLanguage,
                api_key: geminiApiKey
            }
        );
        processedResult = translateResponse.translated_text;
    }

  } catch (apiError) {
    console.error("[SimplifAI] Gemini API processing failed:", apiError.message);
    chrome.tabs.sendMessage(tabId, {
      action: "openChatbot",
      initialText: `Error with Gemini API: ${apiError.message}. Check API key and server.`, // Updated error message
      originalSelectedText: "",
      tabId: tabId
    });
    return;
  }

  console.log(`[${new Date().toLocaleTimeString()}] [SimplifAI] Sending result to tab ${tabId}:`, processedResult);
  chrome.tabs.sendMessage(tabId, {
    action: "openChatbot",
    initialText: processedResult,
    originalSelectedText: selectedText,
    tabId: tabId
  });
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "processText") {
    console.warn("[SimplifAI] Received unexpected 'processText' message in onMessage listener. This should not happen with current architecture.");
  } else if (request.action === "chatbot_query") {
    // Handle chatbot queries originating from content script
    if (request.tabId) {
      console.log("[SimplifAI Background] Received chatbot_query message from content script.");
      runChatbotQuery(request.question, request.context, request.tabId);
    }
  } else if (request.action === "updateSettings") { // Handle settings update from options page
    console.log("[SimplifAI Background] Received updateSettings message.");
    currentSettings.defaultLanguage = request.settings.defaultLanguage;
    currentSettings.geminiApiKey = request.settings.geminiApiKey;
    console.log("[SimplifAI Background] Settings updated to:", currentSettings);
    sendResponse({ status: "success" });
  }
});
