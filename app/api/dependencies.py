from fastapi import Depends, HTTPException
from app.core.security import get_current_user
from app.models import User

# This ensures only admins can access certain routes
def admin_required(user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    return user
