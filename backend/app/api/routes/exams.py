# backend/app/api/routes/exams.py
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from app.schemas.exam_schema import ExamCreate, ExamOut, MarksSaveRequest,ExamMarksOut
from app.models.exam import Exam, Question, Student, Mark
from sqlalchemy.orm import Session
from app.database import get_db,engine
from fastapi.responses import StreamingResponse
import csv
from io import StringIO
from app import models
from typing import List,Optional
from app.api.dependencies import admin_required,get_current_user
from app.core.security import get_current_user
from app.models.user import User
from app.models.exam import Exam, ExamSection
from app.schemas.exam_schema import ExamSectionCreate, ExamSectionOut,MarksSaveRequest

router = APIRouter()


@router.post("/sections", response_model=ExamSectionOut)
def create_section(payload: ExamSectionCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    # only teachers (and admins optionally) can create sections
    if current_user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient privileges")

    exam = db.query(Exam).filter(Exam.id == payload.exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Optional: allow only teachers to create sections for subjects they teach; for now allow teacher to create their own section
    # Validate roll range
    if payload.roll_start > payload.roll_end:
        raise HTTPException(status_code=400, detail="roll_start must be <= roll_end")

    # Overlap check: ensure no overlapping sections for the same exam (or allow overlap if you want)
    overlap = db.query(ExamSection).filter(
        ExamSection.exam_id == payload.exam_id,
        ((ExamSection.roll_start <= payload.roll_end) & (ExamSection.roll_end >= payload.roll_start))
    ).first()
    if overlap:
        # overlapping allowed across sections? we assume NO
        raise HTTPException(status_code=400, detail=f"Roll range overlaps with existing section {overlap.section_name or overlap.id} ({overlap.roll_start}-{overlap.roll_end})")

    sec = ExamSection(
        exam_id = payload.exam_id,
        teacher_id = current_user.id,
        section_name = payload.section_name,
        roll_start = payload.roll_start,
        roll_end = payload.roll_end
    )
    db.add(sec)
    db.commit()
    db.refresh(sec)
    return sec

@router.get("/{exam_id}/sections", response_model=List[ExamSectionOut])
def list_sections_for_exam(exam_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    q = db.query(ExamSection).filter(ExamSection.exam_id == exam_id)
    if current_user.role != "admin":
        q = q.filter(ExamSection.teacher_id == current_user.id)
    return q.all()


@router.post("/{exam_id}/finalize")
def finalize_exam(exam_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user),):

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    exam.is_locked = True
    exam.locked_by = current_user.id 
    db.add(exam)
    db.commit()
    db.refresh(exam)
    return {"status": "ok", "exam": exam}


@router.post("/{exam_id}/unfinalize", dependencies=[Depends(admin_required)])
def unfinalize_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # require admin
    if getattr(current_user, "role", None) != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    exam.is_locked = False
    exam.locked_by = None  
    db.add(exam)
    db.commit()
    db.refresh(exam)
    return {"status": "ok", "exam": exam}


@router.get("/", response_model=List[ExamOut])
def list_exams(
    subject_name: Optional[str] = Query(None),
    academic_year: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    creator_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
):

    q = db.query(Exam)

    # Apply server-side filters if provided
    if subject_name:
        # case-insensitive partial match
        q = q.filter(Exam.subject_name.ilike(f"%{subject_name.strip()}%"))
    if academic_year:
        q = q.filter(Exam.academic_year.ilike(f"%{academic_year.strip()}%"))
# If an admin requested a specific creator_id, apply that
    if creator_id is not None:
        # only allow admins to query arbitrary creator_id
        if getattr(current_user, "role", None) != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")
        q = q.filter(Exam.created_by == creator_id)
    else:
        # if no creator_id provided, non-admins see only their own exams
        if getattr(current_user, "role", None) != "admin":
            q = q.filter(Exam.created_by == current_user.id)

    exams = q.order_by(Exam.created_at.desc()).all()
    return exams


@router.post("/", response_model=ExamOut)
def create_exam(
    exam_in: ExamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    Exam = models.exam.Exam  

    exam = Exam(
        subject_code=exam_in.subject_code,
        subject_name=exam_in.subject_name,
        exam_type=exam_in.exam_type,
        semester=exam_in.semester,
        created_by=current_user.id,
        academic_year=exam_in.academic_year
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)
    return exam

logger = logging.getLogger("uvicorn.error")

@router.post("/{exam_id}/marks")
def save_marks(
    exam_id: int,
    payload: MarksSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Save marks for an exam.

    Behavior (auto-create mode):
      - If there are no Question rows for the exam, create questions from payload.questions.
      - If some questions exist, create any missing labels found in payload.questions.
      - Then save students and marks (storing section_id on each mark if provided).
    """
    logger.info("save_marks called for exam_id=%s by user=%s", exam_id, getattr(current_user, "id", None))
    try:
        logger.info("DB engine url: %s", str(engine.url))
    except Exception as e:
        logger.info("Could not read engine.url: %s", e)

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # sections logic
    sections = db.query(ExamSection).filter(ExamSection.exam_id == exam_id).all()
    exam_has_sections = len(sections) > 0
    section = None
    if exam_has_sections:
        if payload.section_id is None:
            raise HTTPException(status_code=422, detail="section_id is required for this exam")
        section = db.query(ExamSection).filter(
            ExamSection.id == payload.section_id,
            ExamSection.exam_id == exam_id
        ).first()
        if not section:
            raise HTTPException(status_code=422, detail="Invalid section_id")
        if current_user.role == "teacher" and section.teacher_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not allowed to save marks for this section")


# Build list of labels coming from payload.questions (QuestionIn Pydantic models)
    payload_q_labels = [q.label for q in (payload.questions or []) if getattr(q, "label", None)]

    # Fetch existing questions from DB for this exam
    q_objs = db.query(Question).filter(Question.exam_id == exam_id).all()
    existing_labels = {q.label for q in q_objs}

    created_questions = 0

    if not q_objs and payload_q_labels:
        # No questions exist — create all from payload (QuestionIn objects)
        logger.info("No questions found for exam %s — creating %s questions from payload", exam_id, len(payload_q_labels))
        for q_in in (payload.questions or []):
            label = getattr(q_in, "label", None)
            if not label:
                continue
            try:
                mm = int(getattr(q_in, "max_marks", 0))
            except Exception:
                mm = 0
            new_q = Question(exam_id=exam_id, label=label, max_marks=mm)
            db.add(new_q)
            created_questions += 1
        db.flush()
        # refresh list after creation
        q_objs = db.query(Question).filter(Question.exam_id == exam_id).all()
        existing_labels = {q.label for q in q_objs}
    else:
        # Some exist — create any missing labels found in payload (merge)
        missing = [lab for lab in payload_q_labels if lab not in existing_labels]
        if missing:
            logger.info("Creating %s missing question(s) for exam %s: %s", len(missing), exam_id, missing)
            for lab in missing:
                found = next((q for q in (payload.questions or []) if getattr(q, "label", None) == lab), None)
                try:
                    mm = int(getattr(found, "max_marks", 0)) if found else 0
                except Exception:
                    mm = 0
                nq = Question(exam_id=exam_id, label=lab, max_marks=mm)
                db.add(nq)
                created_questions += 1
            db.flush()
            q_objs = db.query(Question).filter(Question.exam_id == exam_id).all()
            existing_labels = {q.label for q in q_objs}

    # Build label->Question map
    q_map = {q.label: q for q in q_objs}
    logger.info("Final question labels for exam %s: %s", exam_id, list(q_map.keys()))


    created_marks = 0
    updated_marks = 0
    created_students = 0

    try:
        for s in payload.students:
            # roll_no should be compatible with Student.roll_no type (int)
            roll_no = int(s.roll_no)

            # find or create student
            student = db.query(Student).filter(Student.exam_id == exam_id, Student.roll_no == roll_no).first()
            if not student:
                student = Student(exam_id=exam_id, roll_no=roll_no, absent=bool(s.absent))
                db.add(student)
                db.flush()  # ensure student.id is available
                created_students += 1
                logger.debug("Created student with roll %s id=%s", roll_no, student.id)
            else:
                student.absent = bool(s.absent)
                db.add(student)

            # handle marks for this student
            for label, raw_val in (s.marks or {}).items():
                q = q_map.get(label)
                if not q:
                    logger.warning("Unknown question label %s - skipping (exam %s)", label, exam_id)
                    continue

                val = None
                if raw_val is not None and raw_val != "":
                    try:
                        val = float(raw_val)
                    except Exception:
                        raise HTTPException(status_code=422, detail=f"Invalid numeric value for {label} for roll {roll_no}")

                mark = db.query(Mark).filter(
                    Mark.exam_id == exam_id,
                    Mark.student_id == student.id,
                    Mark.question_id == q.id
                ).first()

                if not mark:
                    mark = Mark(
                        exam_id=exam_id,
                        student_id=student.id,
                        question_id=q.id,
                        marks=val,
                        section_id=(section.id if section else None)
                    )
                    db.add(mark)
                    created_marks += 1
                    logger.debug("Added mark: exam=%s student=%s q=%s val=%s", exam_id, student.id, q.id, val)
                else:
                    mark.marks = val
                    mark.section_id = (section.id if section else None)
                    db.add(mark)
                    updated_marks += 1
                    logger.debug("Updated mark id=%s -> %s", mark.id, val)

        logger.info(
            "Flushing DB. created_questions=%s created_students=%s created_marks=%s updated_marks=%s",
            created_questions, created_students, created_marks, updated_marks
        )
        db.flush()
        db.commit()
        logger.info("Commit successful")
    except Exception as exc:
        logger.exception("Exception while saving marks: %s", exc)
        try:
            db.rollback()
        except Exception:
            logger.exception("Rollback failed")
        raise HTTPException(status_code=500, detail="Failed to save marks due to server error")

    return {
        "detail": "Marks saved",
        "created_questions": created_questions,
        "created_students": created_students,
        "created_marks": created_marks,
        "updated_marks": updated_marks,
    }


@router.get("/{exam_id}/marks", response_model=ExamMarksOut)
def get_exam_marks(exam_id: int, db: Session = Depends(get_db)):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    questions = (
        db.query(Question)
        .filter(Question.exam_id == exam_id)
        .order_by(Question.order.asc())
        .all()
    )
    students = (
        db.query(Student)
        .filter(Student.exam_id == exam_id)
        .order_by(Student.roll_no.asc())
        .all()
    )
    marks = (
        db.query(Mark)
        .filter(Mark.exam_id == exam_id)
        .all()
    )

    marks_out = [
        {"student_id": m.student_id, "question_id": m.question_id, "marks": m.marks}
        for m in marks
    ]

    return {
        "exam": exam,
        "questions": questions,
        "students": students,
        "marks": marks_out,
    }

@router.get("/{exam_id}/export")
def export_exam_csv(exam_id: int, db: Session = Depends(get_db)):
    """
    Export a single CSV for an exam that merges all sections (batches).
    For each section we print a small header block with:
      - Section label (or id)
      - Teacher name / email
      - Academic year (from exam)
    Then we write the question header row and the student rows for that section.
    """
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Fetch questions once (column layout)
    questions = db.query(Question).filter(Question.exam_id == exam_id).order_by(Question.order.asc()).all()
    question_headers = [q.label for q in questions]

    # Fetch all sections for the exam (admin may call this)
    sections = db.query(ExamSection).filter(ExamSection.exam_id == exam_id).order_by(ExamSection.id.asc()).all()

    # If there are no explicit sections, fall back to default behaviour:
    # treat whole exam as a single unnamed section spanning all students.
    if not sections:
        # gather all students and marks as before (single block)
        students = db.query(Student).filter(Student.exam_id == exam_id).order_by(Student.roll_no.asc()).all()
        marks = db.query(Mark).filter(Mark.exam_id == exam_id).all()
        mark_map = {(m.student_id, m.question_id): m.marks for m in marks}

        output = StringIO()
        writer = csv.writer(output)

        # top-level info row
        writer.writerow([f"{exam.subject_code} — {exam.subject_name}"])
        writer.writerow([f"Academic Year: {exam.academic_year}" if exam.academic_year else ""])
        writer.writerow([])

        # Header
        writer.writerow(["Roll No", "Absent"] + question_headers + ["Total"])

        # Data rows
        for s in students:
            row = [s.roll_no, "AB" if s.absent else ""]
            total = 0.0
            for q in questions:
                mk = mark_map.get((s.id, q.id))
                if mk is None:
                    row.append("")
                else:
                    row.append(mk)
                    try:
                        total += float(mk)
                    except Exception:
                        pass
            row.append(total)
            writer.writerow(row)

        output.seek(0)
        safe = lambda s: str(s).replace(" ", "_").replace("/", "-")
        filename = f"{safe(exam.subject_code)}_{safe(exam.exam_type)}_Sem{exam.semester}_{safe(exam.academic_year or '')}.csv"
        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    # If we have multiple sections, build CSV with per-section blocks
    output = StringIO()
    writer = csv.writer(output)

    # Top-level title row for the whole CSV
    writer.writerow([f"{exam.subject_code} — {exam.subject_name}"])
    writer.writerow([])

    # For each section, print small header info then the table
    for sec in sections:
        # teacher info
        teacher = db.query(User).filter(User.id == sec.teacher_id).first()
        teacher_name = (teacher.name or teacher.email) if teacher else f"teacher_id:{sec.teacher_id}"

        section_label = sec.section_name or f"Section {sec.id}"

        # Section header block (3 rows: section label, teacher, academic year)
        writer.writerow([f"{section_label}"])
        writer.writerow([f"Teacher: {teacher_name}"])
        if exam.academic_year:
            writer.writerow([f"Academic Year: {exam.academic_year}"])
        else:
            writer.writerow(["Academic Year: "])
        writer.writerow([])  # small spacer

        # Write column header for this section
        writer.writerow(["Roll No", "Absent"] + question_headers + ["Total"])

        # Get students for this section by roll range (inclusive)
        students = db.query(Student).filter(
            Student.exam_id == exam_id,
            Student.roll_no >= sec.roll_start,
            Student.roll_no <= sec.roll_end
        ).order_by(Student.roll_no.asc()).all()

        # Fetch marks for this exam and restrict by student ids in this section
        # (build mark map once for speed)
        marks = db.query(Mark).filter(Mark.exam_id == exam_id).all()
        mark_map = {(m.student_id, m.question_id): m.marks for m in marks}

        # Write student rows for this section
        for s in students:
            row = [s.roll_no, "AB" if s.absent else ""]
            total = 0.0
            for q in questions:
                mk = mark_map.get((s.id, q.id))
                if mk is None:
                    row.append("")
                else:
                    row.append(mk)
                    try:
                        total += float(mk)
                    except Exception:
                        pass
            # append total (as a number)
            row.append(total)
            writer.writerow(row)

        # Spacer row between sections
        writer.writerow([])

    # finalize
    output.seek(0)
    safe = lambda s: str(s).replace(" ", "_").replace("/", "-")
    filename = f"{safe(exam.subject_code)}_{safe(exam.exam_type)}_Sem{exam.semester}_{safe(exam.academic_year or '')}_merged.csv"

    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
