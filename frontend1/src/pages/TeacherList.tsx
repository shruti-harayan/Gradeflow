// src/pages/admin/TeacherList.tsx
import React from "react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";

type Teacher = {
  id: number;
  name?: string | null;
  email: string;
  role: string;
  is_frozen: boolean;
  created_at?: string;
};

type TeacherListProps = {
  onSelectTeacher?: (teacherId: number, teacherName: string) => void;
};

function TeacherList({ onSelectTeacher }: TeacherListProps) {
  const [teachers, setTeachers] = React.useState<Teacher[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [showResetFor, setShowResetFor] = React.useState<number | null>(null);
  const [tempPassword, setTempPassword] = React.useState<string | null>(null);

  const { user } = useAuth();

  React.useEffect(() => {
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await api.get("/auth/admin/teachers");
        setTeachers(res.data || []);
      } catch (e: any) {
        setErr(e?.response?.data?.detail || "Failed to load teachers");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // toggle Freeze / Unfreeze
  async function toggleFreeze(t: Teacher, e?: React.MouseEvent) {
    e?.stopPropagation();
    try {
      const newFrozen = !t.is_frozen;
      // optimistic update
      setTeachers((prev) => prev.map((x) => (x.id === t.id ? { ...x, is_frozen: newFrozen } : x)));

      if (t.is_frozen) {
        await api.post(`/auth/admin/teachers/${t.id}/unfreeze`);
      } else {
        await api.post(`/auth/admin/teachers/${t.id}/freeze`);
      }
      // success: keep optimistic state
    } catch (err: any) {
      // revert on failure
      setTeachers((prev) => prev.map((x) => (x.id === t.id ? { ...x, is_frozen: t.is_frozen } : x)));
      alert(err?.response?.data?.detail || "Action failed");
    }
  }

  // Reset password (admin enters password manually)
  async function handleResetPassword(t: Teacher, e?: React.MouseEvent) {
    e?.stopPropagation();
    if (user?.role !== "admin") {
      alert("Only admins can reset passwords.");
      return;
    }

    const newPassword = prompt("Enter new password for the teacher (min 6 chars):");
    if (!newPassword) return;
    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    try {
      const resp = await api.post(`/auth/admin-reset-password/${t.id}`, { password: newPassword });
      // Prefer server-provided temporary password if present, otherwise show the one admin entered.
      const temp = resp?.data?.temporary_password || resp?.data?.password || newPassword || null;
      setTempPassword(temp);
      setShowResetFor(t.id);
      alert("Password updated. Share it securely with the teacher.");
    } catch (err: any) {
      console.error("Reset failed", err);
      alert(err?.response?.data?.detail || "Failed to reset password");
    }
  }

  if (loading) {
    return <p className="text-slate-400">Loading teachers...</p>;
  }

  if (err) {
    return <p className="text-red-400">{err}</p>;
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Teachers List</h2>

      <div className="space-y-3 mt-4">
        {teachers.map((t) => (
          <div
            key={t.id}
            role="button"
            onClick={() => onSelectTeacher?.(t.id, t.name ?? `${t.email}`)}
            className="cursor-pointer rounded-lg bg-slate-900 p-4 hover:bg-slate-800 transition"
            title="Click to view exams by this teacher"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-semibold">{t.name ?? "—"}</div>
                <div className="text-slate-400 text-xs">{t.email}</div>
              </div>

              <div className="flex items-center gap-3">
                <div>
                  {t.is_frozen ? (
                    <span className="text-amber-300 text-xs italic">Frozen</span>
                  ) : (
                    <span className="text-emerald-300 text-xs italic">Active</span>
                  )}
                </div>

                {/* Freeze / Reset buttons (stop propagation so they don't trigger select) */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => toggleFreeze(t, e)}
                    className={`px-3 py-1 rounded-md text-sm ${
                      t.is_frozen ? "bg-gray-600 text-white" : "bg-emerald-500 text-white hover:bg-emerald-600"
                    }`}
                  >
                    {t.is_frozen ? "Unfreeze" : "Freeze"}
                  </button>

                  <button
                    onClick={(e) => handleResetPassword(t, e)}
                    className="px-3 py-1 rounded-md bg-indigo-600 text-white text-sm"
                  >
                    Reset password
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal-like area to show temporary password */}
      {showResetFor && (
        <div className="fixed inset-0 flex items-end md:items-center justify-center p-4 pointer-events-none">
          <div className="pointer-events-auto bg-slate-900 rounded-md p-4 w-full max-w-md">
            <h3 className="text-white font-semibold text-lg">Reset password</h3>
            <p className="text-slate-300 mt-2">Temporary password (copy and share securely):</p>
            <div className="mt-3 bg-slate-800 p-3 rounded">
              <code className="text-sm text-emerald-300 break-all">{tempPassword ?? "—"}</code>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="px-3 py-1 bg-gray-600 rounded text-white"
                onClick={() => {
                  setShowResetFor(null);
                  setTempPassword(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(TeacherList);
