// src/pages/MarksEntry.tsx
import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  saveExamMarks,
  finalizeExam,
  getExamMarks,
  type ExamMarksOut,
  type ExamOut,
} from "../services/examService";
import { useAuth } from "../context/AuthContext";

/**
 * New structure:
 * - mainQuestions: MainQuestion[] where each MainQuestion has subQuestions (A,B,C...)
 * - marks: Record<`${rollNo}-${MainLabel}.${SubLabel}`, number | "">
 *
 * When saving to server we FLATTEN questions to labels like "Q1.A" and send:
 * questions: [{ label: "Q1.A", max_marks: 5 }, ...]
 * students: [{ roll_no: "201", absent: false, marks: { "Q1.A": 4, ... } }, ...]
 */

type Student = {
  id: number;
  rollNo: string;
  absent?: boolean;
};

type SubQuestion = {
  id: number;
  label: string; // "A", "B", "C"
  maxMarks: number;
};

type MainQuestion = {
  id: number;
  label: string; // "Q1", "Q2"
  subQuestions: SubQuestion[];
};

type MarksMap = Record<string, number | "">; // key = `${rollNo}-${MainLabel}.${SubLabel}`

const initialStudents: Student[] = [{ id: 1, rollNo: "101", absent: false }];

export default function MarksEntry() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // exam metadata
  const [exam, setExam] = React.useState<ExamOut | null>(null);
  const examIdParam = searchParams.get("examId");
  const examId = examIdParam ? Number(examIdParam) : 0;
  const isAdminView = searchParams.get("adminView") === "1";

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
  // Academic Year (e.g., 2025-2026)
  const [academicYear, setAcademicYear] = React.useState("2025-2026");

  const [mainQuestions, setMainQuestions] = React.useState<MainQuestion[]>([]);

  const [students, setStudents] = React.useState<Student[]>(initialStudents);
  const [marks, setMarks] = React.useState<MarksMap>({});
  const [error, setError] = React.useState<string | null>(null);

  // new main question builder state
  const [newMainQLabel, setNewMainQLabel] = React.useState("");
  const [newMainQSubCount, setNewMainQSubCount] = React.useState<number>(1);
  const [defaultMaxSubMarks, setDefaultMaxSubMarks] =
    React.useState<number>(10);

  // single-add student fields (kept for small additions)
  const [newStudentRoll, setNewStudentRoll] = React.useState("");
  // roll range generator
  const [newRollFrom, setNewRollFrom] = React.useState<string>("");
  const [newRollTo, setNewRollTo] = React.useState<string>("");

  const isFrozen = !!user?.is_frozen;
  const isFinalized = !!exam?.is_locked;
  const disabled = isFrozen || isFinalized;

  //automatically set academic year
  React.useEffect(() => {
  const now = new Date();
  const year = now.getFullYear();
  const next = year + 1;
  setAcademicYear(`${year}-${next}`);
}, []);


  React.useEffect(() => {
    // load exam details & existing saved marks
    async function loadExam() {
      if (!examId || examId <= 0) return;
      try {
        const data: ExamMarksOut = await getExamMarks(examId);
        setSubjectCode(data.exam.subject_code);
        setSubjectName(data.exam.subject_name);
        setExamName(data.exam.exam_type);
        setSemester(data.exam.semester);
        setExam(data.exam);

        // If backend already has question rows (flat), convert them into mainQuestions if possible.
        // Backend likely returns questions as a flat array of {id,label,max_marks} where label could be "Q1.A"
        // We will parse labels of pattern "Qn.X" into MainQuestion structure.
        if (data.questions && data.questions.length > 0) {
          const mqMap = new Map<string, MainQuestion>();
          data.questions.forEach((q) => {
            const label = q.label; // expect "Q1.A" or similar
            const parts = label.split(".");
            if (parts.length === 2) {
              const main = parts[0];
              const sub = parts[1];
              if (!mqMap.has(main)) {
                mqMap.set(main, {
                  id: Date.now() + mqMap.size + 1,
                  label: main,
                  subQuestions: [],
                });
              }
              const mq = mqMap.get(main)!;
              mq.subQuestions.push({
                id: Date.now() + Math.random() * 10000,
                label: sub,
                maxMarks: q.max_marks,
              });
            } else {
              // fallback: treat as main question with single sub
              const main = label;
              if (!mqMap.has(main)) {
                mqMap.set(main, {
                  id: Date.now() + mqMap.size + 1,
                  label: main,
                  subQuestions: [
                    { id: Date.now(), label: "A", maxMarks: q.max_marks },
                  ],
                });
              }
            }
          });
          setMainQuestions(Array.from(mqMap.values()));
        }

        // students
        if (data.students && data.students.length > 0) {
          const ss: Student[] = data.students.map((s) => ({
            id: s.id,
            rollNo: s.roll_no,
            absent: s.absent,
          }));
          setStudents(ss);
        }

        // marks -> build marks map keyed by `${rollNo}-${label}` where label is "Q1.A"
        if (data.marks && data.marks.length > 0) {
          const m: MarksMap = {};
          // backend marks are objects with student_id and question_id; need to map them to labels
          // We attempt to map by matching question_id -> question label from data.questions
          const qById = new Map<number, string>();
          (data.questions || []).forEach((q) =>
            qById.set((q as any).id, (q as any).label)
          );

          data.marks.forEach((mk) => {
            const qLabel = qById.get(mk.question_id);
            if (!qLabel) return;
            const student = data.students.find((st) => st.id === mk.student_id);
            if (!student) return;
            const key = `${student.roll_no}-${qLabel}`;
            m[key] = mk.marks === null ? "" : mk.marks;
          });
          setMarks(m);
        }
      } catch (err) {
        console.error("Failed to load exam marks", err);
      }
    }

    loadExam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  // helpers
  const normalizeRollValue = (v: string) => v.trim();

  function handleGenerateRange(e: React.FormEvent) {
    e.preventDefault();
    if (isAdminView || disabled) return;
    const rawFrom = normalizeRollValue(newRollFrom);
    const rawTo = normalizeRollValue(newRollTo);
    if (!rawFrom || !rawTo) {
      alert("Please enter both From and To roll numbers.");
      return;
    }
    const nFrom = Number(rawFrom);
    const nTo = Number(rawTo);
    if (
      !Number.isFinite(nFrom) ||
      !Number.isFinite(nTo) ||
      Number.isNaN(nFrom) ||
      Number.isNaN(nTo)
    ) {
      alert("Roll numbers must be numeric.");
      return;
    }
    if (!Number.isInteger(nFrom) || !Number.isInteger(nTo)) {
      alert("Roll numbers must be integers.");
      return;
    }
    if (nFrom > nTo) {
      alert(
        "Starting roll number must be less than or equal to ending roll number."
      );
      return;
    }
    const count = nTo - nFrom + 1;
    const MAX_GENERATE = 500;
    if (count > MAX_GENERATE) {
      if (
        !confirm(
          `You are about to generate ${count} rows. This may be slow. Proceed?`
        )
      )
        return;
    }
    const generated: Student[] = [];
    for (let r = nFrom; r <= nTo; r++) {
      generated.push({
        id: Date.now() + r,
        rollNo: String(r),
        absent: false,
      });
    }
    setStudents(generated);
    setNewRollFrom("");
    setNewRollTo("");
  }

  function handleAddSingleStudent(e: React.FormEvent) {
    e.preventDefault();
    if (isAdminView || disabled) return;
    if (!newStudentRoll.trim()) return;
    setStudents((prev) => [
      ...prev,
      { id: Date.now(), rollNo: newStudentRoll.trim(), absent: false },
    ]);
    setNewStudentRoll("");
  }

  function handleAddMainQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (isAdminView || disabled) return;
    if (!newMainQLabel.trim()) return;
    const numSubs = Math.max(1, Math.min(10, newMainQSubCount));
    const subQs: SubQuestion[] = [];
    for (let i = 0; i < numSubs; i++) {
      const letter = String.fromCharCode(65 + i); // A,B,C...
      subQs.push({
        id: Date.now() + i,
        label: letter,
        maxMarks: defaultMaxSubMarks,
      });
    }
    const newMainQ: MainQuestion = {
      id: Date.now(),
      label: newMainQLabel.trim().toUpperCase(),
      subQuestions: subQs,
    };
    setMainQuestions((prev) => [...prev, newMainQ]);
    setNewMainQLabel("");
    setNewMainQSubCount(1);
  }

  function handleToggleAbsent(studentId: number) {
    if (disabled) return;
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, absent: !s.absent } : s))
    );
  }

  function marksKey(rollNo: string, label: string) {
    return `${rollNo}-${label}`; // label like "Q1.A"
  }

  function handleSubMarkChange(
    rollNo: string,
    mainLabel: string,
    subLabel: string,
    max: number,
    raw: string
  ) {
    if (isFrozen || isFinalized) return;
    const key = marksKey(rollNo, `${mainLabel}.${subLabel}`);
    if (raw === "") {
      setMarks((prev) => ({ ...prev, [key]: "" }));
      return;
    }
    let n = parseFloat(raw);
    if (Number.isNaN(n)) return;
    // clamp between 0 and max
    if (n < 0) n = 0;
    if (n > max) n = max;
    // optional: round to 2 decimals to avoid long floats
    n = Math.round(n * 100) / 100;

    setMarks((prev) => ({ ...prev, [key]: n }));
  }

  function mainTotalForStudent(rollNo: string, mq: MainQuestion) {
    return mq.subQuestions.reduce((acc, sq) => {
      const key = marksKey(rollNo, `${mq.label}.${sq.label}`);
      const v = marks[key];
      return acc + (typeof v === "number" ? v : 0);
    }, 0);
  }

  function grandTotalForStudent(rollNo: string) {
    return mainQuestions.reduce(
      (acc, mq) => acc + mainTotalForStudent(rollNo, mq),
      0
    );
  }

  function maxTotal() {
    return mainQuestions.reduce(
      (acc, mq) => acc + mq.subQuestions.reduce((s, sq) => s + sq.maxMarks, 0),
      0
    );
  }

  async function handleFinalize() {
    if (!exam) {
      console.warn("Attempted to finalize but exam is null");
      return;
    }
    if (disabled) {
      alert(
        "Final submission not allowed: account frozen or exam already finalized."
      );
      return;
    }
    if (
      !window.confirm(
        "This will final-submit the exam. You will not be able to edit marks afterwards. Proceed?"
      )
    )
      return;

    try {
      await finalizeExam(exam.id);
      setExam((prev) =>
        prev ? ({ ...prev, is_locked: true } as ExamOut) : prev
      );
      alert("Exam submitted. You can no longer edit marks.");
    } catch (err) {
      console.error("Finalize failed", err);
      alert("Failed to finalize exam.");
    }
  }

  function handleExportCSV() {
    // header: RollNo, then each sub-question label (Q1.A...), then per-main totals, then grand total
    const subLabels: string[] = [];
    mainQuestions.forEach((mq) => {
      mq.subQuestions.forEach((sq) =>
        subLabels.push(`${mq.label}.${sq.label}`)
      );
    });
    const mainTotalsLabels = mainQuestions.map((mq) => `${mq.label}.Total`);

    const header = [
      "Academic Year",
      "Roll No",
      ...subLabels,
      ...mainTotalsLabels,
      "Grand Total",
    ];
    const rows = students.map((s) => {
      if (s.absent) {
        const empties = subLabels.map(() => "");
        const mainTotals = mainTotalsLabels.map(() => "");
        return [s.rollNo, ...empties, ...mainTotals, "AB"];
      } else {
        const subVals = subLabels.map((lab) => {
          const v = marksKey(s.rollNo, lab);
          const val = marks[v];
          return typeof val === "number" ? String(val) : "";
        });
        const mainTotals = mainQuestions.map((mq) =>
          String(mainTotalForStudent(s.rollNo, mq))
        );
        const g = String(grandTotalForStudent(s.rollNo));
        return [academicYear,s.rollNo, ...subVals, ...mainTotals, g];
      }
    });

    const csvContent = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeSubject = subjectCode || "Subject";
    const safeExam = examName || "Exam";
    const safeSem = `Sem${semester}`;
    a.href = url;
    a.download = `${safeSubject}_${safeExam}_${safeSem}_marks.csv`;
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
    if (disabled) {
      alert(
        "Your account has been frozen or exam finalized. You cannot save marks."
      );
      return;
    }

    // Flatten questions to [{ label: "Q1.A", max_marks: 5 }, ...]
    const questionsPayload = mainQuestions.flatMap((mq) =>
      mq.subQuestions.map((sq) => ({
        label: `${mq.label}.${sq.label}`,
        max_marks: sq.maxMarks,
      }))
    );

    // For each student build marks map keyed by "Q1.A"
    const studentsPayload = students.map((s) => {
      const marksMap: Record<string, number | null> = {};
      mainQuestions.forEach((mq) => {
        mq.subQuestions.forEach((sq) => {
          const label = `${mq.label}.${sq.label}`;
          const key = marksKey(s.rollNo, label);
          const v = marks[key];
          marksMap[label] = typeof v === "number" ? v : null;
        });
      });
      return {
        roll_no: s.rollNo,
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
        academic_year: academicYear, 
        questions: questionsPayload,
        students: studentsPayload,
      } as any);
      alert("Marks saved to server successfully ✅");
    } catch (err: any) {
      console.error("Save failed", err);
      const resp = err?.response?.data;
      let message = "Failed to save marks";
      if (resp?.detail && Array.isArray(resp.detail)) {
        message = resp.detail
          .map((d: any) => {
            const loc = Array.isArray(d.loc) ? d.loc.join(" -> ") : d.loc;
            return `${loc}: ${d.msg}`;
          })
          .join("; ");
      } else if (resp) {
        message = JSON.stringify(resp);
      } else if (err?.message) {
        message = err.message;
      }
      setError(message);
    }
  }

  // UI render
  return (
    <div className="space-y-6">
      {/* Top bar */}
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

        {isAdminView && (
          <span className="ml-3 inline-block rounded-full bg-yellow-600 px-2 py-1 text-xs font-semibold text-black">
            Admin view — read only
          </span>
        )}

        {isFrozen && (
          <div className="mb-4 rounded-md bg-red-900/80 p-3 text-red-100">
            Your account has been frozen by the admin. You cannot edit marks.
            Contact the admin to unfreeze your account.
          </div>
        )}

        {isFinalized && !isAdminView && user?.role === "teacher" && (
          <div className="bg-red-100 text-red-900 border border-red-200 p-3 rounded-md mb-4 font-semibold">
            you have submitted and cannot re-edit. contact admin
          </div>
        )}

        {isFinalized && isAdminView && (
          <div className="bg-blue-900/40 text-blue-200 px-3 py-2 rounded text-xs">
            Exam has been final submitted by the teacher.
          </div>
        )}

        {error && <p className="text-red-500">{error}</p>}

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

          {/* Academic Year */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Academic Year</span>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="2025-2026"
                className="w-28 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 
                text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Max total</span>
            <span className="rounded-md bg-slate-800 px-2 py-1 text-slate-100">
              {maxTotal()}
            </span>
          </div>
        </div>
      </div>

      {/* Controls: roll-range / add single student / add main question */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Roll range generator & single-add */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-100">Students</h3>

          <form onSubmit={handleAddSingleStudent} className="flex gap-2">
            <input
              value={newStudentRoll}
              onChange={(e) => setNewStudentRoll(e.target.value)}
              placeholder="Single roll (e.g. 201)"
              className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              disabled={isAdminView || disabled}
            />
            <button
              type="submit"
              disabled={isAdminView || disabled}
              className={`rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white ${
                isAdminView || disabled
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-indigo-600"
              }`}
            >
              Add
            </button>
          </form>

          <div className="border-t border-slate-800 pt-3 text-xs text-slate-400">
            <div className="mb-2">
              Generate many students by roll no range (inclusive):
            </div>
            <form
              onSubmit={handleGenerateRange}
              className="flex gap-2 items-center"
            >
              <label className="text-[12px]">From</label>
              <input
                type="number"
                min={0}
                value={newRollFrom}
                onChange={(e) => setNewRollFrom(e.target.value)}
                className="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                disabled={isAdminView || disabled}
              />
              <label className="text-[12px]">To</label>
              <input
                type="number"
                min={0}
                value={newRollTo}
                onChange={(e) => setNewRollTo(e.target.value)}
                className="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                disabled={isAdminView || disabled}
              />
              <button
                type="submit"
                disabled={isAdminView || disabled}
                className={`ml-2 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white ${
                  isAdminView || disabled
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-emerald-600"
                }`}
              >
                Generate
              </button>
            </form>
            <div className="mt-2 text-[11px] text-slate-500">
              Example: From <span className="font-mono">201</span> To{" "}
              <span className="font-mono">255</span> → generates 55 rows.
            </div>
          </div>
        </div>

        {/* Add main question */}
        <form
          onSubmit={handleAddMainQuestion}
          className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-2"
        >
          <h3 className="text-sm font-semibold text-slate-100">
            Add Main Question
          </h3>
          <div className="flex items-center gap-2">
            <input
              placeholder="Q1"
              value={newMainQLabel}
              onChange={(e) => setNewMainQLabel(e.target.value)}
              className="w-24 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
              disabled={isAdminView || disabled}
            />
            <input
              type="number"
              min={1}
              max={10}
              value={newMainQSubCount}
              onChange={(e) => setNewMainQSubCount(Number(e.target.value))}
              className="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
              disabled={isAdminView || disabled}
            />
            <input
              type="number"
              min={1}
              max={50}
              value={defaultMaxSubMarks}
              onChange={(e) => setDefaultMaxSubMarks(Number(e.target.value))}
              className="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
              disabled={isAdminView || disabled}
            />
          </div>
          <div className="text-[11px] text-slate-400">
            Main Question No · Sub-questions · Max marks per sub-question
          </div>
          <div>
            <button
              type="submit"
              disabled={isAdminView || disabled}
              className={`mt-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs text-white ${
                isAdminView || disabled
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-emerald-700"
              }`}
            >
              Add Main Question
            </button>
          </div>
        </form>

        {/* Summary box: counts */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <h3 className="text-sm font-semibold text-slate-100">Summary</h3>
          <div className="text-xs text-slate-400 mt-2">
            <div>
              Students:{" "}
              <span className="font-semibold text-slate-100">
                {students.length}
              </span>
            </div>
            <div>
              Main questions:{" "}
              <span className="font-semibold text-slate-100">
                {mainQuestions.length}
              </span>
            </div>
            <div>
              Sub columns:{" "}
              <span className="font-semibold text-slate-100">
                {mainQuestions.reduce((s, mq) => s + mq.subQuestions.length, 0)}
              </span>
            </div>
            <div className="mt-2">
              Grand max:{" "}
              <span className="font-semibold text-slate-100">{maxTotal()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Marks table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 overflow-x-auto shadow-lg shadow-slate-900/40">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-300">
              <th className="px-3 py-2 text-left font-medium">Roll no</th>
              <th className="px-3 py-2 text-center font-medium">Absent</th>

              {/* Flattened sub-question columns */}
              {mainQuestions.flatMap((mq) =>
                mq.subQuestions.map((sq) => (
                  <th
                    key={`${mq.label}.${sq.label}`}
                    className="px-2 py-2 text-center font-medium"
                  >
                    {mq.label}.{sq.label}
                    <div className="text-[10px] text-slate-500">
                      /{sq.maxMarks}
                    </div>
                  </th>
                ))
              )}

              {/* main totals */}
              {mainQuestions.map((mq) => (
                <th
                  key={`${mq.label}.Total`}
                  className="px-3 py-2 text-center font-medium"
                >
                  {mq.label}.Total
                </th>
              ))}

              <th className="px-3 py-2 text-center font-bold text-emerald-300">
                Grand Total
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

                <td className="px-3 py-2 text-center">
                  <label className="inline-flex items-center gap-1 text-[11px] text-slate-300">
                    <input
                      type="checkbox"
                      checked={!!s.absent}
                      onChange={() => handleToggleAbsent(s.id)}
                      className="h-3 w-3 rounded border-slate-600 text-rose-400"
                      disabled={disabled}
                    />
                    <span>AB</span>
                  </label>
                </td>

                {/* sub question inputs */}
                {mainQuestions.flatMap((mq) =>
                  mq.subQuestions.map((sq) => {
                    const label = `${mq.label}.${sq.label}`;
                    const key = marksKey(s.rollNo, label);
                    const value = marks[key];
                    return (
                      <td key={key} className="px-2 py-1 text-center">
                        <input
                          type="number"
                          step="0.25"
                          min={0}
                          max={sq.maxMarks}
                          value={
                            value === "" || value === undefined ? "" : value
                          }
                          onChange={(e) =>
                            handleSubMarkChange(
                              s.rollNo,
                              mq.label,
                              sq.label,
                              sq.maxMarks,
                              e.target.value
                            )
                          }
                          disabled={
                            isAdminView || !!s.absent || isFrozen || isFinalized
                          }
                          className={
                            "w-14 rounded-md border px-1 py-1 text-center text-[11px] focus:outline-none " +
                            (s.absent
                              ? "border-slate-800 bg-slate-900 text-slate-500"
                              : "border-slate-700 bg-slate-900 text-slate-100")
                          }
                        />
                      </td>
                    );
                  })
                )}

                {/* main totals */}
                {mainQuestions.map((mq) => (
                  <td
                    key={`${s.rollNo}-${mq.label}.total`}
                    className="px-3 py-2 text-center font-semibold text-slate-100"
                  >
                    {s.absent ? "AB" : mainTotalForStudent(s.rollNo, mq)}
                  </td>
                ))}

                <td className="px-3 py-2 text-center font-bold text-emerald-400">
                  {s.absent ? "AB" : grandTotalForStudent(s.rollNo)}
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
          · Main Qs:{" "}
          <span className="text-slate-100 font-semibold">
            {mainQuestions.length}
          </span>{" "}
          · Columns:{" "}
          <span className="text-slate-100 font-semibold">
            {mainQuestions.reduce((s, mq) => s + mq.subQuestions.length, 0)}
          </span>
        </div>

        <div className="flex gap-3">
          {!isAdminView ? (
            <button
              type="button"
              onClick={handleSaveToServer}
              disabled={!examId || examId <= 0 || disabled}
              className={
                "rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium " +
                (examId && examId > 0
                  ? "bg-green-500 text-slate-100 hover:bg-slate-800"
                  : "bg-green-500/60 text-slate-500 cursor-not-allowed") +
                (disabled ? " opacity-50 cursor-not-allowed" : "")
              }
            >
              Save to server
            </button>
          ) : (
            <div className="text-xs text-slate-400 px-4 py-2">
              Read-only view
            </div>
          )}

          <button
            type="button"
            onClick={handleExportCSV}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-600 shadow shadow-indigo-500/40"
          >
            Export CSV
          </button>

          <div className="mt-3">
            <button
              onClick={handleFinalize}
              disabled={disabled || isFinalized}
              className={`w-full text-center font-bold rounded px-4 py-3 ${
                isFinalized
                  ? "opacity-60 cursor-not-allowed"
                  : "bg-red-600 text-white hover:bg-red-700"
              } border-2 border-red-700`}
            >
              Final Submit — Lock exam (cannot re-edit)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
