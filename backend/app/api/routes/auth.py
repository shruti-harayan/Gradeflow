import requests,secrets
from fastapi import APIRouter, Body, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as grequests
from app.database import get_db
from app.models import User
from app.core.security import create_access_token,hash_password,get_current_user,verify_password
from app.core.config import GOOGLE_CLIENT_ID
from passlib.hash import argon2
from app.api.dependencies import admin_required
from typing import List
from app.models.user import PasswordReset
from datetime import datetime, timedelta, timezone  

router = APIRouter()

class GoogleTokenIn(BaseModel):
    id_token: str | None = None
    access_token: str | None = None


class ForgotPasswordIn(BaseModel):
    email: str

@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()

    # Email not found → show explicit message (requested by you)
    if not user:
        raise HTTPException(
            status_code=400,
            detail="This email is not registered."
        )

    # Email exists but is teacher → deny reset
    if user.role == "teacher":
        raise HTTPException(
            status_code=400,
            detail="This account is registered as teacher so cannot reset password."
        )

    # Additional safety — only admins allowed
    if user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Not allowed."
        )

    # Valid admin → create token
    token = secrets.token_urlsafe(32)
    expiry = datetime.now(timezone.utc) + timedelta(hours=1)

    row = PasswordReset(
        user_id=user.id,
        token=token,
        expires_at=expiry
    )
    db.add(row)
    db.commit()

    reset_link = f"http://localhost:5173/reset-password?token={token}"
    print("SEND RESET LINK:", reset_link)   # replace with email sending later

    return {"detail": "Password reset instructions have been sent to your email."}


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str

@router.post("/reset-password")
def reset_password(payload: ResetPasswordIn, db: Session = Depends(get_db)):
    row = db.query(PasswordReset).filter(PasswordReset.token == payload.token).first()
   
# Normalize row.expires_at to be timezone-aware (assume UTC if naive)
    expires_at = row.expires_at
    if expires_at is None:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    # If DB returned a naive datetime (no tzinfo), assume UTC
    if getattr(expires_at, "tzinfo", None) is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

# Compare with an aware "now"
    now_utc = datetime.now(timezone.utc)
    if expires_at < now_utc:
        raise HTTPException(status_code=400, detail="Token expired")

    user = db.query(User).filter(User.id == row.user_id).first()
    if not user:
        raise HTTPException(400, "User not found")

    if len(payload.new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    user.hashed_password =hash_password(payload.new_password)
    db.delete(row)
    db.commit()

    return {"detail": "Password successfully reset"}


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


# POST /auth/change-password
class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str

@router.post("/change-password")
def change_password(payload: ChangePasswordIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(400, "Current password is incorrect")
    # basic password policy (min length)
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")

    # optionally enforce password policy here
    current_user.hashed_password = hash_password(payload.new_password)
    db.add(current_user); db.commit()
    return {"detail":"Password updated successfully"}


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


@router.post("/admin-create-teacher", dependencies=[Depends(admin_required)])
def admin_create_teacher(
    payload: AdminCreateTeacher,
    db: Session = Depends(get_db),
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
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {"id": user.id, "email": user.email, "role": user.role,"detail": "Account created successfully"}

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
