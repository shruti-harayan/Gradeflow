# schemas/programme.py
from pydantic import BaseModel, Field

class ProgrammeCreate(BaseModel):
    programme_code: str = Field(..., min_length=2)
    name: str = Field(..., min_length=2)
    total_semesters: int = Field(..., ge=1)

class ProgrammeOut(BaseModel):
    id: int
    name: str
    total_semesters: int
    semester_start: int
    programme_code: str
    
    model_config = {
        "from_attributes": True
    }
