// src/services/examService.ts
import { api } from "./api";

export type ExamType = "Internal" | "External" | "Practical" | "ATKT" | "Other";

export interface ExamCreatePayload {
  subject_code: string;
  subject_name: string;
  exam_type: ExamType;
  semester: number;
  students_count?: number;
  created_at?: string | null;
  is_locked: boolean;
  created_by?: number | null;
}

export interface ExamOut extends ExamCreatePayload {
  id: number;
}

export interface QuestionPayload {
  label: string;
  max_marks: number;
}

export interface StudentMarksPayload {
  roll_no: string;
  name: string;
  absent: boolean;
  marks: Record<string, number | null>;
}

export interface SaveMarksPayload {
  subject_code: string;
  subject_name: string;
  exam_type: string;
  semester: number;
  questions: QuestionPayload[];
  students: StudentMarksPayload[];
}

export interface QuestionOut {
  id: number;
  label: string;
  max_marks: number;
}

export interface StudentOut {
  id: number;
  roll_no: string;
  name: string;
  absent: boolean;
}

export interface MarkOut {
  student_id: number;
  question_id: number;
  marks: number | null;
}

export interface ExamMarksOut {
  exam: ExamOut;
  questions: QuestionOut[];
  students: StudentOut[];
  marks: MarkOut[];
}

export async function getExamMarks(examId: number) {
  const res = await api.get<ExamMarksOut>(`/exams/${examId}/marks`);
  return res.data;
}

export async function getExams() {
  const res = await api.get<ExamOut[]>("/exams");
  return res.data;
}

export async function createExam(payload: ExamCreatePayload) {
  const res = await api.post<ExamOut>("/exams", payload);
  return res.data;
}

export async function saveExamMarks(examId: number, payload: SaveMarksPayload) {
  const res = await api.post(`/exams/${examId}/marks`, payload);
  return res.data;
}


export async function finalizeExam(examId: number) {
  const resp = await api.post(`/exams/${examId}/finalize`);
  return resp.data;
}


export async function downloadExamCsv(examId: number, filename?: string) {
  const res = await api.get(`/exams/${examId}/export`, {
    responseType: "blob",
  });

  // If filename not provided, try to use server-provided filename from headers
  let finalName = filename;
  const cd = res.headers?.["content-disposition"] as string | undefined;
  if (!finalName && cd) {
    const match = cd.match(/filename="?(.+?)"?($|;)/);
    if (match) finalName = match[1];
  }
  // Fallback name when nothing else
  if (!finalName) finalName = `exam_${examId}_marks.csv`;

  const blob = new Blob([res.data], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = finalName;
  link.click();
  window.URL.revokeObjectURL(url);
}
