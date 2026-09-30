
import { useCallback, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import "./ExitTracker.css";

// ============================================================
// CONFIGURATION
// ============================================================

const GAS_URL =
  "https://script.google.com/macros/s/AKfycby9ldjWgsTJdaQf_m1mZgH3ApQrQUTp0B_AXiWDe84C0qYOp3ikTLy6pC_Sf52qLJ7L/exec";

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

const GRADIENT =
  `linear-gradient(100deg, ${M.red}, ${M.orange} 52%, ${M.pink})`;

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
