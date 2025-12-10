# backend/app/api/routes/exams.py
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from app.schemas.exam_schema import ExamCreate, ExamOut, MarksSaveRequest,ExamMarksOut
from app.models.exam import Exam, Question, Student, Mark
from sqlalchemy.orm import Session
from app.database import get_db,engine
from fastapi.responses import StreamingResponse
import csv,io
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
    # normalize fields for matching: subject_code/exam_type/academic_year as-is; subject_name case-insensitive
    existing = (
        db.query(Exam)
        .filter(
            Exam.subject_code == exam_in.subject_code,
            Exam.exam_type == exam_in.exam_type,
            Exam.semester == exam_in.semester,
            Exam.academic_year == exam_in.academic_year,
            Exam.subject_name.ilike(exam_in.subject_name),
        )
        .first()
    )

    if existing:
        # Optionally: if the existing exam has no creator (shouldn't happen normally) set created_by
        # but we do NOT overwrite existing.created_by to avoid changing ownership.
        return existing

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
def export_exam_csv(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Export merged CSV with:
     - Top header block (academic year, subject, semester, exam type)
     - Single merged table:
         Roll No, Section, [Q1.A, Q1.B, ..., Total_Q1], [Q2.A, Q2.B, ..., Total_Q2], Grand_Total
    """
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # fetch questions (flattened labels like "Q1.A")
    questions = db.query(Question).filter(Question.exam_id == exam_id).order_by(Question.id.asc()).all()
    q_labels = [q.label for q in questions]  # preserves DB order

    # Group sub-questions by main label prefix (prefix before first dot)
    main_order: list[str] = []
    subs_by_main: dict[str, list[str]] = {}
    for lbl in q_labels:
        if "." in lbl:
            main, sub = lbl.split(".", 1)
        else:
            main, sub = lbl, ""
        if main not in subs_by_main:
            subs_by_main[main] = []
            main_order.append(main)
        subs_by_main[main].append(lbl)

    # fetch students and marks
    students = db.query(Student).filter(Student.exam_id == exam_id).order_by(Student.roll_no.asc()).all()
    marks = db.query(Mark).filter(Mark.exam_id == exam_id).all()
    # mark lookup (student_id, question_label) -> value
    # to map label to question id:
    q_by_label = {q.label: q for q in questions}
    marks_map = {}
    for m in marks:
        q = m.question_id
        # we need label for question_id:
        # build mapping id->label quickly
        # (we already have q_by_label mapping label->Question; build reverse)
        # build reverse map once:
        pass

    # build reverse map id -> label
    id_to_label = {q.id: q.label for q in questions}
    for m in marks:
        lbl = id_to_label.get(m.question_id)
        if lbl:
            marks_map[(m.student_id, lbl)] = m.marks

    # build student -> section mapping (if section_id present on marks)
    sections = db.query(ExamSection).filter(ExamSection.exam_id == exam_id).all()
    section_name_by_id = {sec.id: sec.section_name or "" for sec in sections}
    student_section: dict[int, str] = {}
    # prefer section_id saved in marks (if present) otherwise empty string
    for m in marks:
        if m.section_id:
            student_section[m.student_id] = section_name_by_id.get(m.section_id, "")

    # prepare CSV
    out = io.StringIO()
    writer = csv.writer(out)

    # header block
    writer.writerow([f"Academic Year: {exam.academic_year or ''}"])
    writer.writerow([f"Subject: {exam.subject_name} ({exam.subject_code})"])
    writer.writerow([f"Semester: {exam.semester}"])
    writer.writerow([f"Exam Type: {exam.exam_type}"])
    writer.writerow([])

    # build header row:
    header = ["Roll No", "Section"]
    # for each main question add its subs then a Total column
    for main in main_order:
        subs = subs_by_main.get(main, [])
        for sub_lbl in subs:
            header.append(sub_lbl)
        header.append(f"Total_{main}")  # e.g. Total_Q1
    header.append("Grand_Total")
    writer.writerow(header)

    # data rows
    for s in students:
        row = [s.roll_no, student_section.get(s.id, "")]
        grand_total = 0.0

        for main in main_order:
            subs = subs_by_main.get(main, [])
            main_total = 0.0
            for lbl in subs:
                val = marks_map.get((s.id, lbl))
                if val is None:
                    row.append("")  # blank if no mark
                else:
                    # ensure numeric format preserved (floats allowed)
                    row.append(val)
                    try:
                        main_total += float(val)
                    except Exception:
                        pass
            # after subquestions append main total
            # format to 2 decimals? leave as number to keep decimals (frontend shows)
            row.append(round(main_total, 2) if main_total % 1 else int(main_total))
            grand_total += main_total

        # final grand total
        row.append(round(grand_total, 2) if grand_total % 1 else int(grand_total))

        writer.writerow(row)

    out.seek(0)
    safe_name = f"{(exam.subject_name or 'exam').replace(' ', '_')}_{exam.exam_type}_Sem{exam.semester}_{exam.academic_year or ''}.csv"
    response = StreamingResponse(iter([out.getvalue().encode("utf-8")]), media_type="text/csv")
    response.headers["Content-Disposition"] = f'attachment; filename="{safe_name}"'
    return response
