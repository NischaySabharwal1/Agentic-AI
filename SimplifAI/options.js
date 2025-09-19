// options.js
document.addEventListener('DOMContentLoaded', () => {
  const defaultLanguageSelect = document.getElementById('defaultLanguage');
  const saveButton = document.getElementById('saveButton');
  const statusDiv = document.getElementById('status');
  const ollamaApiEndpointInput = document.getElementById('ollamaApiEndpoint');
  const ollamaModelInput = document.getElementById('ollamaModel');

  // Load saved options
  chrome.storage.sync.get(['defaultLanguage', 'ollamaApiEndpoint', 'ollamaModel'], (data) => {
    if (data.defaultLanguage) {
      defaultLanguageSelect.value = data.defaultLanguage;
    }
    if (data.ollamaApiEndpoint) {
      ollamaApiEndpointInput.value = data.ollamaApiEndpoint;
    }
    if (data.ollamaModel) {
      ollamaModelInput.value = data.ollamaModel;
    }
  });

  // Save options
  saveButton.addEventListener('click', () => {
    const defaultLanguage = defaultLanguageSelect.value;
    const ollamaApiEndpoint = ollamaApiEndpointInput.value;
    const ollamaModel = ollamaModelInput.value;
    chrome.storage.sync.set({ defaultLanguage: defaultLanguage, ollamaApiEndpoint: ollamaApiEndpoint, ollamaModel: ollamaModel }, () => {
      statusDiv.textContent = 'Options saved!';
      setTimeout(() => {
        statusDiv.textContent = '';
      }, 2000);
    });
  });
});
