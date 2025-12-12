// src/services/examService.ts
import { api } from "./api";

export type ExamType = "Internal" | "External" | "Practical" | "ATKT" | "Other";
export type MainQuestionRule = {
  mainLabel?: string;
  minToCount: number;
  outOf: number;
};

export interface ExamCreatePayload {
  subject_code: string;
  subject_name: string;
  exam_type: ExamType;
  semester: number;
  created_at?: string | null;
  is_locked: boolean;
  academic_year: string;
  created_by?: number | null;
  locked_by?: number | null; 
  question_rules?: Record<string, MainQuestionRule> | null;
}

export interface ExamOut extends ExamCreatePayload {
  id: number;
}

export interface QuestionPayload {
  label: string;
  max_marks: number;
}

export interface StudentMarksPayload {
  roll_no: number;
  absent: boolean;
  marks: Record<string, number | null | "">;
}

export interface SaveMarksPayload {
  section_id?: number | null;
  subject_code: string;
  subject_name: string;
  exam_type: string;
  semester: number;
  academic_year?: string | null;
  questions: QuestionPayload[];
  students: StudentMarksPayload[];
  question_rules?: Record<string, MainQuestionRule> | null;
  
}

export interface QuestionOut {
  id: number;
  label: string;
  max_marks: number;
}

export interface StudentOut {
  id: number;
  roll_no: number;
  name?: string | null;
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



export async function getExams(params?: {
  subject_name?: string;
  academic_year?: string;
  creator_id?: string | number;
}) {
  // remove empty params (optional but helpful)
  const p: Record<string, string> = {};
  if (params?.subject_name) p.subject_name = String(params.subject_name);
  if (params?.academic_year) p.academic_year = String(params.academic_year);
  if (params?.creator_id !== undefined && params?.creator_id !== null)
    p.creator_id = String(params.creator_id);

  const resp = await api.get("/exams", { params: p });
  return resp.data;
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

export async function unfinalizeExam(examId: number) {
  // call backend unfinalize endpoint
  const resp = await api.post(`/exams/${examId}/unfinalize`);
  return resp.data;
}

export async function deleteExam(examId: number) {
  return api.delete(`/exams/${examId}`);
}

export async function downloadExamCsv(examId: number, filename?: string) {
  const res = await api.get(`/exams/${examId}/export`, {
    responseType: "blob",
  });

  // Try to use filename from backend
  let finalName = filename;
  const cd = res.headers?.["content-disposition"];
  if (!finalName && cd) {
    const match = cd.match(/filename="?(.+?)"?($|;)/);
    if (match) finalName = match[1];
  }
  if (!finalName) finalName = `exam_${examId}.csv`;

  const blob = new Blob([res.data], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = finalName;
  link.click();
  URL.revokeObjectURL(url);
}
