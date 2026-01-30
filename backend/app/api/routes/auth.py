import hashlib, secrets
from fastapi import APIRouter, Body, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.core.security import create_access_token,hash_password,get_current_user,verify_password
from passlib.hash import argon2
from app.api.dependencies import admin_required
from typing import List
from app.models.user import PasswordReset
from datetime import datetime, timedelta, timezone  
from app.utils.emailer import send_email
from app.core.config import APP_BASE_URL

router = APIRouter()

class ForgotPasswordIn(BaseModel):
    email: str

@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()

    # Security: do not reveal whether user exists
    if not user:
        return {"detail": "If the account exists, a reset link has been sent."}

    # Teachers are explicitly blocked
    if user.role == "teacher":
        raise HTTPException(
            status_code=403,
            detail="This account is registered as teacher so cannot reset password."
        )

    # Only admins allowed
    if user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Password reset is not allowed for this account."
        )

    # Remove old reset tokens
    db.query(PasswordReset).filter(
        PasswordReset.user_id == user.id
    ).delete()
    db.commit()

    # Generate secure token
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expiry = datetime.now(timezone.utc) + timedelta(hours=1)

    row = PasswordReset(
        user_id=user.id,
        token=token_hash,
        expires_at=expiry
    )
    db.add(row)
    db.commit()

    reset_link = f"{APP_BASE_URL.rstrip('/')}/reset-password?token={raw_token}"

    plain = f"""Hello,

We received a request to reset the password for your GradeFlow admin account.

Reset link (valid for 1 hour):
{reset_link}

If you did not request this, you can ignore this email.

Regards,
GradeFlow team
"""

    html = f"""
<html>
<body>
  <p>Hello,</p>
  <p>We received a request to reset the password for your GradeFlow admin account.</p>
  <p>
    <a href="{reset_link}" style="display:inline-block;padding:10px 16px;background:#6d28d9;color:#fff;border-radius:6px;text-decoration:none">
      Reset password
    </a>
  </p>
  <p style="font-size:13px;color:#666">
    Or copy this link: <a href="{reset_link}">{reset_link}</a>
  </p>
  <p>If you did not request this, please ignore this message.</p>
  <p>Regards,<br/>GradeFlow</p>
</body>
</html>
"""

    try:
        send_email(
           send_email(
            to_email=user.email,
            subject="GradeFlow — Password reset instructions",
            plain_body=plain,
            html_body=html
            )
        )
    except Exception as e:
        print("Forgot-password email failed:", e)
        db.delete(row)
        db.commit()
        raise HTTPException(
            status_code=500,
            detail="Unable to send reset email at the moment."
        )

    return {"detail": "Password reset instructions have been sent to your email."}


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str

@router.post("/reset-password")
def reset_password(
    payload: ResetPasswordIn,
    db: Session = Depends(get_db)
):
    token_hash = hashlib.sha256(payload.token.encode()).hexdigest()

    row = (
        db.query(PasswordReset)
        .filter(PasswordReset.token == token_hash)
        .first()
    )

    if not row:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    # 2. Normalize expires_at to UTC
    expires_at = row.expires_at
    if expires_at is None:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    now_utc = datetime.now(timezone.utc)
    if expires_at < now_utc:
        # cleanup expired token
        db.delete(row)
        db.commit()
        raise HTTPException(status_code=400, detail="Token expired")

    # 3. Fetch user
    user = db.query(User).filter(User.id == row.user_id).first()
    if not user:
        db.delete(row)
        db.commit()
        raise HTTPException(status_code=400, detail="User not found")

    # 4. ADMIN-ONLY restriction 
    if user.role != "admin":
        db.delete(row)
        db.commit()
        raise HTTPException(
            status_code=403,
            detail="This account is registered as teacher so cannot reset password"
        )

    # 5. Validate password
    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters"
        )

    # 6. Update password
    user.hashed_password = hash_password(payload.new_password)
    db.add(user)

    # 7. Delete ALL reset tokens for this user (security best practice)
    db.query(PasswordReset).filter(
        PasswordReset.user_id == user.id
    ).delete()

    db.commit()

    return {"detail": "Password reset successful"}

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
    teachers = db.query(User).filter(User.role == "teacher",User.is_deleted == False).all()
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
    if user.is_deleted:
        raise HTTPException(
            status_code=403,
            detail="This account has been deactivated by admin"
        )

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


@router.post("/admin/users/{user_id}/deactivate")
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.is_deleted:
        raise HTTPException(
            status_code=400,
            detail="User already deactivated"
        )

    # Optional safety: prevent deleting yourself
    if user.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot deactivate your own account"
        )

    # Optional safety: prevent deleting last admin
    if user.role == "admin":
        admin_count = (
            db.query(User)
            .filter(User.role == "admin", User.is_deleted == False)
            .count()
        )
        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="At least one admin must exist"
            )

    user.is_deleted = True
    user.is_frozen = True  # force read-only forever

    db.commit()

    return {
        "status": "ok",
        "message": "User deactivated permanently"
    }
