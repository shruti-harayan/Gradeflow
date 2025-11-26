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


export async function googleSignIn(payload: { id_token?: string; access_token?: string }) {
  // prefer id_token, otherwise access_token
  const body: Record<string,string> = {};
  if (payload.id_token) body.id_token = payload.id_token;
  else if (payload.access_token) body.access_token = payload.access_token;
  else throw new Error("googleSignIn requires id_token or access_token");

  return api.post("/auth/google", body);
}

