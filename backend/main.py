from fastapi import FastAPI
from pymongo import MongoClient
from typing import Dict, Any, Optional
from transformers import pipeline
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. Lesson Data ---
MOCK_LESSONS: Dict[str, Any] = {
    "english": {
        "language": "English",
        "title": "Welcome to the Platform",
        "content": "Hello! This is your first lesson on simple English grammar. We will learn about verbs and nouns today.",
        "quiz_id": "quiz-eng-101"
    },
    "tamil": {
        "language": "Tamil",
        "title": "அறிமுகம் (Introduction)",
        "content": "வணக்கம்! இன்று நாம் தமிழ் எழுத்துக்களைப் பற்றி கற்போம். இது உங்கள் முதல் பாடம்.",
        "quiz_id": "quiz-tamil-101"
    }
}

# --- 2. Quiz Data ---
MOCK_QUIZZES: Dict[str, Any] = {
    "english": [
        {
            "question": "What is a noun?",
            "options": ["An action word", "A naming word", "A describing word", "None of the above"],
            "answer": "A naming word"
        },
        {
            "question": "Which of these is a verb?",
            "options": ["Run", "Table", "Happy", "Blue"],
            "answer": "Run"
        }
    ],
    "tamil": [
        {
            "question": "தமிழ் எழுத்துக்களின் எண்ணிக்கை எவ்வளவு?",
            "options": ["247", "200", "180", "300"],
            "answer": "247"
        },
        {
            "question": "தமிழ் எது?",
            "options": ["Language", "Fruit", "Animal", "Place"],
            "answer": "Language"
        }
    ]
}

# --- 3. AI Model Setup (Summarizer for now) ---
nlp_model: Optional[Any] = None
MODEL_READY: bool = False
try:
    nlp_model = pipeline("summarization", model="facebook/bart-large-cnn")
    MODEL_READY = True
except Exception as e:
    print("Model load failed:", e)

# --- 4. Endpoints ---

@app.get("/")
def home():
    return {"message": "Multilingual Learning Assistant API Running 🚀"}

@app.get("/lesson/{lang}")
def get_lesson(lang: str):
    lang_key = lang.lower()
    if lang_key in MOCK_LESSONS:
        return {"lesson": MOCK_LESSONS[lang_key]}
    else:
        return {"lesson": {"error": f"No lesson found for {lang}"}}

@app.get("/quiz/{lang}")
def get_quiz(lang: str):
    lang_key = lang.lower()
    if lang_key in MOCK_QUIZZES:
        return {"quiz": MOCK_QUIZZES[lang_key]}
    else:
        return {"quiz": []}

@app.post("/explain-ai/")
def explain_ai(request: Dict[str, str]):
    question = str(request.get("question", ""))
    if not MODEL_READY or nlp_model is None:
        return {"answer": "AI model is not ready. Please try later."}
    try:
        summary = nlp_model(question, max_length=80, min_length=10, do_sample=False)
        return {"answer": summary[0]["summary_text"]}
    except Exception as e:
        return {"error": str(e)}
