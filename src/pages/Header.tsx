// src/pages/Header.tsx
import React from "react";
import { Link } from "react-router-dom";

export default function Header() {
  return (
    <header className="bg-transparent">
      <div className="container mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          
          <img
            src="/GradeFlow.png"
            alt="GradeFlow logo"
            className="w-14 h-14 object-contain rounded-md"
          />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight leading-none">
              GradeFlow
            </h1>
            <p className="text-xs text-gray-400 -mt-1">Fast marks entry & analytics for teachers</p>
          </div>
        </div>

        <nav className="flex items-center gap-4">
          <Link to="/" className="text-sm text-gray-300 hover:text-white">Home</Link>
          <Link to="/login" className="text-sm text-blue-400 hover:underline">Login</Link>
          <Link to="/signup" className="text-sm text-green-400 hover:underline">Signup</Link>
        </nav>
      </div>
    </header>
  );
}
