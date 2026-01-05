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
