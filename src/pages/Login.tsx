// src/pages/Login.tsx 
import React from "react";
import { Link } from "react-router-dom";
import GoogleSignIn from "../components/GoogleSignIn";
import { useNavigate } from "react-router-dom";
import { login } from "../services/authService";


export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleLocalLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;

    try {
      const data = await login(email, password);
      if (data.user.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      console.error(err);
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-96px)] flex items-center justify-center px-4 pb-10">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl shadow-slate-900/60 backdrop-blur-md p-8">
        {/* Header */}
        <div className="mb-6">
          <p className="inline-flex items-center rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">
            Teacher access · Secure login
          </p>
          <h1 className="mt-4 text-2xl font-semibold text-white">Login</h1>
          <p className="mt-1 text-sm text-slate-400">
            Sign in to manage marks, exams and CSV exports.
          </p>
        </div>

        {/* Email / password form */}
        <form onSubmit={handleLocalLogin} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-200">Email</label>
            <input
              type="email"
              required
              placeholder="username@gmail.com"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-200">
                Password
              </label>
              <button
                type="button"
                className="text-xs text-indigo-300 hover:text-indigo-200"
              >
                Forgot?
              </button>
            </div>

            <div className="relative mt-1">
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 pr-12"
              />

              {/* Eye toggle */}
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  /* Eye (visible) */
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 4.5c-6 0-9.5 4.5-10 7.5 1.5 4 5 7.5 10 7.5s8.5-3.5 10-7.5c-.5-3-4-7.5-10-7.5ZM7.58 12a4.42 4.42 0 1 1 8.84 0 4.42 4.42 0 0 1-8.84 0Z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  /* Eye-off (hidden) */
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-5 h-5"
                  >
                    <path d="M3.53 2.47a.75.75 0 0 1 1.06 0l17 17a.75.75 0 0 1-1.06 1.06l-2.12-2.12A11.83 11.83 0 0 1 12 19.5c-6 0-9.5-4.5-10-7.5a12 12 0 0 1 5.05-7.21L3.53 3.53a.75.75 0 0 1 0-1.06ZM12 6c3.67 0 6 2.14 7.39 4.2.46.7.46 1.9 0 2.6a13.42 13.42 0 0 1-1.7 2.03l-2.22-2.22a4 4 0 0 0-4.88-4.89L8.28 6.22A12.11 12.11 0 0 1 12 6Z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/40 hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors"
          >
            Sign in
          </button>
        </form>

        {/* Divider */}
        <div className="my-5 flex items-center gap-3 text-xs text-slate-500">
          <div className="h-px flex-1 bg-slate-700" />
          <span>or</span>
          <div className="h-px flex-1 bg-slate-700" />
        </div>

        {/* Google login */}
        <GoogleSignIn
          onSuccess={() => {
            // After backend verifies Google token, you can redirect to dashboard
            // navigate("/dashboard");
          }}
        />

        {/* Footer text */}
        <p className="mt-5 text-xs text-center text-slate-400">
          Don&apos;t have an account?{" "}
          <Link
            to="/signup"
            className="font-medium text-indigo-300 hover:text-indigo-200"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
