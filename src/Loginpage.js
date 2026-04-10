import { useState } from "react";

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbyqaBYwAe6nWtp29xrOTT-nWQYEfwILpaSJ31VOtAv7cWdvexdy-r9-edPj7vSMxTvW/exec";

// ─── PALETTE (matches dashboard) ─────────────────────────────────────────────
const P = {
  dark:   "#1e3a5f",
  blue1:  "#1565C0",
  blue2:  "#1976D2",
  blue3:  "#1E88E5",
  muted:  "#6b7a8d",
  bg:     "#f0f4f8",
  card:   "#ffffff",
  border: "#dde3ea",
  red:    "#e53935",
  green:  "#2e7d32",
};

export default function LoginPage({ onLoginSuccess }) {
  const [movateId,  setMovateId]  = useState("");
  const [password,  setPassword]  = useState("");
  const [showPass,  setShowPass]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [fieldErr,  setFieldErr]  = useState({ movateId: false, password: false });

  // ── Validate fields client-side first ────────────────────────────────────
  const validate = () => {
    const errs = { movateId: !movateId.trim(), password: !password.trim() };
    setFieldErr(errs);
    if (errs.movateId || errs.password) {
      setError("Movate ID and Password are required.");
      return false;
    }
    setError("");
    return true;
  };

  // ── Submit → call GAS login action ───────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError("");

    try {
      const url = `${GAS_URL}?action=login&movateid=${encodeURIComponent(movateId.trim())}&password=${encodeURIComponent(password.trim())}`;
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`Server error: HTTP ${res.status}`);
      const json = await res.json();

      if (json.success) {
        // Store session (non-sensitive flag only — no password stored)
        sessionStorage.setItem("movate_auth", JSON.stringify({
          movateId: movateId.trim(),
          name:     json.name || movateId.trim(),
          loginAt:  new Date().toISOString(),
        }));
        onLoginSuccess({ movateId: movateId.trim(), name: json.name || movateId.trim() });
      } else {
        setError(json.message || "Invalid Movate ID or Password. Please try again.");
      }
    } catch (err) {
      setError("Unable to connect. Please check your network and try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (hasErr) => ({
    width: "100%",
    padding: "11px 14px",
    border: `1.5px solid ${hasErr ? P.red : P.border}`,
    borderRadius: 8,
    fontSize: 13,
    color: P.dark,
    outline: "none",
    background: hasErr ? "#fff8f8" : "#fff",
    transition: "border-color .2s, box-shadow .2s",
    boxSizing: "border-box",
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(135deg, #0d2137 0%, #1e3a5f 45%, #1565C0 100%)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Segoe UI', sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Decorative background circles */}
      <div style={{ position:"absolute", width:500, height:500, borderRadius:"50%",
        background:"rgba(255,255,255,.03)", top:-150, right:-100, pointerEvents:"none" }} />
      <div style={{ position:"absolute", width:350, height:350, borderRadius:"50%",
        background:"rgba(255,255,255,.03)", bottom:-100, left:-80, pointerEvents:"none" }} />
      <div style={{ position:"absolute", width:200, height:200, borderRadius:"50%",
        background:"rgba(21,101,192,.2)", top:"30%", right:"10%", pointerEvents:"none" }} />

      {/* Login Card */}
      <div style={{
        background: P.card,
        borderRadius: 16,
        padding: "40px 36px",
        width: "100%",
        maxWidth: 420,
        boxShadow: "0 24px 64px rgba(0,0,0,.35)",
        position: "relative",
        zIndex: 1,
      }}>

        {/* Logo / Brand */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 14,
            background: `linear-gradient(135deg, ${P.dark}, ${P.blue2})`,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, marginBottom: 14,
            boxShadow: "0 8px 24px rgba(21,101,192,.35)",
          }}>📊</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: P.dark, letterSpacing: .2 }}>
            Employee Utilization
          </div>
          <div style={{ fontSize: 12, color: P.muted, marginTop: 4 }}>
            Sign in with your Movate credentials
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} noValidate>

          {/* Movate ID */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display:"block", fontSize:11, fontWeight:700,
              color: P.muted, textTransform:"uppercase", letterSpacing:.6, marginBottom:6 }}>
              Movate ID <span style={{ color:P.red }}>*</span>
            </label>
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)",
                fontSize:16, pointerEvents:"none" }}>🪪</span>
              <input
                type="text"
                placeholder="Enter your Movate ID"
                value={movateId}
                onChange={(e) => { setMovateId(e.target.value); setFieldErr(f=>({...f,movateId:false})); setError(""); }}
                style={{ ...inputStyle(fieldErr.movateId), paddingLeft: 38 }}
                onFocus={(e) => (e.target.style.borderColor = P.blue2)}
                onBlur={(e)  => (e.target.style.borderColor = fieldErr.movateId ? P.red : P.border)}
                autoComplete="username"
                autoFocus
              />
            </div>
            {fieldErr.movateId && (
              <div style={{ fontSize:10, color:P.red, marginTop:4 }}>Movate ID is required.</div>
            )}
          </div>

          {/* Password */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display:"block", fontSize:11, fontWeight:700,
              color: P.muted, textTransform:"uppercase", letterSpacing:.6, marginBottom:6 }}>
              Password <span style={{ color:P.red }}>*</span>
            </label>
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)",
                fontSize:16, pointerEvents:"none" }}>🔒</span>
              <input
                type={showPass ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFieldErr(f=>({...f,password:false})); setError(""); }}
                style={{ ...inputStyle(fieldErr.password), paddingLeft:38, paddingRight:42 }}
                onFocus={(e) => (e.target.style.borderColor = P.blue2)}
                onBlur={(e)  => (e.target.style.borderColor = fieldErr.password ? P.red : P.border)}
                autoComplete="current-password"
              />
              <span onClick={() => setShowPass(!showPass)} style={{
                position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
                cursor:"pointer", fontSize:16, userSelect:"none", color:P.muted,
              }}>{showPass ? "🙈" : "👁️"}</span>
            </div>
            {fieldErr.password && (
              <div style={{ fontSize:10, color:P.red, marginTop:4 }}>Password is required.</div>
            )}
          </div>

          {/* Error banner */}
          {error && !fieldErr.movateId && !fieldErr.password && (
            <div style={{
              background:"#fdecea", border:`1px solid #ffcdd2`, borderRadius:8,
              padding:"10px 14px", marginBottom:18, display:"flex", alignItems:"center", gap:8,
            }}>
              <span style={{ fontSize:16 }}>⚠️</span>
              <span style={{ fontSize:12, color:"#c62828", fontWeight:500 }}>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading} style={{
            width: "100%",
            padding: "12px",
            borderRadius: 8,
            border: "none",
            background: loading
              ? "#90caf9"
              : `linear-gradient(135deg, ${P.blue1}, ${P.blue3})`,
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            letterSpacing: .3,
            boxShadow: loading ? "none" : "0 4px 16px rgba(21,101,192,.4)",
            transition: "all .2s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}>
            {loading ? (
              <>
                <span style={{
                  width:16, height:16,
                  border:"2.5px solid rgba(255,255,255,.4)",
                  borderTop:"2.5px solid #fff",
                  borderRadius:"50%",
                  animation:"spin .7s linear infinite",
                  display:"inline-block",
                }} />
                Verifying…
              </>
            ) : (
              "Sign In →"
            )}
          </button>
        </form>

        {/* Footer */}
        <div style={{ textAlign:"center", marginTop:20,
          fontSize:11, color:"#bbb", borderTop:`1px solid ${P.bg}`, paddingTop:16 }}>
          For access issues, contact your HR administrator
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #b0bec5; }
      `}</style>
    </div>
  );
}