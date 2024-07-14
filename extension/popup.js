// Global variables
let pageProcessed = false;
let currentTabId = null;
let chatHistory = [];
let currentURL = '';
let processedURLs = [];

// Utility functions
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function showTypingIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  indicator.innerHTML = '<span></span><span></span><span></span>';
  document.getElementById('chatbox').appendChild(indicator);
  document.getElementById('chatbox').scrollTop = document.getElementById('chatbox').scrollHeight;
}

function hideTypingIndicator() {
  const indicator = document.getElementById('chatbox').querySelector('.typing-indicator');
  if (indicator) {
    indicator.remove();
  }
}

function renderChatHistory() {
  const chatbox = document.getElementById('chatbox');
  chatbox.innerHTML = '';
  chatHistory.forEach(msg => addMessage(msg.sender, msg.message, msg.className, msg.isClickable, false));
}

function addMessage(sender, message, className, isClickable = false, shouldSave = true) {
  const chatbox = document.getElementById('chatbox');
  const messageElement = document.createElement('div');
  messageElement.className = `message ${className}`;
  
  if (isClickable) {
    messageElement.classList.add('clickable-question');
    messageElement.addEventListener('click', function() {
      document.getElementById('userInput').value = this.textContent;
      sendMessage();
    });
  }
  
  messageElement.textContent = message;
  chatbox.appendChild(messageElement);
  chatbox.scrollTop = chatbox.scrollHeight;

  setTimeout(() => messageElement.classList.add('show'), 10);

  if (shouldSave) {
    chatHistory.push({sender, message, className, isClickable});
    chrome.storage.local.set({[`chatHistory_${currentTabId}`]: chatHistory});
  }

  return messageElement;
}

// Main processing functions
async function initialProcessing() {
  console.log("Starting initial processing");
  showTypingIndicator();
  
  try {
    const pageContent = await getPageContent();
    if (!pageContent) {
      hideTypingIndicator();
      addMessage('System', 'No content found on page', 'ai');
      return;
    }
    
    addMessage('System', 'Processing page...', 'ai');
    const processedData = await processPageContent(pageContent);
    
    hideTypingIndicator();
    handleProcessedData(processedData);
  } catch (error) {
    handleProcessingError(error);
  }
}

function getPageContent() {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(currentTabId, {action: "getPageContent"}, function(response) {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response && response.content) {
        console.log("Got page content, length:", response.content.length);
        resolve(response.content);
      } else {
        resolve(null);
      }
    });
  });
}

async function processPageContent(content) {
  const response = await fetch('http://localhost:5000/v2/process_page', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: content,
      url: currentURL
    }),
  });
  return await response.json();
}

async function handleProcessedData(data) {
  console.log("Process page response:", data);
  if (data.status === 'success') {
    updateProcessedState();
    addMessage('Auralis', 'Page processed successfully. How may I assist you today?', 'ai');
    await delay(2000);
    await displayInitialQuestions(data.initial_questions);
  } else {
    addMessage('System', 'Failed to process page', 'ai');
  }
}

function updateProcessedState() {
  pageProcessed = true;
  if (!processedURLs.includes(currentURL)) {
    processedURLs.push(currentURL);
  }
  chrome.storage.local.set({
    [`pageProcessed_${currentTabId}`]: true,
    [`processedURLs_${currentTabId}`]: processedURLs
  });
  console.log("Updated processedURLs:", processedURLs);
}

async function displayInitialQuestions(questions) {
  if (questions && questions.length > 0) {
    addMessage('Auralis', 'Here are some suggested questions:', 'ai', false);
    await delay(2000);
    for (let question of questions) {
      addMessage('Auralis', question, 'ai', true);
      await delay(2000);
    }
  }
}

function handleProcessingError(error) {
  hideTypingIndicator();
  console.error('Error:', error);
  addMessage('System', 'Failed to process page: ' + error.message, 'ai');
}

async function sendMessage(message = null) {
  const query = message || document.getElementById('userInput').value.trim();
  if (query) {
    if (!pageProcessed) {
      addMessage('System', 'Please wait while the page is being processed.', 'ai');
      return;
    }
    addMessage('You', query, 'user');
    document.getElementById('userInput').value = '';

    showTypingIndicator();

    try {
      const response = await fetch('http://localhost:5000/v2/ask_question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          currentUrl: currentURL,
          processedUrls: processedURLs
        }),
      });
      const data = await response.json();
      hideTypingIndicator();
      console.log("Received answer:", data);
      
      addMessage('Auralis', data.answer, 'ai');
      await delay(2000);
      
      if (data.sources && data.sources.length > 0) {
        addMessage('Auralis', 'Sources: ' + data.sources.join(', '), 'ai');
        await delay(2000);
      }
      
      if (data.suggested_questions && data.suggested_questions.length > 0) {
        addMessage('Auralis', 'Here are some suggested questions:', 'ai', false);
        await delay(2000);
        for (let question of data.suggested_questions) {
          addMessage('Auralis', question, 'ai', true);
          await delay(2000);
        }
      }
    } catch (error) {
      hideTypingIndicator();
      console.error('Error:', error);
      addMessage('System', 'Failed to get response from server', 'ai');
    }
  }
}

function checkURLChange() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0] && tabs[0].url !== currentURL) {
      console.log("URL changed from", currentURL, "to", tabs[0].url);
      currentURL = tabs[0].url;
      processNewPage();
    }
  });
}

function processNewPage() {
  if (!processedURLs.includes(currentURL)) {
    console.log("Processing new page:", currentURL);
    chrome.tabs.sendMessage(currentTabId, {action: "getPageContent"}, function(response) {
      if (response && response.content) {
        fetch('http://localhost:5000/v2/process_page', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: response.content,
            url: currentURL
          }),
        })
        .then(response => response.json())
        .then(data => {
          if (data.status === 'success') {
            processedURLs.push(currentURL);
            chrome.storage.local.set({[`processedURLs_${currentTabId}`]: processedURLs});
            console.log("Updated processedURLs:", processedURLs);
            addMessage('Auralis', 'New page processed. How may I assist you?', 'ai');
          }
        })
        .catch(error => {
          console.error('Error:', error);
          addMessage('System', 'Failed to process new page', 'ai');
        });
      }
    });
  } else {
    console.log("Page already processed:", currentURL);
  }
}

// Main event listener
document.addEventListener('DOMContentLoaded', function() {
  const chatbox = document.getElementById('chatbox');
  const userInput = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');
  const darkModeToggle = document.getElementById('darkModeToggle');
  const body = document.body;
  const icon = darkModeToggle.querySelector('i');

  // Dark mode toggle
  darkModeToggle.addEventListener('click', function() {
    body.classList.toggle('dark-mode');
    icon.classList.toggle('fa-moon');
    icon.classList.toggle('fa-sun');
  });

  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      currentTabId = tabs[0].id;
      currentURL = tabs[0].url;
      chrome.storage.local.get([`chatHistory_${currentTabId}`, `pageProcessed_${currentTabId}`, `processedURLs_${currentTabId}`], function(result) {
        chatHistory = result[`chatHistory_${currentTabId}`] || [];
        pageProcessed = result[`pageProcessed_${currentTabId}`] || false;
        processedURLs = result[`processedURLs_${currentTabId}`] || [];
        
        console.log("Loaded state:", { chatHistory, pageProcessed, processedURLs });
        
        renderChatHistory();
        
        if (pageProcessed && processedURLs.includes(currentURL)) {
          console.log("Page already processed");
        } else {
          initialProcessing();
        }
      });
    }
  });

  sendBtn.addEventListener('click', () => sendMessage());
  userInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') sendMessage();
  });

  setInterval(checkURLChange, 1000);
});

// Tab removal listener
chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
  chrome.storage.local.remove([`chatHistory_${tabId}`, `pageProcessed_${tabId}`, `processedURLs_${tabId}`], function() {
    console.log(`Chat history, page processed state, and processed URLs cleared for tab ${tabId}`);
  });
});