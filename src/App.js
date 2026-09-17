import { useState } from "react";

// ─── CONFIG ────────────────────────────────────────────────────────────────

// Reuse the same Apps Script Web App URL your dashboard already calls.

const GAS_URL = "https://script.google.com/macros/s/AKfycbxAkN7YAgKtvLfeOXg7J6wflXMqJ27e08bwOdirTH-V4IB3KSGK2JGochP49vtYs9W3/exec";

// ─── PALETTE (matches EmployeeDashboard.jsx) ──────────────────────────────

const P = {

  dark: "#1e3a5f",

  blue1: "#1565C0",

  blue2: "#1976D2",

  red: "#e53935",

  green: "#2e7d32",

  muted: "#6b7a8d",

  bg: "#f0f4f8",

  card: "#ffffff",

  border: "#dde3ea",

};

const REASON_OPTIONS = ["RAM DOWN", "RESIGNED", "ABSCOND"];

const FIELD_LABEL = {

  fontSize: 11,

  fontWeight: 700,

  color: P.muted,

  marginBottom: 4,

  display: "block",

};

const INPUT_STYLE = {

  width: "100%",

  padding: "8px 10px",

  fontSize: 13,

  border: `1px solid ${P.border}`,

  borderRadius: 6,

  outline: "none",

  color: P.dark,

  background: "#fff",

  boxSizing: "border-box",

};

const emptyForm = {

  movateId: "",

  name: "",

  lwd: "",

  reason: "",

  project: "",

  lm: "",

};

function Field({ label, children }) {

  return (
<div>
<label style={FIELD_LABEL}>{label}</label>

      {children}
</div>

  );

}

export default function ExitTrackerForm() {

  const [form, setForm] = useState(emptyForm);

  const [submitting, setSubmitting] = useState(false);

  const [status, setStatus] = useState(null); // { ok: bool, message: string }

  const update = (key) => (e) =>

    setForm((f) => ({ ...f, [key]: e.target.value }));

  const isValid =

    form.movateId.trim() &&

    form.name.trim() &&

    form.lwd &&

    form.reason &&

    form.project.trim() &&

    form.lm.trim();

  const handleSubmit = async (e) => {

    e.preventDefault();

    if (!isValid || submitting) return;

    setSubmitting(true);

    setStatus(null);

    try {

      const res = await fetch(GAS_URL, {

        method: "POST",

        headers: { "Content-Type": "text/plain;charset=utf-8" },

        body: JSON.stringify({

          type: "addExitRecord",

          movateId: form.movateId.trim(),

          name: form.name.trim(),

          lwd: form.lwd,

          reason: form.reason,

          project: form.project.trim(),

          lm: form.lm.trim(),

        }),

      });

      const json = await res.json();

      if (json.status) {

        setStatus({ ok: true, message: "Record saved." });

        setForm(emptyForm);

      } else {

        setStatus({ ok: false, message: json.message || "Save failed." });

      }

    } catch (err) {

      setStatus({ ok: false, message: err.message || "Network error." });

    } finally {

      setSubmitting(false);

    }

  };

  return (
<div

      style={{

        maxWidth: 480,

        margin: "0 auto",

        background: P.card,

        borderRadius: 10,

        padding: 20,

        boxShadow: "0 1px 6px rgba(0,0,0,.08)",

        fontFamily: "system-ui, -apple-system, sans-serif",

      }}
>
<div style={{ fontSize: 15, fontWeight: 800, color: P.dark, marginBottom: 2 }}>

        Add Exit Record
</div>
<div style={{ fontSize: 11, color: P.muted, marginBottom: 16 }}>

        Capture employee separation details for tracking
</div>
<form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
<Field label="Movate ID">
<input

            style={INPUT_STYLE}

            value={form.movateId}

            onChange={update("movateId")}

            placeholder="e.g. MOV12345"

          />
</Field>
<Field label="Name">
<input

            style={INPUT_STYLE}

            value={form.name}

            onChange={update("name")}

            placeholder="Employee name"

          />
</Field>
<Field label="LWD (Last Working Day)">
<input

            type="date"

            style={INPUT_STYLE}

            value={form.lwd}

            onChange={update("lwd")}

          />
</Field>
<Field label="Reason">
<select style={INPUT_STYLE} value={form.reason} onChange={update("reason")}>
<option value="">Select reason…</option>

            {REASON_OPTIONS.map((r) => (
<option key={r} value={r}>

                {r}
</option>

            ))}
</select>
</Field>
<Field label="Project">
<input

            style={INPUT_STYLE}

            value={form.project}

            onChange={update("project")}

            placeholder="Project name"

          />
</Field>
<Field label="LM">
<input

            style={INPUT_STYLE}

            value={form.lm}

            onChange={update("lm")}

            placeholder="Line manager"

          />
</Field>

        {status && (
<div

            style={{

              fontSize: 12,

              fontWeight: 600,

              padding: "8px 10px",

              borderRadius: 6,

              background: status.ok ? "#e8f5e9" : "#fdecea",

              color: status.ok ? P.green : P.red,

            }}
>

            {status.message}
</div>

        )}
<button

          type="submit"

          disabled={!isValid || submitting}

          style={{

            marginTop: 4,

            padding: "10px 0",

            borderRadius: 7,

            border: "none",

            fontSize: 13,

            fontWeight: 700,

            color: "#fff",

            background: !isValid || submitting ? "#9fb3c8" : P.blue1,

            cursor: !isValid || submitting ? "not-allowed" : "pointer",

          }}
>

          {submitting ? "Saving…" : "Save Record"}
</button>
</form>
</div>

  );

}
 
