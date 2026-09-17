import { useState } from "react";

// ─── CONFIG ────────────────────────────────────────────────────────────────

const GAS_URL = "https://script.google.com/macros/s/AKfycbxfVYY72tVANTHlO7iyNn2SfQeH0YQl-d1rsGBZaYJnC5NOiu2oiqsFNlOlCkLjIgyC/exec";

// ─── MOVATE TOKENS ─────────────────────────────────────────────────────────

// Sunset gradient lifted from the Movate mark: red → orange → magenta.

const M = {

  red: "#E5342B",

  orange: "#F7941D",

  pink: "#EC1E79",

  ink: "#1A1B20",

  slate: "#5B5E68",

  hair: "#E7E4E0",

  paper: "#FAF9F7",

  card: "#FFFFFF",

  ok: "#1E8E5A",

};

const GRADIENT = `linear-gradient(100deg, ${M.red} 0%, ${M.orange} 52%, ${M.pink} 100%)`;

const REASON_OPTIONS = ["RAM DOWN", "RESIGNED", "ABSCOND"];

const emptyForm = { movateId: "", name: "", lwd: "", reason: "", project: "", lm: "" };

// ─── Logomark: abstract chevron "M", not a reproduction of the Movate asset ─

function Mark({ size = 30 }) {

  return (
<svg width={size} height={size} viewBox="0 0 40 40" fill="none">
<defs>
<linearGradient id="mkGrad" x1="0" y1="40" x2="40" y2="0">
<stop offset="0%" stopColor={M.red} />
<stop offset="55%" stopColor={M.orange} />
<stop offset="100%" stopColor={M.pink} />
</linearGradient>
</defs>
<path

        d="M3 34 L11 6 L20 24 L29 6 L37 34"

        stroke="url(#mkGrad)"

        strokeWidth="5.5"

        strokeLinecap="round"

        strokeLinejoin="round"

        fill="none"

      />
</svg>

  );

}

function Field({ label, hint, children }) {

  return (
<label style={{ display: "block" }}>
<span style={{ fontSize: 12, fontWeight: 600, color: M.ink, marginBottom: 6, display: "block" }}>

        {label}

        {hint && <span style={{ fontWeight: 400, color: M.slate }}> · {hint}</span>}
</span>

      {children}
</label>

  );

}

function useFocusStyle(base) {

  const [focused, setFocused] = useState(false);

  const style = {

    ...base,

    borderColor: focused ? M.orange : M.hair,

    boxShadow: focused ? `0 0 0 3px ${M.orange}22` : "none",

  };

  return [style, { onFocus: () => setFocused(true), onBlur: () => setFocused(false) }];

}

const BASE_INPUT = {

  width: "100%",

  padding: "10px 12px",

  fontSize: 14,

  border: "1px solid",

  borderRadius: 8,

  outline: "none",

  color: M.ink,

  background: "#fff",

  boxSizing: "border-box",

  transition: "border-color .15s, box-shadow .15s",

  fontFamily: "inherit",

};

function TextInput(props) {

  const [style, handlers] = useFocusStyle(BASE_INPUT);

  return <input {...props} {...handlers} style={style} />;

}

function SelectInput(props) {

  const [style, handlers] = useFocusStyle({ ...BASE_INPUT, cursor: "pointer" });

  return <select {...props} {...handlers} style={style} />;

}

export default function ExitTrackerForm() {

  const [form, setForm] = useState(emptyForm);

  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState(null);

  const [saved, setSaved] = useState(null); // holds the name just saved

  const [btnHover, setBtnHover] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const isValid =

    form.movateId.trim() && form.name.trim() && form.lwd && form.reason &&

    form.project.trim() && form.lm.trim();

  const handleSubmit = async (e) => {

    e.preventDefault();

    if (!isValid || submitting) return;

    setSubmitting(true);

    setError(null);

    try {

      const res = await fetch(GAS_URL, {

        method: "POST",

        headers: { "Content-Type": "text/plain;charset=utf-8" },

        body: JSON.stringify({ type: "addExitRecord", ...form }),

      });

      const json = await res.json();

      if (json.status) {

        setSaved(form.name.trim());

        setForm(emptyForm);

      } else {

        setError(json.message || "Save failed.");

      }

    } catch (err) {

      setError(err.message || "Network error.");

    } finally {

      setSubmitting(false);

    }

  };

  return (
<div

      style={{

        minHeight: "100%",

        background: M.paper,

        padding: "32px 16px",

        fontFamily:

          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",

        display: "flex",

        justifyContent: "center",

      }}
>
<div

        style={{

          width: "100%",

          maxWidth: 460,

          background: M.card,

          borderRadius: 16,

          overflow: "hidden",

          boxShadow: "0 1px 2px rgba(20,20,30,.04), 0 12px 32px -12px rgba(20,20,30,.18)",

          border: `1px solid ${M.hair}`,

        }}
>

        {/* header band */}
<div style={{ padding: "22px 26px 20px", position: "relative", overflow: "hidden" }}>
<div

            style={{

              position: "absolute", top: -40, right: -40, width: 160, height: 160,

              borderRadius: "50%", background: GRADIENT, opacity: 0.08, filter: "blur(2px)",

            }}

          />
<div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
<Mark size={26} />
<span

              style={{

                fontSize: 14, fontWeight: 800, letterSpacing: 0.2,

                backgroundImage: GRADIENT, WebkitBackgroundClip: "text",

                backgroundClip: "text", color: "transparent",

              }}
>

              movate
</span>
</div>
<div style={{ fontSize: 19, fontWeight: 700, color: M.ink, marginTop: 12, position: "relative" }}>

            Exit Record
</div>
<div style={{ fontSize: 13, color: M.slate, marginTop: 2, position: "relative" }}>

            Log a separation for tracking and reporting
</div>
</div>
<div style={{ height: 3, background: GRADIENT }} />

        {/* body */}
<div style={{ padding: 26 }}>

          {saved ? (
<div style={{ textAlign: "center", padding: "18px 4px 6px" }}>
<div

                style={{

                  width: 52, height: 52, borderRadius: "50%", background: GRADIENT,

                  display: "flex", alignItems: "center", justifyContent: "center",

                  margin: "0 auto 16px",

                }}
>
<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
<path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5"

                    strokeLinecap="round" strokeLinejoin="round" />
</svg>
</div>
<div style={{ fontSize: 16, fontWeight: 700, color: M.ink }}>Record saved</div>
<div style={{ fontSize: 13, color: M.slate, marginTop: 4 }}>

                {saved}'s exit has been logged.
</div>
<button

                onClick={() => setSaved(null)}

                style={{

                  marginTop: 20, padding: "9px 18px", borderRadius: 8,

                  border: `1px solid ${M.hair}`, background: "#fff",

                  fontSize: 13, fontWeight: 600, color: M.ink, cursor: "pointer",

                }}
>

                Add another record
</button>
</div>

          ) : (
<form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
<Field label="Movate ID">
<TextInput value={form.movateId} onChange={update("movateId")} placeholder="MOV12345" />
</Field>
<Field label="LWD" hint="last working day">
<TextInput type="date" value={form.lwd} onChange={update("lwd")} />
</Field>
</div>
<Field label="Name">
<TextInput value={form.name} onChange={update("name")} placeholder="Employee name" />
</Field>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
<Field label="Project">
<TextInput value={form.project} onChange={update("project")} placeholder="Project name" />
</Field>
<Field label="LM" hint="line manager">
<TextInput value={form.lm} onChange={update("lm")} placeholder="Manager name" />
</Field>
</div>
<Field label="Reason">
<SelectInput value={form.reason} onChange={update("reason")}>
<option value="">Select reason…</option>

                  {REASON_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
</SelectInput>
</Field>

              {error && (
<div style={{ fontSize: 12, fontWeight: 600, color: M.red, background: "#FDECEA",

                  padding: "9px 12px", borderRadius: 8 }}>

                  {error}
</div>

              )}
<button

                type="submit"

                disabled={!isValid || submitting}

                onMouseEnter={() => setBtnHover(true)}

                onMouseLeave={() => setBtnHover(false)}

                style={{

                  marginTop: 4, padding: "12px 0", borderRadius: 9, border: "none",

                  fontSize: 14, fontWeight: 700, color: "#fff", cursor: isValid && !submitting ? "pointer" : "not-allowed",

                  backgroundImage: isValid ? GRADIENT : "none",

                  background: isValid ? undefined : "#C9CBD1",

                  opacity: submitting ? 0.7 : btnHover && isValid ? 0.92 : 1,

                  transition: "opacity .15s",

                }}
>

                {submitting ? "Saving…" : "Save record"}
</button>
</form>

          )}
</div>
</div>
</div>

  );

}
 
