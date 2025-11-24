# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.api.routes import auth
from app import models  # ensures models are imported so tables are created

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="GradeFlow API")

# ✅ CORS CONFIG
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,        # or ["*"] in dev if you prefer
    allow_credentials=True,
    allow_methods=["*"],          # allow all methods (GET, POST, etc.)
    allow_headers=["*"],          # allow all headers (Authorization, etc.)
)

# ✅ ROUTES
app.include_router(auth.router, prefix="/auth", tags=["auth"])


@app.get("/")
async def root():
  return {"status": "ok"}
