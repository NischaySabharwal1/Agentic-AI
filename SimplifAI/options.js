// options.js
document.addEventListener('DOMContentLoaded', () => {
  const defaultLanguageSelect = document.getElementById('defaultLanguage');
  const saveButton = document.getElementById('saveButton');
  const statusDiv = document.getElementById('status');
  const geminiApiKeyInput = document.getElementById('geminiApiKey'); // New: Gemini API Key input

  // Load saved options
  chrome.storage.sync.get(['defaultLanguage', 'geminiApiKey'], (data) => {
    if (data.defaultLanguage) {
      defaultLanguageSelect.value = data.defaultLanguage;
    }
    if (data.geminiApiKey) {
      geminiApiKeyInput.value = data.geminiApiKey; // Load Gemini API Key
    }
  });

  // Save options
  saveButton.addEventListener('click', () => {
    const defaultLanguage = defaultLanguageSelect.value;
    const geminiApiKey = geminiApiKeyInput.value; // Get Gemini API Key

    chrome.storage.sync.set({ defaultLanguage: defaultLanguage, geminiApiKey: geminiApiKey }, () => {
      statusDiv.textContent = 'Options saved!';
      setTimeout(() => {
        statusDiv.textContent = '';
      }, 2000);
    });
  });
});
