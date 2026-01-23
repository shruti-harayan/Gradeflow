#backend/app/api/routes/subjects.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.models.exam import SubjectCatalog
from app.schemas.exam_schema import SubjectCatalogOut
from app.database import get_db
from app.schemas.subject import SubjectCatalogCreate
from app.api.dependencies import get_current_user
from app.models.user import User

router = APIRouter()

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


@router.get("/valid-semesters")
def get_valid_semesters(
    programme: str = Query(..., description="Programme name"),
    db: Session = Depends(get_db),
):
    """
    Returns list of semesters for which at least one subject exists
    for the given programme.
    """
    rows = (
        db.query(SubjectCatalog.semester)
        .filter(
            SubjectCatalog.programme == programme,
            SubjectCatalog.is_active == True,
        )
        .distinct()
        .order_by(SubjectCatalog.semester.asc())
        .all()
    )

    # rows = [(1,), (2,), (3,)]
    return [r[0] for r in rows]


@router.get("/programmes")
def get_programmes(db: Session = Depends(get_db)):
    """
    Returns list of programmes for which at least one active subject exists.
    """
    rows = (
        db.query(SubjectCatalog.programme)
        .filter(SubjectCatalog.is_active == True)
        .distinct()
        .order_by(SubjectCatalog.programme.asc())
        .all()
    )

    # rows = [("B.Com",), ("M.Sc. (Information Technology)",)]
    return [r[0] for r in rows]

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


@router.get("/catalog/programmes")
def get_programmes(db: Session = Depends(get_db)):
    rows = (
        db.query(SubjectCatalog.programme)
        .filter(SubjectCatalog.is_active == 1)
        .distinct()
        .order_by(SubjectCatalog.programme)
        .all()
    )

    return [r[0] for r in rows]


@router.get("/catalog/semesters")
def get_valid_semesters(
    programme: str,
    db: Session = Depends(get_db),
):
    rows = (
        db.query(SubjectCatalog.semester)
        .filter(
            SubjectCatalog.programme == programme,
            SubjectCatalog.is_active == 1,
        )
        .distinct()
        .order_by(SubjectCatalog.semester)
        .all()
    )

    return [r[0] for r in rows]


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
