// src/services/api.ts
import axios from "axios";

const API_BASE =import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_BASE,
 withCredentials: true,
});

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    localStorage.setItem("gf_token", token);
  } else {
    delete api.defaults.headers.common["Authorization"];
    localStorage.removeItem("gf_token");
  }
}

const token = localStorage.getItem("gf_token");
if (token) {
  api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
}
