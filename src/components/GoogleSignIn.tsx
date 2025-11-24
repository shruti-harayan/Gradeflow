// frontend/src/components/GoogleSignIn.tsx
import React from "react";
import { GoogleLogin } from "@react-oauth/google";
import type { CredentialResponse } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { loginWithGoogle } from "../services/authService";

export default function GoogleSignIn() {
  const navigate = useNavigate();

  async function handleCredentialResponse(response: CredentialResponse | null) {
    if (!response?.credential) return;
    try {
      const data = await loginWithGoogle(response.credential);
      if (data.user.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("Google sign-in error", err);
      // TODO: show toast / error message
    }
  }

  return (
    <GoogleLogin
      onSuccess={handleCredentialResponse}
      onError={() => console.error("Google Login failed")}
    />
  );
}
