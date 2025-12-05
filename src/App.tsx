import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Header from "./pages/Header";
import MarksEntry from "./pages/MarksEntry";
import ProtectedRoute from "./components/ProtectedRoute";
import CreateTeacher from "./pages/CreateTeacher";
import TeacherList from "./pages/TeacherList";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

export default function App() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Teacher dashboard: only teacher role */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={["teacher"]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Admin dashboard: only admin role */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/marks-entry"
            element={
              <ProtectedRoute allowedRoles={["teacher", "admin"]}>
                <MarksEntry />
              </ProtectedRoute>
            }
          />
          <Route
            path="/marks-view"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <MarksEntry />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/create-teacher"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <CreateTeacher />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/teachers"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <TeacherList />
              </ProtectedRoute>
            }
          />

          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </main>
      <footer className="border-t border-gray-700 py-6 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} GradeFlow — Built for teachers by Shruti
        Harayan
      </footer>
    </div>
  );
}
