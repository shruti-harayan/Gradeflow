#backend/app/api/routes/subjects.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.models.exam import SubjectCatalog
from app.schemas.exam_schema import SubjectCatalogOut
from app.database import get_db


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
