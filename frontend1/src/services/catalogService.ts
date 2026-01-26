import {api} from "./api";

export type Programme = {
  id: number;
  name: string;
  total_semesters: number;
  semester_start: number;
};

export async function fetchProgrammes(): Promise<Programme[]> {
  const res = await api.get<Programme[]>("/subjects/catalog/programmes");
  return res.data;
}

export async function searchCatalogSubjects(query: string) {
  const res = await api.get("/subjects/catalog/search", {
    params: { q: query },
  });
  return res.data;
}

export async function deleteCatalogSubject(subjectId: number) {
  return api.delete(`/subjects/catalog/${subjectId}`);
}
