// src/services/examService.ts
import { api } from "./api";

export type ExamType = "Internal" | "External" | "Practical" | "ATKT" | "Other";

export interface ExamCreatePayload {
  subject_code: string;
  subject_name: string;
  exam_type: ExamType;
  semester: number;
  students_count?: number;
}

export interface ExamOut extends ExamCreatePayload {
  id: number;
  created_at?: string;
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


export async function createExam(payload: ExamCreatePayload) {
  const res = await api.post<ExamOut>("/exams", payload);
  return res.data;
}

export async function saveExamMarks(examId: number, payload: SaveMarksPayload) {
  const res = await api.post(`/exams/${examId}/marks`, payload);
  return res.data;
}
