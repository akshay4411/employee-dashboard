import { useState, useRef } from "react";

import * as XLSX from "xlsx";

// npm install xlsx

// This file has no other dependencies — charts are hand-drawn SVG.

// ─── CONFIG ────────────────────────────────────────────────────────────────

const GAS_URL = "https://script.google.com/macros/s/AKfycby9ldjWgsTJdaQf_m1mZgH3ApQrQUTp0B_AXiWDe84C0qYOp3ikTLy6pC_Sf52qLJ7L/exec";

// ─── MOVATE TOKENS ─────────────────────────────────────────────────────────

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

const REASON_COLORS = [M.red, M.orange, M.pink];

const emptyForm = { movateId: "", name: "", lwd: "", reason: "", project: "", lm: "" };

function post(payload) {

  return fetch(GAS_URL, {

    method: "POST",

    headers: { "Content-Type": "text/plain;charset=utf-8" },

    body: JSON.stringify(payload),

  }).then((r) => r.json());

}

// ─── Logomark ──────────────────────────────────────────────────────────────

function Mark({ size = 26 }) {

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

// ─── Shared bits ─────────────────────────────────────────────────────────

function Field({ label, hint, children }) {

  return (
<label style={{ display: "block", marginBottom: 14 }}>
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

function Button({ children, variant = "solid", style, ...props }) {

  const base = {

    padding: "12px 18px",

    borderRadius: 9,

    border: "none",

    fontSize: 14,

    fontWeight: 700,

    cursor: props.disabled ? "not-allowed" : "pointer",

    width: "100%",

  };

  const solid = { backgroundImage: props.disabled ? "none" : GRADIENT, background: props.disabled ? "#C9CBD1" : undefined, color: "#fff" };

  const outline = { background: "#fff", color: M.ink, border: `1px solid ${M.hair}`, fontWeight: 600 };

  return (
<button {...props} style={{ ...base, ...(variant === "solid" ? solid : outline), ...style }}>

      {children}
</button>

  );

}

// ─── Tab 1: Add Record ──────────────────────────────────────────────────

function AddRecordTab() {

  const [form, setForm] = useState(emptyForm);

  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState(null);

  const [saved, setSaved] = useState(null);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const isValid = form.movateId.trim() && form.name.trim() && form.lwd && form.reason && form.project.trim() && form.lm.trim();

  const handleSubmit = async (e) => {

    e.preventDefault();

    if (!isValid || submitting) return;

    setSubmitting(true);

    setError(null);

    try {

      const json = await post({ type: "addExitRecord", ...form });

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

  if (saved) {

    return (
<div style={{ textAlign: "center", padding: "18px 4px 6px" }}>
<div style={{ width: 52, height: 52, borderRadius: "50%", backgroundImage: GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
<path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
</svg>
</div>
<div style={{ fontSize: 16, fontWeight: 700, color: M.ink }}>Record saved</div>
<div style={{ fontSize: 13, color: M.slate, marginTop: 4 }}>{saved}'s exit has been logged.</div>
<Button variant="outline" style={{ marginTop: 20, width: "auto", padding: "9px 18px" }} onClick={() => setSaved(null)}>

          Add another record
</Button>
</div>

    );

  }

  return (
<form onSubmit={handleSubmit}>
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

          {REASON_OPTIONS.map((r) => (
<option key={r} value={r}>{r}</option>

          ))}
</SelectInput>
</Field>

      {error && (
<div style={{ fontSize: 12, fontWeight: 600, color: M.red, background: "#FDECEA", padding: "9px 12px", borderRadius: 8, marginBottom: 14 }}>

          {error}
</div>

      )}
<Button type="submit" disabled={!isValid || submitting}>

        {submitting ? "Saving…" : "Save record"}
</Button>
</form>

  );

}

// ─── Tab 2: Bulk Upload ──────────────────────────────────────────────────

function normalizeRow(row) {

  const get = (...keys) => {

    for (const k of Object.keys(row)) {

      const nk = k.trim().toLowerCase().replace(/[^a-z]/g, "");

      if (keys.includes(nk)) return String(row[k]).trim();

    }

    return "";

  };

  return {

    movateId: get("movateid", "id"),

    name: get("name", "employeename"),

    lwd: get("lwd", "lastworkingday"),

    reason: get("reason").toUpperCase(),

    project: get("project"),

    lm: get("lm", "linemanager", "manager"),

  };

}

function BulkUploadTab() {

  const [rows, setRows] = useState([]);

  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState(null);

  const [okMsg, setOkMsg] = useState(null);

  const fileInput = useRef(null);

  const handleFile = (file) => {

    setError(null);

    setOkMsg(null);

    const reader = new FileReader();

    reader.onload = (e) => {

      try {

        const wb = XLSX.read(e.target.result, { type: "array", cellDates: true });

        const sheet = wb.Sheets[wb.SheetNames[0]];

        const parsed = XLSX.utils.sheet_to_json(sheet, { defval: "" }).map(normalizeRow).filter((r) => r.movateId || r.name);

        setRows(parsed);

      } catch (err) {

        setRows([]);

        setError("Could not read that file: " + err.message);

      }

    };

    reader.readAsArrayBuffer(file);

  };

  const upload = async () => {

    setUploading(true);

    setError(null);

    try {

      const json = await post({ type: "addExitRecordsBulk", records: rows });

      if (json.status) {

        setOkMsg(`Saved ${json.count ?? rows.length} records to the sheet.`);

        setRows([]);

      } else {

        setError(json.message || "Bulk save failed.");

      }

    } catch (err) {

      setError(err.message || "Network error.");

    } finally {

      setUploading(false);

    }

  };

  return (
<div>
<div

        onClick={() => fileInput.current.click()}

        onDragOver={(e) => e.preventDefault()}

        onDrop={(e) => {

          e.preventDefault();

          if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);

        }}

        style={{ border: `2px dashed ${M.hair}`, borderRadius: 12, padding: "26px 12px", textAlign: "center", cursor: "pointer" }}
>
<div style={{ fontWeight: 600, fontSize: 14 }}>Drop an Excel file here, or tap to browse</div>
<div style={{ fontSize: 13, color: M.slate, marginTop: 6 }}>Columns: Movate ID · Name · LWD · Reason · Project · LM</div>
<input

          ref={fileInput}

          type="file"

          accept=".xlsx,.xls,.csv"

          style={{ display: "none" }}

          onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}

        />
</div>

      {rows.length > 0 && (
<>
<div style={{ fontSize: 13, color: M.slate, margin: "14px 0 4px" }}>{rows.length} rows parsed</div>
<div style={{ overflowX: "auto", border: `1px solid ${M.hair}`, borderRadius: 10 }}>
<table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
<thead>
<tr>

                  {["Movate ID", "Name", "LWD", "Reason", "Project", "LM"].map((h) => (
<th key={h} style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${M.hair}`, whiteSpace: "nowrap" }}>{h}</th>

                  ))}
</tr>
</thead>
<tbody>

                {rows.slice(0, 8).map((r, i) => (
<tr key={i}>

                    {[r.movateId, r.name, r.lwd, r.reason, r.project, r.lm].map((v, j) => (
<td key={j} style={{ padding: "6px 8px", borderBottom: `1px solid ${M.hair}`, whiteSpace: "nowrap" }}>{v}</td>

                    ))}
</tr>

                ))}
</tbody>
</table>
</div>
</>

      )}

      {error && <div style={{ fontSize: 12, fontWeight: 600, color: M.red, background: "#FDECEA", padding: "9px 12px", borderRadius: 8, marginTop: 14 }}>{error}</div>}

      {okMsg && <div style={{ fontSize: 12, fontWeight: 600, color: M.ok, background: "#E7F6EE", padding: "9px 12px", borderRadius: 8, marginTop: 14 }}>{okMsg}</div>}

      {rows.length > 0 && (
<Button style={{ marginTop: 14 }} disabled={uploading} onClick={upload}>

          {uploading ? "Uploading…" : `Upload ${rows.length} records`}
</Button>

      )}
</div>

  );

}

// ─── Tab 3: Dashboard ────────────────────────────────────────────────────

function BarChart({ data, colors }) {

  const max = Math.max(1, ...data.map((d) => d.value));

  const w = 400, h = 160, barW = w / data.length - 20;

  return (
<svg viewBox={`0 0 ${w} ${h + 24}`} width="100%">

      {data.map((d, i) => {

        const barH = (d.value / max) * h;

        const x = i * (w / data.length) + 10;

        return (
<g key={d.label}>
<rect x={x} y={h - barH} width={barW} height={barH} rx={4} fill={colors[i % colors.length]} />
<text x={x + barW / 2} y={h + 16} fontSize="11" fill={M.slate} textAnchor="middle">{d.label}</text>
<text x={x + barW / 2} y={h - barH - 6} fontSize="11" fontWeight="700" fill={M.ink} textAnchor="middle">{d.value}</text>
</g>

        );

      })}
</svg>

  );

}

function LineChart({ data }) {

  const max = Math.max(1, ...data.map((d) => d.value));

  const w = 400, h = 160, step = data.length > 1 ? w / (data.length - 1) : 0;

  const points = data.map((d, i) => `${i * step},${h - (d.value / max) * h}`).join(" ");

  return (
<svg viewBox={`0 0 ${w} ${h + 24}`} width="100%">
<polyline points={points} fill="none" stroke={M.orange} strokeWidth="2.5" />

      {data.map((d, i) => (
<g key={d.label}>
<circle cx={i * step} cy={h - (d.value / max) * h} r="3.5" fill={M.orange} />
<text x={i * step} y={h + 16} fontSize="10" fill={M.slate} textAnchor="middle">{d.label}</text>
</g>

      ))}
</svg>

  );

}

function DashboardTab() {

  const [records, setRecords] = useState(null);

  const [error, setError] = useState(null);

  const load = async () => {

    setError(null);

    try {

      const json = await post({ type: "getExitRecords" });

      if (!json.status) throw new Error(json.message || "Could not load records.");

      setRecords(json.records || []);

    } catch (err) {

      setError(err.message);

    }

  };

  if (records === null && !error) {

    load();

    return <div style={{ textAlign: "center", padding: 24, color: M.slate, fontSize: 13 }}>Loading dashboard…</div>;

  }

  if (error) {

    return (
<div>
<div style={{ fontSize: 12, fontWeight: 600, color: M.red, background: "#FDECEA", padding: "9px 12px", borderRadius: 8 }}>{error}</div>
<Button variant="outline" style={{ marginTop: 14 }} onClick={() => { setRecords(null); setError(null); }}>Retry</Button>
</div>

    );

  }

  const byReason = Object.fromEntries(REASON_OPTIONS.map((r) => [r, 0]));

  const byMonth = {};

  records.forEach((r) => {

    if (byReason[r.reason] !== undefined) byReason[r.reason]++;

    const m = (r.lwd || "").slice(0, 7);

    if (m) byMonth[m] = (byMonth[m] || 0) + 1;

  });

  const months = Object.keys(byMonth).sort();

  return (
<div>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
<div style={{ border: `1px solid ${M.hair}`, borderRadius: 12, padding: 14, textAlign: "center" }}>
<b style={{ display: "block", fontSize: 22 }}>{records.length}</b>
<span style={{ fontSize: 11, color: M.slate }}>Total exits logged</span>
</div>
<div style={{ border: `1px solid ${M.hair}`, borderRadius: 12, padding: 14, textAlign: "center" }}>
<b style={{ display: "block", fontSize: 22 }}>{months.length ? months[months.length - 1] : "—"}</b>
<span style={{ fontSize: 11, color: M.slate }}>Most recent month</span>
</div>
</div>
<div style={{ fontSize: 13, color: M.slate, marginBottom: 6 }}>Exits by reason</div>
<BarChart data={REASON_OPTIONS.map((r) => ({ label: r, value: byReason[r] }))} colors={REASON_COLORS} />
<div style={{ fontSize: 13, color: M.slate, margin: "18px 0 6px" }}>Exits by month</div>
<LineChart data={months.map((m) => ({ label: m, value: byMonth[m] }))} />
<Button variant="outline" style={{ marginTop: 18 }} onClick={() => setRecords(null)}>Refresh data</Button>
</div>

  );

}

// ─── App shell ───────────────────────────────────────────────────────────

const TABS = [

  { key: "form", label: "Add Record" },

  { key: "bulk", label: "Bulk Upload" },

  { key: "dash", label: "Dashboard" },

];

export default function ExitTrackerApp() {

  const [tab, setTab] = useState("form");

  return (
<div style={{ minHeight: "100%", background: M.paper, padding: "32px 16px", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", display: "flex", justifyContent: "center" }}>
<div style={{ width: "100%", maxWidth: 460, background: M.card, borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 2px rgba(20,20,30,.04), 0 12px 32px -12px rgba(20,20,30,.18)", border: `1px solid ${M.hair}` }}>
<div style={{ padding: "22px 26px 20px", position: "relative", overflow: "hidden" }}>
<div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", backgroundImage: GRADIENT, opacity: 0.08, filter: "blur(2px)" }} />
<div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
<Mark size={26} />
<span style={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.2, backgroundImage: GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>movate</span>
</div>
<div style={{ fontSize: 19, fontWeight: 700, color: M.ink, marginTop: 12, position: "relative" }}>Exit Tracker</div>
<div style={{ fontSize: 13, color: M.slate, marginTop: 2, position: "relative" }}>Log separations, bulk import, and view trends</div>
</div>
<div style={{ height: 3, backgroundImage: GRADIENT }} />
<div style={{ display: "flex", gap: 4, padding: "16px 26px 0" }}>

          {TABS.map((t) => (
<button

              key={t.key}

              onClick={() => setTab(t.key)}

              style={{

                flex: 1, textAlign: "center", padding: "10px 8px", fontSize: 13, fontWeight: 600,

                borderRadius: 8, cursor: "pointer",

                border: tab === t.key ? "none" : `1px solid ${M.hair}`,

                backgroundImage: tab === t.key ? GRADIENT : "none",

                background: tab === t.key ? undefined : "transparent",

                color: tab === t.key ? "#fff" : M.slate,

              }}
>

              {t.label}
</button>

          ))}
</div>
<div style={{ padding: 26 }}>

          {tab === "form" && <AddRecordTab />}

          {tab === "bulk" && <BulkUploadTab />}

          {tab === "dash" && <DashboardTab />}
</div>
</div>
</div>

  );

}
 
