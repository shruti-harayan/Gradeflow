from sqlalchemy import Column, Integer, String
from app.database import Base  

class Programme(Base):
    __tablename__ = "programmes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    total_semesters = Column(Integer, nullable=False)
    semester_start = Column(Integer, nullable=False, default=1)  
    programme_code = Column(String, index=True, nullable=False)