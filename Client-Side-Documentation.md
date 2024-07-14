# Auralis Chatbot Chrome Extension - Client-Side Documentation

## Overview

The Auralis Chatbot Chrome extension consists of three main client-side components:
1. Popup Script (popup.js)
2. Content Script (content.js)
3. Background Script (background.js)

## 1. Popup Script (popup.js)

The popup script manages the user interface and interactions within the extension's popup window.

### Key Functions and Features

#### Event Listeners

- `DOMContentLoaded`: Initializes the popup when it's opened.
- Click event on `sendBtn`: Triggers the `sendMessage` function.
- `keypress` event on `userInput`: Allows sending messages with the Enter key.
- Click event on `darkModeToggle`: Toggles dark mode.

#### State Management

- `pageProcessed`: Boolean flag indicating if the current page has been processed.
- `currentTabId`: Stores the ID of the current tab.
- `chatHistory`: Array storing the conversation history.
- `currentURL`: Stores the URL of the current page.
- `processedURLs`: Array of URLs that have been processed.

#### Core Functions

- `sendMessage(message = null)`: Sends a user message to the server and handles the response.
- `addMessage(sender, message, className, isClickable = false, shouldSave = true)`: Adds a message to the chat interface.
- `initialProcessing()`: Initiates the processing of a new page.
- `processNewPage()`: Processes a new page when URL changes are detected.
- `checkURLChange()`: Monitors for URL changes in the active tab.

#### UI Functions

- `showTypingIndicator()`: Displays a typing indicator while waiting for a response.
- `hideTypingIndicator()`: Removes the typing indicator.
- `renderChatHistory()`: Renders the stored chat history in the popup.

### Chrome API Usage

- `chrome.tabs`: Used to query and interact with browser tabs.
- `chrome.storage`: Used for storing and retrieving chat history and processed page states.
- `chrome.runtime`: Used for sending messages to the content script.

## 2. Content Script (content.js)

The content script runs in the context of web pages and is responsible for extracting page content.

### Key Features

- Listens for messages from the popup script.
- Responds to `getPageContent` action by sending the page's body text content.

### Message Handling

```javascript
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "getPageContent") {
    sendResponse({content: document.body.innerText});
  }
  return true;  // Indicates that the response is sent asynchronously
});
```

## 3. Background Script (background.js)
The background script handles tab removal events and clears stored data for closed tabs.

### Key Functions and Features
#### Event Listeners
```javascript
chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
  chrome.storage.local.remove([`chatHistory_${tabId}`, `pageProcessed_${tabId}`], function() {
    console.log(`Chat history and page processed state cleared for tab ${tabId}`);
  });
});
```

#### Chrome API Usage
- `chrome.tabs.onRemoved`: Listens for tab closure events.
- `chrome.storage.local`: Used for removing stored data associated with closed tabs.

#### Inter-script Communication
1. Popup → Content: Requests page content.
2. Content → Popup: Sends page content.
3. Popup → Server: Sends processing and question requests.
4. Server → Popup: Sends processing results and question answers.

#### Data Flow
1. User opens a new page:
  - Popup checks if the page is processed.
  - If not, it requests content from the content script.
  - Content is sent to the server for processing.

2. User asks a question:
  - Popup sends the question directly to the server.
  - Server's response is displayed in the popup.

3. User navigates to a new URL:
  - Popup detects the change and initiates processing if needed.

4. User closes a tab:
  - Background script clears stored data for that tab.

#### Error Handling
- Network errors are caught and reported in the chat interface.
- Content script errors are logged and reported to the user.
