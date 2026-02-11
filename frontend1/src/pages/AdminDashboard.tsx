// src/pages/AdminDashboard.tsx
import React, { useEffect, useState } from "react";
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
import { addSubjectToCatalog } from "../services/subjectService";
import {
  deleteCatalogSubject,
  fetchProgrammes,
  searchCatalogSubjects,
} from "../services/catalogService";
import type { Programme } from "../services/catalogService";

type TeacherLite = {
  id: number;
  name?: string | null;
  email: string;
  is_frozen: boolean;
};

type AppliedFilters = {
  programme?: string;
  semester?: number;
  exam_type?: string;
  academic_year?: string;
};

export default function AdminDashboard() {
  const [teachers, setTeachers] = React.useState<TeacherLite[]>([]);
  const [exams, setExams] = React.useState<ExamOut[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters | null>(
    null,
  );
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeYear, setPurgeYear] = useState("");
  const [purgeError, setPurgeError] = useState<string | null>(null);
  const [purgeSuccess, setPurgeSuccess] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const [programmeCode, setProgrammeCode] = useState("");
  const [programmeSuccess, setProgrammeSuccess] = useState<string | null>(null);
  const [showAddProgramme, setShowAddProgramme] = useState(false);
  const [programmeName, setProgrammeName] = useState("");
  const [totalSemesters, setTotalSemesters] = useState<number | null>(null);
  const [programmeSaving, setProgrammeSaving] = useState(false);
  const [programmeError, setProgrammeError] = useState<string | null>(null);

  const [showAddSubject, setShowAddSubject] = useState(false);
  const [semester, setSemester] = useState<number | null>(null);
  const [subjectCode, setSubjectCode] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [saving, setSaving] = useState(false);

  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [programme, setProgramme] = useState<string>("");

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [validSemesters, setValidSemesters] = useState<number[]>([]);
  const [programmeLoading, setProgrammeLoading] = useState(false);

  const [filterProgramme, setFilterProgramme] = useState("");
  const [filterSemester, setFilterSemester] = useState<number | "">("");
  const [filterExamType, setFilterExamType] = useState("");
  const [validFilterSemesters, setValidFilterSemesters] = useState<number[]>(
    [],
  );

  const [filterAcademicYear, setFilterAcademicYear] = useState(
    "2025-2026", // or compute dynamically
  );
  const examTypes = ["Internal", "External", "Practical", "ATKT", "Other"];

  const [showDeleteSubject, setShowDeleteSubject] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [selectedSubject, setSelectedSubject] = useState<any | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (programmeSuccess) {
      const t = setTimeout(() => setProgrammeSuccess(null), 2000);
      return () => clearTimeout(t);
    }
  }, [programmeSuccess]);

  useEffect(() => {
    async function loadProgrammes() {
      try {
        setProgrammeLoading(true);
        const data = await fetchProgrammes();
        setProgrammes(data);
      } catch (e) {
        console.error("Failed to load programmes", e);
      } finally {
        setProgrammeLoading(false);
      }
    }

    loadProgrammes();
  }, []);

  useEffect(() => {
    if (!programme) {
      setValidSemesters([]);
      setSemester(null);

      return;
    }

    const selectedProgramme = programmes.find((p) => p.name === programme);

    if (!selectedProgramme) {
      setValidSemesters([]);
      setSemester(null);
      return;
    }

    const start = selectedProgramme.semester_start ?? 1;

    const semesters = Array.from(
      { length: selectedProgramme.total_semesters },
      (_, i) => start + i,
    );

    setValidSemesters(semesters);
  }, [programme, programmes]);

  const [selectedTeacherId, setSelectedTeacherId] = React.useState<
    number | null
  >(null);
  const [selectedTeacherName, setSelectedTeacherName] = React.useState<
    string | null
  >(null);

  // validation / messages
  const [filterError, setFilterError] = React.useState<string | null>(null);
  const [noResultsMessage, setNoResultsMessage] = React.useState<string | null>(
    null,
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
    null,
  );
  const [pwdChangeSuccess, setPwdChangeSuccess] = React.useState<string | null>(
    null,
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

  useEffect(() => {
    if (showAddSubject) {
      setFormError(null);
      setFormSuccess(null);
    }
  }, [showAddSubject]);

  async function fetchExams() {
    setLoading(true);
    try {
      const res = await api.get("/exams", {});
      setExams(res.data);
    } finally {
      setLoading(false);
    }
  }

  async function handlePurgeExams() {
    if (!purgeYear.trim()) {
      setPurgeError("Academic year is required");
      return;
    }

    if (confirmText !== "DELETE") {
      setPurgeError("Type DELETE to confirm");
      return;
    }

    try {
      setPurging(true);
      setPurgeError(null);

      await api.delete(`/exams/by-academic-year/${purgeYear}`);

      // refresh exam list
      await fetchExams();

      //  reset modal fields
      setPurgeYear("");
      setConfirmText("");

      setPurgeSuccess(
        `All exams for academic year ${purgeYear} have been deleted successfully.`,
      );

      setTimeout(() => {
        setPurgeSuccess(null);
      }, 2000);
    } catch (e: any) {
      setPurgeError(e?.response?.data?.detail || "Failed to delete exams");
    } finally {
      setPurging(false);
    }
  }

  async function handleAddSubject() {
    if (
      !programme ||
      semester === null ||
      Number(semester) < 1 ||
      !subjectCode.trim() ||
      !subjectName.trim()
    ) {
      setFormError("All fields are required");
      return;
    }

    try {
      setSaving(true);
      setFormError(null);
      setFormSuccess(null);

      await addSubjectToCatalog({
        programme,
        semester,
        subject_code: subjectCode.trim().toUpperCase(),
        subject_name: subjectName.trim(),
      });

      setFormSuccess("Subject added successfully");
      setSubjectCode("");
      setSubjectName("");
      setSemester(null);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;

      if (Array.isArray(detail)) {
        // FastAPI validation errors
        setFormError(detail.map((d) => d.msg).join(", "));
      } else if (typeof detail === "string") {
        setFormError(detail);
      } else {
        setFormError(
          "This subject already exists for the selected programme and semester",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleAddProgramme() {
    if (
      !programmeCode.trim() ||
      !programmeName.trim() ||
      !totalSemesters ||
      totalSemesters < 1
    ) {
      setProgrammeError("All fields are required");
      setProgrammeSuccess(null);
      return;
    }

    try {
      setProgrammeSaving(true);
      setProgrammeError(null);
      setProgrammeSuccess(null);

      await api.post("/subjects/catalog/programmes", {
        programme_code: programmeCode.trim().toUpperCase(),
        name: programmeName.trim(),
        total_semesters: totalSemesters,
      });

      // refresh list
      const updated = await fetchProgrammes();
      setProgrammes(updated);

      // success UI
      setProgrammeSuccess("Programme added successfully 🎉");

      // reset form
      setProgrammeCode("");
      setProgrammeName("");
      setTotalSemesters(null);
    } catch (e: any) {
      setProgrammeError(e?.response?.data?.detail || "Failed to add programme");
    } finally {
      setProgrammeSaving(false);
    }
  }

  useEffect(() => {
    if (formSuccess) {
      const t = setTimeout(() => setFormSuccess(null), 2000);
      return () => clearTimeout(t);
    }
  }, [formSuccess]);

  function resetAddSubjectForm() {
    setProgramme("");
    setSemester(null);
    setSubjectCode("");
    setSubjectName("");

    setFormError(null);
    setFormSuccess(null);
  }

  useEffect(() => {
    if (!showDeleteSubject || searchTerm.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    async function runSearch() {
      try {
        setSearchLoading(true);
        const res = await searchCatalogSubjects(searchTerm);
        setSearchResults(res);
      } catch (e) {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }

    runSearch();
  }, [searchTerm, showDeleteSubject]);

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

  React.useEffect(() => {
    async function loadTeachers() {
      try {
        const res = await api.get("/auth/admin/teachers");
        setTeachers(res.data || []);
      } catch (e) {
        console.error("Failed to load teachers", e);
      }
    }

    loadTeachers();
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
    created_by?: number;
    programme?: string;
    semester?: number;
    exam_type?: string;
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
          'Academic year must be in format "YYYY-YYYY" (eg. 2025-2026).',
        );
        setExams([]);
        return;
      }
    }

    try {
      // Build params once and send to backend
      const params: Record<string, string> = {};

      if (filters?.subject?.trim())
        params.subject_name = filters.subject.trim();

      if (filters?.academic_year?.trim())
        params.academic_year = filters.academic_year.trim();

      if (filters?.programme?.trim())
        params.programme = filters.programme.trim();

      if (filters?.exam_type?.trim())
        params.exam_type = filters.exam_type.trim();

      if (filters?.semester !== undefined)
        params.semester = String(filters.semester);

      if (filters?.created_by !== undefined)
        params.created_by = String(filters.created_by);

      const data = await getExams(params);

      // Client-side fallback detection for "no results"
      let noResults = false;
      let noResultsMsg: string | null = null;

      if (Array.isArray(data)) {
        if (
          data.length === 0 &&
          (params.subject_name || params.academic_year || params.created_by)
        ) {
          noResults = true;
          if (params.subject_name && params.academic_year) {
            noResultsMsg = `No exams found for subject "${params.subject_name}" in academic year "${params.academic_year}".`;
          } else if (params.subject_name) {
            noResultsMsg = `No exams found for subject "${params.subject_name}".`;
          } else if (params.created_by) {
            noResultsMsg = `No exams found for the selected teacher.`;
          } else {
            noResultsMsg = `No exams found for academic year "${params.academic_year}".`;
          }
        } else if (params.subject_name && data.length > 0) {
          const matchFound = data.some((e: any) =>
            (e.subject_name || "")
              .toLowerCase()
              .includes(params.subject_name!.toLowerCase()),
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
              .includes(params.academic_year!.toLowerCase()),
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

  useEffect(() => {
    if (!filterProgramme) {
      setValidFilterSemesters([]);
      setFilterSemester("");
      return;
    }

    const selectedProgramme = programmes.find(
      (p) => p.name === filterProgramme,
    );

    if (!selectedProgramme) {
      setValidFilterSemesters([]);
      setFilterSemester("");
      return;
    }

    const start = selectedProgramme.semester_start ?? 1;

    const semesters = Array.from(
      { length: selectedProgramme.total_semesters },
      (_, i) => start + i,
    );

    setValidFilterSemesters(semesters);
  }, [filterProgramme, programmes]);

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
    currentlyLocked: boolean,
  ) {
    try {
      if (currentlyLocked) {
        await unfinalizeExam(examId);
        setExams((prev) =>
          prev.map((ex) =>
            ex.id === examId
              ? { ...ex, is_locked: false, locked_by: null }
              : ex,
          ),
        );
        showToast("Exam unlocked for editing.");
      } else {
        await finalizeExam(examId);
        setExams((prev) =>
          prev.map((ex) =>
            ex.id === examId
              ? {
                  ...ex,
                  is_locked: true,
                  locked_by: user?.id,
                  locked_by_name: user?.name,
                }
              : ex,
          ),
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
        filename,
      );
      showToast("Merged CSV downloaded.");
    } catch (err) {
      console.error("Merged download failed", err);
      showToast("Failed to download merged CSV.");
    }
  }

  // View marks navigates to marks-entry page
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

      {/* 🔍 Admin Filters */}
      <div className="grid gap-4 items-end md:grid-cols-[2fr_1fr_1fr_1fr_auto_auto] text-xs">
        {/* Programme */}
        <div className="flex flex-col gap-1">
          <label className="text-slate-300">Programme</label>
          <select
            value={filterProgramme}
            onChange={(e) => setFilterProgramme(e.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white"
          >
            <option value="">All programmes</option>
            {programmes.filter(Boolean).map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Semester */}
        <div className="flex flex-col gap-1">
          <label className="text-slate-300">Semester</label>

          <select
            value={filterSemester}
            onChange={(e) =>
              setFilterSemester(e.target.value ? Number(e.target.value) : "")
            }
            disabled={!filterProgramme}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white"
          >
            <option value="">All semesters</option>

            {validFilterSemesters.map((s) => (
              <option key={s} value={s}>
                Semester {s}
              </option>
            ))}
          </select>

          {filterProgramme && validFilterSemesters.length === 0 && (
            <span className="text-xs text-yellow-400">
              No semesters found for this programme
            </span>
          )}
        </div>

        {/* Exam Type */}
        <div className="flex flex-col gap-1">
          <label className="text-slate-300">Exam type</label>
          <select
            value={filterExamType}
            onChange={(e) => setFilterExamType(e.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white"
          >
            <option value="">All types</option>
            {examTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Academic Year */}
        <div className="flex flex-col gap-1">
          <label className="text-slate-300">Academic Year</label>
          <input
            value={filterAcademicYear}
            onChange={(e) => setFilterAcademicYear(e.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            const filters = {
              programme: filterProgramme || undefined,
              semester: filterSemester || undefined,
              exam_type: filterExamType || undefined,
              academic_year: filterAcademicYear || undefined,
            };

            setAppliedFilters(filters);
            loadExams({
              programme: filterProgramme || undefined,
              semester: filterSemester || undefined,
              exam_type: filterExamType || undefined,
              academic_year: filterAcademicYear || undefined,
              created_by: selectedTeacherId ?? undefined,
            });
          }}
          className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={() => {
            setFilterProgramme("");
            setFilterSemester("");
            setFilterExamType("");
            setFilterAcademicYear("2025-2026");
            setAppliedFilters(null);
            setSelectedTeacherId(null);
            loadExams({});
          }}
          className="rounded-md bg-gray-600 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700"
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

        <button
          onClick={() => navigate("/admin/list")}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
        >
         ⚙ Manage Admins
        </button>

        <button
          onClick={() => setShowAddSubject(true)}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          + Add Course
        </button>

        <button
          onClick={() => setShowDeleteSubject(true)}
          className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white
               hover:bg-red-800 transition"
        >
          ⚠ Delete Course
        </button>

        <button
          onClick={() => setShowAddProgramme(true)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          + Add Programme
        </button>

        {/* Change password button opens modal */}
        <button
          type="button"
          onClick={() => setShowChangePwd(true)}
          className="px-3 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm"
          title="Change your password"
        >
          ⚙ Change Current Account's Password
        </button>
        <button
          onClick={() => setShowPurgeModal(true)}
          className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
        >
          ⚠️DELETE All Exams
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
                      "New password must be at least 6 characters.",
                    );
                    return;
                  }
                  if (newPassword !== confirmPassword) {
                    setPwdChangeError(
                      "New password and confirm password do not match.",
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
        {/* LEFT: Teacher list  */}
        <div className="lg:col-span-1 space-y-4">
          <TeacherList
            teachers={teachers}
            onTeachersUpdated={setTeachers}
            onSelectTeacher={(id, name) => {
              setSelectedTeacherId(id);
              setSelectedTeacherName(name);
              loadExams({
                programme: filterProgramme || undefined,
                semester: filterSemester || undefined,
                exam_type: filterExamType || undefined,
                academic_year: filterAcademicYear || undefined,
                created_by: id,
              });
            }}
          />
        </div>

        {/* RIGHT: exams */}
        <div className="lg:col-span-2">
          {appliedFilters && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="rounded-full bg-slate-700 px-3 py-1 text-xs text-white">
                Showing exams for:
                {appliedFilters.programme && (
                  <>
                    {" "}
                    Programme: <b>{appliedFilters.programme}</b>
                  </>
                )}
                {appliedFilters.semester && (
                  <>
                    {" "}
                    • Semester: <b>{appliedFilters.semester}</b>
                  </>
                )}
                {appliedFilters.exam_type && (
                  <>
                    {" "}
                    • Type: <b>{appliedFilters.exam_type}</b>
                  </>
                )}
                {appliedFilters.academic_year && (
                  <>
                    {" "}
                    • Year: <b>{appliedFilters.academic_year}</b>
                  </>
                )}
              </div>

              <button
                onClick={() => {
                  setAppliedFilters(null);
                  loadExams({
                    created_by: selectedTeacherId ?? undefined,
                  });
                }}
                className="rounded border px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
              >
                Clear filters
              </button>
            </div>
          )}

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

                  loadExams({
                    programme: filterProgramme || undefined,
                    semester: filterSemester || undefined,
                    exam_type: filterExamType || undefined,
                    academic_year: filterAcademicYear || undefined,
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
                        {e.locked_by_name ?? "Unknown"}
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
                      onClick={() => {
                        handleDownloadMerged(g);
                      }}
                      title="Download merged CSV for all teachers"
                      className="rounded-md px-3 py-2 text-xs font-semibold 
                      bg-slate-900 border border-slate-600 text-slate-100 
                      hover:bg-slate-800 hover:border-slate-500 
                      transition-colors duration-200 shadow-sm"
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

      {/* Add Subject Modal */}
      {showAddSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg bg-slate-900 p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-white">
              Add Course to Existing Programme
            </h3>

            <div className="mt-4 space-y-3">
              <select
                value={programme}
                onChange={(e) => setProgramme(e.target.value)}
                disabled={programmeLoading}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              >
                <option value="">Select programme</option>
                {programmes.filter(Boolean).map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>

              <select
                value={semester ?? ""}
                onChange={(e) =>
                  setSemester(e.target.value ? Number(e.target.value) : null)
                }
                disabled={!programme}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              >
                <option value="">Select semester</option>

                {validSemesters.map((s) => (
                  <option key={s} value={s}>
                    Semester {s}
                  </option>
                ))}
              </select>

              {programme && validSemesters.length === 0 && (
                <span className="text-xs text-yellow-400">
                  No semesters available for this programme
                </span>
              )}

              <input
                placeholder="Course Code (e.g. USIT.501)"
                value={subjectCode}
                onChange={(e) => setSubjectCode(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white"
              />

              <input
                placeholder="Course Name"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white"
              />
            </div>
            {/* FORM ERROR */}
            {formError && (
              <div className="rounded-md bg-red-900/40 border border-red-700 px-3 py-2 text-sm text-red-300">
                {formError}
              </div>
            )}
            {/* FORM SUCCESS */}
            {formSuccess && (
              <div className="rounded-md bg-emerald-900/40 border border-emerald-700 px-3 py-2 text-sm text-emerald-300">
                {formSuccess}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                disabled={saving}
                onClick={() => {
                  resetAddSubjectForm();
                  setShowAddSubject(false);
                }}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  saving
                    ? "border-slate-700 text-slate-500 cursor-not-allowed"
                    : "border-slate-700 text-slate-300 hover:bg-slate-800"
                }`}
              >
                Cancel
              </button>

              <button
                disabled={saving}
                onClick={handleAddSubject}
                className={`rounded-md px-4 py-1.5 text-sm font-semibold text-white transition ${
                  saving
                    ? "bg-emerald-600/60 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {saving ? "Saving..." : "Add Course"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Subject Modal */}
      {showDeleteSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-lg bg-slate-900 p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-red-400">
              Delete Course from Catalog
            </h3>

            <p className="mt-1 text-xs text-slate-400">
              ⚠ This will remove the course from future exam creation. Existing
              exams will NOT be affected.
            </p>

            {/* SEARCH INPUT */}
            <input
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedSubject(null);
              }}
              placeholder="Type course name (min 2 characters)"
              className="mt-4 w-full rounded-md border border-slate-700
                   bg-slate-800 px-3 py-2 text-white"
            />

            {searchLoading && (
              <div className="mt-2 text-xs text-slate-400">
                Searching courses…
              </div>
            )}

            {/* SEARCH RESULTS */}
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-48 overflow-auto rounded border border-slate-700 bg-slate-800">
                {searchResults.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSubject(s)}
                    className={`cursor-pointer px-3 py-2 text-sm hover:bg-slate-700
                ${
                  selectedSubject?.id === s.id
                    ? "bg-slate-700 text-white"
                    : "text-slate-200"
                }`}
                  >
                    <div className="font-semibold">
                      {s.subject_name} ({s.subject_code})
                    </div>
                    <div className="text-xs text-slate-400">
                      {s.programme} • Semester {s.semester}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SELECTED SUBJECT PREVIEW */}
            {selectedSubject && (
              <div className="mt-3 rounded bg-red-900/20 p-3 text-sm text-red-300">
                You are about to delete:
                <br />
                <strong>
                  {selectedSubject.subject_name} ({selectedSubject.subject_code}
                  )
                </strong>
                <br />
                {selectedSubject.programme} • Semester{" "}
                {selectedSubject.semester}
              </div>
            )}

            {deleteError && (
              <p className="mt-2 text-xs text-red-400">{deleteError}</p>
            )}
            {deleteSuccess && (
              <div className="mt-2 rounded bg-green-900/30 border border-green-700 px-3 py-2 text-xs text-green-300">
                {deleteSuccess}
              </div>
            )}

            {/* ACTIONS */}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDeleteSubject(false);
                  setSearchTerm("");
                  setSearchResults([]);
                  setSelectedSubject(null);
                  setDeleteError(null);
                  setDeleteSuccess(null);
                }}
                className="rounded-md border border-slate-700 px-3 py-1.5
                     text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                disabled={!selectedSubject || deleteLoading}
                onClick={async () => {
                  if (!selectedSubject) return;

                  try {
                    setDeleteLoading(true);
                    setDeleteError(null);
                    setDeleteSuccess(null);

                    await deleteCatalogSubject(selectedSubject.id);

                    // show success
                    setDeleteSuccess(
                      "Course removed from catalog successfully",
                    );

                    // clear selection
                    setSearchTerm("");
                    setSelectedSubject(null);
                    setSearchResults([]);

                    // auto-hide success message after 2 seconds
                    setTimeout(() => {
                      setDeleteSuccess(null);
                    }, 2000);
                  } catch (e: any) {
                    setDeleteError(
                      e?.response?.data?.detail || "Failed to delete subject",
                    );
                  } finally {
                    setDeleteLoading(false);
                  }
                }}
                className={`rounded-md px-4 py-1.5 text-sm font-semibold text-white
            ${
              selectedSubject
                ? "bg-red-700 hover:bg-red-800"
                : "bg-red-700/50 cursor-not-allowed"
            }`}
              >
                {deleteLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Programme Modal */}
      {showAddProgramme && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg bg-slate-900 p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-white">
              Add New Programme
            </h3>

            <div className="mt-4 space-y-3">
              {/* Programme Code */}
              <input
                placeholder="Programme Code (e.g. MSC_DS, BCA)"
                value={programmeCode}
                onChange={(e) => setProgrammeCode(e.target.value.toUpperCase())}
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white"
              />

              {/* Programme Name */}
              <input
                placeholder="Programme Name (e.g. M.Sc Data Science Part-I)"
                value={programmeName}
                onChange={(e) => setProgrammeName(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white"
              />

              {/* Total Semesters */}
              <input
                type="number"
                min={1}
                placeholder="Total Semesters (e.g. 2, 4, 6)"
                value={totalSemesters ?? ""}
                onChange={(e) =>
                  setTotalSemesters(
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white"
              />

              {programmeError && (
                <div className="rounded-md bg-red-900/40 border border-red-700 px-3 py-2 text-sm text-red-300">
                  {programmeError}
                </div>
              )}
              {programmeSuccess && (
                <div className="rounded-md bg-green-900/40 border border-green-700 px-3 py-2 text-sm text-green-300">
                  {programmeSuccess}
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                disabled={programmeSaving}
                onClick={() => {
                  setShowAddProgramme(false);
                  setProgrammeCode("");
                  setProgrammeName("");
                  setTotalSemesters(null);
                  setProgrammeError(null);
                  setProgrammeSuccess(null);
                }}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                disabled={programmeSaving}
                onClick={handleAddProgramme}
                className={`rounded-md px-4 py-1.5 text-sm font-semibold text-white ${
                  programmeSaving
                    ? "bg-indigo-600/60 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {programmeSaving ? "Saving..." : "Add Programme"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                      modalAction === "unlock",
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

      {/* Purge Exams Modal */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg bg-slate-900 p-6">
            <h2 className="text-lg font-bold text-red-400">
              ⚠️ Delete Exams Permanently
            </h2>

            <p className="mt-2 text-sm text-slate-300">
              This will permanently delete <b>all exams</b> for the given
              academic year. This action <b>cannot be undone</b>.
            </p>

            <input
              placeholder="Academic Year (e.g. 2024-2025)"
              value={purgeYear}
              onChange={(e) => setPurgeYear(e.target.value)}
              className="mt-4 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white"
            />

            <input
              placeholder="Type DELETE to confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="mt-3 w-full rounded-md border border-red-700 bg-slate-800 px-3 py-2 text-white"
            />

            {purgeError && (
              <div className="mt-3 rounded-md bg-red-900/40 border border-red-700 px-3 py-2 text-sm text-red-300">
                {purgeError}
              </div>
            )}

            {purgeSuccess && (
              <div className="mt-3 rounded-md bg-green-900/40 border border-green-700 px-3 py-2 text-sm text-green-300">
                {purgeSuccess}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowPurgeModal(false);

                  //  reset everything
                  setPurgeYear("");
                  setConfirmText("");
                  setPurgeError(null);
                  setPurgeSuccess(null);
                }}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300"
              >
                Cancel
              </button>

              <button
                disabled={purging}
                onClick={handlePurgeExams}
                className={`rounded-md px-4 py-1.5 text-sm font-semibold text-white ${
                  purging ? "bg-red-600/60" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {purging ? "Deleting..." : "Delete Exams"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
