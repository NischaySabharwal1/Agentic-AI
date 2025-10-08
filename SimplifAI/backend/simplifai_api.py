from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import google.generativeai as genai
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI()

# --- Gemini API Configuration ---
# The API key will be passed from the extension, but a fallback is useful for direct testing
GEMINI_API_KEY_FALLBACK = os.getenv("GEMINI_API_KEY")

class TextProcessRequest(BaseModel):
    text: str
    api_key: Optional[str] = None

class ChatMessage(BaseModel):
    role: str
    parts: List[str]

class ChatRequest(BaseModel):
    history: List[ChatMessage]
    message: str
    api_key: Optional[str] = None

# --- Helper for Gemini Client ---
def get_gemini_client(api_key: Optional[str]) -> genai.GenerativeModel:
    key = api_key or GEMINI_API_KEY_FALLBACK
    if not key:
        raise HTTPException(status_code=400, detail="Gemini API Key not provided.")
    genai.configure(api_key=key)
    return genai.GenerativeModel('gemini-2.0-flash') # Corrected model name

# --- Endpoints ---

@app.post("/simplify")
async def simplify_text(request: TextProcessRequest):
    try:
        model = get_gemini_client(request.api_key)
        prompt = f"Simplify the following text: {request.text}"
        response = await model.generate_content_async(prompt)
        return {"simplified_text": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/translate")
async def translate_text(request: TextProcessRequest, target_language: str = "English"):
    try:
        model = get_gemini_client(request.api_key)
        prompt = f"Translate the following text to {target_language}: {request.text}"
        response = await model.generate_content_async(prompt)
        return {"translated_text": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat_with_gemini(request: ChatRequest):
    try:
        model = get_gemini_client(request.api_key)
        # Convert ChatMessage to the format expected by the Gemini API
        history_for_gemini = []
        for msg in request.history:
            history_for_gemini.append({"role": msg.role, "parts": msg.parts})

        chat_session = model.start_chat(history=history_for_gemini)
        response = await chat_session.send_message_async(request.message)
        return {"response": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
