from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine
from app.api.routes import auth, exams, subjects
from app.models import *

Base.metadata.create_all(bind=engine)

app = FastAPI(title="GradeFlow API")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://grade-frontend-vercel.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(exams.router, prefix="/exams", tags=["exams"])
app.include_router(subjects.router, prefix="/subjects", tags=["subjects"])

@app.get("/")
async def root():
    return {"status": "ok"}

@app.options("/{path:path}")
async def options_handler(path: str):
    return {}

