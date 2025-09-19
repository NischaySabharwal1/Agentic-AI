// llm_handler.js

// Default Ollama settings
const DEFAULT_OLLAMA_API_ENDPOINT = 'http://localhost:11434/api/generate';
const DEFAULT_OLLAMA_MODEL = 'gemma:4b'; // A good general-purpose model from Ollama

async function runLocalLLM(text, task, targetLanguage = 'en', ollamaApiEndpoint, ollamaModel) {
  const apiEndpoint = ollamaApiEndpoint || DEFAULT_OLLAMA_API_ENDPOINT;
  const model = ollamaModel || DEFAULT_OLLAMA_MODEL;

  console.log(`[SimplifAI LLM] Attempting to use Ollama model: ${model} at ${apiEndpoint} for task: ${task}`);

  let prompt = "";
  if (task === 'detect_language') {
    prompt = `Detect the language of the following text: "${text}". Respond only with the ISO 639-1 language code (e.g., "en", "fr"). If the language is not recognized, respond with "unknown".`;
  } else if (task === 'translate') {
    prompt = `Translate the following text into ${targetLanguage}: "${text}". Respond only with the translated text.`;
  } else if (task === 'simplify') {
    prompt = `Simplify the following English text for easy understanding: "${text}". Respond only with the simplified text.`;
  } else if (task === 'chatbot_response') {
    // For chatbot responses, the 'text' argument is already the question/follow-up from the user
    // The 'context' is passed separately from the background script, which is good.
    // We'll directly use the 'text' as the prompt here, as the background script already formats it with context.
    prompt = text;
  } else {
    throw new Error(`Unknown LLM task: ${task}`);
  }

  try {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false, // We want a single response, not a stream
        options: {
          temperature: 0.3,
          num_predict: 200, // Limit response length for faster results
        },
      }),
    });

    console.log("[SimplifAI LLM] Ollama Response Status:", response.status, response.statusText);
    console.log("[SimplifAI LLM] Ollama Response OK:", response.ok);

    if (!response.ok) {
      // Try to parse error data even if response is not ok
      const errorData = await response.json().catch(() => ({})); // Handle non-JSON error responses
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

      // Basic post-processing for language detection if needed
      if (task === 'detect_language') {
        // Ollama might respond with more than just the code. Try to extract it.
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

export { runLocalLLM };
