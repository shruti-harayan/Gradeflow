import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./context/AuthContext";
import { SessionExpiredProvider } from "./context/SessionExpiredContext";
import SessionExpiredModal from "./components/SessionExpiredModal";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SessionExpiredProvider>
          <App />
          <SessionExpiredModal />
        </SessionExpiredProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
