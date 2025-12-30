// src/components/GooglePopupSignIn.tsx
import React from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { googleSignIn } from "../services/authService"; // your existing function
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function GooglePopupSignIn() {
  const navigate = useNavigate();
  const { loginFromResponse } = useAuth();
  
  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        console.log("google popup tokenResponse:", tokenResponse);

        // tokenResponse may contain `credential` (id_token) or `access_token`
        const id_token = (tokenResponse as any).credential;
        const access_token = (tokenResponse as any).access_token;

        if (!id_token && !access_token) {
          throw new Error(
            "No id_token or access_token returned by Google popup"
          );
        }

        // Prefer id_token if available (server verifies it), otherwise send access_token
        const payload = id_token ? { id_token } : { access_token };

        const resp = await googleSignIn(payload); // authService adapts both shapes
        console.log("backend google signin response:", resp.data);

        // Save token/user in AuthContext (use loginFromResponse)
        // assuming you imported and used useAuth
        loginFromResponse(resp.data);

        // redirect based on server-returned role
        const role = resp.data.user?.role;
        if (role === "admin") navigate("/admin");
        else navigate("/dashboard");
      } catch (err) {
        console.error("Backend google sign-in failed", err);
        alert("Google sign-in failed (server). Check console.");
      }
    },

    onError: () => {
      console.error("Google popup login failed");
      alert("Google login failed. See console for details.");
    },
    // flow option may depend on library version; implicit/popup is default
  });

  return (
    <button
  type="button"
  onClick={() => login()}
  className="
    w-full flex items-center justify-center gap-3
    bg-white text-gray-700 font-medium
    border border-gray-300 
    rounded-md py-2.5 
    shadow-sm
    hover:bg-gray-50 hover:shadow-md
    active:scale-[0.98]
    transition-all
  "
>
  <img
    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
    alt="Google"
    className="w-5 h-5"
  />
  <span className="text-sm">Sign in with Google</span>
</button>

  );
}
