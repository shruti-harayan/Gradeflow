# backend/app/models/__init__.py
from app.database import Base
from app.models.user import User  # noqa
from app.models.exam import Exam, Question, Student, Mark # noqa