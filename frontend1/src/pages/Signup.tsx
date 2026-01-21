// src/pages/Signup.tsx
import React from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { signup, type Role } from "../services/authService";
import axios from "axios";

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<Role>("teacher");

  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  setError(null);
  setLoading(true);

  try {
    await signup(name, email, password, role);

    // success -> go to login
    navigate("/login");
  } catch (err: any) {
    // Format axios / FastAPI validation errors into a friendly string
    let message = "Network error";
    if (axios.isAxiosError(err) && err.response) {
      const data = err.response.data;
      if (data?.detail) {
        if (Array.isArray(data.detail)) {
          message = data.detail
            .map((d: any) => (typeof d === "string" ? d : d.msg ?? JSON.stringify(d)))
            .join("; ");
        } else if (typeof data.detail === "string") {
          message = data.detail;
        } else {
          message = JSON.stringify(data.detail);
        }
      } else if (data) {
        message = JSON.stringify(data);
      }
    } else if (err?.message) {
      message = err.message;
    }

    setError(message);
    console.error("Signup error:", err);
  } finally {
    setLoading(false);
  }
}


  return (
    <div className="min-h-[calc(100vh-96px)] flex items-center justify-center px-4 pb-10">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl shadow-slate-900/60 backdrop-blur-md p-8">
        {/* Header */}
        <div className="mb-6">
          <p className="inline-flex items-center rounded-full bg-emerald-900/40 px-3 py-1 text-xs font-medium text-emerald-300">
            New to GradeFlow?
          </p>
          <h1 className="mt-4 text-2xl font-semibold text-white">
            Create an account
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Set up your teacher profile to start entering and analyzing marks.
          </p>
        </div>

        {/* Signup form */}
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-200">
              Full name
            </label>
            <input
              name="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Prof. Shruti H."
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
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
          </div>

          <div>
            <label className="text-sm font-medium text-slate-200">
              Password
            </label>
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
              Choose <span className="text-emerald-300">Teacher</span> for mark entry,{" "}
              <span className="text-emerald-300">Admin</span> for report downloads.
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

        <p className="mt-5 text-xs text-center text-slate-400">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-indigo-300 hover:text-indigo-200"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
