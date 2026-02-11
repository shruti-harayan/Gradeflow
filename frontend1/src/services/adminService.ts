import { api } from "./api";

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export async function fetchAdmins(): Promise<AdminUser[]> {
  const res = await api.get("/auth/admin/list");
  return res.data;
}

export async function deleteAdmin(userId: number) {
  const res = await api.delete(`/auth/admin/users/${userId}`);
  return res.data;
}
