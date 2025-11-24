// src/services/authService.ts
import { api, setAuthToken } from "./api";

export type Role = "teacher" | "admin";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export async function login(email: string, password: string) {
  const res = await api.post<TokenResponse>("/auth/login", { email, password });
  setAuthToken(res.data.access_token);
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

export async function loginWithGoogle(id_token: string) {
  const res = await api.post<TokenResponse>("/auth/google", { id_token });
  setAuthToken(res.data.access_token);
  return res.data;
}
