# app/utils/emailer.py

import resend
from typing import Optional
from app.core.config import RESEND_API_KEY, EMAIL_FROM
resend.api_key = RESEND_API_KEY

def send_email(
    to_email: str,
    subject: str,
    plain_body: str,
    html_body: Optional[str] = None,
) -> None:

    if not RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY not configured")

    try:
        params = {
            "from": EMAIL_FROM,
            "to": [to_email],
            "subject": subject,
            "text": plain_body,
        }

        if html_body:
            params["html"] = html_body

        resend.Emails.send(params)

    except Exception as e:
        print("Resend email error:", e)
        raise
