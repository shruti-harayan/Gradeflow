import os
from os import getenv
from dotenv import load_dotenv

load_dotenv()

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
EMAIL_FROM = os.getenv("EMAIL_FROM", "GradeFlow <onboarding@resend.dev>")
APP_BASE_URL = getenv("APP_BASE_URL", "https://grade-frontend-vercel.vercel.app/")
