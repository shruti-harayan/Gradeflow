import React from "react";

type SessionContextType = {
  show: boolean;
  trigger: () => void;
  close: () => void;
};

const SessionExpiredContext = React.createContext<SessionContextType | null>(
  null,
);

export const SessionExpiredProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [show, setShow] = React.useState(false);
  const trigger = () => setShow(true);
  const close = () => setShow(false);

  React.useEffect(() => {
    const handler = () => setShow(true);
    window.addEventListener("session-expired", handler);
    return () => window.removeEventListener("session-expired", handler);
  }, []);
  
  return (
    <SessionExpiredContext.Provider value={{ show, trigger, close }}>
      {children}
    </SessionExpiredContext.Provider>
  );
};

export function useSessionExpired() {
  const ctx = React.useContext(SessionExpiredContext);
  if (!ctx) throw new Error("useSessionExpired must be used within provider");
  return ctx;
}
