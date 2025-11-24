// src/components/ProtectedRoute.tsx
import React, { type JSX } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../services/authService";

interface ProtectedRouteProps {
  children: JSX.Element;
  allowedRoles?: Role[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-96px)] flex items-center justify-center text-slate-300">
        Checking permissions...
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Logged in but not allowed
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Option: send teacher to /dashboard, admin to /admin
    if (user.role === "teacher") return <Navigate to="/dashboard" replace />;
    if (user.role === "admin") return <Navigate to="/admin" replace />;
    return <Navigate to="/" replace />;
  }

  // Allowed
  return children;
};

export default ProtectedRoute;
