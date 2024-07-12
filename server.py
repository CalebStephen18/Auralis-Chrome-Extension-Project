from flask import Flask, request, jsonify
from flask_cors import CORS
from langchain_community.document_loaders import WebBaseLoader
from langchain.text_splitter import CharacterTextSplitter
from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.chains import ConversationalRetrievalChain, LLMChain
from langchain.memory import ConversationBufferMemory
from langchain_community.llms import Ollama
from langchain.prompts import PromptTemplate

app = Flask(__name__)
CORS(app, resources={r"/": {"origins": ""}})

llm = Ollama(model="llama2")
embeddings = OllamaEmbeddings()
memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)

vectorstore = None
qa = None

# Create a custom prompt template for QA
qa_template = """Use the following pieces of context from the webpage to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.

{context}

Question: {question}
Helpful Answer:"""

QA_PROMPT = PromptTemplate(template=qa_template, input_variables=["context", "question"])

# Create a custom prompt template for question generation
question_generator_template = """
Based on the following webpage content, suggest 3 relevant questions that a user might want to ask:

Webpage content: {content}

Provide only the questions, without any explanations or numbering:
"""

question_generator_prompt = PromptTemplate(
    input_variables=["content"],
    template=question_generator_template
)

question_generator_chain = LLMChain(
    llm=llm,
    prompt=question_generator_prompt
)

@app.route('/process_page', methods=['POST'])
def process_page():
    global vectorstore, qa
    print("Process page endpoint called")
    if 'content' not in request.json:
        print("No content in request")
        return jsonify({'error': 'No content provided'}), 400
    
    content = request.json['content']
    url = request.json.get('url', '')
    append = request.json.get('append', False)
    print(f"Processing page with content length: {len(content)}")
    
    text_splitter = CharacterTextSplitter(
        separator = "\n",
        chunk_size = 1000,
        chunk_overlap  = 200,
        length_function = len,
    )
    texts = text_splitter.split_text(content)
    print(f"Split into {len(texts)} chunks")
    
    if append and vectorstore:
        vectorstore.add_texts(texts, metadatas=[{"source": url}] * len(texts))
    else:
        vectorstore = Chroma.from_texts(texts, embeddings, metadatas=[{"source": url}] * len(texts))
    
    qa = ConversationalRetrievalChain.from_llm(
        llm=llm,
        retriever=vectorstore.as_retriever(search_kwargs={"k": 3}),
        memory=memory,
        combine_docs_chain_kwargs={"prompt": QA_PROMPT}
    )
    print("QA chain created successfully")
    
    initial_questions = question_generator_chain.run(content=content)
    print(f"Initial questions generated: {initial_questions}")
    
    return jsonify({
        'initial_questions': initial_questions,
        'status': 'success'
    })

@app.route('/ask_question', methods=['POST'])
def ask_question():
    global qa
    print("Ask question endpoint called")
    if qa is None:
        print("QA is None, page not processed yet")
        return jsonify({'error': 'Please process a page first'}), 400

    if 'query' not in request.json:
        print("No query in request")
        return jsonify({'error': 'No query provided'}), 400

    query = request.json['query']
    print(f"Received question: {query}")

    result = qa({"question": query})
    answer = result['answer']

    # Add source documents to the response
    source_documents = result.get('source_documents', [])
    sources = [doc.metadata.get('source', 'Unknown') for doc in source_documents]

    suggested_questions = question_generator_chain.run(content=answer)
    print(f"Answer: {answer}")
    print(f"Sources: {sources}")
    print(f"Suggested questions: {suggested_questions}")

    return jsonify({
        'answer': answer,
        'sources': sources,
        'suggested_questions': suggested_questions
    })

if __name__ == '__main__':
    app.run(debug=True)