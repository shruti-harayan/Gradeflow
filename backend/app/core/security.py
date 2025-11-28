# backend/app/core/security.py
from datetime import datetime, timedelta
import logging
from typing import Optional, Dict
from passlib.context import CryptContext
import os
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.models import User
from app.database import get_db

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "dev_secret")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 240  # 4 hours

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: Dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


logger = logging.getLogger(__name__)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        logger.debug("No token provided in request")
        raise credentials_exception

    logger.debug("get_current_user: raw token prefix: %s", token[:30])

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        logger.debug("get_current_user: decoded payload: %s", payload)
        user_id = payload.get("sub")
        if user_id is None:
            logger.error("Token payload missing 'sub' claim: %s", payload)
            raise credentials_exception
        # normalize to int if possible
        try:
            user_id = int(user_id)
        except Exception:
            # leave as-is (maybe your DB uses str id); still try to query
            logger.debug("sub claim not int, using as-is: %s", user_id)

    except JWTError as e:
        logger.exception("JWT decode error: %s", e)
        raise credentials_exception
    except Exception as e:
        logger.exception("Unexpected error decoding token: %s", e)
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        logger.error("No user found for id from token: %s", user_id)
        raise credentials_exception

    return user