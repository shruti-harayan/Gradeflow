// src/pages/MarksEntry.tsx
import React from "react";
import { useSearchParams } from "react-router-dom";
import {saveExamMarks,type QuestionPayload,type StudentMarksPayload,getExamMarks,type ExamMarksOut} from "../services/examService";

type Student = {
  id: number;
  rollNo: string;
  name: string;
  absent?: boolean;
};

type Question = {
  id: number;
  label: string;
  maxMarks: number;
};

type MarksMap = Record<string, number | "">; // key = `${studentId}-${questionId}`

const initialStudents: Student[] = [
  { id: 1, rollNo: "101", name: "Alice", absent: false },
  { id: 2, rollNo: "102", name: "Bob", absent: false },
];

const initialQuestions: Question[] = [
  { id: 1, label: "Q1", maxMarks: 10 },
  { id: 2, label: "Q2", maxMarks: 10 },
  { id: 3, label: "Q3", maxMarks: 10 },
];

export default function MarksEntry() {
  const [searchParams] = useSearchParams();

  const examIdParam = searchParams.get("examId");
  const examId = examIdParam ? Number(examIdParam) : 0;

  const initialSubject = searchParams.get("subject") ?? "CS101";
  const initialSubjectName = searchParams.get("subjectName") ?? "Algorithms";
  const initialExam = searchParams.get("exam") ?? "Internal";
  const initialSem = Number(searchParams.get("sem") ?? 1);

  const [subjectCode, setSubjectCode] = React.useState(initialSubject);
  const [subjectName, setSubjectName] = React.useState(initialSubjectName);
  const [examName, setExamName] = React.useState(initialExam);
  const [semester, setSemester] = React.useState<number>(
    isNaN(initialSem) ? 1 : initialSem
  );

  const [students, setStudents] = React.useState<Student[]>(initialStudents);
  const [questions, setQuestions] =
    React.useState<Question[]>(initialQuestions);
  const [marks, setMarks] = React.useState<MarksMap>({});

  const [newStudentRoll, setNewStudentRoll] = React.useState("");
  const [newStudentName, setNewStudentName] = React.useState("");
  const [newQuestionMax, setNewQuestionMax] = React.useState(10);

  // key for marks map
  const keyFor = (studentId: number, questionId: number) =>
    `${studentId}-${questionId}`;

  React.useEffect(() => {
  async function loadExam() {
    if (!examId || examId <= 0) return;

    try {
      const data: ExamMarksOut = await getExamMarks(examId);

      // Always update basic exam meta
      setSubjectCode(data.exam.subject_code);
      setSubjectName(data.exam.subject_name);
      setExamName(data.exam.exam_type);
      setSemester(data.exam.semester);

      const hasAnyData =
        data.questions.length > 0 ||
        data.students.length > 0 ||
        data.marks.length > 0;

      // 🔹 Only override table data if something was actually saved before
      if (hasAnyData) {
        // Build questions
        const qs: Question[] = data.questions.map((q) => ({
          id: q.id,
          label: q.label,
          maxMarks: q.max_marks,
        }));
        setQuestions(qs);

        // Build students
        const ss: Student[] = data.students.map((s) => ({
          id: s.id,
          rollNo: s.roll_no,
          name: s.name,
          absent: s.absent,
        }));
        setStudents(ss);

        // Build marks map
        const m: MarksMap = {};
        data.marks.forEach((mk) => {
          const key = `${mk.student_id}-${mk.question_id}`;
          m[key] = mk.marks === null ? "" : mk.marks;
        });
        setMarks(m);
      }
    } catch (err) {
      console.error("Failed to load exam marks", err);
    }
  }

  loadExam();
}, [examId]);

  
  function handleMarkChange(
    studentId: number,
    questionId: number,
    value: string
  ) {
    const student = students.find((s) => s.id === studentId);
    if (student?.absent) return; // ignore changes if absent

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

  function studentTotal(student: Student) {
    if (student.absent) return 0;
    return questions.reduce((sum, q) => {
      const v = marks[keyFor(student.id, q.id)];
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
        absent: false,
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

  function toggleAbsent(studentId: number) {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, absent: !s.absent } : s))
    );
  }

  // Export CSV client-side
  function handleExportCSV() {
    const header = [
      "Roll No",
      "Name",
      "Semester",
      "Exam Type",
      ...questions.map((q) => `${q.label} (/${q.maxMarks})`),
      `Total (/${maxTotal()})`,
    ];

    const rows = students.map((s) => {
      if (s.absent) {
        // Mark absent: keep cells blank, total = AB
        const emptyCells = questions.map(() => "");
        return [
          s.rollNo,
          s.name,
          String(semester),
          examName,
          ...emptyCells,
          "AB",
        ];
      } else {
        const cells = questions.map((q) => {
          const v = marks[keyFor(s.id, q.id)];
          return typeof v === "number" ? String(v) : "";
        });
        const total = studentTotal(s);
        return [
          s.rollNo,
          s.name,
          String(semester),
          examName,
          ...cells,
          String(total),
        ];
      }
    });

    const csvContent = [header, ...rows].map((row) => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const safeSubject = subjectCode || "Subject";
    const safeExam = examName || "Exam";
    const safeSem = `Sem${semester}`;
    const safeName = subjectName || "Marks";

    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeSubject}_${safeName}_${safeExam}_${safeSem}_marks.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSaveToServer() {
    if (!examId || examId <= 0) {
      alert(
        "This exam is not linked to backend yet. Create it from Teacher Dashboard to save."
      );
      return;
    }

    const questionsPayload: QuestionPayload[] = questions.map((q) => ({
      label: q.label,
      max_marks: q.maxMarks,
    }));

    const studentsPayload: StudentMarksPayload[] = students.map((s) => {
      const marksMap: Record<string, number | null> = {};
      questions.forEach((q) => {
        const v = marks[keyFor(s.id, q.id)];
        if (s.absent) {
          marksMap[q.label] = null;
        } else {
          marksMap[q.label] =
            typeof v === "number"
              ? v
              : v === "" || v === undefined
              ? null
              : null;
        }
      });
      return {
        roll_no: s.rollNo,
        name: s.name,
        absent: !!s.absent,
        marks: marksMap,
      };
    });

    try {
      await saveExamMarks(examId, {
        subject_code: subjectCode,
        subject_name: subjectName,
        exam_type: examName,
        semester,
        questions: questionsPayload,
        students: studentsPayload,
      });
      alert("Marks saved to server successfully ✅");
    } catch (err) {
      console.error(err);
      alert("Failed to save marks to server.");
    }
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
          <p className="text-xs text-slate-300 mt-1">
            <span className="font-semibold">{subjectCode}</span> —{" "}
            <span>{subjectName}</span> · Sem {semester}
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
            <span className="text-slate-400">Subject name</span>
            <input
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              className="w-40 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Exam type</span>
            <select
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              className="w-28 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="Internal">Internal</option>
              <option value="External">External</option>
              <option value="Practical">Practical</option>
              <option value="ATKT">ATKT</option>
              <option value="Other">Other</option>
            </select>
          </div>
          {/* Semester dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Semester</span>
            <select
              value={semester}
              onChange={(e) => setSemester(Number(e.target.value))}
              className="w-24 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {Array.from({ length: 8 }, (_, i) => i + 1).map((sem) => (
                <option key={sem} value={sem}>
                  Sem {sem}
                </option>
              ))}
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
              <th className="px-3 py-2 text-center font-medium">Absent</th>
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
                  (s.absent
                    ? " bg-slate-900/60"
                    : rowIdx % 2 === 0
                    ? " bg-slate-950/40"
                    : "")
                }
              >
                <td className="px-3 py-2 font-mono text-slate-200">
                  {s.rollNo}
                </td>
                <td className="px-3 py-2 text-slate-100">{s.name}</td>

                {/* Absent toggle */}
                <td className="px-3 py-2 text-center">
                  <label className="inline-flex items-center gap-1 text-[11px] text-slate-300">
                    <input
                      type="checkbox"
                      checked={!!s.absent}
                      onChange={() => toggleAbsent(s.id)}
                      className="h-3 w-3 rounded border-slate-600 text-rose-400"
                    />
                    <span>AB</span>
                  </label>
                </td>

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
                        disabled={!!s.absent}
                        className={
                          "w-16 rounded-md border px-1 py-1 text-center text-[11px] focus:outline-none focus:ring-1 " +
                          (s.absent
                            ? "border-slate-800 bg-slate-900 text-slate-500"
                            : "border-slate-700 bg-slate-900 text-slate-100 focus:ring-indigo-500")
                        }
                      />
                    </td>
                  );
                })}

                <td className="px-3 py-2 text-center font-semibold text-slate-100">
                  {s.absent ? "AB" : studentTotal(s)}
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
            disabled={!examId || examId <= 0}
            onClick={handleSaveToServer}
            className={
              "rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium " +
              (examId && examId > 0
                ? "bg-slate-900 text-slate-100 hover:bg-slate-800"
                : "bg-slate-900/60 text-slate-500 cursor-not-allowed")
            }
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
