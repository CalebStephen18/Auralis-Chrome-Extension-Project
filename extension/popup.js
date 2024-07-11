document.addEventListener('DOMContentLoaded', function() {
    const chatbox = document.getElementById('chatbox');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
  
    function addMessage(sender, message, className) {
      const messageElement = document.createElement('div');
      messageElement.className = `message ${className}`;
      messageElement.textContent = `${sender}: ${message}`;
      chatbox.appendChild(messageElement);
      chatbox.scrollTop = chatbox.scrollHeight;
    }
  
    function sendMessage() {
      const message = userInput.value.trim();
      if (message) {
        addMessage('You', message, 'user');
        userInput.value = '';
  
        fetch('http://localhost:5000/ask_question', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({query: message}),
        })
        .then(response => response.json())
        .then(data => {
          addMessage('AI', data.answer, 'ai');
          addMessage('Suggested Questions', data.suggested_questions, 'ai');
        });
      }
    }
  
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') sendMessage();
    });
  
    // Initial processing
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "getPageContent"}, function(response) {
        if (response && response.content) {
          fetch('http://localhost:5000/process_page', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({content: response.content}),
          })
          .then(response => response.json())
          .then(data => {
            addMessage('Suggested Questions', data.initial_questions, 'ai');
          });
        }
      });
    });
});
