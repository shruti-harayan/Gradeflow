Frontend (npm) — dependencies in frontend/package.json

Run these commands inside frontend/ to install the correct frontend packages:
npm install axios react-router-dom

Activate python environment:
python -m venv venv
venv\Scripts\activate

For running program type following commands in terminal:
backend terminal:python -m uvicorn app.main:app --reload --port 8000
frontend terminal:npm run dev
