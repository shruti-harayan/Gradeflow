from datetime import datetime
import requests
from fastapi import APIRouter, Body, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as grequests
from app.database import get_db
from app.models import User
from app.core.security import create_access_token,hash_password,get_current_user
from app.core.config import GOOGLE_CLIENT_ID
from passlib.hash import argon2
from app.api.dependencies import admin_required
from typing import List

router = APIRouter()

class GoogleTokenIn(BaseModel):
    id_token: str | None = None
    access_token: str | None = None

class AdminCreateTeacher(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "teacher"

# Response schema for teacher listing
class TeacherOut(BaseModel):
    id: int
    name: str | None = None
    email: str
    role: str
    is_frozen: bool
    created_at: datetime | None

    class Config:
        from_attributes = True 

# Reset password input schema
class ResetPasswordIn(BaseModel):
    new_password: str | None = None  # if None, server generates random temp pw

# GET teachers
@router.get("/admin/teachers", response_model=List[TeacherOut], dependencies=[Depends(admin_required)])
def list_teachers(db: Session = Depends(get_db)):
    teachers = db.query(User).filter(User.role == "teacher").all()
    return teachers

# Freeze
@router.post("/admin/teachers/{teacher_id}/freeze", dependencies=[Depends(admin_required)])
def freeze_teacher(teacher_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == teacher_id, User.role == "teacher").first()
    if not user:
        raise HTTPException(status_code=404, detail="Teacher not found")
    user.is_frozen = True
    db.add(user)
    db.commit()
    return {"detail": "Teacher frozen"}

# Unfreeze
@router.post("/admin/teachers/{teacher_id}/unfreeze", dependencies=[Depends(admin_required)])
def unfreeze_teacher(teacher_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == teacher_id, User.role == "teacher").first()
    if not user:
        raise HTTPException(status_code=404, detail="Teacher not found")
    user.is_frozen = False
    db.add(user)
    db.commit()
    return {"detail": "Teacher unfrozen"}

# Reset password (admin)
@router.post("/admin-reset-password/{user_id}", dependencies=[Depends(admin_required)])
def admin_reset_password(
    user_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    # Authorization: admin_required dependency ensures current_user is admin.
    new_password = payload.get("password")
    if not new_password or not isinstance(new_password, str):
        raise HTTPException(status_code=400, detail="Password must be provided")

    # optional: enforce minimum length
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Hash and set
    user.hashed_password = hash_password(new_password)
    db.add(user)
    db.commit()
    # Do not return hashed_password in response
    return {"status": "ok", "message": "Password updated"}


class SignupIn(BaseModel):
    name: str
    email: str
    password: str
    role: str = "teacher"

@router.post("/signup")
def signup(payload: SignupIn, db: Session = Depends(get_db)):

    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = argon2.hash(payload.password)

    user = User(
        name=payload.name,
        email=payload.email,
        hashed_password=hashed_password,
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token({"sub": str(user.id)})
    return {"access_token": access_token, "user": user}


class LoginIn(BaseModel):
    email: str
    password: str

@router.post("/login")
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid email or password")

    # verify argon2 hash
    if not argon2.verify(payload.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid email or password")

    access_token = create_access_token({"sub": str(user.id)})
    return {"access_token": access_token, "user": user}


@router.post("/admin-create-teacher")
def admin_create_teacher(
    payload: AdminCreateTeacher,
    db: Session = Depends(get_db),
    current_admin = Depends(admin_required),
):
    # Check duplicate
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    hashed = argon2.hash(payload.password)

    user = User(
        name=payload.name,
        email=payload.email,
        hashed_password=hashed,
        role="teacher"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {"detail": "Teacher created successfully", "id": user.id}

@router.post("/google")
def google_login(payload: GoogleTokenIn, db: Session = Depends(get_db)):

    # -----------------------
    # 1. Handle id_token case
    # -----------------------
    if payload.id_token:
        try:
            idinfo = id_token.verify_oauth2_token(
                payload.id_token,
                grequests.Request(),
                GOOGLE_CLIENT_ID
            )
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid ID token")

        email = idinfo.get("email")
        name = idinfo.get("name") or "Google User"
        google_sub = idinfo.get("sub")

    # --------------------------
    # 2. Handle access_token case
    # --------------------------
    elif payload.access_token:
        resp = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            params={"access_token": payload.access_token},
            timeout=5
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Invalid access token")

        profile = resp.json()
        email = profile.get("email")
        name = profile.get("name") or "Google User"
        google_sub = profile.get("sub") or profile.get("id")

    else:
        raise HTTPException(status_code=400, detail="Token missing")

    # --------------------------------
    # 3. Find or create User in DB
    # --------------------------------
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            name=name,
            hashed_password=None,   # Google users don't have a local password
            role="teacher",     # Default role — you may ask user to choose
            google_sub=google_sub
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # --------------------------------
    # 4. Create JWT using your EXISTING method
    # --------------------------------
    access_token = create_access_token({"sub": str(user.id)})


    return {"access_token": access_token, "user": user}
