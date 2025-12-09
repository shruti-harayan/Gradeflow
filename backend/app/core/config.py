from os import getenv
from dotenv import load_dotenv

load_dotenv()

GOOGLE_CLIENT_ID = getenv("GOOGLE_CLIENT_ID")
SMTP_HOST = getenv("SMTP_HOST")
SMTP_PORT = int(getenv("SMTP_PORT", "465"))
SMTP_USER = getenv("SMTP_USER")
SMTP_PASS = getenv("SMTP_PASS")
EMAIL_FROM = getenv("EMAIL_FROM", "GradeFlow <no-reply@example.com>")
APP_BASE_URL = getenv("APP_BASE_URL", "http://localhost:5173")
