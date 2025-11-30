# backend/app/schemas/exam_schema.py
from datetime import datetime
from typing import List, Dict, Optional
from pydantic import BaseModel, Field

class ExamBase(BaseModel):
    subject_code: str
    subject_name: str
    exam_type: str = Field(..., description="Internal, External, Practical, ATKT, Other")
    semester: int
    


class ExamCreate(ExamBase):
    pass


class ExamOut(ExamBase):
    id: int
    created_at: datetime | None = None
    is_locked: bool = False

    class Config:
        from_attributes = True


class QuestionIn(BaseModel):
    label: str
    max_marks: int


class StudentMarksIn(BaseModel):
    roll_no: str
    name: Optional[str] = None   # Optional student name
    absent: bool = False
    # key = question.label, value = marks or null
    marks: Dict[str, Optional[int]]


class MarksSaveRequest(BaseModel):
    subject_code: str
    subject_name: str
    exam_type: str
    semester: int
    questions: List[QuestionIn]
    students: List[StudentMarksIn]


class QuestionOut(BaseModel):
    id: int
    label: str
    max_marks: int

    class Config:
        from_attributes = True


class StudentOut(BaseModel):
    id: int
    roll_no: str
    name: Optional[str] = None   
    absent: bool

    class Config:
        from_attributes = True


class MarkOut(BaseModel):
    student_id: int
    question_id: int
    marks: int | None


class ExamMarksOut(BaseModel):
    exam: ExamOut
    questions: List[QuestionOut]
    students: List[StudentOut]
    marks: List[MarkOut]
