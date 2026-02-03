from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.database import Base, engine, SessionLocal
from app.api.routes import auth, exams, subjects
from app.models.user import User
from app.core.security import hash_password
import logging
from app.models.programme import Programme
from app.models.exam import SubjectCatalog

def create_initial_admin(db: Session):
    admin_email = "admin@gradeflow.com"
    existing_admin = db.query(User).filter(User.email == admin_email).first()
    if not existing_admin:
        print(f"Creating default admin: {admin_email}")
        new_admin = User(
            name="System Admin",
            email=admin_email,
            hashed_password=hash_password("admin123"), # Change after login
            role="admin"
        )
        db.add(new_admin)
        db.commit()

def seed_all_data(db: Session):

    # -------------------------------------------------
    # 1. PROGRAMMES
    programmes = [
        # B.Sc. IT
        {"name": "B.Sc. (Information Technology)", "code": "BSC_IT", "sem": 6, "start": 1},

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
            db.add(Programme(name=p["name"], programme_code=p["code"], total_semesters=p["sem"], semester_start=1))
    db.commit()

    # -------------------------------------------------
    # 2. SUBJECT CATALOG
    subjects_list = [
    # -------------------------------------------------
    # M.Com. (Part-I) – Semester 2
    # -------------------------------------------------
    ("M.Com. (Part-I)", 2, "PMCOM.201", "Corporate Financial Reporting"),
    ("M.Com. (Part-I)", 2, "PMCOM.202", "E-Commerce"),
    ("M.Com. (Part-I)", 2, "PMCOM.203", "Advance Macroeconomics"),
    ("M.Com. (Part-I)", 2, "PMCOM.204", "Marketing Research"),
    ("M.Com. (Part-I)", 2, "PMCOM.205", "Investment Analysis and Portfolio Management"),
    ("M.Com. (Part-I)", 2, "PMCOM.206", "Internship"),

    # -------------------------------------------------
# M.Com. (Part-II - Advanced Accounting) – Semester 4
# -------------------------------------------------
("M.Com. (Part-II - Advanced Accounting)", 4, "PMCOM.401", "Corporate Financial Accounting"),
("M.Com. (Part-II - Advanced Accounting)", 4, "PMCOM.402", "Indirect Tax"),
("M.Com. (Part-II - Advanced Accounting)", 4, "PMCOM.403", "Financial Management"),
("M.Com. (Part-II - Advanced Accounting)", 4, "PMCOM.404", "Advanced Auditing"),
("M.Com. (Part-II - Advanced Accounting)", 4, "PMCOM.405", "Financial Reporting-II"),
("M.Com. (Part-II - Advanced Accounting)", 4, "PMCOM.406", "Research Project"),

        # -------------------------------------------------
# M.Com. (Part-II - Business Management) – Semester 4
# -------------------------------------------------
("M.Com. (Part-II - Business Management)", 4, "PMCOM.401", "Supply Chain Management"),
("M.Com. (Part-II - Business Management)", 4, "PMCOM.402", "Management of Business Relations"),
("M.Com. (Part-II - Business Management)", 4, "PMCOM.403", "Tourism Management"),
("M.Com. (Part-II - Business Management)", 4, "PMCOM.404", "Organisational Behaviour"),
("M.Com. (Part-II - Business Management)", 4, "PMCOM.405", "Advertising and Sales Management"),
("M.Com. (Part-II - Business Management)", 4, "PMCOM.406", "Research Project"),

       
    ]
    for prog, sem, code, name in subjects_list:
        if not db.query(SubjectCatalog).filter(SubjectCatalog.subject_code == code).first():
            db.add(SubjectCatalog(programme=prog, semester=sem, subject_code=code, subject_name=name))
    db.commit()
    

# 2. RUN SETUP
Base.metadata.create_all(bind=engine)

# Run seeding
db = SessionLocal()
try:
    create_initial_admin(db) # From previous steps
    seed_all_data(db)      # The function above
    print("Database seeding successful!")
except Exception as e:
    print(f"Error seeding data: {e}")
finally:
    db.close()

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




