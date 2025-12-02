// src/pages/Header.tsx
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isAuthed = !!user;
  const isAdmin = user?.role === "admin";

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="container mx-auto flex items-center justify-between px-6 py-4 relative">
        {/* Logo + title */}
        <Link to="/" className="flex items-center gap-3">
          <img
            src="/GradeFlow.png"
            alt="GradeFlow logo"
            className="h-9 w-9 rounded-md object-cover"
          />
          <div className="leading-tight">
            <h1 className="text-lg font-extrabold tracking-tight text-white">
              GradeFlow
            </h1>
            <p className="text-[11px] text-slate-400">
              Fast marks entry &amp; analytics for teachers
            </p>
          </div>
        </Link>

        {/* Center College Name */}

        <div className="absolute left-1/2 -translate-x-1/2 text-center flex flex-col items-center">
          {/* College Logo */}
          <img
            src="/logo.jpeg"
            alt="College Logo"
            className="h-10 w-10 object-contain mb-1 drop-shadow-lg"
          />

          {/* College Name */}
          <h2 className="text-lg font-extrabold text-sky-300 drop-shadow-md tracking-wide whitespace-nowrap">
            RAMANAND ARYA D.A.V. COLLEGE
          </h2>

          {/* Tagline / Affiliation */}
          <p className="text-[11px] text-slate-400 tracking-wide whitespace-nowrap leading-tight">
            Affiliated to{" "}
            <span className="font-semibold text-slate-300">
              University of Mumbai
            </span>
          </p>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-6 text-sm">
          {/* Nav links (only when not logged in) */}
          {!isAuthed && (
            <nav className="hidden sm:flex items-center gap-4">
              <HeaderLink to="/" currentPath={location.pathname}>
                Home
              </HeaderLink>
              <HeaderLink to="/login" currentPath={location.pathname}>
                Login
              </HeaderLink>
              <HeaderLink to="/signup" currentPath={location.pathname}>
                Signup
              </HeaderLink>
            </nav>
          )}

          {/* When logged in: show role + dashboard link + logout */}
          {isAuthed && (
            <>
              <div className="hidden md:flex flex-col items-end text-xs">
                <span className="text-slate-200">
                  Logged in as{" "}
                  <span className="font-semibold">{user?.name}</span>
                </span>
                <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {isAdmin ? "Admin" : "Teacher"}
                </span>
              </div>

              <nav className="flex items-center gap-3">
                {isAdmin ? (
                  <HeaderLink to="/admin" currentPath={location.pathname}>
                    Admin dashboard
                  </HeaderLink>
                ) : (
                  <HeaderLink to="/dashboard" currentPath={location.pathname}>
                    Teacher dashboard
                  </HeaderLink>
                )}

                <button
                  onClick={handleLogout}
                  className="rounded-lg border border-red-700 bg-red-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-red-700 hover:text-white"
                >
                  Logout
                </button>
              </nav>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

type HeaderLinkProps = {
  to: string;
  currentPath: string;
  children: React.ReactNode;
};

function HeaderLink({ to, currentPath, children }: HeaderLinkProps) {
  const active = currentPath === to;
  return (
    <Link
      to={to}
      className={
        "transition-colors " +
        (active ? "text-indigo-300" : "text-slate-300 hover:text-white")
      }
    >
      {children}
    </Link>
  );
}
