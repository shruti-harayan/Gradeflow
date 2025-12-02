// src/pages/AdminDashboard.tsx
import React from "react";
import {
  getExams,
  downloadExamCsv,
  type ExamOut,
} from "../services/examService";
import TeacherList from "./TeacherList";
import { Link, useNavigate } from "react-router-dom";
import { finalizeExam, unfinalizeExam } from "../services/examService";

export default function AdminDashboard() {
  const [exams, setExams] = React.useState<ExamOut[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    async function load() {
      try {
        const data = await getExams();
        setExams(data);
      } catch (err) {
        setError("Failed to load exams from server");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function toggleExamLock(examId: number, currentlyLocked: boolean) {
    try {
      if (currentlyLocked) {
        // unlock
        await unfinalizeExam(examId);
        setExams((prev) =>
          prev.map((ex) =>
            ex.id === examId ? { ...ex, is_locked: false } : ex
          )
        );
        alert("Exam unlocked for editing.");
      } else {
        // finalize (lock)
        await finalizeExam(examId);
        setExams((prev) =>
          prev.map((ex) => (ex.id === examId ? { ...ex, is_locked: true } : ex))
        );
        alert("Exam finalized (locked).");
      }
    } catch (err: any) {
      console.error("Toggle lock failed", err);
      const msg =
        err?.response?.data?.detail || err?.message || "Operation failed";
      alert(msg);
    }
  }

  async function handleDownload(e: ExamOut) {
    // Create clean filename: CODE_subject_examType_SemX_marks.csv
    // Replace spaces with underscores and remove problematic chars
    const safe = (s: string) =>
      s.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-\.]/g, "");

    const filename = `${safe(e.subject_code)}_${safe(e.subject_name)}_${safe(
      e.exam_type
    )}_Sem${e.semester}_marks.csv`;

    try {
      await downloadExamCsv(e.id, filename);
    } catch (err) {
      console.error("Download failed", err);
      alert("Failed to download CSV.");
    }
  }

  function handleViewMarks(e: ExamOut) {
    const q = new URLSearchParams({
      examId: String(e.id),
      subject: e.subject_code,
      subjectName: e.subject_name,
      exam: e.exam_type,
      sem: String(e.semester),
      adminView: "1",
    }).toString();

    navigate(`/marks-entry?${q}`);
  }

  if (loading) return <p className="text-slate-400">Loading exams...</p>;
  if (error) return <p className="text-red-400 text-sm">{error}</p>;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
      <p className="text-xs text-slate-400">
        Manage exams and download CSV reports created by teachers.
      </p>

      <Link
        to="/admin/create-teacher"
        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
      >
        + Create Teacher
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COLUMN: Teacher List */}
        <div className="lg:col-span-1 space-y-4">
          <TeacherList />
        </div>

        {/* RIGHT COLUMN: Exams */}
        <div className="lg:col-span-2">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-2">
            {exams.map((e) => (
              <div
                key={e.id}
                className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-md hover:bg-slate-800/50 transition"
              >
                {/* SUBJECT & BASIC INFO */}
                <h3 className="text-white font-semibold text-sm">
                  {e.subject_code} — {e.subject_name}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Exam: {e.exam_type} • Sem {e.semester}
                </p>
                {e.academic_year && (
                  <p className="text-[11px] text-slate-400">
                    Academic Year: {e.academic_year}
                  </p>
                )}

                {/* LOCK / UNLOCK BUTTON */}
                <div className="mt-3 flex items-center gap-2">
                  {e.is_locked ? (
                    <button
                      onClick={() => {
                        if (
                          !confirm(
                            "Unlock exam? This will allow the teacher to edit again."
                          )
                        )
                          return;
                        toggleExamLock(e.id, true);
                      }}
                      className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                      title="Unlock exam (allow teacher to edit)"
                    >
                      Unlock
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (
                          !confirm(
                            "Final-submit (lock) this exam? Teacher will not be able to edit afterwards."
                          )
                        )
                          return;
                        toggleExamLock(e.id, false);
                      }}
                      className="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
                      title="Final-submit exam (lock)"
                    >
                      Final Submit
                    </button>
                  )}

                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      e.is_locked
                        ? "bg-emerald-700 text-emerald-100"
                        : "bg-slate-700 text-slate-200"
                    }`}
                  >
                    {e.is_locked ? "Locked" : "Editable"}
                  </span>
                </div>

                {/* BUTTONS: VIEW MARKS / DOWNLOAD */}
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={(evt) => {
                      evt.preventDefault();
                      evt.stopPropagation();
                      handleViewMarks(e);
                    }}
                    className="flex-1 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-600"
                  >
                    View Marks
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownload(e)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800"
                  >
                    Download CSV
                  </button>
                </div>
              </div>
            ))}
          </div>

          {exams.length === 0 && (
            <p className="text-xs text-slate-500">
              No exams found in system. Ask teachers to create 📝
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
