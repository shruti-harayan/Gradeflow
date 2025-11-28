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

export default function TeacherList() {
  const [teachers, setTeachers] = React.useState<Teacher[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [showResetFor, setShowResetFor] = React.useState<number | null>(null);
  const [tempPassword, setTempPassword] = React.useState<string | null>(null);
  const [resetting, setResetting] = React.useState(false);

  const { user } = useAuth();

  React.useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await api.get("/auth/admin/teachers");
      setTeachers(res.data);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Failed to load teachers");
    } finally {
      setLoading(false);
    }
  }

  async function toggleFreeze(t: Teacher) {
    try {
      if (t.is_frozen) {
        await api.post(`/auth/admin/teachers/${t.id}/unfreeze`);
      } else {
        await api.post(`/auth/admin/teachers/${t.id}/freeze`);
      }
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Action failed");
    }
  }

  async function resetPassword(teacherId: number) {
    setResetting(true);
    setTempPassword(null);
    try {
      const res = await api.post(`/auth/admin/teachers/${teacherId}/reset-password`, {});
      setTempPassword(res.data.temporary_password ?? ""); // dev mode returns password
      setShowResetFor(teacherId);
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Reset failed");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Teachers</h2>
        <button
          className="bg-indigo-600 text-white px-3 py-1 rounded-md"
          onClick={() => load()}
        >
          Refresh
        </button>
      </div>

      {loading && <div className="text-slate-300">Loading...</div>}
      {err && <div className="text-red-400">{err}</div>}

      <div className="grid gap-3">
        {teachers.map((t) => (
          <div key={t.id} className="flex items-center justify-between bg-slate-800 p-4 rounded-md">
            <div>
              <div className="text-sm text-slate-200 font-medium">{t.name ?? t.email}</div>
              <div className="text-xs text-slate-400">{t.email}</div>
              <div className="text-xs text-amber-400 mt-1">{t.role}</div>
              <div className="text-xs text-slate-400">{t.created_at}</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className={`px-3 py-1 rounded-md text-sm ${t.is_frozen ? "bg-gray-600 text-white" : "bg-emerald-500 text-white hover:bg-emerald-600"}`}
                onClick={() => toggleFreeze(t)}
              >
                {t.is_frozen ? "Unfreeze" : "Freeze"}
              </button>

              <button
                className="px-3 py-1 rounded-md bg-indigo-600 text-white text-sm"
                onClick={() => resetPassword(t.id)}
                disabled={resetting}
              >
                Reset password
              </button>
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
              <button className="px-3 py-1 bg-gray-600 rounded text-white" onClick={() => { setShowResetFor(null); setTempPassword(null); }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
