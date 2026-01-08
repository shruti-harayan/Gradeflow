// src/pages/MarksEntry.tsx
import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  saveExamMarks,
  finalizeExam,
  getExamMarks,
  type ExamMarksOut,
  type ExamOut,
  downloadExamCsv,
} from "../services/examService";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

type Student = {
  id: number;
  rollNo: number;
  absent?: boolean;
};

interface Section {
  id: number;
  section_name: string | null;
  roll_start: number;
  roll_end: number;
}

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

type MainQuestionRule = {
  mainLabel: string; // "Q1"
  minToCount: number; // e.g. 3
  outOf: number; // e.g. 5
};

type MarksMap = Record<string, number | "">; // key = `${rollNo}-${MainLabel}.${SubLabel}`

const initialStudents: Student[] = [{ id: 1, rollNo: 101, absent: false }];

export default function MarksEntry() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(
    null
  );
  // allow the user to optionally enter an explicit overall max (e.g. 100)
  const [maxTotalOverride, setMaxTotalOverride] = React.useState<number | "">(
    ""
  );

  const [creatingSection, setCreatingSection] = React.useState(false);
  const [newSectionName, setNewSectionName] = React.useState("");
  const [newRollStart, setNewRollStart] = React.useState("");
  const [newRollEnd, setNewRollEnd] = React.useState("");

  const [mqRuleMain, setMqRuleMain] = React.useState<string>(""); // selected main label in the UI card
  const [mqRuleMin, setMqRuleMin] = React.useState<number>(1); // min to count (N)
  const [mqRuleOutOf, setMqRuleOutOf] = React.useState<number>(1); // out of (K) for info
  const [questionRules, setQuestionRules] = React.useState<
    Record<string, MainQuestionRule>
  >({});

  type ExamWithRules = ExamOut & {
    question_rules?: Record<string, MainQuestionRule> | null;
  };

  const [exam, setExam] = React.useState<ExamWithRules | null>(null);
  const examIdParam = searchParams.get("examId");
  const examId = examIdParam ? Number(examIdParam) : 0;

  const isAdminView = searchParams.get("adminView") === "1";
  const adminQuery =
    new URLSearchParams(window.location.search).get("adminView") === "1";
  const isAdmin =
    typeof isAdminView !== "undefined" ? (isAdminView as boolean) : adminQuery;

  // set to true if THIS teacher final-submits the exam in this session
  const [iFinalized, setIFinalized] = React.useState(false);

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

  const [academicYear, setAcademicYear] = React.useState("2025-2026");
  const [mainQuestions, setMainQuestions] = React.useState<MainQuestion[]>([]);
  const [students, setStudents] = React.useState<Student[]>(initialStudents);
  const [marks, setMarks] = React.useState<MarksMap>({});
  const [error, setError] = React.useState<string | null>(null);

  // new main question builder state
  const [newMainQLabel, setNewMainQLabel] = React.useState("");
  const [newMainQSubCount, setNewMainQSubCount] = React.useState<number>(1);
  const [defaultMaxSubMarks, setDefaultMaxSubMarks] = React.useState<number>(2);

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
    async function loadSections() {
      try {
        // replace get with your API wrapper
        const res = await api.get(`/exams/${examId}/sections`);
        setSections(res.data || []);
        // if teacher has exactly one section, auto-select it
        if (res.data && res.data.length === 1)
          setSelectedSectionId(res.data[0].id);
      } catch (err) {
        console.error("Failed to load sections", err);
      }
    }
    loadSections();
  }, [examId]);

  React.useEffect(() => {
    if (!isAdminView) return;
  }, [isAdminView]);

  // --- new helper: generate students array from numeric range (inclusive) ---
  function generateStudentsFromRange(start: number, end: number): Student[] {
    const arr: Student[] = [];
    for (let r = start; r <= end; r++) {
      arr.push({ id: Date.now() + r, rollNo: r, absent: false });
    }
    return arr;
  }

  // Section select handler: selects and generates rows for that section's range
  function handleSectionSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (!val) {
      setSelectedSectionId(null);
      setStudents([]);
      return;
    }
    const secId = Number(val);
    const sec = sections.find((s) => s.id === secId);
    setSelectedSectionId(secId);

    if (sec) {
      // generate students from section roll range
      const start = Number(sec.roll_start ?? sec.roll_start ?? 0);
      const end = Number(sec.roll_end ?? sec.roll_end ?? 0);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
        // invalid section ranges — do nothing
        setStudents([]);
        return;
      }
      const generated = generateStudentsFromRange(start, end);
      setStudents(generated);
    } else {
      setStudents([]);
    }
  }

  React.useEffect(() => {
    // load exam details & existing saved marks
    async function loadExam() {
      if (!examId || examId <= 0) return;
      try {
        let data: ExamMarksOut;

        if (isAdminView) {
          const params = new URLSearchParams({
            subject_code: subjectCode,
            subject_name: subjectName,
            exam_type: examName,
            semester: String(semester),
            academic_year: academicYear,
          });

          const res = await api.get(
            `/exams/admin/combined-marks?${params.toString()}`
          );
          data = res.data;
        } else {
          data = await getExamMarks(examId);
        }

        setSubjectCode(data.exam.subject_code);
        setSubjectName(data.exam.subject_name);
        setExamName(data.exam.exam_type);
        setSemester(data.exam.semester);
        setExam(data.exam as ExamWithRules);

        if (data.exam?.question_rules) {
          try {
            // api might return object already, or JSON string depending on backend
            const rules =
              typeof data.exam.question_rules === "string"
                ? JSON.parse(data.exam.question_rules)
                : data.exam.question_rules;
            setQuestionRules(rules || {});
          } catch (err) {
            console.warn("Failed to parse question_rules", err);
          }
        }

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
          const ss: Student[] = data.students.map((s: any) => ({
            id: s.id,
            rollNo: s.roll_no,
            absent: s.absent,
          }));
          setStudents(ss);
        }

        // marks -> build marks map keyed by `${rollNo}-${label}`
        if (data.marks && data.marks.length > 0) {
          const m: MarksMap = {};

          // map question_id -> label
          const qById = new Map<number, string>();
          (data.questions || []).forEach((q: any) => qById.set(q.id, q.label));

          // map student_id -> roll_no (TEACHER VIEW ONLY)
          const rollByStudentId = new Map<number, number>();
          if (!isAdminView && data.students) {
            data.students.forEach((s: any) => {
              rollByStudentId.set(s.id, s.roll_no);
            });
          }

          data.marks.forEach((mk: any) => {
            let rollNo: number | undefined;
            let qLabel: string | undefined;

            if (isAdminView) {
              //  ADMIN COMBINED VIEW
              // backend sends roll_no + question_label
              rollNo = mk.roll_no;
              qLabel = mk.question_label;
            } else {
              //  TEACHER VIEW
              // backend sends student_id + question_id
              rollNo = rollByStudentId.get(mk.student_id);
              qLabel = qById.get(mk.question_id);
            }

            if (!rollNo || !qLabel) return;

            const key = `${rollNo}-${qLabel}`;
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
        rollNo: Number(r),
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

    const raw = newStudentRoll?.trim();
    if (!raw) return;

    // parse integer (you can use Number(raw) if you want to allow non-integers)
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      alert("Please enter a valid integer roll number.");
      return;
    }

    // optional: prevent duplicates
    if (students.some((s) => s.rollNo === parsed)) {
      alert("This roll number already exists.");
      return;
    }

    // append new Student (rollNo is a number)
    setStudents((prev: Student[]) => [
      ...prev,
      { id: Date.now(), rollNo: parsed, absent: false },
    ]);

    setNewStudentRoll("");
  }

  function applyQuestionRuleLocally(mqLabel: string, N: number, K: number) {
    if (!mqLabel) {
      alert("Please select a main question.");
      return;
    }
    const newRules = {
      ...questionRules,
      [mqLabel]: { mainLabel: mqLabel, minToCount: N, outOf: K },
    };
    setQuestionRules(newRules);
  }

  // --- Main question add: prevent duplicate main labels ---
  function handleAddMainQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (isAdminView || disabled) return;
    if (!newMainQLabel.trim()) return;

    const label = newMainQLabel.trim().toUpperCase();

    // Prevent duplicate main question labels
    if (mainQuestions.some((mq) => mq.label === label)) {
      alert(
        `Main question ${label} already exists. Please choose a different label.`
      );
      return;
    }

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
      label,
      subQuestions: subQs,
    };
    setMainQuestions((prev) => [...prev, newMainQ]);
    setNewMainQLabel("");
    setNewMainQSubCount(1);
  }

  function addSubQuestionToMain(mainLabel: string) {
    if (isAdminView || disabled) return;
    setMainQuestions((prev) =>
      prev.map((mq) => {
        if (mq.label !== mainLabel) return mq;
        const subs = mq.subQuestions || [];

        // determine next candidate letter
        let nextChar = "A";
        if (subs.length > 0) {
          // find highest letter used
          const letters = subs.map((s) => s.label).filter(Boolean);
          const codes = letters
            .map((l) => l.charCodeAt(0))
            .filter((c) => Number.isFinite(c));
          const maxCode = codes.length ? Math.max(...codes) : 64; // 64 so +1 => 'A'
          nextChar = String.fromCharCode(maxCode + 1);
        }

        // ensure unique label (defensive)
        let attempt = nextChar;
        let i = 0;
        while (subs.some((s) => s.label === attempt) && i < 26) {
          attempt = String.fromCharCode(attempt.charCodeAt(0) + 1);
          i++;
        }
        if (attempt.charCodeAt(0) > 90) {
          alert("Cannot add more sub-questions (limit reached).");
          return mq;
        }

        let proposedMax = 1;
        if (subs.length > 0) {
          const last = subs[subs.length - 1];
          if (last && Number.isFinite(last.maxMarks) && last.maxMarks > 0) {
            proposedMax = last.maxMarks;
          } else if (
            Number.isFinite(defaultMaxSubMarks) &&
            defaultMaxSubMarks > 0
          ) {
            proposedMax = defaultMaxSubMarks;
          }
        } else {
          // no existing subs — use default but ensure >=1
          proposedMax =
            Number.isFinite(defaultMaxSubMarks) && defaultMaxSubMarks > 0
              ? defaultMaxSubMarks
              : 1;
        }

        // final sanity: ensure an integer >= 1
        proposedMax = Math.max(1, Math.round(proposedMax));

        const newSub: SubQuestion = {
          id: Date.now() + Math.random() * 10000,
          label: attempt,
          maxMarks: proposedMax,
        };

        return {
          ...mq,
          subQuestions: [...subs, newSub],
        };
      })
    );
  }

  function handleToggleAbsent(studentId: number) {
    if (disabled) return;
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, absent: !s.absent } : s))
    );
  }

  function marksKey(rollNo: number, label: string) {
    return `${rollNo}-${label}`; // label like "Q1.A"
  }

  function handleSubMarkChange(
    rollNo: number,
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

  function mainTotalForStudent(rollNo: number, mq: MainQuestion) {
    // collect numeric marks for each sub-question for this student
    const vals: number[] = mq.subQuestions
      .map((sq) => {
        const key = marksKey(rollNo, `${mq.label}.${sq.label}`);
        const v = marks[key];
        if (v === "" || v === null || v === undefined) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      })
      .filter((v): v is number => v !== null);

    // get rule if present
    const rule = questionRules[mq.label];

    if (rule && rule.minToCount && rule.minToCount > 0) {
      // count top N
      const N = Math.max(1, Math.min(rule.minToCount, mq.subQuestions.length));
      // sort descending and take top N
      const sorted = vals.slice().sort((a, b) => b - a);
      const chosen = sorted.slice(0, N);
      const sum = chosen.reduce((a, b) => a + b, 0);
      return sum;
    }

    // default: sum all sub-questions (existing behavior)
    return vals.reduce((a, b) => a + b, 0);
  }

  function grandTotalForStudent(rollNo: number) {
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

  // compute grand max based on questions and questionRules (uses only typed field minToCount)
  function computeComputedGrandMax() {
    try {
      let grand = 0;
      for (const mq of mainQuestions) {
        const subs = mq.subQuestions || [];
        const subMaxes = subs.map((sq) => Number(sq.maxMarks || 0));

        const rule: MainQuestionRule | undefined = questionRules?.[mq.label];
        const n =
          rule && Number.isFinite(Number(rule.minToCount))
            ? Number(rule.minToCount)
            : null;

        if (n && n > 0) {
          const sorted = subMaxes.slice().sort((a, b) => b - a);
          grand += sorted.slice(0, n).reduce((s, v) => s + (Number(v) || 0), 0);
        } else {
          grand += subMaxes.reduce((s, v) => s + (Number(v) || 0), 0);
        }
      }
      return grand;
    } catch (e) {
      console.warn("Failed to compute computedGrandMax:", e);
      return 0;
    }
  }

  function displayedGrandMax() {
    const computed = computeComputedGrandMax();
    if (maxTotalOverride === "" || maxTotalOverride === null) return computed;
    const ov = Number(maxTotalOverride) || 0;
    return Math.min(computed, ov);
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
        prev ? ({ ...prev, is_locked: true } as ExamWithRules) : prev
      );

      // mark that THIS teacher finalized it (so banner shows the teacher message)
      setIFinalized(true);

      alert("Exam submitted. You can no longer edit marks.");
    } catch (err) {
      console.error("Finalize failed", err);
      alert("Failed to finalize exam.");
    }
  }

  async function handleExportCSV() {
    if (!examId) {
      alert("Exam not created yet.");
      return;
    }
    const safe = (s: string) =>
      s.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-\.]/g, "");
    const filename = `${safe(subjectName)}_${safe(
      examName
    )}_Sem${semester}_${academicYear}.csv`;
    try {
      await downloadExamCsv(examId, filename);
    } catch (err) {
      console.error("CSV export failed", err);
      alert("Failed to export CSV");
    }
  }

  async function handleSaveToServer() {
    if (!isAdminView && sections.length > 0 && !selectedSectionId) {
      alert("Please select a section before saving marks.");
      return;
    }
    if (isAdminView) {
      alert("Admin view is read-only. Marks cannot be saved here.");
      return;
    }

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
      mainQuestions.forEach((mq) =>
        mq.subQuestions.forEach((sq) => {
          const key = `${mq.label}.${sq.label}`;
          const mk = marks[marksKey(s.rollNo, key)];
          marksMap[key] = typeof mk === "number" ? mk : null;
        })
      );

      return {
        roll_no: Number(s.rollNo),
        absent: s.absent,
        marks: marksMap,
      };
    });

    // Build final payload
    const payload = {
      section_id: selectedSectionId,
      subject_code: subjectCode,
      subject_name: subjectName,
      exam_type: examName,
      semester,
      academic_year: academicYear,
      questions: questionsPayload,
      students: studentsPayload,
      question_rules: questionRules,
    } as any;

    try {
      await saveExamMarks(examId, payload);
      alert("Marks and rules saved to server successfully ✅");
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
        {/* Show appropriate locked message only to the teacher-owner or when admin locked */}{" "}
        {/* Teacher-only lock messages*/}
        {isFinalized && user?.role === "teacher" && !isAdminView && (
          <div className="mb-4">
            {(() => {
              // normalize ids to numbers or null
              const lockedBy =
                exam?.locked_by == null ? null : Number(exam.locked_by);
              const createdBy =
                exam?.created_by == null ? null : Number(exam.created_by);
              const myId = user?.id == null ? null : Number(user.id);

              // teacher locked it during this session
              if (iFinalized) return true;

              // if locked_by is present, teacher locked only if locked_by === myId
              if (lockedBy !== null) return lockedBy === myId;

              // fallback for older records: if locked_by missing, assume teacher locked if created_by matches
              if (createdBy !== null) return createdBy === myId;

              return false;
            })() ? (
              <div className="bg-red-100 text-red-900 border border-red-200 p-3 rounded-md font-semibold">
                You have submitted and cannot re-edit. Contact admin.
              </div>
            ) : (
              <div className="bg-yellow-900/80 text-yellow-100 border border-yellow-700 p-3 rounded-md font-semibold">
                Admin has locked the exam. Kindly contact admin to unlock.
              </div>
            )}
          </div>
        )}
        {/* Admin view → show teacher-submitted banner ONLY if teacher actually finalized */}
        {isFinalized &&
          isAdminView &&
          (() => {
            const lockedBy =
              exam?.locked_by == null ? null : Number(exam.locked_by);
            const createdBy =
              exam?.created_by == null ? null : Number(exam.created_by);
            return lockedBy !== null &&
              createdBy !== null &&
              lockedBy === createdBy ? (
              <div className="bg-blue-900/40 text-blue-200 px-3 py-2 rounded text-xs">
                Exam has been final submitted by the teacher.
              </div>
            ) : null;
          })()}
        {error && <p className="text-red-500">{error}</p>}
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Course code</span>
            <input
              value={subjectCode}
              disabled
              readOnly
              title="Subject details are fixed at exam creation"
              className="w-24 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Course name</span>
            <input
              value={subjectName}
              disabled
              readOnly
              title="Subject details are fixed at exam creation"
              className="w-40 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Exam type</span>
            <select
              value={examName}
              disabled
              title="Exam details are fixed at exam creation"
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
              disabled
              title="Semester is fixed at exam creation"
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

      {/* Summary card */}

      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/80 p-4 max-w-full">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Summary</h3>
            <div className="text-xs text-slate-400 mt-2 space-y-2">
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
                  {mainQuestions.reduce(
                    (s, mq) => s + (mq.subQuestions?.length || 0),
                    0
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="w-[260px]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">Computed grand max</div>
                <div className="text-lg font-semibold text-emerald-300">
                  {computeComputedGrandMax()}
                </div>
              </div>

              <div className="text-right">
                <label className="text-xs text-slate-400 block">
                  Max total (optional)
                </label>
                <input
                  type="number"
                  min={0}
                  value={
                    maxTotalOverride === "" ? "" : String(maxTotalOverride)
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") {
                      setMaxTotalOverride("");
                    } else {
                      // allow fractional? Parse as number. Use Math.max(0, value)
                      const n = Number(v);
                      setMaxTotalOverride(
                        Number.isFinite(n) ? Math.max(0, n) : ""
                      );
                    }
                  }}
                  placeholder="e.g. 100"
                  className="w-full mt-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 text-right"
                  disabled={
                    isAdminView &&
                    false /* optional: keep editable by admin/teacher both */
                  }
                />
              </div>
            </div>

            <div className="mt-3 border-t border-slate-800 pt-3 text-sm">
              <div className="text-xs text-slate-400">Displayed Grand Max</div>
              <div className="font-semibold text-slate-100">
                {displayedGrandMax()}
              </div>
              {maxTotalOverride !== "" && (
                <div className="text-xs text-slate-500 mt-1">
                  (capped by entered max: {maxTotalOverride})
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-slate-300">Section</label>
        {!isAdminView && (
          <select
            value={selectedSectionId ?? ""}
            onChange={handleSectionSelect}
            className="rounded bg-slate-900 border border-slate-700 px-3 py-1 text-sm"
          >
            <option value="">-- Select section --</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.section_name ?? `Section ${s.id}`} ({s.roll_start}-
                {s.roll_end})
              </option>
            ))}
          </select>
        )}

        <button
          className={`ml-2 text-xs px-2 py-1 rounded text-white ${
            isAdmin || disabled
              ? "bg-slate-700 cursor-not-allowed opacity-60"
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
          onClick={() => {
            if (isAdmin || disabled) {
              alert(
                disabled
                  ? "This exam is locked by admin."
                  : "Admins cannot create sections from this view."
              );
              return;
            }
            setCreatingSection(true);
          }}
          disabled={isAdmin || disabled}
          title={
            isAdmin
              ? "Admins cannot create sections"
              : disabled
              ? "Exam is locked by admin"
              : "Create a new section"
          }
        >
          Create Section
        </button>
      </div>

      {creatingSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-slate-900 p-4 rounded max-w-sm w-full">
            <h3 className="text-white font-semibold">Create section</h3>

            <div className="mt-2 space-y-2">
              <input
                placeholder="Section name (A)"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                className="w-full p-2 bg-slate-800 rounded border border-slate-700"
              />
              <input
                placeholder="Roll start (e.g. 101)"
                value={newRollStart}
                onChange={(e) => setNewRollStart(e.target.value)}
                className="w-full p-2 bg-slate-800 rounded border border-slate-700"
                type="number"
                min={0}
              />
              <input
                placeholder="Roll end (e.g. 156)"
                value={newRollEnd}
                onChange={(e) => setNewRollEnd(e.target.value)}
                className="w-full p-2 bg-slate-800 rounded border border-slate-700"
                type="number"
                min={0}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setCreatingSection(false)}
                  className="px-3 py-1 border rounded"
                >
                  Cancel
                </button>

                <button
                  onClick={async () => {
                    // compute isAdmin again in case scope differs
                    const adminQuery2 =
                      new URLSearchParams(window.location.search).get(
                        "adminView"
                      ) === "1";
                    const isAdmin2 =
                      typeof isAdminView !== "undefined"
                        ? (isAdminView as boolean)
                        : adminQuery2;
                    if (isAdmin2) {
                      alert("Admins cannot create sections.");
                      setCreatingSection(false);
                      return;
                    }

                    try {
                      const payload = {
                        exam_id: examId,
                        section_name: newSectionName || null,
                        roll_start: Number(newRollStart),
                        roll_end: Number(newRollEnd),
                      };

                      const r = await api.post("/exams/sections", payload);
                      // refresh sections and auto-select the newly created one
                      setSections((prev) => [...prev, r.data]);
                      setSelectedSectionId(r.data.id);

                      // auto-generate rows for the newly created section
                      try {
                        const rs = Number(
                          r.data.roll_start ?? r.data.rollStart ?? 0
                        );
                        const re = Number(
                          r.data.roll_end ?? r.data.rollEnd ?? 0
                        );
                        if (
                          Number.isFinite(rs) &&
                          Number.isFinite(re) &&
                          rs <= re
                        ) {
                          const generated = generateStudentsFromRange(rs, re);
                          setStudents(generated);
                        }
                      } catch (ex) {
                        console.warn(
                          "Failed to auto-generate students for new section",
                          ex
                        );
                      }

                      setCreatingSection(false);
                    } catch (err: any) {
                      alert(
                        err?.response?.data?.detail ||
                          "Failed to create section"
                      );
                    }
                  }}
                  className="px-3 py-1 bg-emerald-600 text-white rounded"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controls: roll-range / add single student / add main question */}
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_320px]">
        {/* Left column (Students) */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
          {/* --- Students card (unchanged content) --- */}
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
              title="Add single student"
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
            <form
              onSubmit={handleGenerateRange}
              className="flex gap-2 items-center"
            >
              <div className="flex items-center gap-2">
                <label className="text-[12px]">From</label>
                <input
                  type="number"
                  min={0}
                  value={newRollFrom}
                  onChange={(e) => setNewRollFrom(e.target.value)}
                  className="w-24 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                  disabled={isAdminView || disabled}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[12px]">To</label>
                <input
                  type="number"
                  min={0}
                  value={newRollTo}
                  onChange={(e) => setNewRollTo(e.target.value)}
                  className="w-24 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                  disabled={isAdminView || disabled}
                />
              </div>

              <button
                type="submit"
                title="Generate students in range"
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

        {/* Middle column (Add main question) */}
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
              title="Add main question"
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

        {/* Right column: Question rules (moved here in place of summary) */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <h3 className="text-sm font-semibold text-slate-100">
            Question rules
          </h3>
          <div className="text-xs text-slate-400 mt-2">
            Apply "answer any N out of K" for a main question — the system will
            count the highest N sub-marks when computing totals.
          </div>

          <div className="mt-3 space-y-2">
            <div className="flex gap-2 items-center">
              <label className="text-xs text-slate-300">Main Q</label>
              <select
                value={mqRuleMain}
                onChange={(e) => setMqRuleMain(e.target.value)}
                className="rounded bg-slate-900 border border-slate-700 px-2 py-1 text-xs"
              >
                <option value="">-- select main question --</option>
                {mainQuestions.map((mq) => (
                  <option key={mq.label} value={mq.label}>
                    {mq.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 items-center">
              <label className="text-xs text-slate-300">Min to count (N)</label>
              <input
                type="number"
                min={1}
                value={mqRuleMin}
                onChange={(e) => setMqRuleMin(Number(e.target.value))}
                className="w-20 rounded bg-slate-900 border border-slate-700 px-2 py-1 text-xs"
              />
              <label className="text-xs text-slate-300">Out of (K)</label>
              <input
                type="number"
                min={1}
                value={mqRuleOutOf}
                onChange={(e) => setMqRuleOutOf(Number(e.target.value))}
                className="w-20 rounded bg-slate-900 border border-slate-700 px-2 py-1 text-xs"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (isAdminView || disabled) return;

                  if (!mqRuleMain) {
                    alert("Please pick a main question first.");
                    return;
                  }
                  const mq = mainQuestions.find((x) => x.label === mqRuleMain);
                  if (!mq) {
                    alert("Selected main question not found.");
                    return;
                  }
                  const K = Math.max(1, Math.floor(mqRuleOutOf));
                  const N = Math.max(1, Math.floor(mqRuleMin));
                  if (
                    N > mq.subQuestions.length ||
                    K > mq.subQuestions.length
                  ) {
                    if (
                      !confirm(
                        `You set N=${N}, K=${K} but this main question has ${mq.subQuestions.length} sub-questions. Proceed?`
                      )
                    ) {
                      return;
                    }
                  }

                  // apply locally (existing function you already have)
                  applyQuestionRuleLocally(mqRuleMain, N, K);

                  // reset inputs
                  setMqRuleMain("");
                  setMqRuleMin(1);
                  setMqRuleOutOf(1);
                }}
                disabled={isAdminView || disabled}
                title={
                  isAdminView
                    ? "Admins cannot apply question rules"
                    : disabled
                    ? "Exam is locked by admin"
                    : undefined
                }
                className={`rounded ${
                  isAdminView || disabled
                    ? "bg-slate-700 cursor-not-allowed opacity-60"
                    : "bg-emerald-600 hover:bg-emerald-700"
                } px-3 py-1 text-xs text-white`}
              >
                Apply
              </button>

              <button
                onClick={() => {
                  setMqRuleMain("");
                  setMqRuleMin(1);
                  setMqRuleOutOf(1);
                }}
                className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-200"
              >
                Reset
              </button>
            </div>

            <div className="mt-3 text-xs text-slate-300">
              <div className="font-semibold text-slate-200 mb-1">
                Active rules
              </div>
              {Object.keys(questionRules).length === 0 ? (
                <div className="text-slate-500">None</div>
              ) : (
                <ul className="space-y-2">
                  {Object.values(questionRules).map((r) => (
                    <li
                      key={r.mainLabel}
                      className="flex items-center justify-between bg-slate-900/70 p-2 rounded"
                    >
                      <div>
                        <span className="font-medium">{r.mainLabel}</span> —
                        count highest{" "}
                        <span className="font-semibold">{r.minToCount}</span>{" "}
                        out of <span className="font-semibold">{r.outOf}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (isAdminView || disabled) return;

                            setQuestionRules((prev) => {
                              const copy = { ...prev };
                              delete copy[r.mainLabel];
                              return copy;
                            });
                          }}
                          disabled={isAdminView || disabled}
                          title={
                            isAdminView
                              ? "Admins cannot remove question rules"
                              : disabled
                              ? "Exam is locked by admin"
                              : "Remove rule"
                          }
                          className={`text-xs rounded px-2 py-0.5 ${
                            isAdminView || disabled
                              ? "bg-slate-700 cursor-not-allowed opacity-60"
                              : "bg-rose-600"
                          } text-white`}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Marks table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 overflow-x-auto shadow-lg shadow-slate-900/40">
        <table className="min-w-full text-xs">
          <thead>
            {(() => {
              // --- build groups (single source of truth) ---
              const groups: Array<{
                main: string;
                type: "sub" | "total";
                label?: string;
                maxMarks?: number;
                isLastSubForMain?: boolean;
              }> = [];

              mainQuestions.forEach((mq) => {
                const subs = mq.subQuestions || [];
                subs.forEach((sq, idx) => {
                  groups.push({
                    main: mq.label,
                    type: "sub",
                    label: sq.label,
                    maxMarks: sq.maxMarks,
                    isLastSubForMain: idx === subs.length - 1,
                  });
                });
                groups.push({ main: mq.label, type: "total" });
              });

              // compute span per main for top header
              const spanByMain = new Map<string, number>();
              mainQuestions.forEach((mq) => {
                spanByMain.set(mq.label, (mq.subQuestions?.length ?? 0) + 1);
              });

              return (
                <>
                  {/* TOP ROW */}
                  <tr className="border-b border-slate-800 text-slate-300">
                    <th rowSpan={2} className="px-3 py-2 text-left font-medium">
                      Roll no
                    </th>
                    <th
                      rowSpan={2}
                      className="px-3 py-2 text-center font-medium"
                    >
                      Absent
                    </th>

                    {mainQuestions.map((mq) => {
                      const span = spanByMain.get(mq.label) ?? 1;
                      const rule = questionRules[mq.label];
                      return (
                        <th
                          key={`group-${mq.label}`}
                          colSpan={span}
                          className="px-2 py-2 text-center align-middle"
                        >
                          <div className="flex flex-col items-center justify-center gap-1">
                            <div className="text-xs font-semibold text-slate-200">
                              {mq.label}
                            </div>
                            {rule ? (
                              <div className="inline-flex items-center rounded-full bg-sky-600/90 px-2 py-0.5 text-[11px] font-semibold text-white">
                                any {rule.minToCount} of {rule.outOf}
                              </div>
                            ) : (
                              <div style={{ height: 22 }} />
                            )}
                          </div>
                        </th>
                      );
                    })}

                    <th
                      rowSpan={2}
                      className="px-3 py-2 text-center font-bold text-emerald-300"
                    >
                      Grand Total
                    </th>
                  </tr>

                  {/* SECOND ROW: render the groups in the exact order */}
                  <tr className="border-b border-slate-800 text-slate-300">
                    {groups.map((g, idx) => {
                      if (g.type === "sub") {
                        const mqLabel = g.main;
                        const sqLabel = g.label!;
                        const maxMarks = g.maxMarks ?? 0;
                        const isLast = !!g.isLastSubForMain;
                        return (
                          <th
                            key={`${mqLabel}.${sqLabel}-${idx}`}
                            className="px-2 py-2 text-center font-medium"
                          >
                            <div className="flex items-center justify-center gap-2">
                              <div className="flex flex-col items-center">
                                <div className="font-semibold text-slate-200">
                                  {mqLabel}.{sqLabel}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  /{maxMarks}
                                </div>
                              </div>

                              {isLast && !isAdminView && !disabled && (
                                <button
                                  type="button"
                                  onClick={() => addSubQuestionToMain(mqLabel)}
                                  className="ml-2 rounded px-1 py-0.5 bg-slate-800 text-slate-200 text-xs"
                                  title={`Add ${mqLabel}.${String.fromCharCode(
                                    sqLabel.charCodeAt(0) + 1
                                  )}`}
                                >
                                  +
                                </button>
                              )}
                            </div>
                          </th>
                        );
                      }

                      // total column
                      return (
                        <th
                          key={`${g.main}.Total-${idx}`}
                          className="px-3 py-2 text-center font-medium"
                        >
                          <div className="text-slate-200 font-semibold">
                            {g.main}.Total
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </>
              );
            })()}
          </thead>

          <tbody>
            {(() => {
              // build groups again — must match header exactly (same logic)
              const groups: Array<{
                main: string;
                type: "sub" | "total";
                label?: string;
                maxMarks?: number;
                isLastSubForMain?: boolean;
              }> = [];
              mainQuestions.forEach((mq) => {
                const subs = mq.subQuestions || [];
                subs.forEach((sq, idx) => {
                  groups.push({
                    main: mq.label,
                    type: "sub",
                    label: sq.label,
                    maxMarks: sq.maxMarks,
                    isLastSubForMain: idx === subs.length - 1,
                  });
                });
                groups.push({ main: mq.label, type: "total" });
              });

              return students.map((s, rowIdx) => (
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

                  {/* Render each column according to groups array */}
                  {groups.map((g, colIdx) => {
                    if (g.type === "sub") {
                      const keyLabel = `${g.main}.${g.label}`;
                      const key = marksKey(s.rollNo, keyLabel);
                      const value = marks[key];
                      const mqObj = mainQuestions.find(
                        (m) => m.label === g.main
                      )!;
                      const sqObj = mqObj.subQuestions.find(
                        (sq) => sq.label === g.label
                      );
                      const maxMarks = sqObj?.maxMarks ?? g.maxMarks ?? 0;

                      return (
                        <td
                          key={`${s.id}-${keyLabel}-${colIdx}`}
                          className="px-2 py-1 text-center"
                        >
                          <input
                            type="number"
                            step="0.25"
                            min={0}
                            max={maxMarks}
                            value={
                              value === "" || value === undefined ? "" : value
                            }
                            onChange={(e) =>
                              handleSubMarkChange(
                                s.rollNo,
                                g.main,
                                g.label!,
                                maxMarks,
                                e.target.value
                              )
                            }
                            disabled={
                              isAdminView ||
                              !!s.absent ||
                              isFrozen ||
                              isFinalized
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
                    }

                    // main total column
                    const mainQ = mainQuestions.find(
                      (m) => m.label === g.main
                    )!;
                    const mainTotal = s.absent
                      ? "AB"
                      : mainTotalForStudent(s.rollNo, mainQ);
                    return (
                      <td
                        key={`${s.id}-${g.main}.total-${colIdx}`}
                        className="px-3 py-2 text-center font-semibold text-slate-100"
                      >
                        {mainTotal}
                      </td>
                    );
                  })}

                  {/* Grand total */}
                  <td className="px-3 py-2 text-center font-bold text-emerald-400">
                    {s.absent ? "AB" : grandTotalForStudent(s.rollNo)}
                  </td>
                </tr>
              ));
            })()}
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
              title="Save marks to server"
              disabled={
                !examId ||
                examId <= 0 ||
                disabled ||
                (!isAdminView &&
                  sections &&
                  sections.length > 0 &&
                  !selectedSectionId)
              }
              className={
                "rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium " +
                (examId && examId > 0
                  ? "bg-green-500 text-slate-100 hover:bg-green-700"
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
            title="Export the marks table as CSV"
            className="rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-600 shadow shadow-indigo-500/40"
          >
            Export CSV
          </button>

          <div className="mt-3">
            <button
              onClick={handleFinalize}
              disabled={disabled || isFinalized}
              title="Finalize the exam to lock it for further edits"
              className={
                "w-full text-center font-bold rounded px-4 py-3 border-2 border-red-700 " +
                (disabled || isFinalized
                  ? "opacity-50 cursor-not-allowed bg-red-600/60 text-white"
                  : "bg-red-600 text-white hover:bg-red-700")
              }
            >
              Final Submit — Lock exam (cannot re-edit)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
