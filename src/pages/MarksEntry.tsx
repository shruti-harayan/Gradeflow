// src/pages/MarksEntry.tsx
import React from "react";
import { useSearchParams } from "react-router-dom";

type Student = {
  id: number;
  rollNo: string;
  name: string;
};

type Question = {
  id: number;
  label: string;
  maxMarks: number;
};

type MarksMap = Record<string, number | "">; // key = `${studentId}-${questionId}`

const initialStudents: Student[] = [
  { id: 1, rollNo: "101", name: "shruti" },
  { id: 2, rollNo: "102", name: "Bob" },
];

const initialQuestions: Question[] = [
  { id: 1, label: "Q1", maxMarks: 10 },
  { id: 2, label: "Q2", maxMarks: 10 },
  { id: 3, label: "Q3", maxMarks: 10 },
];

export default function MarksEntry() {
  const [searchParams] = useSearchParams();

  const initialSubject = searchParams.get("subject") ?? "CS101";
  const initialExam = searchParams.get("exam") ?? "Internal";

  const [subjectCode, setSubjectCode] = React.useState(initialSubject);
  const [examName, setExamName] = React.useState(initialExam);

  const [students, setStudents] = React.useState<Student[]>(initialStudents);
  const [questions, setQuestions] =
    React.useState<Question[]>(initialQuestions);
  const [marks, setMarks] = React.useState<MarksMap>({});

  const [newStudentRoll, setNewStudentRoll] = React.useState("");
  const [newStudentName, setNewStudentName] = React.useState("");
  const [newQuestionMax, setNewQuestionMax] = React.useState(10);

  // Utility key for marks map
  const keyFor = (studentId: number, questionId: number) =>
    `${studentId}-${questionId}`;

  function handleMarkChange(
    studentId: number,
    questionId: number,
    value: string
  ) {
    if (value === "") {
      setMarks((prev) => ({ ...prev, [keyFor(studentId, questionId)]: "" }));
      return;
    }
    const num = Number(value);
    if (Number.isNaN(num)) return;

    const q = questions.find((q) => q.id === questionId);
    const max = q?.maxMarks ?? 0;
    const clamped = Math.min(Math.max(num, 0), max);

    setMarks((prev) => ({
      ...prev,
      [keyFor(studentId, questionId)]: clamped,
    }));
  }

  function studentTotal(studentId: number) {
    return questions.reduce((sum, q) => {
      const v = marks[keyFor(studentId, q.id)];
      return sum + (typeof v === "number" ? v : 0);
    }, 0);
  }

  function maxTotal() {
    return questions.reduce((sum, q) => sum + q.maxMarks, 0);
  }

  function handleAddStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!newStudentRoll.trim() || !newStudentName.trim()) return;

    setStudents((prev) => [
      ...prev,
      {
        id: Date.now(),
        rollNo: newStudentRoll.trim(),
        name: newStudentName.trim(),
      },
    ]);
    setNewStudentRoll("");
    setNewStudentName("");
  }

  function handleAddQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!newQuestionMax || newQuestionMax <= 0) return;

    const nextIndex = questions.length + 1;
    setQuestions((prev) => [
      ...prev,
      {
        id: Date.now(),
        label: `Q${nextIndex}`,
        maxMarks: newQuestionMax,
      },
    ]);
    setNewQuestionMax(10);
  }

  // Export CSV client-side
  function handleExportCSV() {
    const header = [
      "Roll No",
      "Name",
      ...questions.map((q) => `${q.label} (/${q.maxMarks})`),
      `Total (/${maxTotal()})`,
    ];

    const rows = students.map((s) => {
      const cells = questions.map((q) => {
        const v = marks[keyFor(s.id, q.id)];
        return typeof v === "number" ? String(v) : "";
      });
      const total = studentTotal(s.id);
      return [s.rollNo, s.name, ...cells, String(total)];
    });

    const csvContent = [header, ...rows].map((row) => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    const safeSubject = subjectCode || "Subject";
    const safeExam = examName || "Exam";
    a.download = `${safeSubject}_${safeExam}_marks.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Top bar: exam info */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Marks entry</h1>
          <p className="text-xs text-slate-400">
            Roll-no & question-wise marks for a single exam.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Subject code</span>
            <input
              value={subjectCode}
              onChange={(e) => setSubjectCode(e.target.value)}
              className="w-24 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Exam type:</span>
            <select
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              className="w-32 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="Internal">Internal</option>
              <option value="External">External</option>
              <option value="Practical">Practical</option>
              <option value="ATKT">ATKT</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Max total</span>
            <span className="rounded-md bg-slate-800 px-2 py-1 text-slate-100">
              {maxTotal()}
            </span>
          </div>
        </div>
      </div>

      {/* Forms: add student / add question */}
      <div className="grid gap-4 md:grid-cols-2">
        <form
          onSubmit={handleAddStudent}
          className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-3"
        >
          <h2 className="text-sm font-semibold text-slate-100">Add student</h2>
          <div className="flex flex-col gap-2 text-xs">
            <input
              type="text"
              placeholder="Roll no (e.g. 103)"
              value={newStudentRoll}
              onChange={(e) => setNewStudentRoll(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <input
              type="text"
              placeholder="Student name"
              value={newStudentName}
              onChange={(e) => setNewStudentName(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            className="mt-1 inline-flex items-center justify-center rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600"
          >
            Add student
          </button>
        </form>

        <form
          onSubmit={handleAddQuestion}
          className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-3"
        >
          <h2 className="text-sm font-semibold text-slate-100">Add question</h2>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex flex-col">
              <span className="text-slate-400 text-[11px]">
                Max marks for new question
              </span>
              <input
                type="number"
                min={1}
                max={100}
                value={newQuestionMax}
                onChange={(e) => setNewQuestionMax(Number(e.target.value))}
                className="mt-1 w-24 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <button
            type="submit"
            className="mt-1 inline-flex items-center justify-center rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
          >
            Add question
          </button>
        </form>
      </div>

      {/* Marks table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 overflow-x-auto shadow-lg shadow-slate-900/40">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-300">
              <th className="px-3 py-2 text-left font-medium">Roll no</th>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              {questions.map((q) => (
                <th
                  key={q.id}
                  className="px-2 py-2 text-center font-medium"
                  title={`Max: ${q.maxMarks}`}
                >
                  {q.label}
                  <div className="text-[10px] text-slate-500">
                    /{q.maxMarks}
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 text-center font-medium">
                Total / {maxTotal()}
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, rowIdx) => (
              <tr
                key={s.id}
                className={
                  "border-b border-slate-900" +
                  (rowIdx % 2 === 0 ? " bg-slate-950/40" : "")
                }
              >
                <td className="px-3 py-2 font-mono text-slate-200">
                  {s.rollNo}
                </td>
                <td className="px-3 py-2 text-slate-100">{s.name}</td>

                {questions.map((q) => {
                  const v = marks[keyFor(s.id, q.id)];
                  return (
                    <td key={q.id} className="px-2 py-1 text-center">
                      <input
                        type="number"
                        min={0}
                        max={q.maxMarks}
                        value={v === "" || v === undefined ? "" : v}
                        onChange={(e) =>
                          handleMarkChange(s.id, q.id, e.target.value)
                        }
                        className="w-16 rounded-md border border-slate-700 bg-slate-900 px-1 py-1 text-center text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </td>
                  );
                })}

                <td className="px-3 py-2 text-center font-semibold text-slate-100">
                  {studentTotal(s.id)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bottom action bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-xs">
        <div className="text-slate-400">
          Students:{" "}
          <span className="text-slate-100 font-semibold">
            {students.length}
          </span>{" "}
          · Questions:{" "}
          <span className="text-slate-100 font-semibold">
            {questions.length}
          </span>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800"
          >
            Save to server
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-600 shadow shadow-indigo-500/40"
          >
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}
