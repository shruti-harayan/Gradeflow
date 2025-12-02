// src/pages/AdminDashboard.tsx
import React from "react";

import {
  getExams,
  downloadExamCsv,
  type ExamOut,
  finalizeExam,
  unfinalizeExam,
} from "../services/examService";
import TeacherList from "./TeacherList";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminDashboard() {
  const [exams, setExams] = React.useState<ExamOut[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  // modal state for confirm lock/unlock
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalExam, setModalExam] = React.useState<ExamOut | null>(null);
  const [modalAction, setModalAction] = React.useState<
    "lock" | "unlock" | null
  >(null);

  // inline toast
  const [toast, setToast] = React.useState<string | null>(null);
  const toastTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    async function load() {
      try {
        const data = await getExams();
        console.log("Loaded exams (debug):", data);

        setExams(data);
      } catch (err) {
        console.error("Failed to load exams", err);
        setError("Failed to load exams from server");
      } finally {
        setLoading(false);
      }
    }
    load();

    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3500);
  }

  // Toggle via API (kept same semantics as previously)
  async function toggleExamLockDirect(
    examId: number,
    currentlyLocked: boolean
  ) {
    try {
      if (currentlyLocked) {
        await unfinalizeExam(examId);
        setExams((prev) =>
          prev.map((ex) =>
            ex.id === examId ? { ...ex, is_locked: false, locked_by: null } : ex
          )
        );
        showToast("Exam unlocked for editing.");
      } else {
        await finalizeExam(examId);
        setExams((prev) =>
          prev.map((ex) =>
            ex.id === examId
              ? { ...ex, is_locked: true, locked_by: user?.id }
              : ex
          )
        );
        showToast("Exam finalized (locked).");
      }
    } catch (err: any) {
      console.error("Toggle lock failed", err);
      const msg =
        err?.response?.data?.detail || err?.message || "Operation failed";
      showToast(`Error: ${msg}`);
    } finally {
      setModalOpen(false);
      setModalExam(null);
      setModalAction(null);
    }
  }

  function openToggleModal(exam: ExamOut, action: "lock" | "unlock") {
    setModalExam(exam);
    setModalAction(action);
    setModalOpen(true);
  }

  // keep your safe filename builder & download logic
  async function handleDownload(e: ExamOut) {
    const safe = (s: string) =>
      s.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-\.]/g, "");
    const filename = `${safe(e.subject_code)}_${safe(e.subject_name)}_${safe(
      e.exam_type
    )}_Sem${e.semester}_marks.csv`;
    try {
      await downloadExamCsv(e.id, filename);
      showToast("CSV download started.");
    } catch (err) {
      console.error("Download failed", err);
      showToast("Failed to download CSV.");
    }
  }

  // View marks navigates to marks-entry page (adminView=1)
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

      <div className="flex items-center gap-3">
        <Link
          to="/admin/create-teacher"
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          + Create Teacher
        </Link>
      </div>

      {toast && (
        <div className="mt-2 inline-block rounded px-4 py-2 bg-slate-800 text-slate-100">
          {toast}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT: Teacher list (restored as original) */}
        <div className="lg:col-span-1 space-y-4">
          <TeacherList />
        </div>

        {/* RIGHT: exams */}
        <div className="lg:col-span-2">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-2">
            {exams.map((e) => (
              <div
                key={e.id}
                className={`rounded-xl border p-4 shadow-md transition hover:shadow-lg ${
                  e.is_locked
                    ? "border-emerald-600 bg-emerald-950/5"
                    : "border-slate-700 bg-slate-900"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
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
                  </div>

                  <div className="flex items-center gap-2">
                    {e.is_locked ? (
                      <div className="flex items-center gap-1 rounded px-2 py-1 bg-emerald-700 text-emerald-100 text-xs">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          className="inline-block"
                        >
                          <path
                            fill="currentColor"
                            d="M12 17a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm6-7h-1V7a5 5 0 0 0-10 0v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zM9 7a3 3 0 0 1 6 0v3H9V7z"
                          />
                        </svg>
                        <span>Locked</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 rounded px-2 py-1 bg-slate-700 text-slate-100 text-xs">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          className="inline-block"
                        >
                          <path
                            fill="currentColor"
                            d="M12 17a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm6-7h-1V7a5 5 0 0 0-10 0v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zM9 7a3 3 0 0 1 6 0v3H9V7z"
                          />
                        </svg>
                        <span>Editable</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Locked-by label */}
                {e.is_locked && (
                  <p className="mt-1 text-[10px] text-slate-400 italic">
                    Locked by:{" "}
                    <span className="font-semibold text-slate-200">
                      {(() => {
                        // Normalize values to numbers (or null) to avoid string/number mismatch
                        const lockedBy =
                          e.locked_by == null ? null : Number(e.locked_by);
                        const createdBy =
                          e.created_by == null ? null : Number(e.created_by);
                        // If both present and equal -> teacher locked it, otherwise admin
                        if (
                          lockedBy !== null &&
                          createdBy !== null &&
                          lockedBy === createdBy
                        ) {
                          return "Teacher";
                        }
                        return "Admin";
                      })()}
                    </span>
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2 items-center">
                  <button
                    onClick={() =>
                      openToggleModal(e, e.is_locked ? "unlock" : "lock")
                    }
                    title={
                      e.is_locked
                        ? "Unlock exam (allow teacher to edit)"
                        : "Final-submit (lock) exam"
                    }
                    className={`${
                      e.is_locked
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-red-600 hover:bg-red-700"
                    } flex items-center gap-2 rounded px-3 py-2 text-xs font-semibold text-white`}
                  >
                    {e.is_locked ? (
                      <svg width="14" height="14" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M12 17a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM6 10V7a6 6 0 1 1 12 0v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1zM9 10V7a3 3 0 1 1 6 0v3H9z"
                        />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M12 17a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM6 10V7a6 6 0 1 1 12 0v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1zM9 10V7a3 3 0 1 1 6 0v3H9z"
                        />
                      </svg>
                    )}
                    <span>{e.is_locked ? "Unlock" : "Final Submit"}</span>
                  </button>

                  <button
                    onClick={() => handleViewMarks(e)}
                    className="rounded px-3 py-2 text-xs bg-indigo-500 text-white hover:bg-indigo-600"
                    title="View marks (admin)"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      className="inline-block mr-1"
                    >
                      <path
                        fill="currentColor"
                        d="M12 6c-4.418 0-8 2.686-8 6s3.582 6 8 6 8-2.686 8-6-3.582-6-8-6zm0 10c-2.206 0-4-1.567-4-4s1.794-4 4-4 4 1.567 4 4-1.794 4-4 4zM12 9a3 3 0 100 6 3 3 0 000-6z"
                      />
                    </svg>
                    View Marks
                  </button>

                  <button
                    onClick={() => handleDownload(e)}
                    className="rounded px-3 py-2 text-xs border border-slate-700 text-slate-100 hover:bg-slate-800"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      className="inline-block mr-1"
                    >
                      <path
                        fill="currentColor"
                        d="M5 20h14v-2H5v2zm7-18L5.33 9h3.67v6h6V9h3.67L12 2z"
                      />
                    </svg>
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

      {/* Modal */}
      {modalOpen && modalExam && modalAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-slate-900 p-6">
            <h3 className="text-lg font-semibold text-white">
              {modalAction === "lock" ? "Finalize (Lock) Exam" : "Unlock Exam"}
            </h3>
            <p className="text-sm text-slate-300 mt-2">
              {modalAction === "lock"
                ? "Final-submitting (locking) will prevent the teacher from editing marks. Are you sure?"
                : "Unlocking will allow the teacher to edit marks again. Proceed?"}
            </p>

            <div className="mt-4 border-t border-slate-800 pt-4 flex justify-between gap-3">
              <button
                onClick={() => {
                  setModalOpen(false);
                  setModalExam(null);
                  setModalAction(null);
                }}
                className="rounded px-4 py-2 text-sm border border-slate-700 text-slate-200 hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  if (modalExam && modalAction) {
                    toggleExamLockDirect(
                      modalExam.id,
                      modalAction === "unlock"
                    );
                  }
                }}
                className={`rounded px-4 py-2 text-sm font-semibold text-white ${
                  modalAction === "lock"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {modalAction === "lock"
                  ? "Confirm Final Submit"
                  : "Confirm Unlock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
