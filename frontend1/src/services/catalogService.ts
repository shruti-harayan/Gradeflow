import {api} from "./api";

export async function fetchProgrammes(): Promise<string[]> {
  const res = await api.get("/subjects/catalog/programmes");
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


export async function fetchValidSemesters(
  programme: string
): Promise<number[]> {
  const res = await api.get("/subjects/catalog/semesters", {
    params: { programme },
  });
  return res.data;
}
