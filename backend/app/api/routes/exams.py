# backend/app/api/routes/exams.py
from sqlalchemy import delete, select
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import UniqueConstraint
from app.schemas.exam_schema import AdminCombinedMarksOut, ExamCreate, ExamMarksOut, ExamOut,ExamSectionCreate, ExamSectionOut, ExamUpdate,MarksSaveRequest
from app.models.exam import Exam, Question, Student, Mark,ExamSection             
from sqlalchemy.orm import Session
from app.database import get_db,engine
from fastapi.responses import StreamingResponse
import csv,io,json,logging
from sqlalchemy.exc import StatementError
from typing import Any, List,Optional
from app.api.dependencies import admin_required,get_current_user
from app.core.security import get_current_user
from app.models.user import User
from app.models.programme import Programme
from app.schemas.programme import ProgrammeCreate, ProgrammeOut
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.dependencies import admin_required
from sqlalchemy.orm import aliased

router = APIRouter()

@router.post("/sections", response_model=ExamSectionOut)
def create_section(payload: ExamSectionCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
   
    if current_user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient privileges")

    exam = db.query(Exam).filter(Exam.id == payload.exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
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
def finalize_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")


    if current_user.role == "teacher":
        # safety: teacher can only finalize their own exam
        if exam.created_by != current_user.id:
            raise HTTPException(status_code=403, detail="Not allowed")

        exam.is_locked = True
        exam.locked_by = current_user.id

        db.add(exam)
        db.commit()
        db.refresh(exam)

        return {
            "status": "ok",
            "scope": "single",
            "message": "Exam finalized",
            "locked_by_name": current_user.name,
        }

    if current_user.role == "admin":
        db.query(Exam).filter(
            Exam.subject_code == exam.subject_code,
            Exam.subject_name == exam.subject_name,  # IMPORTANT
            Exam.exam_type == exam.exam_type,
            Exam.semester == exam.semester,
            Exam.academic_year == exam.academic_year,
        ).update(
            {
                "is_locked": True,
                "locked_by": current_user.id,
            },
            synchronize_session=False,
        )

        db.commit()

        return {
            "status": "ok",
            "scope": "global",
            "message": "Exam finalized globally",
            "locked_by_name": current_user.name,
        }
    raise HTTPException(status_code=403, detail="Not authorized")


@router.post("/{exam_id}/unfinalize", dependencies=[Depends(admin_required)])
def unfinalize_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if getattr(current_user, "role", None) != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")

    ref_exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not ref_exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    #  GLOBAL UNLOCK: unlock all shared exams
    db.query(Exam).filter(
        Exam.subject_code == ref_exam.subject_code,
        Exam.exam_type == ref_exam.exam_type,
        Exam.semester == ref_exam.semester,
        Exam.academic_year == ref_exam.academic_year,
    ).update(
        {
            "is_locked": False,
            "locked_by": None,
        },
        synchronize_session=False,
    )

    db.commit()

    return {"status": "ok", "message": "Exam unfinalized globally"}


@router.get("/", response_model=List[ExamOut])
def list_exams(
    subject_name: Optional[str] = Query(None),
    academic_year: Optional[str] = Query(None),
    exam_type: Optional[str] = Query(None),
    semester: Optional[int] = Query(None),
    programme: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    created_by: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Exam)

    # ---------- Role-based visibility ----------
    if current_user.role != "admin":
        # Teachers can see ONLY their own exams
        q = q.filter(Exam.created_by == current_user.id)
    else:
        # Admins: optionally filter 
        if created_by is not None:
            q = q.filter(Exam.created_by == created_by)

    # ---------- Optional filters ----------
    if subject_name:
        q = q.filter(Exam.subject_name.ilike(f"%{subject_name.strip()}%"))

    if academic_year:
        q = q.filter(Exam.academic_year.ilike(f"%{academic_year.strip()}%"))
    if programme:
        q = q.filter(Exam.programme == programme)

    if semester is not None:
        q = q.filter(Exam.semester == semester)

    if exam_type:
        q = q.filter(Exam.exam_type == exam_type)

    Locker = aliased(User)

    exams = (
        q.outerjoin(Locker, Locker.id == Exam.locked_by)
        .add_columns(Locker.name.label("locked_by_name"))
        .order_by(Exam.created_at.desc())
        .all()
    )

    result = []
    for exam, locked_by_name in exams:
        result.append({
            **exam.__dict__,
            "locked_by_name": locked_by_name,
        })

    return result


@router.post("/", response_model=ExamOut)
def create_exam(
    exam_in: ExamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing = db.query(Exam).filter(
    Exam.subject_code == exam_in.subject_code,
    Exam.exam_type == exam_in.exam_type,
    Exam.semester == exam_in.semester,
    Exam.academic_year == exam_in.academic_year,
    Exam.created_by == current_user.id, 
    Exam.programme == exam_in.programme,
).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="You have already created this exam."
        )

    logger.info(
    "Create exam called by user_id=%s email=%s",
    current_user.id,
    current_user.email,
)
    exam = Exam(
        programme=exam_in.programme,
        subject_code=exam_in.subject_code,
        subject_name=exam_in.subject_name,
        exam_type=exam_in.exam_type,
        semester=exam_in.semester,
        created_by=current_user.id,
        academic_year=exam_in.academic_year,
        is_locked=False,
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)
    return exam

__table_args__ = (
    UniqueConstraint(
        "subject_code",
        "exam_type",
        "semester",
        "academic_year",
        "created_by",
        name="uq_exam_per_teacher",
    ),
)

logger = logging.getLogger("uvicorn.error")

@router.post("/{exam_id}/marks")
def save_marks(
    exam_id: int,
    payload: MarksSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
   
    logger.info("save_marks called for exam_id=%s by user=%s", exam_id, getattr(current_user, "id", None))

    # basic exam existence check
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # --- SECTION HANDLING (optional) ---
    section = None
    if payload.section_id is not None:
        # Validate provided section_id
        section = (
            db.query(ExamSection)
            .filter(ExamSection.id == payload.section_id, ExamSection.exam_id == exam_id)
            .first()
        )
        if not section:
            raise HTTPException(status_code=422, detail="Invalid section_id")
        # permission: teacher may only write for their section
        if getattr(current_user, "role", None) == "teacher" and section.teacher_id != getattr(current_user, "id", None):
            raise HTTPException(status_code=403, detail="Not allowed to save marks for this section")

    # --- Build list of question labels from payload (safe access) ---
    payload_q_labels = []
    for q in (payload.questions or []):
        lbl = getattr(q, "label", None)
        if lbl:
            payload_q_labels.append(lbl)

    # --- Fetch existing questions and create missing ones (auto-create behavior) ---
    q_objs = db.query(Question).filter(Question.exam_id == exam_id).order_by(Question.id.asc()).all()
    existing_labels = {q.label for q in q_objs}

    created_questions = 0
    if not q_objs and payload_q_labels:
        # no questions at all — create all from payload
        logger.info("No existing questions; creating %s from payload for exam %s", len(payload_q_labels), exam_id)
        for q_in in (payload.questions or []):
            lbl = getattr(q_in, "label", None)
            if not lbl:
                continue
            try:
                mm = float(getattr(q_in, "max_marks", 0) or 0)
            except Exception:
                mm = 0.0
            new_q = Question(exam_id=exam_id, label=lbl, max_marks=mm)
            db.add(new_q)
            created_questions += 1
        db.flush()
        q_objs = db.query(Question).filter(Question.exam_id == exam_id).all()
        existing_labels = {q.label for q in q_objs}
    else:
        # create any missing labels from payload
        missing = [lab for lab in payload_q_labels if lab not in existing_labels]
        if missing:
            logger.info("Creating %s missing question(s) for exam %s: %s", len(missing), exam_id, missing)
            for lab in missing:
                found = next((q for q in (payload.questions or []) if getattr(q, "label", None) == lab), None)
                try:
                    mm = float(getattr(found, "max_marks", 0) or 0) if found else 0.0
                except Exception:
                    mm = 0.0
                nq = Question(exam_id=exam_id, label=lab, max_marks=mm)
                db.add(nq)
                created_questions += 1
            db.flush()
            q_objs = db.query(Question).filter(Question.exam_id == exam_id).all()
            existing_labels = {q.label for q in q_objs}

    # map label -> Question object
    q_map = {}
    for q in q_objs:
        if q.label not in q_map:
            q_map[q.label] = q

    logger.info("Final question labels for exam %s: %s", exam_id, list(q_map.keys()))

    # --- Persist question_rules if present (store dict or JSON string depending on column type) ---
    try:
        qr = getattr(payload, "question_rules", None)
        if qr is not None:
            exam_row = db.query(Exam).filter(Exam.id == exam_id).first()
            if exam_row:
                try:
                    exam_row.question_rules = qr
                    db.add(exam_row)
                    logger.info("Persisted question_rules (direct assign) for exam_id=%s", exam_id)
                except (TypeError, StatementError):
                    try:
                        exam_row.question_rules = json.dumps(qr)
                        db.add(exam_row)
                        logger.info("Persisted question_rules (json dump) for exam_id=%s", exam_id)
                    except Exception as e:
                        logger.exception("Failed to json-dump question_rules for exam_id=%s: %s", exam_id, e)
    except Exception as e:
        logger.exception("Unexpected error while persisting question_rules for exam_id=%s: %s", exam_id, e)
        # continue — do not abort marks save for rules failure

    # --- Iterate students and save marks ---
    created_marks = 0
    updated_marks = 0
    created_students = 0

    try:
        for s in (payload.students or []):
            # normalize roll_no depending on incoming type
            try:
                roll_no = int(s.roll_no)
            except Exception:
                # if backend expects string roll_no, change parsing accordingly
                raise HTTPException(status_code=422, detail=f"Invalid roll_no: {s.roll_no}")

            # find existing student or create
            student = db.query(Student).filter(Student.exam_id == exam_id, Student.roll_no == roll_no).first()
            if not student:
                student = Student(exam_id=exam_id, roll_no=roll_no, absent=bool(getattr(s, "absent", False)))
                db.add(student)
                db.flush()  # ensure id populated
                created_students += 1
                logger.debug("Created student roll=%s id=%s", roll_no, student.id)
            else:
                # update absent flag
                student.absent = bool(getattr(s, "absent", False))
                db.add(student)

            # for safety, capture section_id to assign to marks (either validated section or None)
            section_id_to_set = section.id if section else None

            # iterate marks map for this student
            for label, raw_val in (getattr(s, "marks", {}) or {}).items():
                if label is None:
                    continue
                q = q_map.get(label)
                if not q:
                    logger.warning("Unknown question label %s - skipping (exam %s)", label, exam_id)
                    continue

                # parse numeric or accept None/blank
                val = None
                if raw_val is not None and raw_val != "":
                    try:
                        val = float(raw_val)
                    except Exception:
                        raise HTTPException(status_code=422, detail=f"Invalid numeric value for {label} for roll {roll_no}")

                # find existing mark (student + question + exam)
                mark = (
                    db.query(Mark)
                    .filter(Mark.exam_id == exam_id, Mark.student_id == student.id, Mark.question_id == q.id)
                    .first()
                )

                if not mark:
                    mark = Mark(
                        exam_id=exam_id,
                        student_id=student.id,
                        question_id=q.id,
                        marks=val,
                        section_id=section_id_to_set,
                    )
                    db.add(mark)
                    created_marks += 1
                    logger.debug("Added mark: exam=%s student=%s q=%s val=%s", exam_id, student.id, q.id, val)
                else:
                    mark.marks = val
                    mark.section_id = section_id_to_set
                    db.add(mark)
                    updated_marks += 1
                    logger.debug("Updated mark id=%s -> %s", mark.id, val)

        logger.info(
            "Flushing DB. created_questions=%s created_students=%s created_marks=%s updated_marks=%s",
            created_questions, created_students, created_marks, updated_marks,
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

    # build lookup maps
    student_roll_by_id = {
        s.id: s.roll_no
        for s in students
    }

    question_label_by_id = {
        q.id: q.label
        for q in questions
    }

    marks_out = []

    for m in marks:
        roll_no = student_roll_by_id.get(m.student_id)
        q_label = question_label_by_id.get(m.question_id)

        if roll_no is None or q_label is None:
            continue

        marks_out.append({
            "roll_no": roll_no,
            "question_label": q_label,
            "marks": m.marks,
        })

    return {
        "exam": exam,
        "questions": questions,
        "students": students,
        "marks": marks_out,
    }

@router.delete("/{exam_id}")
def delete_exam(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Only admin OR exam creator can delete
    if current_user.role != "admin":
        created = db.query(Exam).filter(Exam.id == exam_id).first()
        if not created:
            raise HTTPException(status_code=404, detail="Exam not found")
        if created.created_by != current_user.id:
            raise HTTPException(
                status_code=403, detail="Not authorized to delete this exam"
            )

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Delete cascade manually (SQLite does not cascade automatically)
    db.query(Mark).filter(Mark.exam_id == exam_id).delete()
    db.query(Student).filter(Student.exam_id == exam_id).delete()
    db.query(Question).filter(Question.exam_id == exam_id).delete()
    db.query(ExamSection).filter(ExamSection.exam_id == exam_id).delete()

    db.delete(exam)
    db.commit()

    return {"status": "success", "message": "Exam deleted successfully"}

@router.patch("/{exam_id}", response_model=ExamOut)
def update_exam(
    exam_id: int,
    payload: ExamUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # permission: only admin or exam creator can update metadata
    if current_user.role != "admin" and exam.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    if payload.subject_code is not None:
        exam.subject_code = payload.subject_code
    if payload.subject_name is not None:
        exam.subject_name = payload.subject_name
    # ... other fields as needed ...

    if payload.question_rules is not None:
        # store as JSON string in text column
        exam.question_rules = json.dumps(payload.question_rules)

    db.add(exam)
    db.commit()
    db.refresh(exam)
    # return parsed rules as dict in pydantic model
    return exam

@router.get("/admin/combined-marks", response_model=AdminCombinedMarksOut
)
def get_admin_combined_marks(
    subject_code: str,
    subject_name: str,
    exam_type: str,
    semester: int,
    academic_year: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    # 1️ Fetch all related exams (shared logical exam)
    exams = (
        db.query(Exam)
        .filter(
            Exam.subject_code == subject_code,
            Exam.subject_name == subject_name,
            Exam.exam_type == exam_type,
            Exam.semester == semester,
            Exam.academic_year == academic_year,
        )
        .all()
    )

    if not exams:
        raise HTTPException(status_code=404, detail="No exams found")

    exam_ids = [e.id for e in exams]
    ref_exam = exams[0]  # metadata reference

    # 2️ Questions (merged, unique by label)
    questions = (
        db.query(Question)
        .filter(Question.exam_id.in_(exam_ids))
        .order_by(Question.label.asc())
        .all()
    )

    seen = {}
    unique_questions = []
    for q in questions:
        if q.label not in seen:
            seen[q.label] = True
            unique_questions.append(q)

    # 3️ Students (merged, unique by roll_no)
    # collect unique roll numbers across all exams
    students = (
    db.query(Student)
    .filter(Student.exam_id.in_(exam_ids))
    .all()
)
    students_by_roll = {}

    for s in students:
        roll = s.roll_no
        if roll not in students_by_roll:
            students_by_roll[roll] = {
                "id": roll,              # synthetic but stable
                "roll_no": roll,
                "absent": bool(s.absent),
            }
        else:
            # if ABSENT in ANY exam → absent in admin view
            students_by_roll[roll]["absent"] = (
                students_by_roll[roll]["absent"] or bool(s.absent)
            )

    merged_students = list(students_by_roll.values())


    # 4️ Marks (ALL)
    marks = (
        db.query(Mark)
        .filter(Mark.exam_id.in_(exam_ids))
        .all()
    )

    # map student_id -> roll_no
    student_roll_by_id = {
        s.id: s.roll_no
        for s in db.query(Student).filter(Student.exam_id.in_(exam_ids)).all()
    }
        
    # map (exam_id, question_id) -> label
    question_label_by_key = {
        (q.exam_id, q.id): q.label
        for q in db.query(Question)
            .filter(Question.exam_id.in_(exam_ids))
            .all()
    }
    marks_out = []

    for m in marks:
        roll_no = student_roll_by_id.get(m.student_id)
        if roll_no is None:
            continue

        q_label = question_label_by_key.get((m.exam_id, m.question_id))
        if not q_label:
            continue

        marks_out.append({
            "roll_no": roll_no,
            "question_label": q_label,
            "marks": m.marks,
        })

    return {
        "exam": ref_exam,
        "questions": unique_questions,
        "students": merged_students,
        "marks": marks_out,
    }


def export_single_exam_csv(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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

    # build reverse map id -> label for questions
    id_to_label = {q.id: q.label for q in questions}

    # marks_map: (student_id, label) -> mark_value
    marks_map: dict[tuple[int, str], float | None] = {}
    for m in marks:
        lbl = id_to_label.get(m.question_id)
        if lbl:
            # preserve None if m.marks is None (so we can output blank cell)
            marks_map[(m.student_id, lbl)] = None if m.marks is None else float(m.marks)

    # build student -> section mapping (if section_id present on marks)
    sections = db.query(ExamSection).filter(ExamSection.exam_id == exam_id).all()
    section_name_by_id = {sec.id: sec.section_name or "" for sec in sections}
    student_section: dict[int, str] = {}
    # prefer section_id saved in marks (if present) otherwise empty string
    for m in marks:
        if getattr(m, "section_id", None):
            student_section[m.student_id] = section_name_by_id.get(m.section_id, "")

    # Read question_rules from exam (may be JSON string or dict)
    raw_qr = getattr(exam, "question_rules", None)
    try:
        question_rules = json.loads(raw_qr) if isinstance(raw_qr, str) else (raw_qr or {})
    except Exception:
        question_rules = {}

    # helper to extract minToCount integer from possibly different key names
    def get_rule_min_to_count(rule_obj: Any) -> Optional[int]:
        if not rule_obj:
            return None
        # accept minToCount or min_to_count or min (fallback)
        if isinstance(rule_obj, dict):
            for k in ("minToCount", "min_to_count", "min", "min_to_count"):
                if k in rule_obj and rule_obj[k] is not None:
                    try:
                        return int(rule_obj[k])
                    except Exception:
                        pass
        return None

    # prepare CSV
    out = io.StringIO()
    writer = csv.writer(out)

    # header block (keep your existing format)
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
        row: list[Any] = [s.roll_no, student_section.get(s.id, "")]
        grand_total = 0.0

        for main in main_order:
            subs = subs_by_main.get(main, [])
            # collect values (None means blank / not entered)
            sub_vals: list[Optional[float]] = []
            for lbl in subs:
                val = marks_map.get((s.id, lbl))
                sub_vals.append(val)
                # write cell: blank if None, else write numeric preserving fraction
                if val is None:
                    row.append("")
                else:
                    # keep as number; csv.writer will convert to string
                    # keep fractional precision as-is (we'll not round here)
                    row.append(val)

            # compute main total using rules if present
            rule_obj = question_rules.get(main) if isinstance(question_rules, dict) else None
            N = get_rule_min_to_count(rule_obj)
            if N and N > 0:
                # take top N numeric values (ignore None)
                numeric_vals = [v for v in sub_vals if v is not None]
                numeric_vals.sort(reverse=True)
                chosen = numeric_vals[:N]
                main_total = sum(chosen)
            else:
                # default: sum all present numeric values (ignore None)
                numeric_vals = [v for v in sub_vals if v is not None]
                main_total = sum(numeric_vals)

            # format main_total: integer if whole else round 2 decimals
            if float(main_total).is_integer():
                row.append(int(main_total))
            else:
                row.append(round(main_total, 2))

            grand_total += main_total

        # final grand total formatting
        if float(grand_total).is_integer():
            row.append(int(grand_total))
        else:
            row.append(round(grand_total, 2))

        writer.writerow(row)

    out.seek(0)
    safe_name = f"{(exam.subject_name or 'exam').replace(' ', '_')}_{exam.exam_type}_Sem{exam.semester}_{exam.academic_year or ''}.csv"
    response = StreamingResponse(iter([out.getvalue().encode("utf-8")]), media_type="text/csv")
    response.headers["Content-Disposition"] = f'attachment; filename="{safe_name}"'
    return response


@router.post("/export-merged")
def export_merged_exam_csv(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    exam_ids = payload.get("exam_ids")
    if not exam_ids or not isinstance(exam_ids, list):
        raise HTTPException(status_code=422, detail="exam_ids list required")

    exams = db.query(Exam).filter(Exam.id.in_(exam_ids)).all()
    if not exams:
        raise HTTPException(status_code=404, detail="No exams found")

    ref = exams[0]  # metadata reference

    # -------------------------------
    # QUESTIONS (merged)
    # -------------------------------
    questions = (
        db.query(Question)
        .filter(Question.exam_id.in_(exam_ids))
        .order_by(Question.label.asc())
        .all()
    )

    # unique labels, ordered
    q_labels = sorted({q.label for q in questions})


    # Group by main question
    main_order: list[str] = []
    subs_by_main: dict[str, list[str]] = {}

    for lbl in q_labels:
        main = lbl.split(".", 1)[0]
        if main not in subs_by_main:
            subs_by_main[main] = set()
            main_order.append(main)
        subs_by_main[main].add(lbl)

    # convert sets → sorted lists (stable CSV order)
    subs_by_main = {
        k: sorted(v)
        for k, v in subs_by_main.items()
    }


    # -------------------------------
    # STUDENTS + MARKS
    # -------------------------------
    students = (
        db.query(Student)
        .filter(Student.exam_id.in_(exam_ids))
        .order_by(Student.roll_no.asc())
        .all()
    )

    marks = (
        db.query(Mark)
        .filter(Mark.exam_id.in_(exam_ids))
        .all()
    )

    id_to_label = {q.id: q.label for q in questions}

    # (student_id, label) → marks
    marks_map: dict[tuple[int, str], float | None] = {}
    for m in marks:
        lbl = id_to_label.get(m.question_id)
        if lbl:
            marks_map[(m.student_id, lbl)] = (
                None if m.marks is None else float(m.marks)
            )

    # -------------------------------
    # SECTIONS
    # -------------------------------
    sections = (
        db.query(ExamSection)
        .filter(ExamSection.exam_id.in_(exam_ids))
        .all()
    )
    section_name_by_id = {s.id: s.section_name or "" for s in sections}

    student_section: dict[int, str] = {}
    for m in marks:
        if m.section_id:
            student_section[m.student_id] = section_name_by_id.get(m.section_id, "")

    # -------------------------------
    # QUESTION RULES (merge)
    # -------------------------------
    question_rules: dict[str, Any] = {}

    for e in exams:
        raw = e.question_rules
        try:
            rules = json.loads(raw) if isinstance(raw, str) else (raw or {})
        except Exception:
            rules = {}

        for k, v in rules.items():
            if k not in question_rules:
                question_rules[k] = v

    def get_rule_min(rule):
        if not isinstance(rule, dict):
            return None
        for k in ("minToCount", "min", "min_to_count"):
            if k in rule:
                try:
                    return int(rule[k])
                except Exception:
                    pass
        return None

    # -------------------------------
    # CSV OUTPUT
    # -------------------------------
    out = io.StringIO()
    writer = csv.writer(out)

    writer.writerow([f"Academic Year: {ref.academic_year}"])
    writer.writerow([f"Subject: {ref.subject_name} ({ref.subject_code})"])
    writer.writerow([f"Semester: {ref.semester}"])
    writer.writerow([f"Exam Type: {ref.exam_type}"])
    writer.writerow([])

    header = ["Roll No", "Section"]
    for main in main_order:
        for sub in subs_by_main[main]:
            header.append(sub)
        header.append(f"Total_{main}")
    header.append("Grand_Total")
    writer.writerow(header)

    # -------------------------------
    # DATA ROWS
    # -------------------------------
    for s in students:
        row = [s.roll_no, student_section.get(s.id, "")]
        grand_total = 0.0

        for main in main_order:
            subs = subs_by_main[main]
            values: list[float] = []

            for lbl in subs:
                v = marks_map.get((s.id, lbl))
                row.append("" if v is None else v)
                if v is not None:
                    values.append(v)

            rule = question_rules.get(main)
            N = get_rule_min(rule)

            if N:
                values.sort(reverse=True)
                main_total = sum(values[:N])
            else:
                main_total = sum(values)

            if isinstance(main_total, int) or main_total == int(main_total):
                row.append(int(main_total))
            else:
                row.append(round(float(main_total), 2))

            grand_total += main_total

        #  GRAND TOTAL 
        if isinstance(grand_total, int) or grand_total == int(grand_total):
            row.append(int(grand_total))
        else:
            row.append(round(float(grand_total), 2))

        writer.writerow(row)


    out.seek(0)

    filename = (
        f"{ref.subject_code}_{ref.subject_name}_"
        f"{ref.exam_type}_Sem{ref.semester}_{ref.academic_year}_MERGED.csv"
    )

    response = StreamingResponse(
        iter([out.getvalue().encode("utf-8")]),
        media_type="text/csv",
    )
    response.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


@router.get("/{exam_id}/export")
def export_exam_csv(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    #  ADMIN → MERGED EXPORT
    if current_user.role == "admin":
        exams = (
            db.query(Exam)
            .filter(
                Exam.subject_code == exam.subject_code,
                Exam.subject_name == exam.subject_name,
                Exam.exam_type == exam.exam_type,
                Exam.semester == exam.semester,
                Exam.academic_year == exam.academic_year,
            )
            .all()
        )

        exam_ids = [e.id for e in exams]

        return export_merged_exam_csv(
            payload={"exam_ids": exam_ids},
            db=db,
            current_user=current_user,
        )

    #  TEACHER → SINGLE EXAM EXPORT
    return export_single_exam_csv(
        exam_id=exam_id,
        db=db,
        current_user=current_user,
    )


@router.post("/admin/programmes", status_code=201)
async def add_programme(
    payload: ProgrammeCreate,
    db: AsyncSession = Depends(get_db),
    admin=Depends(admin_required),
):
    existing = await db.execute(
        select(Programme).where(Programme.name == payload.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Programme already exists")

    programme = Programme(
        name=payload.name.strip(),
        total_semesters=payload.total_semesters,
    )

    db.add(programme)
    await db.commit()
    await db.refresh(programme)

    return programme


@router.delete("/by-academic-year/{academic_year}")
def delete_exams_by_academic_year(
    academic_year: str,
    db: Session = Depends(get_db),
    _: None = Depends(admin_required),
):
    # sanity check
    if not academic_year or len(academic_year) < 4:
        raise HTTPException(
            status_code=400,
            detail="Invalid academic year"
        )

    # check existence
    exam_count = (
        db.query(Exam)
        .filter(Exam.academic_year == academic_year)
        .count()
    )

    if exam_count == 0:
        raise HTTPException(
            status_code=404,
            detail=f"No exams found for academic year {academic_year}"
        )


    # subquery of exams for the academic year
    exam_ids_subquery = (
        db.query(Exam.id)
        .filter(Exam.academic_year == academic_year)
        .subquery()
    )

    try:
        #  delete marks
        db.execute(
            delete(Mark).where(
                Mark.exam_id.in_(exam_ids_subquery)
            )
        )

        # delete questions
        db.execute(
            delete(Question).where(
                Question.exam_id.in_(exam_ids_subquery)
            )
        )

        # delete exam sections
        db.execute(
            delete(ExamSection).where(
                ExamSection.exam_id.in_(exam_ids_subquery)
            )
        )

        #  delete exams
        db.execute(
            delete(Exam).where(
                Exam.academic_year == academic_year
            )
        )

        db.commit()

    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete exams: {str(e)}"
        )