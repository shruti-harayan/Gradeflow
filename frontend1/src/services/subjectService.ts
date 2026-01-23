import {api} from "./api";

export type AddSubjectPayload = {
  programme: string;
  semester: number;
  subject_code: string;
  subject_name: string;
};

export async function addSubjectToCatalog(payload: AddSubjectPayload) {
  const res = await api.post("/subjects/catalog", payload);
  return res.data;
}
