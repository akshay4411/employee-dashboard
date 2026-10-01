import { useCallback, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";

// ============================================================
// STYLES (embedded, so no separate .css file is needed)
// ============================================================

const CSS = `
.et-page {
  --red: #E5342B;
  --orange: #F7941D;
  --pink: #EC1E79;
  --ink: #1A1B20;
  --slate: #5B5E68;
  --hair: #E7E4E0;
  --paper: #FAF9F7;
  --card: #FFFFFF;
  --ok: #1E8E5A;
  --gradient: linear-gradient(100deg, var(--red), var(--orange) 52%, var(--pink));
  --radius: 10px;
  --focus: 0 0 0 3px rgba(236, 30, 121, 0.28);

  min-height: 100vh;
  padding: clamp(12px, 4vw, 48px) clamp(12px, 3vw, 24px);
  background: var(--paper);
  color: var(--ink);
  font-family: "Inter", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif;
  font-size: 15px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  box-sizing: border-box;
}

.et-page *, .et-page *::before, .et-page *::after { box-sizing: border-box; }
.et-page h1, .et-page h2, .et-page h3, .et-page p { margin: 0; }

.et-app {
  max-width: 880px;
  margin: 0 auto;
  background: var(--card);
  border: 1px solid var(--hair);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(26,27,32,0.04), 0 12px 32px -16px rgba(26,27,32,0.12);
}

.et-header { padding: 28px clamp(20px, 4vw, 40px) 24px; }

.et-brand {
  display: flex; align-items: center; gap: 10px; margin-bottom: 24px;
  font-size: 22px; font-weight: 700; letter-spacing: -0.02em;
}
.et-brand-divider { width: 1px; height: 20px; background: var(--hair); margin: 0 4px; }
.et-brand-label { font-size: 11px; font-weight: 600; letter-spacing: 0.12em; color: var(--slate); }

.et-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.et-title-row h1 { font-size: clamp(26px, 4vw, 34px); font-weight: 750; letter-spacing: -0.03em; line-height: 1.15; }
.et-title-row p { margin-top: 6px; max-width: 52ch; color: var(--slate); }

.et-status-badge {
  display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0;
  padding: 6px 12px; border: 1px solid var(--hair); border-radius: 999px;
  font-size: 12px; font-weight: 600; color: var(--slate); background: var(--paper);
}
.et-status-badge span {
  width: 8px; height: 8px; border-radius: 50%; background: var(--ok);
  box-shadow: 0 0 0 3px rgba(30,142,90,0.18);
}

.et-gradient-line { height: 4px; background: var(--gradient); }

.et-tabs {
  display: flex; gap: 4px; padding: 0 clamp(12px, 3vw, 32px);
  border-bottom: 1px solid var(--hair); overflow-x: auto; scrollbar-width: none;
}
.et-tabs::-webkit-scrollbar { display: none; }

.et-tab {
  position: relative; padding: 16px 16px 14px; border: 0; background: none;
  font: inherit; font-weight: 600; color: var(--slate); cursor: pointer;
  white-space: nowrap; transition: color 0.15s ease;
}
.et-tab::after {
  content: ""; position: absolute; left: 12px; right: 12px; bottom: -1px; height: 3px;
  border-radius: 3px 3px 0 0; background: var(--gradient);
  transform: scaleX(0); transition: transform 0.2s ease;
}
.et-tab:hover, .et-tab.active { color: var(--ink); }
.et-tab.active::after { transform: scaleX(1); }
.et-tab:focus-visible { outline: none; box-shadow: var(--focus); border-radius: 6px; }

.et-content { padding: clamp(20px, 4vw, 40px); min-height: 360px; }

.et-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.et-field { display: block; margin-bottom: 18px; }
.et-field-label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: var(--ink); }
.et-field-hint { font-weight: 400; color: var(--slate); }

.et-input {
  display: block; width: 100%; height: 44px; padding: 0 14px;
  border: 1px solid var(--hair); border-radius: var(--radius);
  background: var(--card); color: var(--ink); font: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.et-input::placeholder { color: #A5A7AF; }
.et-input:hover { border-color: #D3CFC9; }
.et-input:focus { outline: none; border-color: var(--pink); box-shadow: var(--focus); }

select.et-input {
  appearance: none; padding-right: 40px; cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1.5l5 5 5-5' stroke='%235B5E68' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 14px center;
}

.et-button {
  display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  min-height: 44px; padding: 0 22px; border: 1px solid transparent;
  border-radius: var(--radius); font: inherit; font-weight: 650; cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
.et-button:focus-visible { outline: none; box-shadow: var(--focus); }
.et-button:active:not(:disabled) { transform: translateY(1px); }
.et-button:disabled { opacity: 0.6; cursor: not-allowed; }
.et-button-primary { background: var(--gradient); color: #fff; box-shadow: 0 6px 16px -8px rgba(229,52,43,0.6); }
.et-button-primary:hover:not(:disabled) { box-shadow: 0 8px 20px -8px rgba(236,30,121,0.7); }
.et-button-secondary { background: var(--card); color: var(--ink); border-color: var(--hair); }
.et-button-secondary:hover:not(:disabled) { border-color: var(--ink); }

.et-text-button {
  padding: 0; border: 0; background: none; font: inherit; font-weight: 600;
  color: var(--pink); text-decoration: underline; text-underline-offset: 3px; cursor: pointer;
}
.et-text-button:hover { color: var(--red); }
.et-text-button:focus-visible { outline: none; box-shadow: var(--focus); border-radius: 4px; }

.et-notice {
  margin: 4px 0 18px; padding: 12px 14px; border: 1px solid; border-left-width: 4px;
  border-radius: var(--radius); font-size: 14px; white-space: pre-line;
}
.et-notice-error { background: #FEF2F1; border-color: #F6C5C2; border-left-color: var(--red); color: #9C1F18; }
.et-notice-success { background: #EEF8F2; border-color: #BCE3CD; border-left-color: var(--ok); color: #14683F; }

.et-spinner {
  display: inline-block; width: 16px; height: 16px; border: 2px solid currentColor;
  border-right-color: transparent; border-radius: 50%;
  animation: et-spin 0.7s linear infinite; vertical-align: -3px;
}
@keyframes et-spin { to { transform: rotate(360deg); } }

.et-loading, .et-dashboard-loading {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  padding: 24px; color: var(--slate);
}
.et-dashboard-loading { min-height: 260px; }

.et-success { display: flex; flex-direction: column; align-items: center; padding: 40px 16px; text-align: center; }
.et-success-icon {
  display: grid; place-items: center; width: 60px; height: 60px; margin-bottom: 18px;
  border-radius: 50%; background: #EEF8F2; color: var(--ok); font-size: 28px; font-weight: 700;
  box-shadow: 0 0 0 8px rgba(30,142,90,0.08);
}
.et-success h3 { font-size: 20px; letter-spacing: -0.02em; }
.et-success p { margin: 6px 0 22px; color: var(--slate); }

.et-dropzone {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 36px 20px; border: 2px dashed #D9D4CD; border-radius: 14px;
  background: var(--paper); text-align: center; cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.et-dropzone:hover { border-color: var(--orange); background: #FFF8F0; }
.et-dropzone:focus-visible { outline: none; border-color: var(--pink); box-shadow: var(--focus); }
.et-dropzone strong { font-size: 16px; }
.et-dropzone p { color: var(--slate); }
.et-dropzone > span { font-size: 12px; color: #8A8D96; }
.et-upload-icon {
  display: grid; place-items: center; width: 48px; height: 48px; margin-bottom: 10px;
  border-radius: 50%; background: var(--gradient); color: #fff; font-size: 22px; font-weight: 700;
}

.et-template-row {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
  gap: 8px; margin: 16px 0 8px; font-size: 14px; color: var(--slate);
}

.et-preview-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 24px 0 12px; }
.et-preview-heading strong { word-break: break-all; }
.et-preview-heading p { font-size: 13px; color: var(--ok); font-weight: 600; }

.et-table-wrap { margin-bottom: 18px; border: 1px solid var(--hair); border-radius: var(--radius); overflow-x: auto; }
.et-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.et-table th, .et-table td { padding: 10px 14px; text-align: left; white-space: nowrap; }
.et-table th { background: var(--paper); border-bottom: 1px solid var(--hair); font-size: 12px; font-weight: 650; color: var(--slate); }
.et-table td { border-bottom: 1px solid var(--hair); }
.et-table tbody tr:last-child td { border-bottom: 0; }
.et-table tbody tr:hover { background: #FFFBF6; }
.et-table-note { padding: 10px 14px; border-top: 1px solid var(--hair); background: var(--paper); font-size: 12px; color: var(--slate); }
.et-upload-action { width: 100%; }

.et-dashboard-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 22px; }
.et-dashboard-heading h2 { font-size: 22px; letter-spacing: -0.02em; }
.et-dashboard-heading p { margin-top: 2px; color: var(--slate); }
.et-refresh { min-height: 38px; padding: 0 16px; font-size: 14px; }

.et-stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 20px; }
.et-stat-card {
  display: flex; flex-direction: column; gap: 2px; padding: 20px;
  border: 1px solid var(--hair); border-radius: 12px; background: var(--card);
}
.et-stat-card > span { font-size: 13px; font-weight: 600; color: var(--slate); }
.et-stat-card > strong {
  font-size: 40px; font-weight: 750; line-height: 1.1; letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums; background: var(--gradient);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent;
}
.et-stat-card > strong.et-stat-month { font-size: 30px; }
.et-stat-card small { font-size: 12px; color: #8A8D96; }

.et-panel { margin-bottom: 20px; padding: 22px; border: 1px solid var(--hair); border-radius: 12px; background: var(--card); }
.et-panel h3 { font-size: 16px; letter-spacing: -0.01em; }
.et-panel-description { margin: 2px 0 18px; font-size: 13px; color: var(--slate); }

.et-chart { display: flex; flex-direction: column; gap: 14px; }
.et-bar-row { display: grid; grid-template-columns: 96px 1fr 36px; align-items: center; gap: 12px; }
.et-bar-label { font-size: 13px; font-weight: 600; color: var(--slate); }
.et-bar-track { height: 12px; border-radius: 999px; background: #F1EEEA; overflow: hidden; }
.et-bar-fill { height: 100%; border-radius: 999px; transition: width 0.5s cubic-bezier(0.2, 0.8, 0.2, 1); }
.et-bar-row > strong { text-align: right; font-variant-numeric: tabular-nums; }

.et-month-chart { display: flex; align-items: flex-end; gap: 10px; height: 200px; padding-top: 4px; overflow-x: auto; }
.et-month-column { display: flex; flex: 1 0 44px; flex-direction: column; align-items: center; gap: 6px; height: 100%; }
.et-month-column > strong { font-size: 12px; font-variant-numeric: tabular-nums; }
.et-month-track {
  display: flex; align-items: flex-end; flex: 1; width: 100%; max-width: 40px;
  border-radius: 6px 6px 0 0; background: #F6F4F1;
}
.et-month-fill {
  width: 100%; border-radius: 6px 6px 0 0;
  background: linear-gradient(180deg, var(--pink), var(--orange));
  transition: height 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.et-month-column > span { font-size: 11px; color: var(--slate); white-space: nowrap; }
.et-empty-chart { padding: 40px 0; text-align: center; color: var(--slate); }

.et-dashboard-footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; font-size: 12px; color: #8A8D96; }

.et-footer {
  display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px;
  padding: 16px clamp(20px, 4vw, 40px); border-top: 1px solid var(--hair);
  background: var(--paper); font-size: 12px; color: var(--slate);
}

@media (max-width: 640px) {
  .et-grid-2 { grid-template-columns: 1fr; gap: 0; }
  .et-stat-grid { grid-template-columns: 1fr; gap: 12px; }
  .et-title-row, .et-dashboard-heading, .et-preview-heading { flex-direction: column; }
  .et-brand-label, .et-brand-divider { display: none; }
  .et-bar-row { grid-template-columns: 80px 1fr 28px; gap: 8px; }
  .et-page .et-button[type="submit"] { width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .et-page *, .et-page *::before, .et-page *::after {
    transition-duration: 0.01ms !important;
  }
  .et-spinner { animation-duration: 1.5s !important; }
}
`;

// ============================================================
// CONFIGURATION
// ============================================================

const GAS_URL =
  "https://script.google.com/macros/s/AKfycby9ldjWgsTJdaQf_m1mZgH3ApQrQUTp0B_AXiWDe84C0qYOp3ikTLy6pC_Sf52qLJ7L/exec";

const M = {
  red: "#E5342B",
  orange: "#F7941D",
  pink: "#EC1E79",
};

const REASON_OPTIONS = ["RAM DOWN", "RESIGNED", "ABSCOND"];

const REASON_COLORS = {
  "RAM DOWN": M.red,
  RESIGNED: M.orange,
  ABSCOND: M.pink,
};

const EMPTY_FORM = {
  movateId: "",
  name: "",
  lwd: "",
  reason: "",
  project: "",
  lm: "",
};

const TABS = [
  { key: "form", label: "Add Record" },
  { key: "bulk", label: "Bulk Upload" },
  { key: "dash", label: "Dashboard" },
];

// ============================================================
// API CLIENT
// ============================================================

async function post(payload) {
  if (!GAS_URL || !GAS_URL.endsWith("/exec")) {
    throw new Error("Configure a valid deployed Apps Script /exec URL.");
  }

  let response;

  try {
    response = await fetch(GAS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
      redirect: "follow",
    });
  } catch {
    throw new Error(
      "Cannot connect to Google Apps Script. Check your internet, " +
      "deployment permissions, and browser CORS/network errors."
    );
  }

  if (!response.ok) {
    throw new Error(`Backend returned HTTP ${response.status}.`);
  }

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      "The backend did not return readable JSON. " +
      "Check the deployment URL and Google Apps Script permissions."
    );
  }

  if (!result || typeof result.status !== "boolean") {
    throw new Error("Unexpected backend response format.");
  }

  return result;
}

// ============================================================
// UTILITIES
// ============================================================

function normalizeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const date = XLSX.SSF.parse_date_code(value);

    if (date) {
      return [
        date.y,
        String(date.m).padStart(2, "0"),
        String(date.d).padStart(2, "0"),
      ].join("-");
    }
  }

  const text = String(value ?? "").trim();

  if (!text) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  // Handle DD/MM/YYYY and DD-MM-YYYY explicitly.
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);

    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return "";
}

function normalizeRow(row) {
  const columns = {};

  Object.entries(row).forEach(([key, value]) => {
    const normalizedKey = key.trim().toLowerCase().replace(/[^a-z]/g, "");
    columns[normalizedKey] = value;
  });

  const get = (...keys) => {
    for (const key of keys) {
      if (columns[key] !== undefined && columns[key] !== null) {
        return String(columns[key]).trim();
      }
    }

    return "";
  };

  return {
    movateId: get("movateid", "id"),
    name: get("name", "employeename"),
    lwd: normalizeDate(
      columns.lwd ?? columns.lastworkingday ?? ""
    ),
    reason: get("reason").toUpperCase(),
    project: get("project"),
    lm: get("lm", "linemanager", "manager"),
  };
}

function validateRecord(record) {
  const required = [
    ["movateId", "Movate ID"],
    ["name", "Name"],
    ["lwd", "LWD"],
    ["reason", "Reason"],
    ["project", "Project"],
    ["lm", "Line Manager"],
  ];

  for (const [key, label] of required) {
    if (!String(record[key] ?? "").trim()) {
      return `${label} is required.`;
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.lwd)) {
    return "LWD must be a valid date.";
  }

  if (!REASON_OPTIONS.includes(record.reason)) {
    return "Select a valid exit reason.";
  }

  return "";
}

function downloadTemplate() {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Movate ID", "Name", "LWD", "Reason", "Project", "LM"],
    ["MOV12345", "Sample Employee", "2026-09-30", "RESIGNED", "Project A", "Manager Name"],
  ]);

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, sheet, "Exit Records");

  XLSX.writeFile(workbook, "Movate_Exit_Tracker_Template.xlsx");
}

// ============================================================
// SHARED COMPONENTS
// ============================================================

function Mark({ size = 30 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-label="Movate Exit Tracker"
      role="img"
    >
      <defs>
        <linearGradient id="movateMarkGradient" x1="0" y1="40" x2="40" y2="0">
          <stop offset="0%" stopColor={M.red} />
          <stop offset="55%" stopColor={M.orange} />
          <stop offset="100%" stopColor={M.pink} />
        </linearGradient>
      </defs>
      <path
        d="M3 34 L11 6 L20 24 L29 6 L37 34"
        stroke="url(#movateMarkGradient)"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="et-field">
      <span className="et-field-label">
        {label}
        {hint && <span className="et-field-hint"> · {hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Input({ className = "", ...props }) {
  return <input className={`et-input ${className}`} {...props} />;
}

function Select({ className = "", ...props }) {
  return <select className={`et-input ${className}`} {...props} />;
}

function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}) {
  return (
    <button
      className={`et-button et-button-${variant} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function Notice({ type = "error", children }) {
  if (!children) return null;

  return (
    <div className={`et-notice et-notice-${type}`} role="status">
      {children}
    </div>
  );
}

function Spinner() {
  return <span className="et-spinner" aria-label="Loading" />;
}

// ============================================================
// ADD RECORD
// ============================================================

function AddRecordTab() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const update = (key) => (event) => {
    setForm((previous) => ({
      ...previous,
      [key]: event.target.value,
    }));
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    const validationError = validateRecord(form);

    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const result = await post({
        type: "addExitRecord",
        ...form,
      });

      if (!result.status) {
        throw new Error(result.message || "Unable to save record.");
      }

      setSaved(form.name.trim());
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err.message || "Unable to save record.");
    } finally {
      setSubmitting(false);
    }
  };

  if (saved) {
    return (
      <section className="et-success">
        <div className="et-success-icon">✓</div>
        <h3>Record saved successfully</h3>
        <p>{saved}'s exit record has been added.</p>
        <Button
          variant="secondary"
          onClick={() => setSaved("")}
        >
          Add another record
        </Button>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="et-grid-2">
        <Field label="Movate ID">
          <Input
            value={form.movateId}
            onChange={update("movateId")}
            placeholder="MOV12345"
            autoComplete="off"
            required
          />
        </Field>

        <Field label="Last Working Day" hint="LWD">
          <Input
            type="date"
            value={form.lwd}
            onChange={update("lwd")}
            required
          />
        </Field>
      </div>

      <Field label="Employee Name">
        <Input
          value={form.name}
          onChange={update("name")}
          placeholder="Enter employee name"
          required
        />
      </Field>

      <div className="et-grid-2">
        <Field label="Project">
          <Input
            value={form.project}
            onChange={update("project")}
            placeholder="Project name"
            required
          />
        </Field>

        <Field label="Line Manager">
          <Input
            value={form.lm}
            onChange={update("lm")}
            placeholder="Manager name"
            required
          />
        </Field>
      </div>

      <Field label="Exit Reason">
        <Select
          value={form.reason}
          onChange={update("reason")}
          required
        >
          <option value="">Select a reason</option>
          {REASON_OPTIONS.map((reason) => (
            <option key={reason} value={reason}>
              {reason}
            </option>
          ))}
        </Select>
      </Field>

      <Notice>{error}</Notice>

      <Button type="submit" disabled={submitting}>
        {submitting ? <><Spinner /> Saving record…</> : "Save exit record"}
      </Button>
    </form>
  );
}

// ============================================================
// BULK UPLOAD
// ============================================================

function BulkUploadTab() {
  const [rows, setRows] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const fileInput = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;

    setError("");
    setMessage("");
    setRows([]);
    setFileName("");
    setReading(true);

    try {
      const extension = file.name.split(".").pop().toLowerCase();

      if (!["xlsx", "xls", "csv"].includes(extension)) {
        throw new Error("Choose an Excel (.xlsx, .xls) or CSV file.");
      }

      const buffer = await file.arrayBuffer();

      const workbook = XLSX.read(buffer, {
        type: "array",
        cellDates: true,
      });

      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

      if (!firstSheet) {
        throw new Error("The selected file contains no worksheet.");
      }

      const parsed = XLSX.utils.sheet_to_json(firstSheet, {
        defval: "",
        raw: true,
      });

      if (!parsed.length) {
        throw new Error("The selected worksheet contains no records.");
      }

      const normalized = parsed
        .map(normalizeRow)
        .filter((row) =>
          Object.values(row).some((value) => String(value).trim())
        );

      if (!normalized.length) {
        throw new Error("No employee records were found.");
      }

      const errors = normalized
        .map((row, index) => ({
          row: index + 2,
          error: validateRecord(row),
        }))
        .filter((item) => item.error);

      if (errors.length) {
        const preview = errors
          .slice(0, 5)
          .map((item) => `Excel row ${item.row}: ${item.error}`)
          .join("\n");

        throw new Error(
          `${errors.length} invalid row(s) found.\n${preview}` +
          (errors.length > 5 ? "\nMore errors were found." : "")
        );
      }

      if (normalized.length > 500) {
        throw new Error("Upload a maximum of 500 records at a time.");
      }

      setRows(normalized);
      setFileName(file.name);
    } catch (err) {
      setError(err.message || "Unable to read the selected file.");
    } finally {
      setReading(false);

      if (fileInput.current) {
        fileInput.current.value = "";
      }
    }
  };

  const upload = async () => {
    if (!rows.length || uploading) return;

    setUploading(true);
    setError("");
    setMessage("");

    try {
      const result = await post({
        type: "addExitRecordsBulk",
        records: rows,
      });

      if (!result.status) {
        throw new Error(result.message || "Bulk upload failed.");
      }

      setMessage(`${result.count ?? rows.length} records saved successfully.`);
      setRows([]);
      setFileName("");
    } catch (err) {
      setError(err.message || "Unable to upload records.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section>
      <div
        className="et-dropzone"
        role="button"
        tabIndex={0}
        onClick={() => fileInput.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileInput.current?.click();
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          handleFile(event.dataTransfer.files?.[0]);
        }}
      >
        <div className="et-upload-icon">↑</div>
        <strong>Import employee records</strong>
        <p>Drop your file here or browse your computer</p>
        <span>Excel and CSV · Maximum 500 records</span>

        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.xls,.csv"
          hidden
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
      </div>

      <div className="et-template-row">
        <span>Need the correct column format?</span>
        <button
          className="et-text-button"
          type="button"
          onClick={downloadTemplate}
        >
          Download template
        </button>
      </div>

      {reading && (
        <div className="et-loading"><Spinner /> Validating spreadsheet…</div>
      )}

      {fileName && rows.length > 0 && (
        <div className="et-preview-heading">
          <div>
            <strong>{fileName}</strong>
            <p>{rows.length} validated records ready to upload</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setRows([]);
              setFileName("");
              setError("");
            }}
          >
            Clear
          </Button>
        </div>
      )}

      {rows.length > 0 && (
        <div className="et-table-wrap">
          <table className="et-table">
            <thead>
              <tr>
                {["Movate ID", "Name", "LWD", "Reason", "Project", "LM"].map(
                  (heading) => <th key={heading}>{heading}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((row, index) => (
                <tr key={`${row.movateId}-${index}`}>
                  <td>{row.movateId}</td>
                  <td>{row.name}</td>
                  <td>{row.lwd}</td>
                  <td>{row.reason}</td>
                  <td>{row.project}</td>
                  <td>{row.lm}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 10 && (
            <p className="et-table-note">
              Showing 10 of {rows.length} records.
            </p>
          )}
        </div>
      )}

      <Notice>{error}</Notice>
      <Notice type="success">{message}</Notice>

      {rows.length > 0 && (
        <Button
          className="et-upload-action"
          disabled={uploading || reading}
          onClick={upload}
        >
          {uploading
            ? <><Spinner /> Uploading records…</>
            : `Upload ${rows.length} records`}
        </Button>
      )}
    </section>
  );
}

// ============================================================
// CHARTS
// ============================================================

function BarChart({ data }) {
  const max = Math.max(1, ...data.map((item) => item.value));

  return (
    <div className="et-chart">
      {data.map((item) => (
        <div className="et-bar-row" key={item.label}>
          <span className="et-bar-label">{item.label}</span>
          <div className="et-bar-track">
            <div
              className="et-bar-fill"
              style={{
                width: `${(item.value / max) * 100}%`,
                background: REASON_COLORS[item.label],
              }}
            />
          </div>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function LineChart({ data }) {
  if (!data.length) {
    return <div className="et-empty-chart">No monthly data available.</div>;
  }

  const max = Math.max(1, ...data.map((item) => item.value));

  return (
    <div className="et-month-chart">
      {data.map((item) => (
        <div className="et-month-column" key={item.label}>
          <strong>{item.value}</strong>
          <div className="et-month-track">
            <div
              className="et-month-fill"
              style={{ height: `${Math.max(4, (item.value / max) * 100)}%` }}
            />
          </div>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// DASHBOARD
// ============================================================

function DashboardTab() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await post({ type: "getExitRecords" });

      if (!result.status) {
        throw new Error(result.message || "Unable to load dashboard.");
      }

      setRecords(Array.isArray(result.records) ? result.records : []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || "Unable to load records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  if (loading) {
    return (
      <div className="et-dashboard-loading">
        <Spinner /> Loading exit analytics…
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Notice>{error}</Notice>
        <Button variant="secondary" onClick={loadRecords}>
          Retry connection
        </Button>
      </div>
    );
  }

  const byReason = Object.fromEntries(
    REASON_OPTIONS.map((reason) => [reason, 0])
  );

  const byMonth = {};

  records.forEach((record) => {
    if (Object.hasOwn(byReason, record.reason)) {
      byReason[record.reason]++;
    }

    const month = String(record.lwd || "").slice(0, 7);

    if (/^\d{4}-\d{2}$/.test(month)) {
      byMonth[month] = (byMonth[month] || 0) + 1;
    }
  });

  const months = Object.keys(byMonth).sort();
  const latestMonth = months[months.length - 1] || "—";

  const monthlyData = months.slice(-12).map((month) => ({
    label: month,
    value: byMonth[month],
  }));

  return (
    <section>
      <div className="et-dashboard-heading">
        <div>
          <h2>Exit overview</h2>
          <p>Employee separation trends and records</p>
        </div>
        <Button
          variant="secondary"
          className="et-refresh"
          onClick={loadRecords}
        >
          ↻ Refresh
        </Button>
      </div>

      <div className="et-stat-grid">
        <div className="et-stat-card">
          <span>Total exits</span>
          <strong>{records.length}</strong>
          <small>All recorded separations</small>
        </div>
        <div className="et-stat-card">
          <span>Latest LWD month</span>
          <strong className="et-stat-month">{latestMonth}</strong>
          <small>Based on last working day</small>
        </div>
      </div>

      <div className="et-panel">
        <h3>Exits by reason</h3>
        <p className="et-panel-description">Distribution across recorded reasons</p>
        <BarChart
          data={REASON_OPTIONS.map((reason) => ({
            label: reason,
            value: byReason[reason],
          }))}
        />
      </div>

      <div className="et-panel">
        <h3>Monthly exit trend</h3>
        <p className="et-panel-description">
          Up to the last 12 months with recorded LWDs
        </p>
        <LineChart data={monthlyData} />
      </div>

      <div className="et-dashboard-footer">
        <span>
          {lastUpdated
            ? `Updated ${lastUpdated.toLocaleTimeString()}`
            : "Not yet refreshed"}
        </span>
        <span>{records.length} records loaded</span>
      </div>
    </section>
  );
}

// ============================================================
// APPLICATION SHELL
// ============================================================

export default function ExitTrackerApp() {
  const [tab, setTab] = useState("form");

  return (
    <main className="et-page">
      <style>{CSS}</style>

      <div className="et-app">
        <header className="et-header">
          <div className="et-brand">
            <Mark />
            <span>movate</span>
            <span className="et-brand-divider" />
            <span className="et-brand-label">PEOPLE OPERATIONS</span>
          </div>

          <div className="et-title-row">
            <div>
              <h1>Exit Tracker</h1>
              <p>
                Manage employee separations, import records, and review trends.
              </p>
            </div>
            <div className="et-status-badge">
              <span /> Tracker
            </div>
          </div>
        </header>

        <div className="et-gradient-line" />

        <nav className="et-tabs" aria-label="Exit Tracker sections">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`et-tab ${tab === item.key ? "active" : ""}`}
              aria-current={tab === item.key ? "page" : undefined}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="et-content">
          {tab === "form" && <AddRecordTab />}
          {tab === "bulk" && <BulkUploadTab />}
          {tab === "dash" && <DashboardTab />}
        </div>

        <footer className="et-footer">
          <span>Movate · Exit Tracker</span>
          <span>Employee records management</span>
        </footer>
      </div>
    </main>
  );
}
