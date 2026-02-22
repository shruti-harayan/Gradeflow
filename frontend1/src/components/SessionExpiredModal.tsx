import { useSessionExpired } from "../context/SessionExpiredContext";

export default function SessionExpiredModal() {
  const { show, close } = useSessionExpired();

  if (!show) return null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.4)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999
    }}>
      <div style={{
        background: "black",
        padding: 24,
        borderRadius: 10,
        width: 340,
        textAlign: "center",
        boxShadow: "0 8px 25px rgba(0,0,0,0.2)"
      }}>
        <h3>⚠ Session expired !!</h3>
        <p>Your login session has expired. Please login again to continue.</p>
        <button
          onClick={() => {
            close();
            window.location.href = "/login";
          }}
          style={{
            marginTop: 12,
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: "#6d28d9",
            color: "white",
            cursor: "pointer"
          }}
        >
          Go to Login
        </button>
      </div>
    </div>
  );
}