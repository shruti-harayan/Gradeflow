import React from "react";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Header from "./pages/Header";
import { Routes, Route } from "react-router-dom";

export default function App() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      <Header />

      <main className="container mx-auto px-4 py-12">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>

      <footer className="border-t border-gray-700 py-6 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} GradeFlow — Built for teachers by Shruti Harayan
      </footer>
    </div>
  );
}
