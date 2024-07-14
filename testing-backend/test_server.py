import pytest
import requests

BASE_URL = "http://localhost:5000"

@pytest.fixture
def base_url():
    return BASE_URL

def test_invalid_url(base_url):
    payload = {
        "query": "What encryption is used?",
        "currentUrl": "",
        "processedUrls": [""]
    }
    response = requests.post(f"{base_url}/v2/ask_question", json=payload)
    assert response.status_code == 400
    
def test_page_processing_and_suggested_questions_generator_for_auralis_website(base_url):
    payload = {
        "content": "Yes, Auralis AI prioritizes security and reliability. It employs state-of-the-art AES256 encryption encryption and security practices to safeguard all interactions and data. Continuous updates and monitoring also ensure that the system remains robust against evolving threats and challenges in the AI landscape. We generally don’t store PII unless you specifically upload it, or a user provides it in a question to your bots. We store queries and responses in our database to be able to provide and improve on the service. Queries and responses also pass through OpenAI and are subject to their privacy policy as well.",
        "url": "http://auralis.ai"
    }
    response = requests.post(f"{base_url}/v2/process_page", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "initial_questions" in data

def test_ask_questions_with_auralis_context(base_url):
    payload = {
        "query": "What encryption is used?",
        "currentUrl": "auralis.ai",
        "processedUrls": ["auralis.ai"]
    }
    response = requests.post(f"{base_url}/v2/ask_question", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "suggested_questions" in data

def test_if_backend_handles_irrelevant_questions(base_url):
    payload = {
        "query": "How does Auralis affect my health?",
        "currentUrl": "auralis.ai",
        "processedUrls": ["auralis.ai"]
    }
    response = requests.post(f"{base_url}/v2/ask_question", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "couldn't find a relevant answer" in data["answer"]
    assert "suggested_questions" in data
