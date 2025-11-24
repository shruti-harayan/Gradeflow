# backend/app/api/routes/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.database import get_db
from app import models
from app.schemas.user_schema import UserCreate, UserLogin, UserOut, Token
from app.core import security

router = APIRouter()


@router.post("/signup", response_model=UserOut)
def signup(user_in: UserCreate, db: Session = Depends(get_db)):
    existing = (
        db.query(models.user.User)
        .filter(models.user.User.email == user_in.email)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = models.user.User(
        name=user_in.name,
        email=user_in.email,
        role=user_in.role,
        hashed_password=security.hash_password(user_in.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(user_in: UserLogin, db: Session = Depends(get_db)):
    user = (
        db.query(models.user.User)
        .filter(models.user.User.email == user_in.email)
        .first()
    )
    if not user or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid credentials"
        )
    if not security.verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid credentials"
        )

    access_token = security.create_access_token(
        {"sub": str(user.id), "role": user.role}
    )
    return Token(access_token=access_token, user=user)


class GoogleTokenIn(BaseModel):
    id_token: str


@router.post("/google", response_model=Token)
def google_login(payload: GoogleTokenIn, db: Session = Depends(get_db)):
    # Verify token with Google
    try:
        idinfo = id_token.verify_oauth2_token(
            payload.id_token, google_requests.Request()
        )
        if not idinfo.get("email_verified"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google email not verified",
            )

        email = idinfo["email"]
        name = idinfo.get("name", email)
        sub = idinfo["sub"]
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Google token",
        )

    # Look up by Google sub or fallback to email
    User = models.user.User
    user = db.query(User).filter(User.google_sub == sub).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()

    # If user doesn't exist, create a teacher by default
    if not user:
        user = User(
            name=name,
            email=email,
            role="teacher",
            google_sub=sub,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # attach google_sub if missing
        if not user.google_sub:
            user.google_sub = sub
            db.commit()
            db.refresh(user)

    access_token = security.create_access_token(
        {"sub": str(user.id), "role": user.role}
    )
    return Token(access_token=access_token, user=user)
