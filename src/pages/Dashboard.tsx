// src/pages/Dashboard.tsx
import React from "react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  return (
    <div className="container mx-auto px-6">
      <div className="bg-gray-900 p-6 rounded-xl shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">Welcome, Professor</h2>
            <p className="text-sm text-gray-400">Select a subject to start entering marks</p>
          </div>
          <div className="flex gap-3">
            <button className="px-3 py-2 bg-gray-800 border border-gray-700 rounded">Profile</button>
            <button className="px-3 py-2 bg-red-600 rounded">Logout</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: 'CS101 - Algorithms', students: 120 },
            { title: 'MA201 - Calculus', students: 90 },
            { title: 'CS301 - Databases', students: 60 }
          ].map((s) => (
            <div key={s.title} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-400">Subject</div>
                  <div className="text-lg font-semibold">{s.title}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{s.students}</div>
                  <div className="text-xs text-gray-400">students</div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button className="flex-1 py-2 bg-indigo-600 rounded text-white">Open</button>
                <button className="py-2 px-3 border border-gray-700 rounded text-gray-200">Export</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* page-level header + content (optional) */}
      <div className="min-h-screen mt-6">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">GradeFlow — Dashboard</h1>
          <nav>
            <Link to="/" className="mr-3 text-blue-400">Home</Link>
            <button className="px-3 py-1 bg-red-500 text-white rounded">Logout</button>
          </nav>
        </header>
        <main>
          <p className="text-gray-300">Welcome to GradeFlow. Use the subject cards above to open mark-entry.</p>
        </main>
      </div>
    </div>
  );
}
