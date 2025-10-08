// background.js
var API_BASE_URL = "http://localhost:8000";
var currentSettings = {
  defaultLanguage: "en",
  geminiApiKey: ""
};
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "simplifai",
    title: "SimplifAI",
    contexts: ["selection"]
  });
  chrome.storage.sync.get(["defaultLanguage", "geminiApiKey"], (data) => {
    currentSettings.defaultLanguage = data.defaultLanguage || "en";
    currentSettings.geminiApiKey = data.geminiApiKey || "";
    console.log("[SimplifAI Background] Loaded initial settings:", currentSettings);
  });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "simplifai") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: getSelectedText
    }, (results) => {
      if (results && results[0] && results[0].result) {
        const selectedText = results[0].result;
        processSelectedText(selectedText, tab.id);
      } else {
        console.error(`[SimplifAI] Error: No text selected or content script failed to return text in tab ${tab.id}.`);
      }
    });
  }
});
function getSelectedText() {
  return window.getSelection().toString();
}
async function callApi(endpoint, method = "GET", data = null) {
  const headers = { "Content-Type": "application/json" };
  const options = {
    method,
    headers
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
async function runChatbotQuery(question, context, tabId) {
  console.log(`[SimplifAI Chatbot] Received question: "${question}" with context: "${context}" for tab ${tabId}`);
  const { defaultLanguage, geminiApiKey } = currentSettings;
  const history = [];
  try {
    const response = await callApi(
      "/chat",
      "POST",
      {
        history,
        message: `Given the following original text: "${context}", answer the following question: "${question}" in ${defaultLanguage}.`,
        api_key: geminiApiKey
      }
    );
    console.log("[SimplifAI Chatbot] Gemini API Response:", response);
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
async function processSelectedText(selectedText, tabId) {
  if (!selectedText) {
    console.warn(`[SimplifAI] No text selected in tab ${tabId}.`);
    chrome.tabs.sendMessage(tabId, {
      action: "openChatbot",
      initialText: "No text selected.",
      originalSelectedText: "",
      tabId
    });
    return;
  }
  console.log(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] [SimplifAI] Text received for processing in tab ${tabId}:`, selectedText);
  const { defaultLanguage, geminiApiKey } = currentSettings;
  if (!geminiApiKey) {
    console.error("[SimplifAI] Error: Gemini API Key not set. Please configure in extension options.");
    chrome.tabs.sendMessage(tabId, {
      action: "openChatbot",
      initialText: "Error: Gemini API Key not set. Please configure in extension options.",
      originalSelectedText: "",
      tabId
    });
    return;
  }
  let processedResult = "";
  try {
    console.log(`[SimplifAI] Attempting Gemini simplification/translation to ${defaultLanguage}...`);
    const simplifyResponse = await callApi(
      "/simplify",
      "POST",
      {
        text: selectedText,
        api_key: geminiApiKey
      }
    );
    processedResult = simplifyResponse.simplified_text;
    if (defaultLanguage !== "en") {
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
      initialText: `Error with Gemini API: ${apiError.message}. Check API key and server.`,
      // Updated error message
      originalSelectedText: "",
      tabId
    });
    return;
  }
  console.log(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] [SimplifAI] Sending result to tab ${tabId}:`, processedResult);
  chrome.tabs.sendMessage(tabId, {
    action: "openChatbot",
    initialText: processedResult,
    originalSelectedText: selectedText,
    tabId
  });
}
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "processText") {
    console.warn("[SimplifAI] Received unexpected 'processText' message in onMessage listener. This should not happen with current architecture.");
  } else if (request.action === "chatbot_query") {
    if (request.tabId) {
      console.log("[SimplifAI Background] Received chatbot_query message from content script.");
      runChatbotQuery(request.question, request.context, request.tabId);
    }
  } else if (request.action === "updateSettings") {
    console.log("[SimplifAI Background] Received updateSettings message.");
    currentSettings.defaultLanguage = request.settings.defaultLanguage;
    currentSettings.geminiApiKey = request.settings.geminiApiKey;
    console.log("[SimplifAI Background] Settings updated to:", currentSettings);
    sendResponse({ status: "success" });
  }
});
