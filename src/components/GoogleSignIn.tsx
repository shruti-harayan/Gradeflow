// frontend/src/components/GoogleSignIn.tsx
import React from "react";
import { GoogleLogin } from "@react-oauth/google";
import type { CredentialResponse } from "@react-oauth/google";
import axios from "axios";

type Props = { onSuccess?: () => void };

export default function GoogleSignIn({ onSuccess }: Props) {
  async function handleCredentialResponse(response: CredentialResponse | null) {
    if (!response || !response.credential) return;
    try {
      // Send id_token (credential) to backend for verification & sign-in
      const res = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL || process.env.REACT_APP_BACKEND_URL}/auth/google`,
        { id_token: response.credential },
        { withCredentials: true }
      );

      // res.data might contain your app JWT or user info
      console.log("Backend response", res.data);
      onSuccess?.();
    } catch (err) {
      console.error("Google sign-in backend error", err);
    }
  }

  return (
    <div>
      <GoogleLogin
        onSuccess={(credentialResponse) => handleCredentialResponse(credentialResponse)}
        onError={() => {
          console.error("Google Login Failed");
        }}
      />
    </div>
  );
}
