import React from "react";
import { api } from "../services/api";
import type { Role } from "../services/authService";

export default function CreateTeacher() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [error, setError] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [role, setRole] = React.useState<Role>("teacher");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // load admin token manually
      const token = localStorage.getItem("gf_token");

      await api.post(
        "/auth/admin-create-teacher",
        {
          name,
          email,
          password,
          role,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`, // <-- 🔥 FIX
          },
        }
      );

      setSuccess("Account created successfully.");
      setName("");
      setEmail("");
      setPassword("");
    } catch (err: any) {
      // Convert FastAPI/Pydantic 422 detail into a readable string
      let message = "Failed to create new account.";
      const resp = err?.response?.data;
      if (resp) {
        if (Array.isArray(resp.detail)) {
          // resp.detail is an array of objects: { loc, msg, type, ... }
          message = resp.detail
            .map((d: any) => {
              if (typeof d === "string") return d;
              // format like: "body -> name: field required"
              const loc = Array.isArray(d.loc) ? d.loc.join(" -> ") : d.loc;
              return `${loc}: ${d.msg}`;
            })
            .join("; ");
        } else if (typeof resp.detail === "string") {
          message = resp.detail;
        } else {
          // fallback: stringify body (safe)
          message = JSON.stringify(resp);
        }
      } else if (err?.message) {
        message = err.message;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex justify-center mt-12">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md p-6 bg-slate-800 rounded-xl shadow-xl"
      >
        <h2 className="text-2xl font-semibold text-white mb-4">
          Create New Account
        </h2>

        {success && <p className="text-emerald-400 mb-2">{success}</p>}
        {error && <p className="text-red-400 mb-2">{error}</p>}

        <label className="text-sm font-medium text-slate-200">Full name</label>
        <input
          name="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Prof. Shruti H."
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />

        <label className="text-sm font-medium text-slate-200">
          College email
        </label>
        <input
          name="name"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="username@gmail.com"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />

        <label className="text-sm font-medium text-slate-200">Password</label>
        <div className="relative mt-1">
          <input
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={72}
            placeholder="At least 6 characters"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 pr-12"
          />

          {/* Eye toggle */}
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "🙈" : "👁️"}
          </button>
        </div>

        {/* Role dropdown */}
        <div>
          <label className="text-sm font-medium text-slate-200">Role</label>
          <select
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="teacher">Teacher</option>
            <option value="admin">Admin</option>
          </select>
          <p className="mt-1 text-[11px] text-slate-400">
            Choose <span className="text-emerald-300">Teacher</span> for mark
            entry, <span className="text-emerald-300">Admin</span> for report
            downloads.
          </p>
        </div>

        {error && <div className="error">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/40 hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>
    </div>
  );
}
