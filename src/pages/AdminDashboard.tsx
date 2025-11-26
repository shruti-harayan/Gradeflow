// src/pages/AdminDashboard.tsx
import React from "react";
import {
  getExams,
  downloadExamCsv,
  type ExamOut,
} from "../services/examService";
import { useNavigate } from "react-router-dom";

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
      adminView: "1", // <-- add this for admin read-only mode
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

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {exams.map((e) => (
          <div
            key={e.id}
            className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg shadow-slate-900/40 space-y-2"
          >
            <h3 className="text-white font-semibold">
              {e.subject_code} — {e.subject_name}
            </h3>
            <p className="text-[11px] text-slate-400">
              Exam: {e.exam_type} • Sem {e.semester}
            </p>
            <p className="text-[11px] text-slate-400">
              Students: {e.students_count}
            </p>

            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={(evt) => {
                  // defensive: stop anything else from running (forms, parent handlers)
                  evt.preventDefault();
                  evt.stopPropagation();

                  console.log("View Marks clicked (defensive)", e.id);

                  // small safety: ensure navigate exists and is a function
                  try {
                    handleViewMarks(e);
                  } catch (err) {
                    console.error(
                      "navigate failed, falling back to client pushState",
                      err
                    );
                    // fallback: update URL without reload using history API
                    const q = new URLSearchParams({
                      examId: String(e.id),
                      subject: e.subject_code,
                      subjectName: e.subject_name,
                      exam: e.exam_type,
                      sem: String(e.semester),
                    }).toString();
                    window.history.pushState({}, "", `/marks-entry?${q}`);
                    // Also trigger a React Router navigation programmatically by dispatching a popstate
                    window.dispatchEvent(new PopStateEvent("popstate"));
                  }
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

        {exams.length === 0 && (
          <p className="text-xs text-slate-500">
            No exams found in system. Ask teachers to create 📝
          </p>
        )}
      </div>
    </div>
  );
}
