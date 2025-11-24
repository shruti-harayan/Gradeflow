# backend/app/schemas/user_schema.py
from pydantic import BaseModel, EmailStr,Field
from typing import Literal

Role = Literal["teacher", "admin"]


class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: Role = "teacher"


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=72)

class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(UserBase):
    id: int

    class Config:
        from_attributes = True  # for SQLAlchemy models


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
