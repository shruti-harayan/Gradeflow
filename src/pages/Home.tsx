import React from "react";
import { Link } from "react-router-dom";
import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
  fetch("https://gradeflow-hggr.onrender.com/")
    .then(res => res.json())
    .then(console.log);
}, []);

  return (
    <div className="min-h-[calc(100vh-96px)] flex flex-col gap-10 px-4 pb-12">
      {/* Hero section */}
      <section className="container mx-auto grid gap-10 md:grid-cols-2 items-center mt-6">
        {/* Left: text + CTAs */}
        <div className="max-w-xl">
          <p className="inline-flex items-center rounded-full bg-slate-900/60 border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300 mb-4">
            Built for colleges · Teachers & Admins
          </p>

          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            One place to <span className="text-indigo-400">enter marks</span>{" "}
            and <span className="text-emerald-400">download reports</span>.
          </h1>

          <p className="text-slate-300 mb-6 text-sm md:text-base">
            GradeFlow lets teachers record question-wise marks in seconds, while
            admins download clean Excel/CSV reports for audits, result
            processing, and analytics.
          </p>

          <div className="flex flex-wrap gap-4">
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/40 hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              I&apos;m a Teacher
            </Link>

            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-lg border border-emerald-500/70 px-5 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/10 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              I&apos;m an Admin
            </Link>
          </div>

          <div className="mt-6 grid gap-3 text-xs text-slate-400 md:text-sm">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Teachers: Create exams, enter marks, auto-calc totals & export
              CSV.
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              Admins: View all teacher uploads, filter by subject/semester, and
              download Excel.
            </div>
          </div>
        </div>

        {/* Right: Role cards */}
        <div className="grid gap-4 md:gap-6">
          {/* Teacher card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-900/40">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Teacher workspace
                </h2>
                <p className="text-xs text-slate-400">
                  Create exams & enter marks.
                </p>
              </div>
              <span className="rounded-full bg-indigo-500/10 px-2 py-1 text-[10px] font-medium text-indigo-300">
                Marks entry
              </span>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-center justify-between rounded-lg bg-slate-950/40 border border-slate-800 px-3 py-2">
                <div>
                  <p className="font-medium">CS101 · Midterm</p>
                  <p className="text-[11px] text-slate-400">
                    3 questions · 72 students
                  </p>
                </div>
                <span className="rounded-md bg-slate-800 px-2 py-1 text-[10px] text-slate-300">
                  In progress
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-950/40 border border-slate-800 px-3 py-2">
                <div>
                  <p className="font-medium">IT204 · Internal Test</p>
                  <p className="text-[11px] text-slate-400">
                    5 questions · 56 students
                  </p>
                </div>
                <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300">
                  Saved
                </span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Link
                to="/dashboard"
                className="flex-1 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-center text-white hover:bg-indigo-600"
              >
                Go to teacher dashboard
              </Link>
            </div>
          </div>

          {/* Admin card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-slate-900/40">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Admin console
                </h2>
                <p className="text-xs text-slate-400">
                  Review & download teacher files.
                </p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-300">
                Reports
              </span>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-center justify-between border border-slate-800 rounded-lg px-3 py-2 bg-slate-950/40">
                <div>
                  <p className="font-medium">Uploads today</p>
                  <p className="text-[11px] text-slate-400">
                    4 Excel files from 3 teachers
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-emerald-300">4</p>
                  <p className="text-[10px] text-slate-500">pending review</p>
                </div>
              </div>

              <div className="flex items-center justify-between border border-slate-800 rounded-lg px-3 py-2 bg-slate-950/40">
                <div>
                  <p className="font-medium">Last downloaded</p>
                  <p className="text-[11px] text-slate-400">
                    CS101_midterm_marks.xlsx
                  </p>
                </div>
                <button className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800">
                  Open folder
                </button>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Link
                to="/login"
                className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-center text-white hover:bg-emerald-600"
              >
                Go to admin login
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom: simple 3-step strip */}
      <section className="container mx-auto mt-4 grid gap-4 md:grid-cols-3 text-xs md:text-sm text-slate-300">
        <div className="flex gap-3 items-start">
          <div className="mt-0.5 h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center text-[11px] font-semibold text-slate-200">
            1
          </div>
          <div>
            <p className="font-medium">Teachers log in</p>
            <p className="text-slate-400">
              Create exams and fill marks directly from any device.
            </p>
          </div>
        </div>
        <div className="flex gap-3 items-start">
          <div className="mt-0.5 h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center text-[11px] font-semibold text-slate-200">
            2
          </div>
          <div>
            <p className="font-medium">GradeFlow saves & exports</p>
            <p className="text-slate-400">
              Data is stored safely and exported as clean CSV/Excel.
            </p>
          </div>
        </div>
        <div className="flex gap-3 items-start">
          <div className="mt-0.5 h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center text-[11px] font-semibold text-slate-200">
            3
          </div>
          <div>
            <p className="font-medium">Admins download reports</p>
            <p className="text-slate-400">
              Filter by subject, teacher, or semester and download in one click.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

