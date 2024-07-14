# Auralis Chatbot Server API Documentation

## Base URL
All endpoints are relative to: `http://localhost:5000`

## Endpoints

### 1. Process Page

Processes a web page's content and prepares it for question answering.

- **URL:** `/process_page`
- **Method:** `POST`
- **Content-Type:** `application/json`

#### Request Body
```json
{
  "content": "Full text content of the web page",
  "url": "URL of the web page (optional)"
}
```
Success Response:
Code: 200 OK
Content:
```json
{
  "initial_questions": [
    "Question 1",
    "Question 2",
    "Question 3"
  ],
  "status": "success"
}
```
Error Response:
Code: 400 Bad Request
Content:
```json
{
  "error": "No content provided"
}
```
#### Notes:
- This endpoint splits the provided content into chunks, creates embeddings, and stores them in a FAISS vector store.
- It also generates initial questions based on the content.

### 2. Ask Question

Answers a user's question based on the processed page content.

- **URL:** `/ask_question`
- **Method:** `POST`
- **Content-Type:** `application/json`

#### Request Body
```json
{
  "query": "User's question",
  "currentUrl": "URL of the current page",
  "processedUrls": ["Array of previously processed URLs"]
}
```
Success Response:
Code: 200 OK
Content:
```json
{
  "answer": "Generated answer to the user's question",
  "sources": ["Source 1", "Source 2"],
  "suggested_questions": [
    "Follow-up question 1",
    "Follow-up question 2",
    "Follow-up question 3"
  ]
}
```
Error Response:
Code: 400 Bad Request
Content:
```json
{
  "error": "Please process a page first"
}
```
or

```json
{
  "error": "No query provided"
}
```
#### Notes:
- This endpoint performs a tiered search across the current page and previously processed pages.
- It uses a ConversationalRetrievalChain to generate answers based on the retrieved context.
- The response includes the answer, sources (if available), and suggested follow-up questions.

## Internal Functions
```
tiered_search(query: str, current_url: str, processed_urls: List[str])
```
Performs a tiered search across multiple processed pages.
```
search_single_store(query: str, store: FAISS)
```
Searches a single FAISS vector store for relevant document chunks.

## Models and Embeddings
- Language Model: Ollama model "llama3"
- Embeddings: HuggingFaceEmbeddings model "all-MiniLM-L6-v2"

## Vector Store
FAISS is used as the vector store for efficient similarity search of document chunks.

## Memory
ConversationBufferMemory is used to maintain conversation history.

## Prompts
Two main prompts are used:

- QA_PROMPT: For generating answers based on context
- question_generator_prompt: For generating suggested questions

## Error Handling
- The server returns appropriate error messages and status codes for common issues like missing content or queries.
- Detailed error logging is implemented for server-side issues.

## CORS
CORS is enabled for all origins on the / route.

## Running the Server
The server runs in debug mode when executed directly:
```
if __name__ == '__main__':
    app.run(debug=True, use_reloader=False)
```
### Note: In production, it's recommended to use a proper WSGI server instead of the built-in Flask server.
