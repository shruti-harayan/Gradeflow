from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.database import Base, engine, SessionLocal
from app.api.routes import auth, exams, subjects
from app.models.user import User
from app.core.security import hash_password
import logging

# 1. DEFINE THE FUNCTION
def create_initial_admin():
    db = SessionLocal()
    try:
        admin_email = "admin@gradeflow.com"
        existing_admin = db.query(User).filter(User.email == admin_email).first()
        if not existing_admin:
            print(f"Creating default admin: {admin_email}")
            new_admin = User(
                name="System Admin",
                email=admin_email,
                hashed_password=hash_password("admin123"),
                role="admin"
            )
            db.add(new_admin)
            db.commit()
    except Exception as e:
        print(f"Admin setup skipped: {e}")
    finally:
        db.close()

# 2. RUN SETUP
Base.metadata.create_all(bind=engine)
create_initial_admin()

app = FastAPI(title="GradeFlow API")

# 3. CORS SETTINGS
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://grade-frontend-vercel.vercel.app", # Vercel URL
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
