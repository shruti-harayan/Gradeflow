# app/utils/emailer.py
from email.message import EmailMessage
import smtplib
from typing import Optional
from app.core.config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM

def send_email(
    to_email: str,
    subject: str,
    plain_body: str,
    html_body: Optional[str] = None,
) -> None:
    """
    Synchronously send an email via SMTP.
    Raises smtplib.SMTPException on failure.
    """

    if not all([SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS]):
        raise RuntimeError("SMTP is not configured. Check environment variables.")

    msg = EmailMessage()
    msg["From"] = EMAIL_FROM
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(plain_body)
    if html_body:
        msg.add_alternative(html_body, subtype="html")

    # Use SMTP over SSL (port 465) or StartTLS (port 587) depending on provider.
    # Here we prefer SSL (465). If you use 587, use smtplib.SMTP and starttls().
    try:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as smtp:
            smtp.login(SMTP_USER, SMTP_PASS)
            smtp.send_message(msg)
    except Exception as e:
        # re-raise so caller can handle/log
        raise
