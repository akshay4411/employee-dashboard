import { useState, useEffect } from "react";
import EmployeeDashboard from "./EmployeeDashboard";
import LoginPage from "./Loginpage";

export default function App() {
  const [user, setUser] = useState(null);   // null = not logged in
  const [ready, setReady] = useState(false); // prevents flash before session check

  // ── Restore session from sessionStorage on page load ──────────────────────
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("movate_auth");
      if (stored) {
        const parsed = JSON.parse(stored);
        // Accept session only if it was created in the last 8 hours
        const loginAt  = new Date(parsed.loginAt).getTime();
        const eightHrs = 8 * 60 * 60 * 1000;
        if (Date.now() - loginAt < eightHrs) {
          setUser(parsed);
        } else {
          sessionStorage.removeItem("movate_auth"); // expired
        }
      }
    } catch (_) {
      sessionStorage.removeItem("movate_auth");
    }
    setReady(true);
  }, []);

  const handleLoginSuccess = (userData) => setUser(userData);

  const handleLogout = () => {
    sessionStorage.removeItem("movate_auth");
    setUser(null);
  };

  // Avoid flashing login page before session is checked
  if (!ready) return null;

  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return <EmployeeDashboard user={user} onLogout={handleLogout} />;
}