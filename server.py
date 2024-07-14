from flask import Flask, request, jsonify
from flask_cors import CORS
from langchain_groq import ChatGroq
from langchain_community.document_loaders import WebBaseLoader
from langchain.text_splitter import CharacterTextSplitter
from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.chains import ConversationalRetrievalChain, LLMChain
from langchain_community.llms import Ollama
from langchain.memory import ConversationBufferMemory
from langchain.prompts import PromptTemplate
from typing import Dict, List
import logging

app = Flask(__name__)
CORS(app, resources={r"/": {"origins": ""}})

llm = Ollama(model="llama3")  

embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)

vectorstores: Dict[str, FAISS] = {}

qa_template = """Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.

{context}

Question: {question}
Helpful Answer:"""

QA_PROMPT = PromptTemplate(template=qa_template, input_variables=["context", "question"])

question_generator_template = """
Based on the following webpage content, suggest 3 relevant questions that a user might want to ask:

Webpage content: {content}

Provide the questions in the following format:
Q1: [First question]
Q2: [Second question]
Q3: [Third question]
"""

question_generator_prompt = PromptTemplate(
    input_variables=["content"],
    template=question_generator_template
)

question_generator_chain = LLMChain(
    llm=llm,
    prompt=question_generator_prompt
)

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.route('/v2/process_page', methods=['POST'])
def process_page():
    logger.info("Process page endpoint called")
    if 'content' not in request.json:
        logger.warning("No content in request")
        return jsonify({'error': 'No content provided'}), 400
    
    content = request.json['content']
    url = request.json.get('url', '')
    logger.info(f"Processing page with content length: {len(content)}")
    logger.info(f"URL: {url}")
    create_vectorstore(content, url)
    initial_questions = generate_questions(content)
    
    return jsonify({
        'initial_questions': initial_questions,
        'status': 'success'
    })

def create_vectorstore(content, url):
    global vectorstores
    text_splitter = CharacterTextSplitter(
        separator = "\n",
        chunk_size = 1000,
        chunk_overlap  = 200,
        length_function = len,
    )
    texts = text_splitter.split_text(content)
    logger.info(f"Split into {len(texts)} chunks")
    
    vectorstores[url] = FAISS.from_texts(texts, embeddings, metadatas=[{"source": url}] * len(texts))
    
    logger.info("Vector store created successfully")

def generate_questions(content):
    initial_questions = question_generator_chain.run(content=content)
    
    processed_questions = []
    for line in initial_questions.split('\n'):
        if line.strip().startswith('Q'):
            question = line.split(':', 1)[1].strip()
            processed_questions.append(question)
    
    logger.info(f"Initial questions generated: {processed_questions}")
    
    return processed_questions

@app.route('/v2/ask_question', methods=['POST'])
def ask_question():
    logger.info("\n--- New question received ---")
    logger.info(f"Request data: {request.json}")
    
    if not vectorstores:
        logger.info("No pages processed yet")
        return jsonify({'error': 'Please process a page first'}), 400

    if 'query' not in request.json:
        logger.info("No query in request")
        return jsonify({'error': 'No query provided'}), 400

    query = request.json['query']
    current_url = request.json.get('currentUrl', '')
    processed_urls = request.json.get('processedUrls', [])
    logger.info(f"Received question: {query}")
    logger.info(f"Current URL: {current_url}")
    logger.info(f"Processed URLs: {processed_urls}")

    result = tiered_search(query, current_url, processed_urls)
    answer = result['answer']
    context = result.get('context', '')

    logger.info(f"Final answer: {answer}")

    if answer == "I couldn't find a relevant answer in the current or previous pages.":
        # Use the entire website's content for suggested questions
        full_content = ""
        for url in processed_urls:
            if url in vectorstores:
                docs = vectorstores[url].similarity_search("", k=100)  # Get all documents
                full_content += "\n".join(doc.page_content for doc in docs)
        suggested_questions = question_generator_chain.run(content=full_content)
    else:
        # Use the context for suggested questions
        suggested_questions = question_generator_chain.run(content=context)
    
    processed_questions = []
    for line in suggested_questions.split('\n'):
        if line.strip().startswith('Q'):
            question = line.split(':', 1)[1].strip()
            processed_questions.append(question)

    logger.info(f"Suggested questions: {processed_questions}")

    return jsonify({
        'answer': answer,
        'sources': result.get('sources', []),
        'suggested_questions': processed_questions
    })

def tiered_search(query: str, current_url: str, processed_urls: List[str]):
    logger.info(f"\nPerforming tiered search for query: {query}")
    logger.info(f"Current URL: {current_url}")
    logger.info(f"Processed URLs: {processed_urls}")
    
    if current_url in vectorstores:
        logger.info(f"Searching current URL: {current_url}")
        result = search_single_store(query, vectorstores[current_url])
        if result['answer'].strip() and not result['answer'].lower().startswith("i don't know"):
            logger.info(f"Answer found in current URL: {current_url}")
            return result
    
    # Only search other URLs if no answer was found in the current URL
    for url in reversed(processed_urls):
        if url != current_url and url in vectorstores:
            logger.info(f"Searching previous URL: {url}")
            result = search_single_store(query, vectorstores[url])
            if result['answer'].strip() and not result['answer'].lower().startswith("i don't know"):
                logger.info(f"Answer found in previous URL: {url}")
                return result
    
    logger.info("No answer found in any processed URLs")
    return {"answer": "I couldn't find a relevant answer in the current or previous pages.", "source_documents": [], "context": ""}

def search_single_store(query: str, store: FAISS):
    docs = store.similarity_search(query, k=3)
    
    logger.info(f"\nQuery: {query}")
    logger.info("Retrieved context chunks:")
    for i, doc in enumerate(docs, 1):
        logger.info(f"Chunk {i}:")
        logger.info(doc.page_content)
        logger.info(f"Metadata: {doc.metadata}")
        logger.info("-" * 50)
    
    context = "\n".join(doc.page_content for doc in docs)
    
    qa = ConversationalRetrievalChain.from_llm(
        llm=llm,
        retriever=store.as_retriever(search_kwargs={"k": 3}),
        memory=memory,
        combine_docs_chain_kwargs={"prompt": QA_PROMPT}
    )
    
    result = qa({"question": query, "chat_history": []})
    result['source_documents'] = docs
    result['context'] = context
    return result

if __name__ == '__main__':
    app.run(debug=True, use_reloader = False)
