// src/pages/ResetPassword.tsx
import React, { useState } from "react";
import { api } from "../services/api";
import { useSearchParams, useNavigate } from "react-router-dom";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // eye toggles
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setError(null);

    if (!token) {
      setError("Missing reset token. Use the link sent to your email.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    try {
      const res = await api.post("/auth/reset-password", {
        token,
        new_password: password,
      });
      setMsg(res.data.detail || "Password reset successful.");
      // optionally redirect to login after a short delay
      setTimeout(() => navigate("/login"), 1200);
    } catch (err: any) {
      const serverMsg = err?.response?.data?.detail || err?.message || "Error resetting password.";
      setError(String(serverMsg));
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-slate-900 rounded-lg">
      <h2 className="text-lg text-white font-semibold mb-3">Reset Password</h2>

      <form onSubmit={handleReset} className="space-y-4">
        <div>
          <label className="text-xs text-slate-400">New Password</label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              className="w-full px-3 py-2 bg-slate-800 text-white rounded"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowNew((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300"
              aria-label={showNew ? "Hide password" : "Show password"}
            >
              {showNew ? "🙈" : "👁️"}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400">Confirm Password</label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              className="w-full px-3 py-2 bg-slate-800 text-white rounded"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirm((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300"
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? "🙈" : "👁️"}
            </button>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {msg && <p className="text-green-400 text-sm">{msg}</p>}

        <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded">
          Reset Password
        </button>
      </form>
    </div>
  );
}
