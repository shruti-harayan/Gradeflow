// src/pages/Dashboard.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createExam,
  downloadExamCsv,
  getExams,
  type ExamType,
} from "../services/examService";
import { deleteExam } from "../services/examService";
import { api } from "../services/api";

type SubjectCard = {
  id: number; // UI id
  examId?: number; // backend exam id
  code: string;
  name: string;
  examType: ExamType;
  semester: number;
  lastUpdated?: string;
  academicYear: string;
};

export default function Dashboard() {
  const navigate = useNavigate();

  const [programme, setProgramme] = useState("");
  const [catalogSemester, setCatalogSemester] = useState<number | "">("");
  const [catalogSubjects, setCatalogSubjects] = useState<any[]>([]);
  const [selectedCatalogSubjectId, setSelectedCatalogSubjectId] =
    useState<string>("");
  const [catalogLoading, setCatalogLoading] = useState(false);

  const selectedCatalogSubject = catalogSubjects.find(
    (s) => String(s.id) === selectedCatalogSubjectId
  );
  const showNoSubjectsMessage =
    programme &&
    catalogSemester &&
    !catalogLoading &&
    catalogSubjects.length === 0;

  const [academicYear, setAcademicYear] = React.useState("2025-2026");
  const [subjects, setSubjects] = React.useState<SubjectCard[]>([]);
  const [isCreating, setIsCreating] = React.useState(false);
  const [newExamType, setNewExamType] = React.useState<ExamType>("Internal");

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [subjectFilter, setSubjectFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");

  //  Load exams from backend on first mount
  async function loadExams(filters?: {
    subject_name?: string;
    academic_year?: string;
  }) {
    try {
      setLoading(true);

      const exams = await getExams(filters);

      const mapped: SubjectCard[] = exams.map((exam: any) => ({
        id: exam.id,
        examId: exam.id,
        code: exam.subject_code,
        name: exam.subject_name,
        examType: exam.exam_type as ExamType,
        semester: exam.semester,
        lastUpdated: exam.updated_at ?? exam.created_at,
        academicYear: exam.academic_year,
      }));

      setSubjects(mapped);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load exams from server.");
    } finally {
      setLoading(false);
    }
  }
  React.useEffect(() => {
    loadExams(); // initial load (no filters)
  }, []);

  async function loadCatalogSubjects(programme: string, semester: number) {
    try {
      setCatalogLoading(true);

      const res = await api.get("/subjects/catalog", {
        params: { programme, semester },
      });

      setCatalogSubjects(res.data);
    } catch (e) {
      console.error("Failed to load subject catalog", e);
      setCatalogSubjects([]);
    } finally {
      setCatalogLoading(false);
    }
  }

 React.useEffect(() => {
  if (programme && catalogSemester) {
    loadCatalogSubjects(programme, catalogSemester);
    setSelectedCatalogSubjectId("");
  }
}, [programme, catalogSemester]);


  function resetForm() {
    setProgramme("");
    setCatalogSemester("");
    setCatalogSubjects([]);
    setSelectedCatalogSubjectId("");
    setNewExamType("Internal");
  }

  function formatLocalDateTime(iso?: string) {
    if (!iso) return "";
    return new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  async function handleCreateExam(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!selectedCatalogSubject) {
      alert("Please select programme, semester, and subject.");
      return;
    }

    if (!academicYear || academicYear.trim().length < 7) {
      alert("Please enter academic year (eg. 2025-2026)");
      return;
    }

    const subjectCode = selectedCatalogSubject.subject_code;
    const subjectName = selectedCatalogSubject.subject_name;
    const semester = Number(catalogSemester);

    // Prevent exact duplicate exams (same subject + exam type + semester + year)
    const exactExamExists = subjects.some(
      (s) =>
        s.code === subjectCode &&
        s.name === subjectName &&
        s.examType === newExamType &&
        s.semester === semester &&
        s.academicYear === academicYear
    );

    if (exactExamExists) {
      alert(
        `This exam already exists with the same details:\n\n` +
          `• Subject: ${subjectName} (${subjectCode})\n` +
          `• Exam type: ${newExamType}\n` +
          `• Semester: ${semester}\n` +
          `• Academic Year: ${academicYear}`
      );
      return;
    }

    try {
      const exam = await createExam({
        subject_code: subjectCode,
        subject_name: subjectName,
        exam_type: newExamType,
        semester,
        academic_year: academicYear,
      });

      const lastUpdated =
        exam.updated_at ?? exam.created_at ?? new Date().toISOString();

      const newSubject: SubjectCard = {
        id: exam.id,
        examId: exam.id,
        code: exam.subject_code,
        name: exam.subject_name,
        examType: exam.exam_type as ExamType,
        semester: exam.semester,
        lastUpdated,
        academicYear: exam.academic_year,
      };

      setSubjects((prev) => [newSubject, ...prev]);

      resetForm();
      setIsCreating(false);

      // Navigate after successful creation
      navigate(
        `/marks-entry?examId=${exam.id}` +
          `&subject=${encodeURIComponent(exam.subject_code)}` +
          `&subjectName=${encodeURIComponent(exam.subject_name)}` +
          `&exam=${encodeURIComponent(exam.exam_type)}` +
          `&sem=${encodeURIComponent(String(exam.semester))}`
      );
    } catch (err: any) {
      if (err?.response?.status === 400) {
        alert(err.response.data?.detail || "This exam already exists.");
        return;
      }

      console.error("Create exam failed", err);
      alert("Failed to create exam. Please try again.");
    }
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

  async function handleExport(subject: SubjectCard) {
    // determine exam id (try multiple common property names)
    const examId =
      (subject as any).id ??
      (subject as any).examId ??
      (subject as any).exam_id;
    if (!examId) {
      alert(
        "Cannot determine exam id for this subject. Please open the marks page to export."
      );
      return;
    }

    const safe = (s?: string | number | null) =>
      String(s ?? "")
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9_\-\.]/g, "");

    const subjCode =
      (subject as any).code ?? (subject as any).subject_code ?? "";
    const subjName =
      (subject as any).name ?? (subject as any).subject_name ?? "";
    const examType =
      (subject as any).examType ?? (subject as any).exam_type ?? "";
    const semester = (subject as any).semester ?? "";
    const academicYear =
      (subject as any).academicYear ?? (subject as any).academic_year ?? "";

    const filename = `${safe(subjCode)}_${safe(subjName)}_${safe(
      examType
    )}_Sem${safe(semester)}${academicYear ? "_" + safe(academicYear) : ""}.csv`;

    try {
      await downloadExamCsv(examId, filename);
    } catch (err) {
      console.error("Export failed", err);
      alert("Failed to download CSV. See console for details.");
    }
  }

  async function handleDelete(id: number) {
    const ok = window.confirm(
      "⚠️ Are you sure you want to delete this entire subject/exam?\n\n" +
        "This will permanently delete:\n" +
        "• All sections\n" +
        "• All roll numbers\n" +
        "• All marks\n" +
        "• All questions\n\n" +
        "This action CANNOT be undone."
    );

    if (!ok) return;

    try {
      await deleteExam(id); // <-- backend DELETE call
      setSubjects((prev) => prev.filter((s) => s.id !== id));
      alert("Exam deleted successfully.");
    } catch (err: any) {
      console.error("Delete failed", err);
      alert("Failed to delete exam. Check console for details.");
    }
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
          {isCreating ? "Close form" : "+ New exam"}
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
            {/* Programme */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-300">Programme</label>
              <select
                value={programme}
                onChange={(e) => setProgramme(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              >
                <option value="">Select programme</option>
                <option value="B.Com">B.Com. (Bachelor of Commerce)</option>
                <option value="B.Com (Accounting & Finance)">
                  B.Com. (Accounting & Finance)
                </option>
                <option value="B.Com (Banking & Insurance)">
                  B.Com. (Banking & Insurance)
                </option>
                <option value="B.Com. (Financial Markets)">
                  B.Com. (Financial Markets)
                </option>
                <option value="B.Sc. (Information Technology">
                  B.Sc. (Information Technology)
                </option>
                <option value="B.M.S. (B.Com. in Management Studies">
                  B.M.S. (B.Com. in Management Studies)
                </option>
                <option value="B.B.A. (B.Com. in Business Administration)">
                  B.B.A. (B.Com. in Business Administration)
                </option>
                <option value="B.B.A. (B.Com. in Business Administration) (Marketing Management)">
                  B.B.A. (B.Com. in Business Administration) (Marketing
                  Management)
                </option>
                <option value="M.Com. (Advance Accountancy)">
                  M.Com. (Advance Accountancy)
                </option>
                <option value="M.Com. (Business Management)">
                  M.Com. (Business Management)
                </option>
                <option value="M.Sc. (Information Technology)">
                  M.Sc. (Information Technology)
                </option>
              </select>
            </div>

            {/* Semester */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-300">Semester</label>
              <select
                value={catalogSemester}
                onChange={(e) => setCatalogSemester(Number(e.target.value))}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              >
                <option value="">Select semester</option>
                {Array.from({ length: 8 }, (_, i) => i + 1).map((s) => (
                  <option key={s} value={s}>
                    Sem {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-slate-300">Subject</label>

              <select
                value={selectedCatalogSubjectId}
                onChange={(e) => setSelectedCatalogSubjectId(e.target.value)}
                disabled={!catalogSubjects.length}
                className={
                  "rounded-md border px-3 py-2 text-slate-100 " +
                  (catalogSubjects.length
                    ? "border-slate-700 bg-slate-900"
                    : "border-slate-700 bg-slate-900/60 cursor-not-allowed")
                }
              >
                <option value="">Select subject</option>
                {catalogSubjects.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.subject_name} ({s.subject_code})
                  </option>
                ))}
              </select>


              {/* Inline message when no subjects exist */}
              {showNoSubjectsMessage && (
                <span className="text-xs text-yellow-400 mt-1">
                  No subjects are available for this programme in Semester{" "}
                  {catalogSemester}.
                </span>
              )}
            </div>

            {/* Exam type */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-300">Exam type</label>
              <select
                value={newExamType}
                onChange={(e) => setNewExamType(e.target.value as ExamType)}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              >
                <option value="Internal">Internal</option>
                <option value="External">External</option>
                <option value="Practical">Practical</option>
                <option value="ATKT">ATKT</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 text-xs">
            {/* Academic Year */}
            <div className="flex flex-col gap-1">
              <label className="text-slate-300">Academic Year</label>
              <input
                type="text"
                placeholder="Academic year (e.g. 2025-2026)"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              />
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

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by subject name"
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
        />

        <input
          type="text"
          placeholder="Academic year (e.g. 2025-2026)"
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
        />

        <button
          onClick={() =>
            loadExams({
              subject_name: subjectFilter,
              academic_year: yearFilter,
            })
          }
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Apply
        </button>

        <button
          onClick={() => {
            setSubjectFilter("");
            setYearFilter("");
            loadExams(); // reload all exams
          }}
          className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          Clear
        </button>
      </div>

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
                  Last updated: {formatLocalDateTime(s.lastUpdated)}
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
            <span className="font-semibold text-emerald-300">“+ New exam”</span>{" "}
            to create the first one.
          </p>
        )}
      </div>
    </div>
  );
}
