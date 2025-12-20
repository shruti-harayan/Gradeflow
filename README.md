# GradeFlow 🎓  
**A Rule-Based Academic Grading & Workflow Management System**

GradeFlow is a web-based grading system designed for colleges to replace spreadsheet-based mark entry workflows. It enables teachers to enter question-wise marks, automatically compute totals using predefined rules, and submit finalized results in a controlled manner. Administrators can review, lock/unlock exams, and download clean Excel/CSV reports for examination processing.

---

## 📌 Problem Addressed

In many colleges, teachers use Excel sheets to enter marks and calculate totals manually. If errors are found after submission, files are repeatedly edited and renamed (e.g., *final*, *updated*, *final_v2*), creating confusion for examination committees.

GradeFlow solves this problem by:
- Eliminating manual calculations
- Enforcing rule-based evaluation
- Providing clear draft and final submission states
- Maintaining a single authoritative dataset

---

## 🚀 Key Features

### 👩‍🏫 Teacher Module
- Create subjects and exams
- Enter roll-wise, question-wise marks
- Define grading rules (e.g., **best N out of K**)
- Automatic calculation of totals and grand totals
- Save marks as draft
- Final submit with system-level lock
- Export marks as Excel/CSV

### 🛡️ Admin Module
- Create and manage teacher/admin accounts
- View all exams across subjects and academic years
- Lock or unlock exams
- Read-only access to marks for review
- Download final CSV/Excel reports
- Reset passwords and freeze user accounts

---

## 🧠 Core Concepts

- **Rule-Based Evaluation**  
  Supports grading rules like “answer any N out of K sub-questions”.

- **Workflow Control**  
  Explicit states: *Draft → Final → Locked* to prevent accidental edits.

- **Single Source of Truth**  
  No multiple Excel versions; one finalized dataset per exam.

---

## 🖥️ System Architecture

GradeFlow follows a **three-tier architecture**:

1. **Frontend (Presentation Layer)**  
   - React-based UI for teachers and admins  
   - Handles user interaction and visualization  

2. **Backend (Application Layer)**  
   - REST APIs built with FastAPI  
   - Business logic, validation, and workflow enforcement  

3. **Database (Data Layer)**  
   - Relational database for structured storage of marks, exams, and users  

---

## 🛠️ Tech Stack

- **Frontend:** React, Tailwind CSS  
- **Backend:** FastAPI (Python)  
- **Database:** Relational Database (e.g., PostgreSQL / SQLite for development)  
- **Export:** CSV / Excel generation  
- **Diagrams:** draw.io (for system & workflow diagrams)


---

## 🔐 Security & Access Control

- Role-based access (Teacher / Admin)
- Server-side enforcement of permissions
- Read-only admin views for marks
- Locked exams cannot be edited after final submission

---

## 📊 Output & Reports

- Clean, structured **CSV/Excel** reports
- Includes academic metadata, question-wise marks, totals, and grand totals
- Ready for audit, moderation, and result processing

---

## 🎯 Scope of the Project

- Focused on **marks entry, computation, and submission workflows**
- Does **not** include result publishing or student-facing portals
- Designed specifically for **college examination processes**

---

## 🔮 Future Enhancements

- Analytics dashboards for admins
- Integration with LMS or Student Information Systems
- Support for moderation and re-evaluation workflows
- Cloud deployment and multi-college support

---

## 📜 License

This project is developed for academic and educational purposes.  
All rights reserved © 2025.

---

## 👩‍💻 Author

**Shruti Harayan**  
Built for teachers and academic institutions  
GradeFlow — Fast marks entry & analytics for colleges
