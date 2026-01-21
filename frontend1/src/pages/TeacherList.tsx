// src/pages/admin/TeacherList.tsx
import React from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

export type TeacherBase = {
  id: number;
  name?: string | null;
  email: string;
  is_frozen: boolean;
};

type TeacherListProps = {
  teachers: TeacherBase[];
  onSelectTeacher?: (teacherId: number, teacherName: string) => void;
  onTeachersUpdated?: (teachers: TeacherBase[]) => void;
};

function TeacherList({
  teachers,
  onSelectTeacher,
  onTeachersUpdated,
}: TeacherListProps) {
  const { user } = useAuth();

  const [resetTarget, setResetTarget] = React.useState<TeacherBase | null>(
    null
  );
  const [resetPassword, setResetPassword] = React.useState("");
  const [resetLoading, setResetLoading] = React.useState(false);
  const [resetError, setResetError] = React.useState<string | null>(null);
  const [tempPassword, setTempPassword] = React.useState<string | null>(null);

  async function handleDeactivateTeacher(t: TeacherBase, e?: React.MouseEvent) {
    e?.stopPropagation();

    const confirmText = prompt(
      `⚠️ PERMANENT ACTION\n\n` +
        `This will permanently deactivate this account.\n\n` +
        `• User will NEVER be able to log in\n` +
        `• All exams & marks will remain\n` +
        `• This action CANNOT be undone\n\n` +
        `Type DELETE to confirm:`
    );

    if (confirmText !== "DELETE") {
      alert("Deactivation cancelled.");
      return;
    }

    try {
      await api.post(`/auth/admin/users/${t.id}/deactivate`);

      // remove from UI immediately
      onTeachersUpdated?.(teachers.filter((x) => x.id !== t.id));

      alert("User account deactivated permanently.");
    } catch (err: any) {
      console.error("Deactivate failed", err);
      alert(err?.response?.data?.detail || "Failed to deactivate account");
    }
  }

  // 🔒 Freeze / Unfreeze (ADMIN only)
  async function toggleFreeze(t: TeacherBase, e?: React.MouseEvent) {
    e?.stopPropagation();

    try {
      if (t.is_frozen) {
        await api.post(`/auth/admin/teachers/${t.id}/unfreeze`);
      } else {
        await api.post(`/auth/admin/teachers/${t.id}/freeze`);
      }

      // notify parent to update teacher list
      onTeachersUpdated?.(
        teachers.map((x) =>
          x.id === t.id ? { ...x, is_frozen: !t.is_frozen } : x
        )
      );
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Action failed");
    }
  }

  // 🔑 Reset password
  function handleResetPassword(t: TeacherBase, e?: React.MouseEvent) {
    e?.stopPropagation();

    if (user?.role !== "admin") return;

    setResetTarget(t);
    setResetPassword("");
    setTempPassword(null);
    setResetError(null);
  }
  async function submitResetPassword() {
    if (!resetTarget) return;

    if (resetPassword.length < 6) {
      setResetError("Password must be at least 6 characters.");
      return;
    }

    try {
      setResetLoading(true);
      setResetError(null);

      const resp = await api.post(
        `/auth/admin-reset-password/${resetTarget.id}`,
        { password: resetPassword }
      );

      setTempPassword(resp?.data?.temporary_password || resetPassword);
    } catch (err: any) {
      setResetError(err?.response?.data?.detail || "Failed to reset password");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Teachers List</h2>

      <div className="space-y-3 mt-4">
        {teachers.map((t) => (
          <div
            key={t.id}
            role="button"
            onClick={() => onSelectTeacher?.(t.id, t.name ?? t.email)}
            className="cursor-pointer rounded-lg bg-slate-900 p-4 hover:bg-slate-800 transition"
            title="Click to view exams by this teacher"
          >
            <div className="flex flex-col gap-3">
              {/* Top row: identity */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-semibold">
                    {t.name ?? "—"}
                  </div>
                  <div className="text-slate-400 text-xs">{t.email}</div>
                </div>

                <span
                  className={`text-xs italic ${
                    t.is_frozen ? "text-amber-300" : "text-emerald-300"
                  }`}
                >
                  {t.is_frozen ? "Frozen" : "Active"}
                </span>
              </div>

              {/* Bottom row: actions */}
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  onClick={(e) => toggleFreeze(t, e)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition
        ${
          t.is_frozen
            ? "bg-slate-600 text-white hover:bg-slate-500"
            : "bg-emerald-600 text-white hover:bg-emerald-700"
        }`}
                >
                  {t.is_frozen ? "Unfreeze" : "Freeze"}
                </button>

                <button
                  onClick={(e) => handleResetPassword(t, e)}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold
        bg-indigo-600 text-white hover:bg-indigo-700 transition"
                >
                  Reset password
                </button>

                {user?.role === "admin" && (
                  <button
                    onClick={(e) => handleDeactivateTeacher(t, e)}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold
          bg-red-700 text-white hover:bg-red-800 transition"
                  >
                    Deactivate
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg bg-slate-900 p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-white">Reset password</h3>

            <p className="mt-1 text-sm text-slate-400">
              Teacher:{" "}
              <span className="text-slate-200 font-medium">
                {resetTarget.name ?? resetTarget.email}
              </span>
            </p>

            {/* INPUT PHASE */}
            {!tempPassword && (
              <>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="mt-4 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                {resetError && (
                  <p className="mt-2 text-xs text-red-400">{resetError}</p>
                )}

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={() => setResetTarget(null)}
                    className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={submitResetPassword}
                    disabled={resetLoading}
                    className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {resetLoading ? "Resetting..." : "Reset password"}
                  </button>
                </div>
              </>
            )}

            {/* SUCCESS PHASE */}
            {tempPassword && (
              <>
                <p className="mt-4 text-sm text-slate-300">
                  Temporary password (copy & share securely):
                </p>

                <div className="mt-2 flex items-center justify-between rounded bg-slate-800 px-3 py-2">
                  <code className="text-emerald-300 text-sm">
                    {tempPassword}
                  </code>

                  <button
                    onClick={() => navigator.clipboard.writeText(tempPassword)}
                    className="text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    Copy
                  </button>
                </div>

                <p className="mt-2 text-xs text-amber-400">
                  ⚠ This password will not be shown again.
                </p>

                <div className="mt-5 flex justify-end">
                  <button
                    onClick={() => {
                      setResetTarget(null);
                      setTempPassword(null);
                    }}
                    className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(TeacherList);
