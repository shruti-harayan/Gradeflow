# backend/app/models/exam.py
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Exam(Base):
    __tablename__ = "exams"

    id = Column(Integer, primary_key=True, index=True)
    subject_code = Column(String, index=True, nullable=False)
    subject_name = Column(String, nullable=False)
    exam_type = Column(String, nullable=False)  
    semester = Column(Integer, nullable=False)
    students_count = Column(Integer, default=0)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_locked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    questions = relationship(
        "Question", back_populates="exam", cascade="all, delete-orphan"
    )
    students = relationship(
        "Student", back_populates="exam", cascade="all, delete-orphan"
    )
    marks = relationship(
        "Mark", back_populates="exam", cascade="all, delete-orphan"
    )


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"))
    label = Column(String, nullable=False)       # "Q1", "Q2" etc
    max_marks = Column(Integer, nullable=False)
    order = Column(Integer, default=0)

    exam = relationship("Exam", back_populates="questions")
    marks = relationship(
        "Mark", back_populates="question", cascade="all, delete-orphan"
    )


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"))
    roll_no = Column(String, nullable=False)
   
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
    marks = Column(Integer, nullable=True)  # None if absent or not entered

    exam = relationship("Exam", back_populates="marks")
    student = relationship("Student", back_populates="marks")
    question = relationship("Question", back_populates="marks")
