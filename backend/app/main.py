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

        # -------------------------------
        # M.Sc. IT – Semester 1
        # -------------------------------
        ("M.Sc. (Information Technology)", 1, "PSIT.SI.P501", "Data Science"),
        ("M.Sc. (Information Technology)", 1, "PSIT.SI.P502", "Cloud Computing"),
        ("M.Sc. (Information Technology)", 1, "PSIT.SI.P503", "Soft Computing"),
        ("M.Sc. (Information Technology)", 1, "PSIT.SI.P504", "Image Processing"),
        ("M.Sc. (Information Technology)", 1, "PSIT.SI.P505.1", "Artificial Intelligence"),
        ("M.Sc. (Information Technology)", 1, "PSIT.SI.P505.2", "Natural Language Processing"),
        ("M.Sc. (Information Technology)", 1, "PSIT.SI.P506", "Research Methodology"),

        # -------------------------------
        # M.Sc. IT – Semester 2
        # -------------------------------
        ("M.Sc. (Information Technology)", 2, "PSIT.SII.P501", "Big Data Analytics"),
        ("M.Sc. (Information Technology)", 2, "PSIT.SII.P502", "Modern Networking"),
        ("M.Sc. (Information Technology)", 2, "PSIT.SII.P503", "Microservice Architecture"),
        ("M.Sc. (Information Technology)", 2, "PSIT.SII.P504", "Computer Vision"),
        ("M.Sc. (Information Technology)", 2, "PSIT.SII.P505.1", "Machine Learning"),
        ("M.Sc. (Information Technology)", 2, "PSIT.SII.P505.2", "Cloud Management"),
        ("M.Sc. (Information Technology)", 2, "PSIT.SII.P506", "Internship"),

        # -------------------------------
        # M.Sc. IT – Semester 3
        # -------------------------------
        ("M.Sc. (Information Technology)", 3, "PSIT.501", "Security Breaches and Counter Measures"),
        ("M.Sc. (Information Technology)", 3, "PSIT.502", "Malware Analysis"),
        ("M.Sc. (Information Technology)", 3, "PSIT.503", "Offensive Security"),
        ("M.Sc. (Information Technology)", 3, "PSIT.504", "Technical Writing and Entrepreneurship Development"),
        ("M.Sc. (Information Technology)", 3, "PSIT.505.1", "Deep Learning"),
        ("M.Sc. (Information Technology)", 3, "PSIT.505.2", "Data Centre Technologies"),
        ("M.Sc. (Information Technology)", 3, "PSIT.506", "Research Project"),

        # -------------------------------
        # M.Sc. IT – Semester 4
        # -------------------------------
        ("M.Sc. (Information Technology)", 4, "PSIT.601", "Blockchain"),
        ("M.Sc. (Information Technology)", 4, "PSIT.602", "Cyber Forensics"),
        ("M.Sc. (Information Technology)", 4, "PSIT.603", "Security Operation Centre"),
        ("M.Sc. (Information Technology)", 4, "PSIT.604.1", "Information Security Auditing"),
        ("M.Sc. (Information Technology)", 4, "PSIT.604.2", "Human Computer Interface"),
        ("M.Sc. (Information Technology)", 4, "PSIT.605", "Research Project"),

        # -------------------------------
        # B.Sc. IT – Semester 3
        # -------------------------------
        ("B.Sc. (Information Technology)", 3, "USIT.301", "Python Programming"),
        ("B.Sc. (Information Technology)", 3, "USIT.302", "Computer Networks"),
        ("B.Sc. (Information Technology)", 3, "USIT.303", "Data Structure"),
        ("B.Sc. (Information Technology)", 3, "USIT.304", "Applied Mathematics"),
        ("B.Sc. (Information Technology)", 3, "USIT.305", "PL/SQL"),
        ("B.Sc. (Information Technology)", 3, "USIT.306.1", "Hindi - I"),
        ("B.Sc. (Information Technology)", 3, "USIT.306.2", "Marathi - I"),
        ("B.Sc. (Information Technology)", 3, "USIT.307", "Yoga Studies"),
        ("B.Sc. (Information Technology)", 3, "USIT.308", "Field Project"),

        # -------------------------------------------------
# B.Sc. IT – Semester 4
# -------------------------------------------------
("B.Sc. (Information Technology)", 4, "USIT.401", "Core Java"),
("B.Sc. (Information Technology)", 4, "USIT.402", "Software Engineering"),
("B.Sc. (Information Technology)", 4, "USIT.403", "Advance Python Programming"),
("B.Sc. (Information Technology)", 4, "USIT.404", "Sales and Distribution"),
("B.Sc. (Information Technology)", 4, "USIT.405", "Computer Oriented Statistical Techniques"),
("B.Sc. (Information Technology)", 4, "USIT.406", "Embedded System"),
("B.Sc. (Information Technology)", 4, "USIT.407.1", "Hindi - I"),
("B.Sc. (Information Technology)", 4, "USIT.407.2", "Marathi - I"),
("B.Sc. (Information Technology)", 4, "USIT.408", "Yoga Studies"),
("B.Sc. (Information Technology)", 4, "USIT.409", "Field Project"),

# -------------------------------------------------
# B.Sc. IT – Semester 5
# -------------------------------------------------
("B.Sc. (Information Technology)", 5, "USIT.501", "Advance Web Programming"),
("B.Sc. (Information Technology)", 5, "USIT.502", "Internet of Things"),
("B.Sc. (Information Technology)", 5, "USIT.503", "Software Project Management"),
("B.Sc. (Information Technology)", 5, "USIT.504", "Linux"),
("B.Sc. (Information Technology)", 5, "USIT.505", "Cyber Law"),
("B.Sc. (Information Technology)", 5, "USIT.506", "Retail Management"),
("B.Sc. (Information Technology)", 5, "USIT.507", "Enterprise Java"),
("B.Sc. (Information Technology)", 5, "USIT.508", "Project Dissertation"),

# -------------------------------------------------
# B.Sc. IT – Semester 6
# -------------------------------------------------
("B.Sc. (Information Technology)", 6, "USIT.601", "Security in Computing"),
("B.Sc. (Information Technology)", 6, "USIT.602", "Business Intelligence"),
("B.Sc. (Information Technology)", 6, "USIT.603", "Software Quality Assurance"),
("B.Sc. (Information Technology)", 6, "USIT.604", "Principles of Geographic Information Systems"),
("B.Sc. (Information Technology)", 6, "USIT.605", "Android Programming"),
("B.Sc. (Information Technology)", 6, "USIT.606", "Digital Marketing"),
("B.Sc. (Information Technology)", 6, "USIT.607", "Project Implementation"),


        # -------------------------------
        # M.Com Part-I – Semester 1
        # -------------------------------
        ("M.Com. (Part-I)", 1, "PMCOM.101", "Advanced Financial Management"),
        ("M.Com. (Part-I)", 1, "PMCOM.102", "Strategic Management"),
        ("M.Com. (Part-I)", 1, "PMCOM.103", "Advance Microeconomics"),
        ("M.Com. (Part-I)", 1, "PMCOM.104", "Business Ethics & CSR"),
        ("M.Com. (Part-I)", 1, "PMCOM.105", "Financial Instruments"),
        ("M.Com. (Part-I)", 1, "PMCOM.106", "Research Methodology"),

        # -------------------------------
        # M.Com Part-II – Advanced Accounting (Sem 3)
        # -------------------------------
        ("M.Com. (Part-II - Advanced Accounting)", 3, "PMCOM.301", "Advanced Financial Accounting"),
        ("M.Com. (Part-II - Advanced Accounting)", 3, "PMCOM.302", "Direct Tax"),
        ("M.Com. (Part-II - Advanced Accounting)", 3, "PMCOM.303", "Advanced Cost Accounting"),
        ("M.Com. (Part-II - Advanced Accounting)", 3, "PMCOM.304", "Advanced Auditing"),
        ("M.Com. (Part-II - Advanced Accounting)", 3, "PMCOM.305", "Financial Reporting-I"),
        ("M.Com. (Part-II - Advanced Accounting)", 3, "PMCOM.306", "Research Project"),

        # -------------------------------
        # M.Com Part-II – Business Management (Sem 3)
        # -------------------------------
        ("M.Com. (Part-II - Business Management)", 3, "PMCOM.301", "Human Resource Management"),
        ("M.Com. (Part-II - Business Management)", 3, "PMCOM.302", "Rural Marketing"),
        ("M.Com. (Part-II - Business Management)", 3, "PMCOM.303", "Entrepreneurial Management"),
        ("M.Com. (Part-II - Business Management)", 3, "PMCOM.304", "Organisational Behaviour"),
        ("M.Com. (Part-II - Business Management)", 3, "PMCOM.305", "Marketing Strategies and Practices"),
        ("M.Com. (Part-II - Business Management)", 3, "PMCOM.306", "Research Project"),
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



