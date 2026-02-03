# backend/create_admin.py
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User
from app.core.security import hash_password

def create_initial_admin():
    db = SessionLocal()
    try:
        # Check if admin already exists
        admin_email = "shruti@gmail.com" # Change this to your preferred email
        existing_admin = db.query(User).filter(User.email == admin_email).first()
        
        if not existing_admin:
            print(f"Creating default admin: {admin_email}")
            new_admin = User(
                name="System Admin",
                email=admin_email,
                hashed_password=hash_password("123456"), # Change this immediately after login
                role="admin"
            )
            db.add(new_admin)
            db.commit()
            print("Admin created successfully!")
        else:
            print("Admin already exists.")
    except Exception as e:
        print(f"Error creating admin: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_initial_admin()
