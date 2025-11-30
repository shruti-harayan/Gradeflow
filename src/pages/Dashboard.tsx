// src/pages/Dashboard.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { createExam, getExams, type ExamType } from "../services/examService";

type SubjectCard = {
  id: number;         // UI id 
  examId?: number;    // backend exam id 
  code: string;
  name: string;
  examType: ExamType;
  semester: number;
  lastUpdated?: string;
};

export default function Dashboard() {
  const navigate = useNavigate();

  const [subjects, setSubjects] = React.useState<SubjectCard[]>([]);
  const [isCreating, setIsCreating] = React.useState(false);

  const [newCode, setNewCode] = React.useState("");
  const [newName, setNewName] = React.useState("");
  const [newExamType, setNewExamType] = React.useState<ExamType>("Internal");
  const [newSemester, setNewSemester] = React.useState<number>(1);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // 🔹 Load exams from backend on first mount
  React.useEffect(() => {
    async function load() {
      try {
        const exams = await getExams();
        const mapped: SubjectCard[] = exams.map((exam) => ({
          id: exam.id,
          examId: exam.id,
          code: exam.subject_code,
          name: exam.subject_name,
          examType: exam.exam_type as ExamType,
          semester: exam.semester,
          lastUpdated: exam.created_at
            ? new Date(exam.created_at).toLocaleString()
            : undefined,
        }));
        setSubjects(mapped);
      } catch (err) {
        console.error(err);
        setError("Failed to load exams from server.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  function resetForm() {
    setNewCode("");
    setNewName("");
    setNewExamType("Internal");
    setNewSemester(1);
  }

  async function handleCreateExam(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) return;


    // 1) Create exam in backend
    const exam = await createExam({
      subject_code: newCode.trim().toUpperCase(),
      subject_name: newName.trim(),
      exam_type: newExamType,
      semester: newSemester,
      is_locked: false
    });

    // 2) Create local card so it appears immediately
    const newSubject: SubjectCard = {
      id: exam.id,
      examId: exam.id,
      code: exam.subject_code,
      name: exam.subject_name,
      examType: exam.exam_type as ExamType,
      semester: exam.semester,
      lastUpdated: "Just now",
    };

    setSubjects((prev) => [newSubject, ...prev]);
    resetForm();
    setIsCreating(false);

    // 3) Navigate to marks entry for this exam
    navigate(
      `/marks-entry?examId=${exam.id}` +
        `&subject=${encodeURIComponent(exam.subject_code)}` +
        `&subjectName=${encodeURIComponent(exam.subject_name)}` +
        `&exam=${encodeURIComponent(exam.exam_type)}` +
        `&sem=${encodeURIComponent(String(exam.semester))}`
    );
  }

  function handleOpen(subject: SubjectCard) {
    const examId = subject.examId ?? 0;

    navigate(
      `/marks-entry?examId=${examId}` +
        `&subject=${encodeURIComponent(subject.code)}` +
        `&subjectName=${encodeURIComponent(subject.name)}` +
        `&exam=${encodeURIComponent(subject.examType)}` +
        `&sem=${encodeURIComponent(String(subject.semester))}`
    );
  }

  function handleExport(subject: SubjectCard) {
    alert(
      `Export for ${subject.code} - ${subject.name} (Sem ${subject.semester}, ${subject.examType}) will be implemented with backend.`
    );
  }

  function handleDelete(id: number) {
    const ok = window.confirm(
      "Are you sure you want to delete this subject/exam from your dashboard?"
    );
    if (!ok) return;

    setSubjects((prev) => prev.filter((s) => s.id !== id));
    // TODO: also call backend DELETE /exams/{id} when you add it
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Teacher dashboard</h1>
          <p className="text-xs text-slate-400">
            Create exams, enter marks, and export CSV files.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreating((prev) => !prev)}
          className="inline-flex items-center rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow shadow-emerald-500/40 hover:bg-emerald-600"
        >
          {isCreating ? "Close form" : "+ New subject / exam"}
        </button>
      </div>

      {/* Optional error / loading states */}
      {loading && (
        <p className="text-xs text-slate-400">Loading exams from server…</p>
      )}
      {error && (
        <p className="text-xs text-red-400">
          {error} (check backend is running on port 8000)
        </p>
      )}

      {/* Create Exam panel */}
      {isCreating && (
        <form
          onSubmit={handleCreateExam}
          className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg shadow-slate-900/40 space-y-4"
        >
          <h2 className="text-sm font-semibold text-slate-100">
            Create new exam
          </h2>

          <div className="grid gap-4 md:grid-cols-5 text-xs">
            <div className="flex flex-col gap-1">
              <label className="text-slate-300">Subject code</label>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="CS101"
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-slate-300">Subject name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Algorithms"
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-slate-300">Exam type</label>
              <select
                value={newExamType}
                onChange={(e) => setNewExamType(e.target.value as ExamType)}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Internal">Internal</option>
                <option value="External">External</option>
                <option value="Practical">Practical</option>
                <option value="ATKT">ATKT</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-slate-300">Semester</label>
              <select
                value={newSemester}
                onChange={(e) => setNewSemester(Number(e.target.value))}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {Array.from({ length: 8 }, (_, i) => i + 1).map((sem) => (
                  <option key={sem} value={sem}>
                    Sem {sem}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <p className="text-slate-400">
              After creating, you’ll be taken to the marks entry screen for this
              exam.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setIsCreating(false);
                }}
                className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
              >
                Create & open
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Subject cards */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {subjects.map((s) => (
          <div
            key={s.id}
            className="relative flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg shadow-slate-900/40"
          >
            {/* Delete button */}
            <button
              type="button"
              onClick={() => handleDelete(s.id)}
              className="absolute right-3 top-3 rounded-full border border-slate-700 bg-slate-900/80 px-2 text-[10px] text-slate-400 hover:text-red-300 hover:border-red-400"
              title="Remove this subject"
            >
              ✕
            </button>

            <div className="space-y-2 pr-6">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Subject
              </p>
              <h2 className="text-lg font-semibold text-white">
                {s.code} – {s.name}
              </h2>

              <div className="mt-2 flex items-center justify-between text-xs">
                <div className="flex flex-col gap-1">
                  <span className="text-slate-400">Exam type</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-indigo-200">
                    {s.examType}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Sem {s.semester}
                  </span>
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

        {!loading && subjects.length === 0 && (
          <p className="text-xs text-slate-500">
            No exams yet. Click{" "}
            <span className="font-semibold text-emerald-300">
              “+ New subject / exam”
            </span>{" "}
            to create the first one.
          </p>
        )}
      </div>
    </div>
  );
}
