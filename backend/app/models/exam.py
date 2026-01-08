# backend/app/models/exam.py
from sqlalchemy import Column, Float, Integer, String, Boolean, ForeignKey, DateTime,Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
from sqlalchemy.dialects.sqlite import JSON 
import json

class Exam(Base):
    __tablename__ = "exams"

    id = Column(Integer, primary_key=True, index=True)
    programme = Column(String, nullable=False)
    subject_code = Column(String, index=True, nullable=False)
    subject_name = Column(String, nullable=False)
    exam_type = Column(String, nullable=False)  
    semester = Column(Integer, nullable=False)
    academic_year= Column(String, nullable=False)
    students_count = Column(Integer, default=0)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    locked_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_locked = Column(Boolean, default=False, nullable=False) 
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    question_rules = Column(JSON, nullable=True)
    
    questions = relationship(
        "Question", back_populates="exam", cascade="all, delete-orphan"
    )
    students = relationship(
        "Student", back_populates="exam", cascade="all, delete-orphan"
    )
    marks = relationship(
        "Mark", back_populates="exam", cascade="all, delete-orphan"
    )
    sections = relationship(
        "ExamSection", back_populates="exam", cascade="all, delete-orphan")

    def get_question_rules(self):
        if not self.question_rules:
            return {}
        try:
            return json.loads(self.question_rules)
        except Exception:
            return {}

class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"))
    label = Column(String, nullable=False)       # "Q1", "Q2" etc
    max_marks = Column(Integer, nullable=False)  # change to Float if needed
    order = Column(Integer, default=0)

    exam = relationship("Exam", back_populates="questions")
    marks = relationship(
        "Mark", back_populates="question", cascade="all, delete-orphan"
    )


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"))
    roll_no = Column(Integer, nullable=False)   
    absent = Column(Boolean, default=False)

    exam = relationship("Exam", back_populates="students")
    marks = relationship(
        "Mark", back_populates="student", cascade="all, delete-orphan"
    )


class Mark(Base):
    __tablename__ = "marks"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"))
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"))
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"))
    marks = Column(Float, nullable=True)  # None if absent or not entered
    section_id = Column(Integer, ForeignKey("exam_sections.id"), nullable=True)

    exam = relationship("Exam", back_populates="marks")
    student = relationship("Student", back_populates="marks")
    question = relationship("Question", back_populates="marks")
    

class ExamSection(Base):
    __tablename__ = "exam_sections"
    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"))
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    section_name = Column(String, nullable=True)
    roll_start = Column(Integer, nullable=False)
    roll_end = Column(Integer, nullable=False)
    is_locked = Column(Boolean, default=False)
    locked_by = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())  # timezone-aware

    exam = relationship("Exam", back_populates="sections")
    teacher = relationship("User")



class SubjectCatalog(Base):
    __tablename__ = "subjects_catalog"

    id = Column(Integer, primary_key=True, index=True)
    programme = Column(String, nullable=False, index=True)
    semester = Column(Integer, nullable=False, index=True)
    subject_code = Column(String, nullable=False)
    subject_name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
