from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.database import Base, engine, SessionLocal
from app.api.routes import auth, exams, subjects
from app.models.user import User
from app.models.programme import Programme
from app.models.exam import SubjectCatalog


def seed_all_data(db: Session):
    # 1. PROGRAMMES
    programmes = [
        # M.Sc. IT
        {"name": "M.Sc. (Information Technology)", "code": "MSC_IT", "sem": 4, "start": 1},
        # M.Com Part-I
        {"name": "M.Com. (Part-I)", "code": "MCOM", "sem": 2, "start": 1},
        # M.Com Part-II
        {"name": "M.Com. (Part-II - Advanced Accounting)", "code": "MCOM", "sem": 2, "start": 3},
        {"name": "M.Com. (Part-II - Business Management)", "code": "MCOM", "sem": 2, "start": 3},
    ]
    for p in programmes:
        if not db.query(Programme).filter(Programme.name == p["name"]).first():
            db.add(Programme(name=p["name"], programme_code=p["code"], total_semesters=p["sem"], semester_start=p["start"]))
    db.commit()


    # 2. SUBJECT CATALOG
    subjects_list = [
    # -------------------------------------------------
    # M.Com. (Part-II - Advanced Accounting) – Semester 4
    # -------------------------------------------------
    ("M.Com. (Part-II - Advanced Accounting)", 4, "PMCOM.401", "Corporate Financial Accounting"),
    ("M.Com. (Part-II - Advanced Accounting)", 4, "PMCOM.402", "Indirect Tax"),
    ("M.Com. (Part-II - Advanced Accounting)", 4, "PMCOM.403", "Financial Management"),
    ("M.Com. (Part-II - Advanced Accounting)", 4, "PMCOM.404", "Advanced Auditing"),
    ("M.Com. (Part-II - Advanced Accounting)", 4, "PMCOM.405", "Financial Reporting-II"),
    ("M.Com. (Part-II - Advanced Accounting)", 4, "PMCOM.406", "Research Project"),
    ]
    for prog, sem, code, name in subjects_list:
        if not db.query(SubjectCatalog).filter(SubjectCatalog.subject_code == code).first():
            db.add(SubjectCatalog(programme=prog, semester=sem, subject_code=code, subject_name=name))
    db.commit()

# RUN SETUP
Base.metadata.create_all(bind=engine)

app = FastAPI(title="GradeFlow API")

# @app.on_event("startup")
# def startup_event():
#     db = SessionLocal()
#     try:
#         seed_all_data(db)
#     finally:
#         db.close()

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
