from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
import requests
from google.oauth2 import id_token
from google.auth.transport import requests as grequests

from app.database import get_db
from app.models import User
from app.core.security import create_access_token
from app.core.config import GOOGLE_CLIENT_ID

from passlib.hash import argon2

router = APIRouter()

class GoogleTokenIn(BaseModel):
    id_token: str | None = None
    access_token: str | None = None


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
            full_name=name,
            password="",        # Not used for Google accounts
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


class SignupIn(BaseModel):
    full_name: str
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
        full_name=payload.full_name,
        email=payload.email,
        password=hashed_password,
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
