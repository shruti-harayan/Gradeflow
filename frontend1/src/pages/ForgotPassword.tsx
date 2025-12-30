import React, { useState } from "react";
import { api } from "../services/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    try {
      const res = await api.post("/auth/forgot-password", { email });
      setMsg(res.data.detail);
    } catch (err: any) {
      setMsg(err?.response?.data?.detail || "Something went wrong.");
    }
  }
  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-slate-900 rounded-lg">
      <h2 className="text-lg text-white font-semibold mb-3">Forgot Password</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs text-slate-400">Enter your email</label>
          <input
            type="email"
            className="w-full px-3 py-2 bg-slate-800 text-white rounded"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {msg && <p className="text-slate-300 text-sm">{msg}</p>}

        <button className="w-full bg-sky-600 hover:bg-sky-700 text-white py-2 rounded">
          Send reset link
        </button>
      </form>
    </div>
  );
}
