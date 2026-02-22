// src/context/AuthContext.tsx
import React from "react";
import { type User, type TokenResponse } from "../services/authService";
import { setAuthToken } from "../services/api";

type AuthContextType = {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  loading: boolean;
  loginFromResponse: (data: TokenResponse) => void;
  logout: () => void;
};

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = React.useState<User | null>(null);
  const [token, setToken] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshToken, setRefreshToken] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Restore from localStorage on page refresh
    const storedToken = localStorage.getItem("gf_token");
    const storedUser = localStorage.getItem("gf_user");
    const storedRefresh = localStorage.getItem("gf_refresh");

    if (storedRefresh) {
      setRefreshToken(storedRefresh);
    }
    if (storedToken) {
      setToken(storedToken);
      setAuthToken(storedToken);
    } else {
      setAuthToken(null);
    }
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser) as User);
      } catch {
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  function loginFromResponse(data: TokenResponse) {
    const t = data.access_token;
    const r = data.refresh_token;
    const u = data.user;

    localStorage.setItem("gf_token", t);
    localStorage.setItem("gf_refresh", r);
    localStorage.setItem("gf_user", JSON.stringify(u));

    setAuthToken(t);

    setToken(t);
    setRefreshToken(r);
    setUser(u);
  }

  function logout() {
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    setAuthToken(null);

    localStorage.removeItem("gf_token");
    localStorage.removeItem("gf_refresh");
    localStorage.removeItem("gf_user");
  }

  return (
    <AuthContext.Provider
      value={{ user, token, refreshToken, loading, loginFromResponse, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};
export function getRefreshToken() {
  return localStorage.getItem("gf_refresh");
}
export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
