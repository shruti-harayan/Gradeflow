# -----------------------------
# Base Image
# -----------------------------
FROM python:3.12-slim

# -----------------------------
# Environment Variables
# -----------------------------
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# -----------------------------
# Working Directory
# -----------------------------
WORKDIR /app

# -----------------------------
# Copy requirements first
# -----------------------------
COPY requirements.txt .

# -----------------------------
# Install dependencies
# -----------------------------
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# -----------------------------
# Copy the project
# -----------------------------
COPY . .

# -----------------------------
# Expose FastAPI Port
# -----------------------------
EXPOSE 8000

# -----------------------------
# Start FastAPI
# -----------------------------
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]