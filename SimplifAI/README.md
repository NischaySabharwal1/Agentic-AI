# SimplifAI Extension

SimplifAI is a Microsoft Edge extension designed to help users understand and translate text from any webpage. Users can highlight a section of text, right-click, and select "SimplifAI" to either get a simplified explanation (if the text is in English) or a translation into their preferred language (if the text is in a different language).

## Features

*   **Context Menu Integration:** Easily access SimplifAI by right-clicking on selected text.
*   **Automatic Language Detection:** Automatically detects the language of the selected text.
*   **Translation:** Translates text to a user-defined default language (e.g., English) using a fallback to Google Cloud Translation API.
*   **Text Simplification:** If the text is already in the default language (English), it provides a simplified explanation.
*   **Local LLM (Ollama):** Integrates with a local Ollama server for privacy-focused and flexible LLM processing, with a fallback to external APIs.

## Architecture Overview

The extension consists of the following main components:

*   **`manifest.json`**: The manifest file defines the extension's metadata, permissions, and entry points.
*   **`background.js`**: The service worker script that handles extension events (e.g., context menu clicks), orchestrates language detection, translation, and simplification, and manages communication between other parts of the extension. It attempts to use the local Ollama LLM first and falls back to external APIs if Ollama is unavailable or fails.
*   **`content.js`**: A script injected into all web pages. It captures selected text from the page and displays the processed results back to the user by directly injecting a display function from `background.js`.
*   **`options.html` / `options.js`**: Provides a user interface for configuring extension settings, such as the default translation language, API keys for external services, and Ollama server details.
*   **`llm_handler.js`**: This script contains the logic for interacting with the local Ollama API for language detection, translation, and simplification.
*   **`icons/`**: Directory containing extension icons.

## Setup and Installation (Developer Mode)

To install SimplifAI in Microsoft Edge (or any Chromium-based browser) for development:

1.  **Install Node.js and npm:** If you don't have them, download and install from [nodejs.org](https://nodejs.org/).
2.  **Clone the Repository:**
    ```bash
    git clone <repository_url>
    cd SimplifAI
    ```
3.  **Install Dependencies and Build:**
    ```bash
    npm install
    npm run build
    ```
4.  **Install Ollama (for local LLM functionality):**
    *   Download and install Ollama from [ollama.com](https://ollama.com/).
    *   After installation, download a model. For example, to download `llama3` (recommended for general tasks):
        ```bash
        ollama run llama3
        ```
        (This will download and run the model. You can then exit the `ollama run` command.)

5.  **Open Extension Management Page:**
    *   Open Microsoft Edge.
    *   Navigate to `edge://extensions` (or `chrome://extensions` for Chrome).

6.  **Enable Developer Mode:**
    *   Toggle on the "Developer mode" switch, usually found in the top-right corner of the extensions page.

7.  **Load Unpacked Extension:**
    *   Click on the "Load unpacked" button.
    *   Select the root directory of this project (`SimplifAI/`) that contains the `manifest.json` file.

8.  **Configure Extension Options:**
    *   After loading the extension, click on its icon in the browser toolbar.
    *   Select "Options" from the context menu (or right-click the extension icon and choose "Options").
    *   **External API Key:** Enter your Google Cloud Translation API key (obtainable from the Google Cloud Console) in the provided field if you want the external API fallback to work.
    *   **Ollama API Endpoint:** Ensure this is set to `http://localhost:11434/api/generate` (default for Ollama). If Ollama is running on a different endpoint, configure it here.
    *   **Ollama Model Name:** Ensure this is set to `llama3` (or the name of the Ollama model you downloaded).
    *   Select your preferred default translation language.
    *   Click "Save Options".

## Usage

1.  Ensure Ollama is running (if using local LLM). You can start it by running `ollama run llama3` in your terminal, or simply ensuring the Ollama application is active in your system tray.
2.  Navigate to any webpage.
3.  Select a portion of text.
4.  Right-click on the selected text.
5.  Choose "SimplifAI" from the context menu.
6.  The processed text (simplified or translated) will appear in a temporary yellow box on the top right of the page.

## Contributing

Feel free to contribute to this project by submitting pull requests or opening issues.

## License

[Specify your license here, e.g., MIT License]
