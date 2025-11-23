from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from google.oauth2 import id_token
from google.auth.transport import requests as grequests
from app.core import security
# user service/db not implemented here; assume you have create_or_get_user()

router = APIRouter()

class GoogleTokenIn(BaseModel):
    id_token: str

@router.post("/google")
async def google_login(data: GoogleTokenIn):
    try:
        # Verify the token with Google
        idinfo = id_token.verify_oauth2_token(data.id_token, grequests.Request())
        # idinfo contains: sub (user id), email, email_verified, name, picture, etc.
        if not idinfo.get("email_verified"):
            raise HTTPException(status_code=400, detail="Email not verified by Google")

        email = idinfo["email"]
        name = idinfo.get("name", "")
        google_sub = idinfo["sub"]

        # TODO: create_or_get_user(google_sub, email, name)
        # For MVP: create a local user or fetch from DB
        user = {"id": 1, "email": email, "name": name}

        # Create your app JWT (access token)
        access_token = security.create_access_token({"sub": str(user["id"]), "email": email})
        # Optionally set refresh cookie (httpOnly) and return token in response body too
        return {"access_token": access_token, "token_type": "bearer", "user": user}
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Google token")
