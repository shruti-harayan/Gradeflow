// src/services/authService.ts
import { api, setAuthToken } from "./api";

export type Role = "teacher" | "admin";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  is_frozen?: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

function storeAuth(data: TokenResponse) {
  setAuthToken(data.access_token);
  localStorage.setItem("gf_user", JSON.stringify(data.user));
}

export async function login(email: string, password: string) {
  const res = await api.post<TokenResponse>("/auth/login", { email, password });
  storeAuth(res.data);
  return res.data;
}

export async function signup(
  name: string,
  email: string,
  password: string,
  role: Role
) {
  const res = await api.post<User>("/auth/signup", {
    name,
    email,
    password,
    role,
  });
  return res.data;
}
