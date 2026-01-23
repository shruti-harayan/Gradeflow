from pydantic import BaseModel, Field

class SubjectCatalogCreate(BaseModel):
    programme: str = Field(..., min_length=2)
    semester: int = Field(..., ge=1)
    subject_code: str = Field(..., min_length=2)
    subject_name: str = Field(..., min_length=2)

