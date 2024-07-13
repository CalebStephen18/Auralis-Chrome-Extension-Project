document.addEventListener('DOMContentLoaded', function() {
  const chatbox = document.getElementById('chatbox');
  const userInput = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');
  const darkModeToggle = document.getElementById('darkModeToggle');
  const body = document.body;
  const icon = darkModeToggle.querySelector('i');
  let pageProcessed = false;
  let currentTabId = null;
  let chatHistory = [];
  let currentURL = '';
  let processedURLs = [];

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

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    chatbox.appendChild(indicator);
    chatbox.scrollTop = chatbox.scrollHeight;
  }
  
  function hideTypingIndicator() {
    const indicator = chatbox.querySelector('.typing-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  function renderChatHistory() {
    chatbox.innerHTML = '';
    chatHistory.forEach(msg => addMessage(msg.sender, msg.message, msg.className, msg.isClickable, false));
  }

  function addMessage(sender, message, className, isClickable = false, shouldSave = true) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${className}`;
    
    if (isClickable) {
      messageElement.classList.add('clickable-question');
      messageElement.addEventListener('click', function() {
        userInput.value = this.textContent;
        sendMessage();
      });
    }
    
    messageElement.textContent = message;
    chatbox.appendChild(messageElement);
    chatbox.scrollTop = chatbox.scrollHeight;
  
    // Add animation class
    setTimeout(() => messageElement.classList.add('show'), 10);
  
    if (shouldSave) {
      chatHistory.push({sender, message, className, isClickable});
      chrome.storage.local.set({[`chatHistory_${currentTabId}`]: chatHistory});
    }
  
    return messageElement;
  }

  async function sendMessage(message = null) {
    const query = message || userInput.value.trim();
    if (query) {
      if (!pageProcessed) {
        addMessage('System', 'Please wait while the page is being processed.', 'ai');
        return;
      }
      addMessage('You', query, 'user');
      userInput.value = '';
  
      showTypingIndicator();
  
      try {
        const response = await fetch('http://localhost:5000/ask_question', {
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
        
        // Add the main answer
        addMessage('Auralis', data.answer, 'ai');
        await delay(2000);
        
        // Add the sources if available
        if (data.sources && data.sources.length > 0) {
          addMessage('Auralis', 'Sources: ' + data.sources.join(', '), 'ai');
          await delay(2000);
        }
        
        // Add suggested questions
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

  sendBtn.addEventListener('click', () => sendMessage());
  userInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') sendMessage();
  });

  async function initialProcessing() {
    console.log("Starting initial processing");
    showTypingIndicator();
    chrome.tabs.sendMessage(currentTabId, {action: "getPageContent"}, async function(response) {
      if (chrome.runtime.lastError) {
        console.error("Error sending message:", chrome.runtime.lastError.message);
        hideTypingIndicator();
        addMessage('System', 'Failed to get page content: ' + chrome.runtime.lastError.message, 'ai');
        return;
      }
      if (response && response.content) {
        console.log("Got page content, length:", response.content.length);
        addMessage('System', 'Processing page...', 'ai');
        try {
          const res = await fetch('http://localhost:5000/process_page', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: response.content,
              url: currentURL
            }),
          });
          const data = await res.json();
          hideTypingIndicator();
          console.log("Process page response:", data);
          if (data.status === 'success') {
            pageProcessed = true;
            if (!processedURLs.includes(currentURL)) {
              processedURLs.push(currentURL);
            }
            chrome.storage.local.set({
              [`pageProcessed_${currentTabId}`]: true,
              [`processedURLs_${currentTabId}`]: processedURLs
            });
            console.log("Updated processedURLs:", processedURLs);
            addMessage('Auralis', 'Page processed successfully. How may I assist you today?', 'ai');
            await delay(2000);
            if (data.initial_questions && data.initial_questions.length > 0) {
              addMessage('Auralis', 'Here are some suggested questions:', 'ai', false);
              await delay(2000);
              for (let question of data.initial_questions) {
                addMessage('Auralis', question, 'ai', true);
                await delay(2000);
              }
            }
          } else {
            addMessage('System', 'Failed to process page', 'ai');
          }
        } catch (error) {
          hideTypingIndicator();
          console.error('Error:', error);
          addMessage('System', 'Failed to process page', 'ai');
        }
      } else {
        hideTypingIndicator();
        console.log("No content in response");
        addMessage('System', 'No content found on page', 'ai');
      }
    });
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
          fetch('http://localhost:5000/process_page', {
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

  setInterval(checkURLChange, 1000);
});

chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
  chrome.storage.local.remove([`chatHistory_${tabId}`, `pageProcessed_${tabId}`, `processedURLs_${tabId}`], function() {
    console.log(`Chat history, page processed state, and processed URLs cleared for tab ${tabId}`);
  });
});