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

function TeacherList() {
  const [teachers, setTeachers] = React.useState<Teacher[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [showResetFor, setShowResetFor] = React.useState<number | null>(null);
  const [tempPassword, setTempPassword] = React.useState<string | null>(null);
  //const [resetting, setResetting] = React.useState(false);

  React.useEffect(() => {
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
  load();
  }, []);

    async function toggleFreeze(t: Teacher) {
    try {
      // Optimistic: compute new value and update UI immediately
      const newFrozen = !t.is_frozen;
      // Update UI locally for snappiness
      setTeachers(prev => prev.map(x => x.id === t.id ? { ...x, is_frozen: newFrozen } : x));

      if (t.is_frozen) {
        await api.post(`/auth/admin/teachers/${t.id}/unfreeze`);
      } else {
        await api.post(`/auth/admin/teachers/${t.id}/freeze`);
      }

      // Optionally re-fetch single teacher or show toast (kept minimal)
    } catch (e: any) {
      // revert local change if API failed
      setTeachers(prev => prev.map(x => x.id === t.id ? { ...x, is_frozen: t.is_frozen } : x));
      alert(e?.response?.data?.detail || "Action failed");
    }
  }



  const { user } = useAuth();

    async function handleResetPassword(teacherId: number) {
    // Only allow admins in UI too
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
      // prefer letting api layer send auth header; but if your api requires manual token:
      // const token = localStorage.getItem("gf_token");
      // await api.post(`/auth/admin-reset-password/${teacherId}`, { password: newPassword }, { headers: { Authorization: `Bearer ${token}` } });

      const resp = await api.post(`/auth/admin-reset-password/${teacherId}`, { password: newPassword });
      // If server returns temporary password or message, show it in the UI modal area
      const temp = resp?.data?.temporary_password || resp?.data?.password || null;
      setTempPassword(temp);
      setShowResetFor(teacherId);
      alert("Password updated. Share it securely with the teacher.");
    } catch (err: any) {
      console.error("Reset failed", err);
      alert(err?.response?.data?.detail || "Failed to reset password");
    }
  }


  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Teachers List</h2>
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
                onClick={() =>  handleResetPassword(t.id)}>Reset password</button>
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
export default React.memo(TeacherList);