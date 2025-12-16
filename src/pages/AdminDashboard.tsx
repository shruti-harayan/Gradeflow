// src/pages/AdminDashboard.tsx
import React from "react";
import {
  getExams,
  downloadMergedExamCsv,
  type ExamOut,
  finalizeExam,
  unfinalizeExam,
} from "../services/examService";
import TeacherList from "./TeacherList";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";



export default function AdminDashboard() {
  const [exams, setExams] = React.useState<ExamOut[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  

  const [selectedTeacherId, setSelectedTeacherId] = React.useState<
    number | null
  >(null);
  const [selectedTeacherName, setSelectedTeacherName] = React.useState<
    string | null
  >(null);

  // filters
  const [subjectFilter, setSubjectFilter] = React.useState<string>("");
  const [yearFilter, setYearFilter] = React.useState<string>("");

  // validation / messages
  const [filterError, setFilterError] = React.useState<string | null>(null);
  const [noResultsMessage, setNoResultsMessage] = React.useState<string | null>(
    null
  );

  // modal state for confirm lock/unlock
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalExam, setModalExam] = React.useState<ExamOut | null>(null);
  const [modalAction, setModalAction] = React.useState<
    "lock" | "unlock" | null
  >(null);

  // Change-password modal state
  const [showChangePwd, setShowChangePwd] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [pwdChangeError, setPwdChangeError] = React.useState<string | null>(
    null
  );
  const [pwdChangeSuccess, setPwdChangeSuccess] = React.useState<string | null>(
    null
  );

  // visibility toggles for each password field
  const [showCurrentPwd, setShowCurrentPwd] = React.useState(false);
  const [showNewPwd, setShowNewPwd] = React.useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = React.useState(false);

  // inline toast
  const [toast, setToast] = React.useState<string | null>(null);
  const toastTimerRef = React.useRef<number | null>(null);

  // single debounce timer ref used by scheduleLoad
  const debounceRef = React.useRef<number | null>(null);

  // Prevent accidental form submissions (page reload) coming from parent forms or implicit submits
  React.useEffect(() => {
    const onSubmit = (ev: Event) => {
      try {
        ev.preventDefault();
      } catch (e) {}
    };
    document.addEventListener("submit", onSubmit, true); // capture phase
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);

  function groupExamsForAdmin(exams: ExamOut[]) {
    const map = new Map<string, ExamOut[]>();

    for (const e of exams) {
      const key = [
        e.subject_code,
        e.subject_name,
        e.exam_type,
        e.semester,
        e.academic_year,
      ].join("|");

      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }

    return Array.from(map.entries()).map(([key, exams]) => ({
      key,
      exams, // ALL teacher exams under this subject
      representative: exams[0], // used for display text
    }));
  }

  async function loadExams(filters?: {
    subject?: string;
    academic_year?: string;
    creator_id?: string | number;
  }) {
    setLoading(true);
    setFilterError(null);
    setNoResultsMessage(null);

    // Validate academic year format if provided (YYYY-YYYY)
    if (filters?.academic_year && String(filters.academic_year).trim()) {
      const v = String(filters.academic_year).trim();
      const yearRe = /^\d{4}-\d{4}$/;
      if (!yearRe.test(v)) {
        setLoading(false);
        setFilterError(
          'Academic year must be in format "YYYY-YYYY" (eg. 2025-2026).'
        );
        setExams([]);
        return;
      }
    }

    try {
      // Build params once and send to backend
      const params: Record<string, string> = {};
      if (filters?.subject && String(filters.subject).trim())
        params.subject_name = String(filters.subject).trim();
      if (filters?.academic_year && String(filters.academic_year).trim())
        params.academic_year = String(filters.academic_year).trim();
      if (
        filters?.creator_id !== undefined &&
        filters?.creator_id !== null &&
        String(filters.creator_id).trim()
      ) {
        params.creator_id = String(filters.creator_id).trim();
      }

      const data = await getExams(params);

      // Client-side fallback detection for "no results"
      let noResults = false;
      let noResultsMsg: string | null = null;

      if (Array.isArray(data)) {
        if (
          data.length === 0 &&
          (params.subject_name || params.academic_year || params.creator_id)
        ) {
          noResults = true;
          if (params.subject_name && params.academic_year) {
            noResultsMsg = `No exams found for subject "${params.subject_name}" in academic year "${params.academic_year}".`;
          } else if (params.subject_name) {
            noResultsMsg = `No exams found for subject "${params.subject_name}".`;
          } else if (params.creator_id) {
            noResultsMsg = `No exams found for the selected teacher.`;
          } else {
            noResultsMsg = `No exams found for academic year "${params.academic_year}".`;
          }
        } else if (params.subject_name && data.length > 0) {
          const matchFound = data.some((e: any) =>
            (e.subject_name || "")
              .toLowerCase()
              .includes(params.subject_name!.toLowerCase())
          );
          if (!matchFound) {
            noResults = true;
            noResultsMsg = `No exams found for subject "${params.subject_name}".`;
          }
        }
        if (!noResults && params.academic_year && data.length > 0) {
          const yearMatch = data.some((e: any) =>
            String(e.academic_year || "")
              .toLowerCase()
              .includes(params.academic_year!.toLowerCase())
          );
          if (!yearMatch) {
            noResults = true;
            noResultsMsg = params.subject_name
              ? `No exams found for subject "${params.subject_name}" in academic year "${params.academic_year}".`
              : `No exams found for academic year "${params.academic_year}".`;
          }
        }

        if (noResults) {
          setExams([]);
          setNoResultsMessage(noResultsMsg);
        } else {
          setExams(data);
          setNoResultsMessage(null);
        }
      } else {
        setExams(Array.isArray(data) ? data : []);
        setNoResultsMessage(null);
      }

      setError(null);
    } catch (err) {
      console.error("Failed to load exams", err);
      setError("Failed to load exams from server");
      setExams([]);
    } finally {
      setLoading(false);
    }
  }

  // On mount, load with no filters
  React.useEffect(() => {
    loadExams();

    return () => {
      // cleanup timers
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function handleDownloadMerged(g: {
  representative: ExamOut;
  exams: ExamOut[];
}) {
  const safe = (s: string) =>
    s.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-\.]/g, "");

  const r = g.representative;

  const filename =
    `${safe(r.subject_code)}_${safe(r.subject_name)}_` +
    `${safe(r.exam_type)}_Sem${r.semester}_` +
    `${safe(r.academic_year)}_MERGED.csv`;

  try {
    await downloadMergedExamCsv(
      g.exams.map((e) => e.id),
      filename
    );
    showToast("Merged CSV downloaded.");
  } catch (err) {
    console.error("Merged download failed", err);
    showToast("Failed to download merged CSV.");
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

      {/* Filters: Subject name & Academic year */}
      <div className="flex flex-wrap gap-3 items-center mt-3">
        <input
          type="text"
          placeholder="Filter by subject name (eg. Algorithms)"
          value={subjectFilter}
          onChange={(e) => {
            // only update local state — do NOT call loadExams here
            setSubjectFilter(e.target.value);
            setNoResultsMessage(null);
            setFilterError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              // apply on Enter using current typed value
              const val = (e.currentTarget as HTMLInputElement).value;
              loadExams({ subject: val, academic_year: yearFilter });
            }
          }}
          className="w-72 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 text-sm"
        />

        <input
          type="text"
          placeholder="Academic year (eg. 2025-2026)"
          value={yearFilter}
          onChange={(e) => {
            // only update local state — do NOT call loadExams here
            setYearFilter(e.target.value);
            setNoResultsMessage(null);
            setFilterError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const val = (e.currentTarget as HTMLInputElement).value;
              loadExams({ subject: subjectFilter, academic_year: val });
            }
          }}
          className="w-36 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 text-sm"
        />

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setNoResultsMessage(null);
            setFilterError(null);
            loadExams({
              subject: subjectFilter,
              academic_year: yearFilter,
              creator_id: selectedTeacherId
                ? String(selectedTeacherId)
                : undefined,
            });
          }}
          className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          Apply
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setSubjectFilter("");
            setYearFilter("");
            setNoResultsMessage(null);
            setFilterError(null);
            loadExams({});
          }}
          className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
        >
          Clear
        </button>
      </div>

      {/* validation or no-results messages */}
      {filterError && (
        <p className="text-yellow-400 text-sm mt-2">{filterError}</p>
      )}
      {noResultsMessage && (
        <p className="text-slate-400 text-sm mt-2 italic">{noResultsMessage}</p>
      )}

      {/* Create Teacher + Change Password (admin only) */}
      <div className="flex items-center gap-3">
        <Link
          to="/admin/create-teacher"
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          + Create Teacher/Admin
        </Link>

        {/* Change password button opens modal */}
        <button
          type="button"
          onClick={() => setShowChangePwd(true)}
          className="px-3 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm"
          title="Change your password"
        >
          Change password
        </button>
      </div>

      {/* Change Password Modal*/}
      {showChangePwd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-slate-900 p-6">
            <h3 className="text-lg font-semibold text-white">
              Change Your Current Account's Password
            </h3>
            <p className="text-sm text-slate-300 mt-2">
              Enter your current password and choose a new one.
            </p>

            {/* Current password */}
            <div className="mt-4">
              <label className="text-xs text-slate-400">Current password</label>
              <div className="relative">
                <input
                  type={showCurrentPwd ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPwd((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  aria-label={
                    showCurrentPwd ? "Hide password" : "Show password"
                  }
                >
                  {showCurrentPwd ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="mt-3">
              <label className="text-xs text-slate-400">New password</label>
              <div className="relative">
                <input
                  type={showNewPwd ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPwd((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  aria-label={showNewPwd ? "Hide password" : "Show password"}
                >
                  {showNewPwd ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div className="mt-3">
              <label className="text-xs text-slate-400">
                Confirm new password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPwd ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPwd((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  aria-label={
                    showConfirmPwd ? "Hide password" : "Show password"
                  }
                >
                  {showConfirmPwd ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <div className="mt-4">
              {pwdChangeError && (
                <p className="text-red-400 text-sm">{pwdChangeError}</p>
              )}
              {pwdChangeSuccess && (
                <p className="text-green-400 text-sm">{pwdChangeSuccess}</p>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  // close modal and reset
                  setShowChangePwd(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setPwdChangeError(null);
                  setPwdChangeSuccess(null);
                  setShowCurrentPwd(false);
                  setShowNewPwd(false);
                  setShowConfirmPwd(false);
                }}
                className="rounded px-4 py-2 border border-slate-700 text-slate-200 hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  // client-side validation
                  setPwdChangeError(null);
                  setPwdChangeSuccess(null);

                  if (!currentPassword) {
                    setPwdChangeError("Please enter your current password.");
                    return;
                  }
                  if (!newPassword || newPassword.length < 6) {
                    setPwdChangeError(
                      "New password must be at least 6 characters."
                    );
                    return;
                  }
                  if (newPassword !== confirmPassword) {
                    setPwdChangeError(
                      "New password and confirm password do not match."
                    );
                    return;
                  }

                  try {
                    // call backend change-password endpoint
                    await api.post("/auth/change-password", {
                      current_password: currentPassword,
                      new_password: newPassword,
                    });
                    setPwdChangeSuccess("Password updated successfully.");
                    // optionally close the modal after success (small delay)
                    setTimeout(() => {
                      setShowChangePwd(false);
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                      setPwdChangeError(null);
                      setPwdChangeSuccess(null);
                      setShowCurrentPwd(false);
                      setShowNewPwd(false);
                      setShowConfirmPwd(false);
                    }, 1100);
                  } catch (err: any) {
                    console.error("Change password failed", err);
                    const msg =
                      err?.response?.data?.detail ||
                      err?.message ||
                      "Failed to change password";
                    setPwdChangeError(String(msg));
                  }
                }}
                className="rounded px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Change Password
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="mt-2 inline-block rounded px-4 py-2 bg-slate-800 text-slate-100">
          {toast}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT: Teacher list (restored as original) */}
        <div className="lg:col-span-1 space-y-4">
          <TeacherList
            onSelectTeacher={(id, name) => {
              setSelectedTeacherId(id);
              setSelectedTeacherName(name);
              // call loadExams for that teacher (admin-only filter)
              loadExams({
                subject: subjectFilter,
                academic_year: yearFilter,
                creator_id: String(id),
              });
            }}
          />
        </div>

        {/* RIGHT: exams */}
        <div className="lg:col-span-2">
          {selectedTeacherId && (
            <div className="mb-3 flex items-center gap-3">
              <div className="rounded-full bg-indigo-600 px-3 py-1 text-white text-sm font-semibold">
                Showing exams by: {selectedTeacherName}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedTeacherId(null);
                  setSelectedTeacherName(null);
                  // reload without creator_id
                  loadExams({
                    subject: subjectFilter,
                    academic_year: yearFilter,
                  });
                }}
                className="rounded border px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
              >
                Clear teacher filter
              </button>
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-2">
            {groupExamsForAdmin(exams).map((g) => {
              const e = g.representative;
            
              return (
                <div
                  key={g.key}
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
                      onClick={ () => {handleDownloadMerged(g)}}
                      title="Download merged CSV for all teachers"
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
              );
            })}
          </div>

          {exams.length === 0 && !loading && (
            <p className="text-xs text-slate-500 mt-4">
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
