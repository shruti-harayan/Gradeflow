#backend/app/api/routes/subjects.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.models.exam import SubjectCatalog
from app.schemas.exam_schema import SubjectCatalogOut
from app.database import get_db
from app.schemas.subject import SubjectCatalogCreate
from app.api.dependencies import get_current_user
from app.models.user import User
from app.models.programme import Programme
from app.schemas.programme import ProgrammeCreate, ProgrammeOut
import re

router = APIRouter()

def normalize_base_programme(name: str) -> str:
    """
    Removes 'part X', 'part-X', 'part I', etc. (case-insensitive)
    and normalizes whitespace.
    """
    base = re.sub(r'\bpart\s*[-]?\s*\d+\b', '', name, flags=re.IGNORECASE)
    base = re.sub(r'\bpart\s*[-]?\s*[ivx]+\b', '', base, flags=re.IGNORECASE)
    return base.strip().lower()


@router.get("/catalog", response_model=list[SubjectCatalogOut])
def get_subjects_catalog(
    programme: str = Query(..., description="Programme name"),
    semester: int = Query(..., description="Semester number"),
    db: Session = Depends(get_db),
):
    subjects = (
        db.query(SubjectCatalog)
        .filter(
            SubjectCatalog.programme == programme,
            SubjectCatalog.semester == semester,
            SubjectCatalog.is_active == True,
        )
        .order_by(SubjectCatalog.subject_code.asc())
        .all()
    )
    return subjects


@router.post("/catalog", status_code=201)
def add_subject_to_catalog(
    data: SubjectCatalogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    existing = (
        db.query(SubjectCatalog)
        .filter(
            SubjectCatalog.programme == data.programme,
            SubjectCatalog.semester == data.semester,
            SubjectCatalog.subject_code == data.subject_code,
            SubjectCatalog.is_active == 1,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Subject already exists for this programme and semester",
        )

    subject = SubjectCatalog(
        programme=data.programme,
        semester=data.semester,
        subject_code=data.subject_code.upper(),
        subject_name=data.subject_name,
        is_active=1,
    )

    db.add(subject)
    db.commit()
    db.refresh(subject)

    return subject


@router.get("/catalog/programmes", response_model=list[ProgrammeOut])
def get_programmes(db: Session = Depends(get_db)):
    return db.query(Programme).order_by(Programme.name).all()


@router.delete("/catalog/{subject_id}")
def deactivate_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    subject = (
        db.query(SubjectCatalog)
        .filter(SubjectCatalog.id == subject_id)
        .first()
    )

    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    if subject.is_active == 0:
        raise HTTPException(status_code=400, detail="Subject already inactive")

    subject.is_active = 0
    db.commit()

    return {"status": "ok", "message": "Subject removed from catalog"}


@router.get("/catalog/search")
def search_subjects(
    q: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    rows = (
        db.query(SubjectCatalog)
        .filter(
            SubjectCatalog.is_active == 1,
            SubjectCatalog.subject_name.ilike(f"%{q.strip()}%"),
        )
        .order_by(
            SubjectCatalog.subject_name,
            SubjectCatalog.programme,
            SubjectCatalog.semester,
        )
        .limit(20)
        .all()
    )

    return rows


@router.post(
    "/catalog/programmes",
    response_model=ProgrammeOut,
    status_code=201
)
def create_programme(
    payload: ProgrammeCreate,
    db: Session = Depends(get_db),
):
    programme_code = payload.programme_code.strip().upper()
    name = payload.name.strip()

    existing = (
    db.query(Programme)
    .filter(Programme.programme_code == programme_code)
    .all()
    )

    incoming_base = normalize_base_programme(name)

    if existing:
        existing_base = normalize_base_programme(existing[0].name)

        if existing_base != incoming_base:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Programme code '{programme_code}' is already used for "
                    f"'{existing[0].name}'. Please use a different code."
                )
            )

        # compute semester_start correctly
        semester_start = max(
            p.semester_start + p.total_semesters
            for p in existing
        )
    else:
        semester_start = 1

    
    programme = Programme(
        programme_code=programme_code,
        name=name,
        total_semesters=payload.total_semesters,
        semester_start=semester_start,
    )

    db.add(programme)
    db.commit()
    db.refresh(programme)

    return programme
