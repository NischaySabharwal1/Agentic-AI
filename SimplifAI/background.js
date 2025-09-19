// background.js

import { runLocalLLM } from './llm_handler.js';

const USE_LOCAL_LLM = true; // Set to true to enable local LLM, false to keep local LLM logic, but prevent calls for testing

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "simplifai",
    title: "SimplifAI",
    contexts: ["selection"]
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
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: createChatbotUI,
            args: ["No text selected.", ""]
        });
      }
    });
  }
});

function getSelectedText() {
  return window.getSelection().toString();
}

// Chatbot UI and interaction logic (moved to content.js)
// const CHATBOT_TIMEOUT_SECONDS = 30;
// let chatbotInactivityTimer;
// function resetChatbotTimer() { /* ... */ }
// function createChatbotUI(...) { /* ... */ }
// function sendChatMessage(...) { /* ... */ }
// function displayChatbotMessage(...) { /* ... */ }


// Function to handle chatbot queries
async function runChatbotQuery(question, context, tabId) {
  console.log(`[SimplifAI Chatbot] Received question: "${question}" with context: "${context}" for tab ${tabId}`);
  const data = await chrome.storage.sync.get(['defaultLanguage', 'ollamaApiEndpoint', 'ollamaModel']);
  const defaultLanguage = data.defaultLanguage || 'en';
  const ollamaApiEndpoint = data.ollamaApiEndpoint;
  const ollamaModel = data.ollamaModel;

  const prompt = `Given the following original text: "${context}" and the conversation so far, answer the following question: "${question}"`;
  console.log("[SimplifAI Chatbot] LLM Prompt:", prompt);

  try {
    const response = await runLocalLLM(prompt, "chatbot_response", defaultLanguage, ollamaApiEndpoint, ollamaModel);
    console.log("[SimplifAI Chatbot] LLM Response from runLocalLLM:", response);
    // Send response back to content script to display
    chrome.tabs.sendMessage(tabId, {
      action: "displayChatbotResponse",
      message: response
    });
  } catch (error) {
    console.error("[SimplifAI Chatbot] Error during LLM processing:", error);
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

  const data = await chrome.storage.sync.get(['defaultLanguage', 'ollamaApiEndpoint', 'ollamaModel']);
  const defaultLanguage = data.defaultLanguage || 'en';
  const ollamaApiEndpoint = data.ollamaApiEndpoint;
  const ollamaModel = data.ollamaModel;

  let processedResult = "";
  let detectedLanguage = "";

  if (!USE_LOCAL_LLM) {
    console.error("[SimplifAI] Error: Local LLM is disabled. Cannot process text.");
    chrome.tabs.sendMessage(tabId, {
      action: "openChatbot",
      initialText: "Error: Local LLM is disabled. Please enable it in background.js for development.",
      originalSelectedText: "",
      tabId: tabId
    });
    return;
  }

  // Attempt language detection with local LLM (Ollama)
  try {
    console.log("[SimplifAI] Attempting local LLM (Ollama) language detection...");
    detectedLanguage = await runLocalLLM(selectedText, 'detect_language', defaultLanguage, ollamaApiEndpoint, ollamaModel);
    console.log("[SimplifAI] Local LLM (Ollama) detected language:", detectedLanguage);
  } catch (llmError) {
    console.error("[SimplifAI] Local LLM (Ollama) language detection failed:", llmError.message);
    chrome.tabs.sendMessage(tabId, {
      action: "openChatbot",
      initialText: `Error with Ollama (detection): ${llmError.message}. Is Ollama running and model installed?`,
      originalSelectedText: "",
      tabId: tabId
    });
    return;
  }

  // Now, attempt translation or simplification with local LLM (Ollama)
  try {
    if (detectedLanguage === 'en' || detectedLanguage === defaultLanguage) {
      console.log("[SimplifAI] Attempting local LLM (Ollama) simplification...");
      processedResult = await runLocalLLM(selectedText, 'simplify', defaultLanguage, ollamaApiEndpoint, ollamaModel);
    } else {
      console.log("[SimplifAI] Attempting local LLM (Ollama) translation...");
      processedResult = await runLocalLLM(selectedText, 'translate', defaultLanguage, ollamaApiEndpoint, ollamaModel);
    }
  } catch (llmError) {
    console.error("[SimplifAI] Local LLM (Ollama) translation/simplification failed:", llmError.message);
    chrome.tabs.sendMessage(tabId, {
      action: "openChatbot",
      initialText: `Error with Ollama (processing): ${llmError.message}. Is Ollama running and model installed?`,
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
  }
});
