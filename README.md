# Auralis Chatbot Chrome Extension

## Overview

Auralis Chatbot is a powerful Chrome extension that leverages Language Models (LLMs) and Retrieval-Augmented Generation (RAG) to provide intelligent, context-aware responses to user queries about web page content. This extension processes the content of the current web page and allows users to ask questions about it, receiving informative answers and suggested follow-up questions. 

### Key Features

- Real-time web page content processing
- Intelligent question-answering using RAG technology
- Suggested questions based on page content and user interactions
- Dark mode toggle for user comfort
- Persistent chat history across browser sessions
- Multi-page context awareness

## Installation

### Prerequisites

- Python 3.7+
- Google Chrome browser

### Server Setup

1. Clone the repository: https://github.com/CalebStephen18/Auralis-Chrome-Extension-Project.git 
2. Install the required Python packages: pip install -r requirements.txt
3. Start the Flask server: python server.py

### Chrome Extension Setup

1. Open Google Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select the directory containing the extension files (manifest.json, popup.html, etc.)
4. The Auralis Chatbot extension should now appear in your Chrome toolbar

## Usage

1. Navigate to any web page you want to analyze
2. Click on the Auralis Chatbot extension icon in your Chrome toolbar
3. Wait for the "Page processed successfully" message
4. Start asking questions about the page content in the chat interface
5. Click on suggested questions or type your own
6. Toggle dark mode using the moon/sun icon for comfortable viewing

## Architecture

### Client-side Components

- **Popup (popup.js, popup.html)**: The main user interface for interacting with the chatbot
- **Background Script (background.js)**: Manages the extension's state and communicates with the server
- **Content Script (content.js)**: Extracts page content and injects it into the extension

### Server-side Components

- **Flask Server (server.py)**: Handles requests from the extension, processes page content, and generates responses
- **LangChain Integration**: Utilizes various LangChain components for document processing, embedding, and question-answering

Detailed documentation is present for the Client-side and Server-side components.

### RAG Process

1. Web page content is extracted and sent to the server
2. Content is split into chunks and embedded using HuggingFace embeddings
3. Embeddings are stored in a FAISS vector store for efficient retrieval
4. User queries are processed using a combination of retrieval and language model generation
5. Relevant context is retrieved and used to generate accurate responses

## Configuration

- The default Language Model used is "llama3" via Ollama. To change this, modify the `llm` variable in `server.py`
- Embeddings are generated using the "all-MiniLM-L6-v2" model. This can be changed in the `embeddings` variable in `server.py`

## Maintenance

### Updating the Extension

1. Pull the latest changes from the GitHub repository
2. Update any dependencies: `pip install -r requirements.txt`
3. Restart the Flask server
4. In Chrome, go to `chrome://extensions/`, find Auralis Chatbot, and click "Reload"

### Troubleshooting

- If the extension isn't processing pages, ensure the Flask server is running on `localhost:5000`
- Clear your browser cache and restart Chrome if you encounter persistent issues
- Check the browser console and server logs for error messages


## Acknowledgments

- [LangChain](https://github.com/hwchase17/langchain) for providing the foundation for our RAG implementation
- [Ollama](https://github.com/jmorganca/ollama) for the local LLM integration
- [FAISS](https://github.com/facebookresearch/faiss) for efficient similarity search
