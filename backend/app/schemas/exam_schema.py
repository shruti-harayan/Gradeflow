# backend/app/schemas/exam_schema.py
from datetime import datetime, timezone
from typing import List, Dict, Optional,Any
from pydantic import BaseModel, Field

class QuestionOut(BaseModel):
    id: int
    label: str
    max_marks: int

    class Config:
        from_attributes = True


class StudentOut(BaseModel):
    id: int
    roll_no: int
    name: Optional[str] = None   
    absent: bool

    class Config:
        from_attributes = True
        
class ExamBase(BaseModel):
    subject_code: str
    subject_name: str
    exam_type: str = Field(..., description="Internal, External, Practical, ATKT, Other")
    semester: int
    academic_year: str
   
class ExamCreate(ExamBase):
    pass


class ExamOut(ExamBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None 
    is_locked: bool = False
    locked_by: Optional[int] = None
    created_by: Optional[int]=None
    question_rules: Optional[Dict[str, Any]] = None

    class Config:
            orm_mode = True
            json_encoders = {
                datetime: lambda v: (
                    v.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
                    if v.tzinfo is None
                    else v.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
                )
            }

class AdminMarkOut(BaseModel):
    roll_no: int
    question_label: str
    marks: float | None


class AdminCombinedMarksOut(BaseModel):
    exam: ExamOut
    questions: List[QuestionOut]
    students: List[StudentOut]
    marks: List[AdminMarkOut]


class QuestionIn(BaseModel):
    label: str
    max_marks: int


class StudentMarksIn(BaseModel):
    roll_no: int
    name: Optional[str] = None   # Optional student name
    absent: bool = False
    # key = question.label, value = marks or null
    marks: Dict[str, Optional[float]]


class MarksSaveRequest(BaseModel):
    section_id: Optional[int]= None
    subject_code: str
    subject_name: str
    exam_type: str
    semester: int
    questions: List[QuestionIn]
    students: List[StudentMarksIn]
    question_rules: Optional[Dict[str, Any]] = None




class MarkOut(BaseModel):
    student_id: int
    question_id: int
    marks: float | None


class ExamMarksOut(BaseModel):
    exam: ExamOut
    questions: List[QuestionOut]
    students: List[StudentOut]
    marks: List[MarkOut]


class ExamSectionCreate(BaseModel):
    exam_id: int
    section_name: Optional[str] = None
    roll_start: int
    roll_end: int

class ExamSectionOut(BaseModel):
    id: int
    exam_id: int
    teacher_id: int
    section_name: Optional[str]
    roll_start: int
    roll_end: int
    is_locked: bool

    class Config:
        orm_mode = True

class ExamUpdate(BaseModel):
    subject_code: Optional[str]
    subject_name: Optional[str]
    question_rules: Optional[Dict[str, Any]] = None
