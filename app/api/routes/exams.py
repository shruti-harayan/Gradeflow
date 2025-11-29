# backend/app/api/routes/exams.py
from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.exam_schema import ExamCreate, ExamOut, MarksSaveRequest,ExamMarksOut
from app.models.exam import Exam, Question, Student, Mark
from sqlalchemy.orm import Session
from app.database import get_db
from fastapi.responses import StreamingResponse
import csv
from io import StringIO
from app import models
from typing import List
from app.api.dependencies import admin_required
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter()


@router.post("/{exam_id}/finalize")
def finalize_exam(exam_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    Exam = models.exam.Exam  # type: ignore[attr-defined]

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # If already locked, return ok
    if getattr(exam, "is_locked", False):
        return {"status": "ok", "message": "Exam already finalized"}

    # Authorization: allow if current_user is admin OR current_user.id == exam.created_by
    if current_user.role != "admin" and exam.created_by is not None and int(current_user.id) != int(exam.created_by):
        raise HTTPException(status_code=403, detail="Only the exam owner or admin can finalize")

    exam.is_locked = True
    db.add(exam)
    db.commit()
    return {"status": "ok", "message": "Exam finalized (locked)."}


@router.post("/{exam_id}/unfinalize", dependencies=[Depends(admin_required)])
def unfinalize_exam(exam_id: int, db: Session = Depends(get_db)):
    Exam = models.exam.Exam  # type: ignore[attr-defined]

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    if not getattr(exam, "is_locked", False):
        return {"status": "ok", "message": "Exam not locked"}

    exam.is_locked = False
    db.add(exam)
    db.commit()
    return {"status": "ok", "message": "Exam unlocked for editing."}


@router.get("/", response_model=List[ExamOut])
def list_exams(db: Session = Depends(get_db)):
    exams = db.query(Exam).order_by(Exam.created_at.desc()).all()
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
        students_count=exam_in.students_count or 0,
        created_by=current_user.id  
    )

    db.add(exam)
    db.commit()
    db.refresh(exam)

    return exam


@router.post("/{exam_id}/marks")
def save_marks(exam_id: int, payload: MarksSaveRequest, db: Session = Depends(get_db)):
    Exam = models.exam.Exam  # type: ignore[attr-defined]
    Question = models.exam.Question  # type: ignore[attr-defined]
    Student = models.exam.Student  # type: ignore[attr-defined]
    Mark = models.exam.Mark  # type: ignore[attr-defined]

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Update meta info (just in case)
    exam.subject_code = payload.subject_code
    exam.subject_name = payload.subject_name
    exam.exam_type = payload.exam_type
    exam.semester = payload.semester

    # Questions: upsert by label
    existing_questions = (
        db.query(Question).filter(Question.exam_id == exam_id).all()
    )
    q_by_label = {q.label: q for q in existing_questions}

    for idx, q_in in enumerate(payload.questions):
        q = q_by_label.get(q_in.label)
        if not q:
            q = Question(
                exam_id=exam_id,
                label=q_in.label,
                max_marks=q_in.max_marks,
                order=idx,
            )
            db.add(q)
            db.flush()
            q_by_label[q.label] = q
        else:
            q.max_marks = q_in.max_marks
            q.order = idx

    # Students: upsert by roll_no
    existing_students = (
        db.query(Student).filter(Student.exam_id == exam_id).all()
    )
    s_by_roll = {s.roll_no: s for s in existing_students}

    for s_in in payload.students:
        s = s_by_roll.get(s_in.roll_no)
        if not s:
            s = Student(
                exam_id=exam_id,
                roll_no=s_in.roll_no,
                name=s_in.name,
                absent=s_in.absent,
            )
            db.add(s)
            db.flush()
            s_by_roll[s.roll_no] = s
        else:
            s.name = s_in.name
            s.absent = s_in.absent

        # For each question label, upsert mark
        for label, value in s_in.marks.items():
            q = q_by_label.get(label)
            if not q:
                continue  # should not happen if frontend & backend are aligned

            mark = (
                db.query(Mark)
                .filter(
                    Mark.exam_id == exam_id,
                    Mark.student_id == s.id,
                    Mark.question_id == q.id,
                )
                .first()
            )

            if s_in.absent:
                # Absent: clear marks
                if mark:
                    mark.marks = None
                else:
                    mark = Mark(
                        exam_id=exam_id,
                        student_id=s.id,
                        question_id=q.id,
                        marks=None,
                    )
                    db.add(mark)
            else:
                if value is None:
                    # treat None as "no mark"
                    if mark:
                        mark.marks = None
                    else:
                        mark = Mark(
                            exam_id=exam_id,
                            student_id=s.id,
                            question_id=q.id,
                            marks=None,
                        )
                        db.add(mark)
                else:
                    if mark:
                        mark.marks = value
                    else:
                        mark = Mark(
                            exam_id=exam_id,
                            student_id=s.id,
                            question_id=q.id,
                            marks=value,
                        )
                        db.add(mark)

    exam.students_count = len(payload.students)
    db.commit()
    return {"status": "ok", "message": "Marks saved"}

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
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    questions = db.query(Question).filter(Question.exam_id == exam_id).order_by(Question.order.asc()).all()
    students = db.query(Student).filter(Student.exam_id == exam_id).order_by(Student.roll_no.asc()).all()
    marks = db.query(Mark).filter(Mark.exam_id == exam_id).all()

    # Marks lookup for quick fill
    mark_map = {(m.student_id, m.question_id): m.marks for m in marks}

    output = StringIO()
    writer = csv.writer(output)

    # Header
    question_headers = [q.label for q in questions]
    writer.writerow(["Roll No", "Name", "Absent"] + question_headers + ["Total"])

    # Data rows
    for s in students:
        row = [
            s.roll_no,
            s.name,
            "AB" if s.absent else "",
        ]
        total = 0
        for q in questions:
            mk = mark_map.get((s.id, q.id))
            if mk is None:
                row.append("")
            else:
                row.append(mk)
                total += mk

        row.append(total)
        writer.writerow(row)

    output.seek(0)
    filename = f"{exam.subject_code}_{exam.exam_type}_Sem{exam.semester}.csv"

    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
