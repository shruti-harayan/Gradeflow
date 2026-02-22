import axios from "axios";

const API_BASE =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

function triggerSessionExpired() {
  window.dispatchEvent(new Event("session-expired"));
}  

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
});

// ---------- TOKEN HELPERS ----------
export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    localStorage.setItem("gf_token", token);
  } else {
    delete api.defaults.headers.common["Authorization"];
    localStorage.removeItem("gf_token");
  }
}

// restore token on reload
const token = localStorage.getItem("gf_token");
if (token) {
  api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
}

// ---------- SILENT REFRESH LOGIC ----------

let isRefreshing = false;
let subscribers: ((token: string) => void)[] = [];

function subscribe(cb: (token: string) => void) {
  subscribers.push(cb);
}

function notify(token: string) {
  subscribers.forEach((cb) => cb(token));
  subscribers = [];
}

function logoutUser() {
  localStorage.removeItem("gf_token");
  localStorage.removeItem("gf_refresh");
  localStorage.removeItem("gf_user");
  triggerSessionExpired();
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // prevent infinite loop
    if (originalRequest._retry) {
      logoutUser();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    const refreshToken = localStorage.getItem("gf_refresh");
    if (!refreshToken) {
      logoutUser();
      return Promise.reject(error);
    }

    // if another refresh is already happening, wait for it
    if (isRefreshing) {
      return new Promise((resolve) => {
        subscribe((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(api(originalRequest));
        });
      });
    }

    isRefreshing = true;

    try {
      const res = await axios.post(`${API_BASE}/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const newAccess = res.data.access_token;

      setAuthToken(newAccess);
      notify(newAccess);

      originalRequest.headers.Authorization = `Bearer ${newAccess}`;
      return api(originalRequest);
    } catch (err) {
      logoutUser();
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }
);