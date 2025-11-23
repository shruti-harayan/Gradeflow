# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import auth

app = FastAPI(title="GradeFlow API")
app.include_router(auth.router, prefix="/auth", tags=["auth"])

# Simple CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple health route
@app.get("/")
async def root():
    return {"status": "ok", "service": "GradeFlow API"}

