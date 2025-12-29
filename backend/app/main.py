from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.api.routes import auth, exams
from app import models

Base.metadata.create_all(bind=engine)

app = FastAPI(title="GradeFlow API")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://gradeflow-beta.vercel.app/",
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

@app.get("/")
async def root():
    return {"status": "ok"}

