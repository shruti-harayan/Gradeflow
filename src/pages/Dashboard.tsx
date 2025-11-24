// src/pages/Dashboard.tsx
import React from "react";
import { useNavigate } from "react-router-dom";

type ExamType = "Internal" | "External" | "Practical" | "ATKT" | "Other";

type SubjectCard = {
  id: number;
  code: string;
  name: string;
  students: number;
  examType: ExamType;         
  lastUpdated?: string;
};

const subjects: SubjectCard[] = [
  {
    id: 1,
    code: "CS101",
    name: "Math",
    students: 120,
    examType: "Internal",
    lastUpdated: "Today, 3:45 PM",
  },
  {
    id: 2,
    code: "MA201",
    name: "Data Structures",
    students: 90,
    examType: "External",
    lastUpdated: "Yesterday",
  },
  {
    id: 3,
    code: "CS301",
    name: "Databases",
    students: 60,
    examType: "Practical",
    lastUpdated: "2 days ago",
  },
];

export default function Dashboard() {
  const navigate = useNavigate();

  function handleOpen(subject: SubjectCard) {
    // Send subject + exam in query params to marks-entry page
    navigate(
      `/marks-entry?subject=${encodeURIComponent(
        subject.code
      )}&exam=${encodeURIComponent(subject.examType)}`
    );
  }

  function handleExport(subject: SubjectCard) {
    // later: call backend to download latest CSV for this subject+exam
    alert(
      `Export for ${subject.code} - ${subject.name} (${subject.examType}) will be implemented with backend.`
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Teacher dashboard
          </h1>
          <p className="text-xs text-slate-400">
            Quickly open exams, enter marks, and export CSV files.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex items-center rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow shadow-emerald-500/40 hover:bg-emerald-600"
        >
          + New subject / exam
        </button>
      </div>

      {/* Subject cards */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {subjects.map((s) => (
          <div
            key={s.id}
            className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg shadow-slate-900/40"
          >
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Subject
              </p>
              <h2 className="text-lg font-semibold text-white">
                {s.code} – {s.name}
              </h2>

              <div className="mt-2 flex items-center justify-between text-xs">
                <div className="flex flex-col">
                  <span className="text-slate-400">Exam type</span>
                  <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-indigo-200">
                    {s.examType}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-slate-50">
                    {s.students}
                  </span>
                  <div className="text-[11px] text-slate-400">students</div>
                </div>
              </div>

              {s.lastUpdated && (
                <p className="mt-2 text-[11px] text-slate-500">
                  Last updated: {s.lastUpdated}
                </p>
              )}
            </div>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => handleOpen(s)}
                className="flex-1 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-600"
              >
                Open marks entry
              </button>
              <button
                type="button"
                onClick={() => handleExport(s)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800"
              >
                Export
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
