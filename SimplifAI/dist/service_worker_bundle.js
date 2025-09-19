// llm_handler.js
var DEFAULT_OLLAMA_API_ENDPOINT = "http://localhost:11434/api/generate";
var DEFAULT_OLLAMA_MODEL = "gemma:4b";
async function runLocalLLM(text, task, targetLanguage = "en", ollamaApiEndpoint, ollamaModel) {
  const apiEndpoint = ollamaApiEndpoint || DEFAULT_OLLAMA_API_ENDPOINT;
  const model = ollamaModel || DEFAULT_OLLAMA_MODEL;
  console.log(`[SimplifAI LLM] Attempting to use Ollama model: ${model} at ${apiEndpoint} for task: ${task}`);
  let prompt = "";
  if (task === "detect_language") {
    prompt = `Detect the language of the following text: "${text}". Respond only with the ISO 639-1 language code (e.g., "en", "fr"). If the language is not recognized, respond with "unknown".`;
  } else if (task === "translate") {
    prompt = `Translate the following text into ${targetLanguage}: "${text}". Respond only with the translated text.`;
  } else if (task === "simplify") {
    prompt = `Simplify the following English text for easy understanding: "${text}". Respond only with the simplified text.`;
  } else if (task === "chatbot_response") {
    prompt = text;
  } else {
    throw new Error(`Unknown LLM task: ${task}`);
  }
  try {
    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        // We want a single response, not a stream
        options: {
          temperature: 0.3,
          num_predict: 200
          // Limit response length for faster results
        }
      })
    });
    console.log("[SimplifAI LLM] Ollama Response Status:", response.status, response.statusText);
    console.log("[SimplifAI LLM] Ollama Response OK:", response.ok);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || response.statusText || "Ollama API request failed.");
    }
    let rawResponseText;
    try {
      rawResponseText = await response.text();
      console.log("[SimplifAI LLM] Raw Ollama response text:", rawResponseText);
    } catch (textError) {
      console.error("[SimplifAI LLM] Error reading response text:", textError);
      throw new Error("Ollama API: Error reading response text. " + textError.message);
    }
    const data = JSON.parse(rawResponseText);
    if (data && data.response) {
      let generatedText = data.response.trim();
      if (task === "detect_language") {
        const match = generatedText.match(/\b([a-z]{2}(-[A-Z]{2})?)\b/i);
        if (match) {
          generatedText = match[1].toLowerCase();
        } else {
          generatedText = "unknown";
        }
      }
      return generatedText;
    } else {
      throw new Error("Ollama API did not return a valid response.");
    }
  } catch (error) {
    console.error("[SimplifAI LLM] Error communicating with Ollama API:", error);
    throw new Error("Ollama processing failed: " + error.message);
  }
}

// background.js
var USE_LOCAL_LLM = true;
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
      function: getSelectedText
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
async function runChatbotQuery(question, context, tabId) {
  console.log(`[SimplifAI Chatbot] Received question: "${question}" with context: "${context}" for tab ${tabId}`);
  const data = await chrome.storage.sync.get(["defaultLanguage", "ollamaApiEndpoint", "ollamaModel"]);
  const defaultLanguage = data.defaultLanguage || "en";
  const ollamaApiEndpoint = data.ollamaApiEndpoint;
  const ollamaModel = data.ollamaModel;
  const prompt = `Given the following original text: "${context}" and the conversation so far, answer the following question: "${question}"`;
  console.log("[SimplifAI Chatbot] LLM Prompt:", prompt);
  try {
    const response = await runLocalLLM(prompt, "chatbot_response", defaultLanguage, ollamaApiEndpoint, ollamaModel);
    console.log("[SimplifAI Chatbot] LLM Response from runLocalLLM:", response);
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
  const data = await chrome.storage.sync.get(["defaultLanguage", "ollamaApiEndpoint", "ollamaModel"]);
  const defaultLanguage = data.defaultLanguage || "en";
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
      tabId
    });
    return;
  }
  try {
    console.log("[SimplifAI] Attempting local LLM (Ollama) language detection...");
    detectedLanguage = await runLocalLLM(selectedText, "detect_language", defaultLanguage, ollamaApiEndpoint, ollamaModel);
    console.log("[SimplifAI] Local LLM (Ollama) detected language:", detectedLanguage);
  } catch (llmError) {
    console.error("[SimplifAI] Local LLM (Ollama) language detection failed:", llmError.message);
    chrome.tabs.sendMessage(tabId, {
      action: "openChatbot",
      initialText: `Error with Ollama (detection): ${llmError.message}. Is Ollama running and model installed?`,
      originalSelectedText: "",
      tabId
    });
    return;
  }
  try {
    if (detectedLanguage === "en" || detectedLanguage === defaultLanguage) {
      console.log("[SimplifAI] Attempting local LLM (Ollama) simplification...");
      processedResult = await runLocalLLM(selectedText, "simplify", defaultLanguage, ollamaApiEndpoint, ollamaModel);
    } else {
      console.log("[SimplifAI] Attempting local LLM (Ollama) translation...");
      processedResult = await runLocalLLM(selectedText, "translate", defaultLanguage, ollamaApiEndpoint, ollamaModel);
    }
  } catch (llmError) {
    console.error("[SimplifAI] Local LLM (Ollama) translation/simplification failed:", llmError.message);
    chrome.tabs.sendMessage(tabId, {
      action: "openChatbot",
      initialText: `Error with Ollama (processing): ${llmError.message}. Is Ollama running and model installed?`,
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
  }
});
