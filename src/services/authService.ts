import axios from "axios";
const BACKEND = import.meta.env.VITE_BACKEND_URL || process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

export async function localLogin(email: string, password: string) {
  const res = await axios.post(`${BACKEND}/auth/login`, { email, password }, { withCredentials: true });
  return res.data;
}
