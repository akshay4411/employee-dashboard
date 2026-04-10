// npm install xlsx        ← required for Export Excel
import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from "recharts";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const GAS_URL =
  "https://script.google.com/macros/s/AKfycbyqaBYwAe6nWtp29xrOTT-nWQYEfwILpaSJ31VOtAv7cWdvexdy-r9-edPj7vSMxTvW/exec";

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const P = {
  dark:   "#1e3a5f",
  blue1:  "#1565C0",
  blue2:  "#1976D2",
  blue3:  "#1E88E5",
  blue4:  "#42A5F5",
  red:    "#e53935",
  green:  "#2e7d32",
  orange: "#e65100",
  purple: "#6a1b9a",
  muted:  "#6b7a8d",
  bg:     "#f0f4f8",
  card:   "#ffffff",
  border: "#dde3ea",
  stripe: "#f5f9ff",
};
const BAR_COLORS = [P.blue1, P.blue2, P.blue3, P.blue4, "#64B5F6", "#90CAF9"];

// ─── PURE HELPERS (outside component — stable refs, no ESLint dep warnings) ──
function normaliseRows(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw?.data  && Array.isArray(raw.data))   return raw.data;
  if (raw?.values && Array.isArray(raw.values)) {
    const [headers, ...rows] = raw.values;
    return rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
  }
  return [];
}

function latestPerEmployee(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const id   = r["Emp ID"];
    const date = new Date(r["Mapping Date"] || 0);
    if (!map.has(id) || date > new Date(map.get(id)["Mapping Date"] || 0)) map.set(id, r);
  });
  return [...map.values()];
}

// An employee has resigned if DOE (Date of Exit) is a non-empty, valid date
function hasResigned(row) {
  const doe = row["DOE"];
  if (!doe) return false;
  const d = new Date(doe);
  return !isNaN(d.getTime());
}

const uniq = (arr, key) =>
  ["All", ...new Set(arr.map((r) => r[key]).filter(Boolean))];

const grp = (arr, key) => {
  const m = {};
  arr.forEach((r) => { const k = r[key] || "Unknown"; m[k] = (m[k] || 0) + 1; });
  return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
};

const fmt = (n) => {
  if (n >= 1e7) return "₹" + (n / 1e7).toFixed(2) + " Cr";
  if (n >= 1e5) return "₹" + (n / 1e5).toFixed(1) + "L";
  return "₹" + n.toLocaleString("en-IN");
};

const fmtDate = (val) => {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

// ─── EXPORT HELPERS ───────────────────────────────────────────────────────────
const TABLE_COLS = [
  { label: "Emp ID",          key: "Emp ID"                              },
  { label: "Emp Name",        key: "Emp Name"                            },
  { label: "Project",         key: "Project Name"                        },
  { label: "Function",        key: "Function (Sub SU) - Sub Function"    },
  { label: "Status",          key: "Status (Billable / Bench)"           },
  { label: "Bill Rate (₹)",   key: "Bill Rate"                           },
  { label: "Location",        key: "Location/City"                       },
  { label: "Grade",           key: "Grade"                               },
  { label: "Billing Model",   key: "Billing Model"                       },
  { label: "Emp Type",             key: "Emp Type"                       },
  { label: "DOJ",                  key: "DOJ"                            },
  { label: "DOE",                  key: "DOE"                            },
  { label: "Active/Inactive",      key: "Active/Inactive"                },
  { label: "Nokia Ramp Date",      key: "Nokia Ramp Date"                },
  { label: "Nokia Ramp Down Date", key: "Nokia Ramp down Date"           },
  { label: "Nokia LWD",            key: "Nokia LWD"                      },
  { label: "Ramp Down Issue Date", key: "Ramp down issue Date"           },
  { label: "Bench Start Date",     key: "Bench start Date"               },
  { label: "Bench End Date",       key: "Bench End Date"                 },
  { label: "SR No",                key: "SR NO"                          },
  { label: "Resigned",             key: "__resigned"                     },
];

// Keys whose values should be formatted as dates in exports
const DATE_KEYS = new Set([
  "DOJ", "DOE",
  "Nokia Ramp Date", "Nokia Ramp down Date", "Nokia LWD",
  "Ramp down issue Date", "Bench start Date", "Bench End Date",
]);

function buildExportRows(data) {
  return data.map((r) => {
    const row = {};
    TABLE_COLS.forEach(({ label, key }) => {
      if (key === "__resigned") {
        row[label] = hasResigned(r) ? "Yes" : "No";
      } else if (DATE_KEYS.has(key)) {
        row[label] = fmtDate(r[key]);
      } else {
        row[label] = r[key] ?? "";
      }
    });
    return row;
  });
}

function exportCSV(data, filename = "employee_data.csv") {
  const rows  = buildExportRows(data);
  const headers = TABLE_COLS.map((c) => c.label);
  const csvLines = [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => {
        const val = String(r[h] ?? "").replace(/"/g, '""');
        return val.includes(",") || val.includes("\n") ? `"${val}"` : val;
      }).join(",")
    ),
  ];
  const blob = new Blob(["\uFEFF" + csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportExcel(data, filename = "employee_data.xlsx") {
  const rows = buildExportRows(data);
  const ws   = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws["!cols"] = TABLE_COLS.map(({ label }) => ({ wch: Math.max(label.length + 2, 14) }));

  // Header style (xlsx-js-style not needed — basic xlsx supports fill via cell style)
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Employee Data");
  XLSX.writeFile(wb, filename);
}

// ─── SHARED UI COMPONENTS ─────────────────────────────────────────────────────
function DonutGauge({ pct, color = P.green }) {
  const r = 22, circ = 2 * Math.PI * r, dash = (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width={52} height={52} viewBox="0 0 56 56" style={{ flexShrink: 0 }}>
      <circle cx={28} cy={28} r={r} fill="none" stroke="#e0e0e0" strokeWidth={6} />
      <circle cx={28} cy={28} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        transform="rotate(-90 28 28)" />
      <text x={28} y={32} textAnchor="middle" fontSize={9} fontWeight={700} fill={P.dark}>
        {pct.toFixed(1)}%
      </text>
    </svg>
  );
}

const TTip = ({ active, payload, label, pre = "", suf = "" }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: P.dark, color: "#fff", padding: "6px 12px",
      borderRadius: 6, fontSize: 11, boxShadow: "0 2px 8px rgba(0,0,0,.3)" }}>
      <div style={{ fontWeight: 700, marginBottom: 2 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i}>{pre}{typeof p.value === "number" ? p.value.toLocaleString("en-IN") : p.value}{suf}</div>
      ))}
    </div>
  );
};

const Card = ({ title, children }) => (
  <div style={{ background: P.card, borderRadius: 8, padding: 12,
    boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
    {title && (
      <div style={{ fontSize: 11, fontWeight: 700, color: P.dark, marginBottom: 8,
        paddingBottom: 5, borderBottom: `1px solid ${P.bg}` }}>{title}</div>
    )}
    {children}
  </div>
);

const FSelect = ({ label, value, onChange, options }) => (
  <div>
    <div style={{ fontSize: 9, fontWeight: 700, color: P.muted,
      textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 }}>{label}</div>
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{ width: "100%", padding: "4px 7px", border: `1px solid ${P.border}`,
        borderRadius: 5, fontSize: 11, color: P.dark, outline: "none",
        cursor: "pointer", background: "#fff" }}>
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  </div>
);

const ExportBtn = ({ onClick, icon, label, color }) => (
  <button onClick={onClick} style={{
    display: "flex", alignItems: "center", gap: 5,
    padding: "5px 12px", borderRadius: 5, cursor: "pointer", fontSize: 11,
    fontWeight: 600, border: `1px solid ${color}`,
    background: color, color: "#fff", transition: "opacity .15s",
  }}
    onMouseEnter={(e) => (e.currentTarget.style.opacity = ".85")}
    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
  >
    <span>{icon}</span> {label}
  </button>
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function EmployeeDashboard({ user = {}, onLogout }) {
  const [rawRows,  setRawRows]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [tab,      setTab]      = useState("Summary");

  // Filters
  const [fProject,  setFProject]  = useState("All");
  const [fLocation, setFLocation] = useState("All");
  const [fType,     setFType]     = useState("All");
  const [fGrade,    setFGrade]    = useState("All");
  const [fFunction, setFFunction] = useState("All");
  const [fBilling,  setFBilling]  = useState("All");
  const [fStatus,   setFStatus]   = useState("All");
  const [fResigned, setFResigned] = useState("All"); // "All" | "Active" | "Resigned"
  const [search,    setSearch]    = useState("");
  const [showSrch,  setShowSrch]  = useState(false);

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const load = () => {
    setLoading(true); setError(null);
    fetch(`${GAS_URL}?t=${Date.now()}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((j)  => { setRawRows(normaliseRows(j)); setLoading(false); })
      .catch((e) => { setError(e.message);          setLoading(false); });
  };
  useEffect(load, []);

  // ── Derive unique employees (latest mapping row per ID) ────────────────────
  const employees = useMemo(() => latestPerEmployee(rawRows), [rawRows]);

  // ── Dropdown options ────────────────────────────────────────────────────────
  const projects  = useMemo(() => uniq(employees, "Project Name"),                     [employees]);
  const locations = useMemo(() => uniq(employees, "Location/City"),                    [employees]);
  const types     = useMemo(() => uniq(employees, "Emp Type"),                         [employees]);
  const grades    = useMemo(() => uniq(employees, "Grade"),                            [employees]);
  const functions = useMemo(() => uniq(employees, "Function (Sub SU) - Sub Function"), [employees]);
  const billings  = useMemo(() => uniq(employees, "Billing Model"),                    [employees]);

  const clearAll = () => {
    setFProject("All"); setFLocation("All"); setFType("All"); setFGrade("All");
    setFFunction("All"); setFBilling("All"); setFStatus("All");
    setFResigned("All"); setSearch("");
  };

  // ── Filtered employees ──────────────────────────────────────────────────────
  const filtered = useMemo(() => employees.filter((r) => {
    if (fProject  !== "All" && r["Project Name"]                     !== fProject)  return false;
    if (fLocation !== "All" && r["Location/City"]                    !== fLocation) return false;
    if (fType     !== "All" && r["Emp Type"]                         !== fType)     return false;
    if (fGrade    !== "All" && r["Grade"]                            !== fGrade)    return false;
    if (fFunction !== "All" && r["Function (Sub SU) - Sub Function"] !== fFunction) return false;
    if (fBilling  !== "All" && r["Billing Model"]                    !== fBilling)  return false;
    if (fStatus   !== "All" && r["Status (Billable / Bench)"]        !== fStatus)   return false;
    if (fResigned === "Resigned" && !hasResigned(r)) return false;
    if (fResigned === "Active"   &&  hasResigned(r)) return false;
    if (search && !(r["Emp Name"] || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [employees, fProject, fLocation, fType, fGrade, fFunction, fBilling, fStatus, fResigned, search]);

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const total    = filtered.length;
  const billable = filtered.filter((r) => r["Status (Billable / Bench)"] === "Billable").length;
  const bench    = total - billable;
  const billPct  = total > 0 ? (billable / total) * 100 : 0;
  const totalRev = filtered.reduce((s, r) => s + (Number(r["Bill Rate"]) || 0), 0);
  const resigned = filtered.filter(hasResigned).length;
  const active   = total - resigned;

  // ── Chart data ──────────────────────────────────────────────────────────────
  const byProject        = useMemo(() => grp(filtered, "Project Name"),                     [filtered]);
  const byLocation       = useMemo(() => grp(filtered, "Location/City"),                    [filtered]);
  const byFunction       = useMemo(() => grp(filtered, "Function (Sub SU) - Sub Function"), [filtered]);

  const revenueByProject = useMemo(() => {
    const m = {};
    filtered.forEach((r) => {
      const k = r["Project Name"] || "Unknown";
      m[k] = (m[k] || 0) + (Number(r["Bill Rate"]) || 0);
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1])
      .map(([name, v]) => ({ name, revenue: Math.round(v / 1000) }));
  }, [filtered]);

  const trendData = useMemo(() => {
    const m = {};
    rawRows.forEach((r) => {
      const dt = new Date(r["Mapping Date"]);
      if (isNaN(dt)) return;
      const k = dt.toLocaleString("en", { month: "short", year: "2-digit" });
      m[k] = (m[k] || 0) + 1;
    });
    return Object.entries(m)
      .sort((a, b) => new Date("1 " + a[0]) - new Date("1 " + b[0]))
      .slice(-8)
      .map(([month, count]) => ({ month, count }));
  }, [rawRows]);

  // Resigned trend by month of DOE
  const resignedTrend = useMemo(() => {
    const m = {};
    employees.filter(hasResigned).forEach((r) => {
      const dt = new Date(r["DOE"]);
      if (isNaN(dt)) return;
      const k = dt.toLocaleString("en", { month: "short", year: "2-digit" });
      m[k] = (m[k] || 0) + 1;
    });
    return Object.entries(m)
      .sort((a, b) => new Date("1 " + a[0]) - new Date("1 " + b[0]))
      .map(([month, count]) => ({ month, count }));
  }, [employees]);

  const donutData = [
    { name: "Billable", value: billable },
    { name: "Bench",    value: bench    },
  ];

  const attritionData = [
    { name: "Active",   value: active   },
    { name: "Resigned", value: resigned },
  ];

  // ── Export ──────────────────────────────────────────────────────────────────
  const ts = new Date().toISOString().slice(0, 10);
  const handleExportCSV   = () => exportCSV(filtered,   `employees_${ts}.csv`);
  const handleExportExcel = () => exportExcel(filtered, `employees_${ts}.xlsx`);

  // ── Status toggle pill ──────────────────────────────────────────────────────
  const StatusPill = ({ st }) => {
    const on     = fStatus === st;
    const isBill = st === "Billable";
    return (
      <span onClick={() => setFStatus(on ? "All" : st)} style={{
        padding: "2px 9px", borderRadius: 3, fontSize: 10, fontWeight: 700,
        cursor: "pointer", transition: "all .15s",
        background: on ? (isBill ? P.blue2 : P.red) : (isBill ? "#e3f2fd" : "#fdecea"),
        color:      on ? "#fff"  : (isBill ? P.blue1 : "#c62828"),
        border: `1px solid ${isBill ? "#90caf9" : "#ef9a9a"}`,
      }}>{st}</span>
    );
  };

  const ResignedPill = ({ label, val }) => {
    const on = fResigned === val;
    return (
      <span onClick={() => setFResigned(on ? "All" : val)} style={{
        padding: "2px 9px", borderRadius: 3, fontSize: 10, fontWeight: 700,
        cursor: "pointer", transition: "all .15s",
        background: on ? P.purple : "#f3e5f5",
        color:      on ? "#fff"   : P.purple,
        border: `1px solid #ce93d8`,
      }}>{label}</span>
    );
  };

  // ── Loading / Error states ──────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "70vh", background: P.bg,
      fontFamily: "'Segoe UI',sans-serif", gap: 16 }}>
      <div style={{ width: 46, height: 46, border: `5px solid ${P.border}`,
        borderTop: `5px solid ${P.blue2}`, borderRadius: "50%",
        animation: "spin .8s linear infinite" }} />
      <div style={{ color: P.muted, fontSize: 13 }}>Fetching dashboard data…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error) return (
    <div style={{ fontFamily: "'Segoe UI',sans-serif", background: P.bg, minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 10,
        padding: 28, maxWidth: 420, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
        <div style={{ fontWeight: 700, color: "#856404", marginBottom: 6 }}>Failed to load data</div>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>{error}</div>
        <button onClick={load} style={{ padding: "7px 20px", background: P.blue2, color: "#fff",
          border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 600 }}>↻ Retry</button>
      </div>
    </div>
  );

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Segoe UI',sans-serif", background: P.bg,
      minHeight: "100vh", color: P.dark, fontSize: 12 }}>

      {/* HEADER */}
      <div style={{ background: P.dark, color: "#fff", padding: "10px 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 2px 8px rgba(0,0,0,.25)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: .3 }}>
          📊 Employee Utilization
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,.55)" }}>
            {total} employees · {rawRows.length} records
          </div>
          {user?.movateId && (
            <div style={{ display:"flex", alignItems:"center", gap:6,
              background:"rgba(255,255,255,.1)", borderRadius:6,
              padding:"4px 10px", fontSize:11 }}>
              <span style={{ fontSize:14 }}>👤</span>
              <span style={{ color:"#fff", fontWeight:600 }}>{user.name || user.movateId}</span>
            </div>
          )}
          <button onClick={load} style={{ background: "rgba(255,255,255,.15)",
            border: "1px solid rgba(255,255,255,.3)", color: "#fff",
            borderRadius: 5, padding: "3px 10px", fontSize: 11, cursor: "pointer" }}>
            ↻ Refresh
          </button>
          {["Summary","Detailed View"].map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "4px 13px", borderRadius: 4, cursor: "pointer", fontSize: 11,
              border: "1px solid rgba(255,255,255,.35)",
              background: tab === t ? "#fff" : "transparent",
              color:       tab === t ? P.dark : "#fff",
              fontWeight:  tab === t ? 700    : 400,
            }}>{t}{t === "Detailed View" ? " ▾" : ""}</button>
          ))}
          {onLogout && (
            <button onClick={onLogout} style={{
              background:"rgba(229,57,53,.25)", border:"1px solid rgba(229,57,53,.5)",
              color:"#fff", borderRadius:5, padding:"3px 10px", fontSize:11,
              cursor:"pointer", fontWeight:600,
            }}>⎋ Logout</button>
          )}
        </div>
      </div>

      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>

        {/* ── KPI ROW (6 cards) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 8 }}>

          {/* Total */}
          <div style={{ background:P.card, borderRadius:8, padding:"10px 12px",
            boxShadow:"0 1px 4px rgba(0,0,0,.08)", display:"flex", alignItems:"center",
            gap:10, borderLeft:`3px solid ${P.dark}` }}>
            <div style={{ width:36,height:36,borderRadius:7,background:"#e3eaf5",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0 }}>👥</div>
            <div>
              <div style={{ fontSize:10,color:P.muted,fontWeight:500,marginBottom:1 }}>Total Employees</div>
              <div style={{ fontSize:20,fontWeight:800,lineHeight:1 }}>{total}</div>
              <div style={{ fontSize:9,color:"#aaa",marginTop:2 }}>{rawRows.length} total records</div>
            </div>
          </div>

          {/* Billable */}
          <div style={{ background:P.card, borderRadius:8, padding:"10px 12px",
            boxShadow:"0 1px 4px rgba(0,0,0,.08)", display:"flex", alignItems:"center",
            gap:10, borderLeft:`3px solid ${P.blue2}` }}>
            <div style={{ width:36,height:36,borderRadius:7,background:"#e3f2fd",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0 }}>✅</div>
            <div>
              <div style={{ fontSize:10,color:P.muted,fontWeight:500,marginBottom:1 }}>Billable</div>
              <div style={{ fontSize:20,fontWeight:800,lineHeight:1,color:P.blue1 }}>{billable}</div>
              <div style={{ fontSize:9,color:"#aaa",marginTop:2 }}>Active on projects</div>
            </div>
          </div>

          {/* Bench */}
          <div style={{ background:P.card, borderRadius:8, padding:"10px 12px",
            boxShadow:"0 1px 4px rgba(0,0,0,.08)", display:"flex", alignItems:"center",
            gap:10, borderLeft:`3px solid ${P.red}` }}>
            <div style={{ width:36,height:36,borderRadius:7,background:"#fdecea",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0 }}>⏸️</div>
            <div>
              <div style={{ fontSize:10,color:P.muted,fontWeight:500,marginBottom:1 }}>Bench</div>
              <div style={{ fontSize:20,fontWeight:800,lineHeight:1,color:P.red }}>{bench}</div>
              <div style={{ fontSize:9,color:"#aaa",marginTop:2 }}>Awaiting assignment</div>
            </div>
          </div>

          {/* Billable % donut */}
          <div style={{ background:P.card, borderRadius:8, padding:"10px 12px",
            boxShadow:"0 1px 4px rgba(0,0,0,.08)", display:"flex", alignItems:"center",
            gap:10, borderLeft:`3px solid ${P.green}` }}>
            <DonutGauge pct={billPct} color={P.green} />
            <div>
              <div style={{ fontSize:10,color:P.muted,fontWeight:500,marginBottom:1 }}>Billable %</div>
              <div style={{ fontSize:20,fontWeight:800,lineHeight:1,color:P.green }}>
                {billPct.toFixed(1)}%
              </div>
              <div style={{ fontSize:9,color:"#aaa",marginTop:2 }}>of active workforce</div>
            </div>
          </div>

          {/* Resigned */}
          <div style={{ background:P.card, borderRadius:8, padding:"10px 12px",
            boxShadow:"0 1px 4px rgba(0,0,0,.08)", display:"flex", alignItems:"center",
            gap:10, borderLeft:`3px solid ${P.purple}`,
            cursor:"pointer", transition:"box-shadow .15s" }}
            onClick={() => setFResigned(fResigned === "Resigned" ? "All" : "Resigned")}
            title="Click to filter resigned employees">
            <div style={{ width:36,height:36,borderRadius:7,background:"#f3e5f5",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0 }}>🚪</div>
            <div>
              <div style={{ fontSize:10,color:P.muted,fontWeight:500,marginBottom:1 }}>Resigned</div>
              <div style={{ fontSize:20,fontWeight:800,lineHeight:1,color:P.purple }}>{resigned}</div>
              <div style={{ fontSize:9,color:"#aaa",marginTop:2 }}>
                {total > 0 ? ((resigned/total)*100).toFixed(1) : 0}% attrition rate
              </div>
            </div>
          </div>

          {/* Revenue */}
          <div style={{ background:P.card, borderRadius:8, padding:"10px 12px",
            boxShadow:"0 1px 4px rgba(0,0,0,.08)", display:"flex", alignItems:"center",
            gap:10, borderLeft:`3px solid ${P.orange}` }}>
            <div style={{ width:36,height:36,borderRadius:7,background:"#fff3e0",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0 }}>💰</div>
            <div>
              <div style={{ fontSize:10,color:P.muted,fontWeight:500,marginBottom:1 }}>Total Bill Rate</div>
              <div style={{ fontSize:13,fontWeight:800,lineHeight:1,color:P.orange }}>{fmt(totalRev)}</div>
              <div style={{ fontSize:9,color:"#aaa",marginTop:2 }}>Sum of current rates</div>
            </div>
          </div>
        </div>

        {/* ── ROW 2: Filters + BvB + By Project ── */}
        <div style={{ display:"grid", gridTemplateColumns:"185px 1fr 1fr", gap:10 }}>

          {/* FILTERS */}
          <div style={{ background:P.card, borderRadius:8, padding:12,
            boxShadow:"0 1px 4px rgba(0,0,0,.08)", display:"flex", flexDirection:"column", gap:8 }}>
            <FSelect label="Project Name"  value={fProject}  onChange={setFProject}  options={projects}  />
            <FSelect label="Location"      value={fLocation} onChange={setFLocation} options={locations} />
            <FSelect label="Emp Type"      value={fType}     onChange={setFType}     options={types}     />
            <FSelect label="Grade"         value={fGrade}    onChange={setFGrade}    options={grades}    />
            <FSelect label="Function"      value={fFunction} onChange={setFFunction} options={functions} />
            <FSelect label="Billing Model" value={fBilling}  onChange={setFBilling}  options={billings}  />
            <div>
              <div style={{ fontSize:9, fontWeight:700, color:P.muted, textTransform:"uppercase",
                letterSpacing:.6, marginBottom:4 }}>Status</div>
              <div style={{ display:"flex", gap:5 }}>
                <StatusPill st="Billable" />
                <StatusPill st="Bench"    />
              </div>
            </div>
            <div>
              <div style={{ fontSize:9, fontWeight:700, color:P.muted, textTransform:"uppercase",
                letterSpacing:.6, marginBottom:4 }}>Employment</div>
              <div style={{ display:"flex", gap:5 }}>
                <ResignedPill label="Active"   val="Active"   />
                <ResignedPill label="Resigned" val="Resigned" />
              </div>
            </div>
            <button onClick={clearAll} style={{ marginTop:2, padding:"4px 0", background:P.bg,
              border:`1px solid ${P.border}`, borderRadius:5, fontSize:10,
              color:P.muted, cursor:"pointer" }}>
              ✕ Clear Filters
            </button>
          </div>

          {/* BILLABLE vs BENCH */}
          <Card title="Billable vs Bench">
            <div style={{ display:"flex", gap:12, alignItems:"center" }}>
              <div style={{ flexShrink:0 }}>
                <PieChart width={105} height={105}>
                  <Pie data={donutData} cx={50} cy={50} innerRadius={30} outerRadius={48}
                    dataKey="value" startAngle={90} endAngle={-270} paddingAngle={3}>
                    {donutData.map((_, i) => <Cell key={i} fill={[P.blue2, P.red][i]} />)}
                  </Pie>
                </PieChart>
                <div style={{ textAlign:"center", marginTop:-6 }}>
                  <div style={{ fontSize:12, fontWeight:800, color:P.dark }}>{billPct.toFixed(1)}%</div>
                  <div style={{ fontSize:9, color:"#888" }}>Billable</div>
                </div>
                {[["Billable",P.blue2],["Bench",P.red]].map(([l,c]) => (
                  <div key={l} style={{ display:"flex", alignItems:"center", gap:4,
                    fontSize:9, color:"#555", marginTop:3 }}>
                    <span style={{ width:7,height:7,borderRadius:"50%",background:c,display:"inline-block" }}/>
                    {l}
                  </div>
                ))}
              </div>
              <div style={{ flex:1 }}>
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart layout="vertical"
                    data={[
                      { label:"Billable", val:parseFloat(billPct.toFixed(1)) },
                      { label:"Bench",    val:parseFloat((100-billPct).toFixed(1)) },
                    ]}
                    margin={{ top:0, right:24, bottom:0, left:0 }}>
                    <XAxis type="number" tick={{fontSize:9}} axisLine={false} tickLine={false} domain={[0,100]} />
                    <YAxis type="category" dataKey="label" tick={{fontSize:10}} axisLine={false} tickLine={false} width={50} />
                    <CartesianGrid horizontal={false} stroke={P.bg} />
                    <Tooltip content={<TTip suf="%" />} />
                    <Bar dataKey="val" radius={[0,3,3,0]}>
                      {[P.blue2, P.red].map((c,i) => <Cell key={i} fill={c} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          {/* EMPLOYEES BY PROJECT */}
          <Card title="Employees by Project">
            <ResponsiveContainer width="100%" height={135}>
              <BarChart layout="vertical" data={byProject} margin={{top:0,right:28,bottom:0,left:10}}>
                <XAxis type="number" tick={{fontSize:9}} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{fontSize:10}} axisLine={false} tickLine={false} width={110} />
                <CartesianGrid horizontal={false} stroke={P.bg} />
                <Tooltip content={<TTip suf=" employees" />} />
                <Bar dataKey="count" radius={[0,4,4,0]}>
                  {byProject.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* ── ROW 3: Location + Revenue + Attrition donut ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>

          <Card title="Employees by Location">
            <ResponsiveContainer width="100%" height={130}>
              <BarChart layout="vertical" data={byLocation} margin={{top:0,right:28,bottom:0,left:10}}>
                <XAxis type="number" tick={{fontSize:9}} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{fontSize:10}} axisLine={false} tickLine={false} width={70} />
                <CartesianGrid horizontal={false} stroke={P.bg} />
                <Tooltip content={<TTip suf=" employees" />} />
                <Bar dataKey="count" radius={[0,4,4,0]}>
                  {byLocation.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Revenue by Project (₹K)">
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={revenueByProject} margin={{top:5,right:10,bottom:5,left:0}}>
                <XAxis dataKey="name" tick={{fontSize:9}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize:9}} axisLine={false} tickLine={false} tickFormatter={(v)=>`₹${v}K`} />
                <CartesianGrid vertical={false} stroke={P.bg} />
                <Tooltip content={<TTip pre="₹" suf="K" />} />
                <Bar dataKey="revenue" radius={[4,4,0,0]}>
                  {revenueByProject.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* ATTRITION */}
          <Card title="Attrition Overview">
            <div style={{ display:"flex", gap:16, alignItems:"center" }}>
              <div style={{ flexShrink:0 }}>
                <PieChart width={105} height={105}>
                  <Pie data={attritionData} cx={50} cy={50} innerRadius={30} outerRadius={48}
                    dataKey="value" startAngle={90} endAngle={-270} paddingAngle={3}>
                    {attritionData.map((_, i) => <Cell key={i} fill={[P.green, P.purple][i]} />)}
                  </Pie>
                </PieChart>
                <div style={{ textAlign:"center", marginTop:-6 }}>
                  <div style={{ fontSize:12, fontWeight:800, color:P.purple }}>{resigned}</div>
                  <div style={{ fontSize:9, color:"#888" }}>Resigned</div>
                </div>
              </div>
              <div style={{ flex:1, display:"flex", flexDirection:"column", gap:10 }}>
                {[["Active", active, P.green], ["Resigned", resigned, P.purple]].map(([l,v,c]) => (
                  <div key={l}>
                    <div style={{ display:"flex", justifyContent:"space-between",
                      fontSize:10, marginBottom:3 }}>
                      <span style={{ color:P.muted, fontWeight:600 }}>{l}</span>
                      <span style={{ fontWeight:700, color:c }}>{v}</span>
                    </div>
                    <div style={{ height:6, background:"#eee", borderRadius:3 }}>
                      <div style={{ height:6, background:c, borderRadius:3,
                        width: total > 0 ? `${(v/total)*100}%` : "0%" }} />
                    </div>
                  </div>
                ))}
                {resignedTrend.length > 0 && (
                  <div style={{ fontSize:9, color:P.muted, marginTop:4 }}>
                    Most recent exits: {resignedTrend.slice(-2).map((d) => `${d.count} in ${d.month}`).join(", ")}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* ── ROW 4: Trend + Resigned Trend ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <Card title="Mapping Activity Trend">
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={trendData} margin={{top:5,right:10,bottom:5,left:0}}>
                <XAxis dataKey="month" tick={{fontSize:9}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize:9}} axisLine={false} tickLine={false} />
                <CartesianGrid stroke={P.bg} />
                <Tooltip content={<TTip suf=" mappings" />} />
                <Line type="monotone" dataKey="count" stroke={P.blue2} strokeWidth={2.5}
                  dot={{ r:4, fill:P.blue2, stroke:"#fff", strokeWidth:2 }} activeDot={{ r:6 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Resignations by Month (DOE)">
            <ResponsiveContainer width="100%" height={120}>
              {resignedTrend.length > 0 ? (
                <BarChart data={resignedTrend} margin={{top:5,right:10,bottom:5,left:0}}>
                  <XAxis dataKey="month" tick={{fontSize:9}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize:9}} axisLine={false} tickLine={false} allowDecimals={false} />
                  <CartesianGrid vertical={false} stroke={P.bg} />
                  <Tooltip content={<TTip suf=" resignations" />} />
                  <Bar dataKey="count" fill={P.purple} radius={[4,4,0,0]} />
                </BarChart>
              ) : (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
                  height:120, color:P.muted, fontSize:11 }}>
                  No resignation data (no DOE values found)
                </div>
              )}
            </ResponsiveContainer>
          </Card>
        </div>

        {/* ── ROW 5: Function + Employee Table ── */}
        <div style={{ display:"grid", gridTemplateColumns:"190px 1fr", gap:10 }}>

          <Card title="By Function">
            <ResponsiveContainer width="100%" height={155}>
              <BarChart layout="vertical" data={byFunction} margin={{top:0,right:24,bottom:0,left:0}}>
                <XAxis type="number" tick={{fontSize:9}} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{fontSize:10}} axisLine={false} tickLine={false} width={60} />
                <CartesianGrid horizontal={false} stroke={P.bg} />
                <Tooltip content={<TTip suf=" employees" />} />
                <Bar dataKey="count" radius={[0,4,4,0]}>
                  {byFunction.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* EMPLOYEE TABLE */}
          <div style={{ background:P.card, borderRadius:8, padding:12,
            boxShadow:"0 1px 4px rgba(0,0,0,.08)", overflowX:"auto" }}>

            {/* Table header bar */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
              marginBottom:7, paddingBottom:7, borderBottom:`1px solid ${P.bg}` }}>
              <div style={{ fontSize:11, fontWeight:700, color:P.dark }}>Employee Details</div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                {showSrch && (
                  <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name…" style={{ padding:"3px 7px",
                      border:`1px solid ${P.border}`, borderRadius:5,
                      fontSize:10, outline:"none", width:130, color:P.dark }} />
                )}
                <span style={{ cursor:"pointer", color:"#888", fontSize:14 }}
                  onClick={() => { setShowSrch(!showSrch); setSearch(""); }}>🔍</span>
                <span style={{ fontSize:10, color:P.muted, background:P.bg,
                  padding:"2px 8px", borderRadius:4 }}>{filtered.length} records</span>

                {/* Export Buttons */}
                <ExportBtn onClick={handleExportCSV}
                  icon="📄" label="Export CSV"   color="#546e7a" />
                <ExportBtn onClick={handleExportExcel}
                  icon="📊" label="Export Excel" color={P.green} />
              </div>
            </div>

            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
              <thead>
                <tr style={{ background:P.dark, color:"#fff" }}>
                  {[
                    "SR No","Emp ID","Emp Name","Project","Function","Status",
                    "Bill Rate","Location","Grade","Billing Model",
                    "Active/Inactive","DOJ","DOE",
                    "Nokia Ramp Date","Nokia Ramp Down Date","Nokia LWD",
                    "Ramp Down Issue Date","Bench Start Date","Bench End Date",
                    "Employment",
                  ].map((h) => (
                    <th key={h} style={{ padding:"6px 10px", textAlign:"left",
                      fontWeight:600, fontSize:10, whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => {
                  const st      = e["Status (Billable / Bench)"];
                  const retired = hasResigned(e);
                  const even    = i % 2 === 0;
                  return (
                    <tr key={`${e["Emp ID"]}-${i}`}
                      style={{ background: retired ? "#fdf6ff" : (even ? P.card : P.stripe) }}
                      onMouseEnter={(ev) => (ev.currentTarget.style.background = "#e8f0fe")}
                      onMouseLeave={(ev) => (ev.currentTarget.style.background = retired ? "#fdf6ff" : (even ? P.card : P.stripe))}>

                      {/* SR No */}
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}`,
                        color:P.muted, textAlign:"center", fontWeight:600 }}>
                        {e["SR NO"] || "—"}
                      </td>

                      {/* Emp ID */}
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}`,
                        color:P.muted, fontFamily:"monospace" }}>{e["Emp ID"]}</td>

                      {/* Emp Name */}
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}`,
                        fontWeight:600 }}>{e["Emp Name"]}</td>

                      {/* Project */}
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}` }}>
                        {e["Project Name"]}</td>

                      {/* Function */}
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}` }}>
                        {e["Function (Sub SU) - Sub Function"]}</td>

                      {/* Status */}
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}` }}>
                        <span style={{ padding:"2px 7px", borderRadius:3, fontSize:9, fontWeight:700,
                          background:st==="Billable"?P.blue2:P.red, color:"#fff" }}>{st}</span>
                      </td>

                      {/* Bill Rate */}
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}` }}>
                        {Number(e["Bill Rate"]) > 0
                          ? <span style={{ fontWeight:600, color:P.green }}>
                              ₹{Number(e["Bill Rate"]).toLocaleString("en-IN")}
                            </span>
                          : <span style={{ color:"#bbb" }}>—</span>}
                      </td>

                      {/* Location */}
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}` }}>
                        {e["Location/City"]}</td>

                      {/* Grade */}
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}` }}>
                        <span style={{ background:"#e3eaf5", color:P.dark, padding:"2px 6px",
                          borderRadius:3, fontSize:9, fontWeight:700 }}>{e["Grade"]}</span>
                      </td>

                      {/* Billing Model */}
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}` }}>
                        {e["Billing Model"]}</td>

                      {/* Active / Inactive */}
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}` }}>
                        {e["Active/Inactive"] ? (
                          <span style={{
                            padding:"2px 7px", borderRadius:3, fontSize:9, fontWeight:700,
                            background: String(e["Active/Inactive"]).toLowerCase() === "active"
                              ? "#e8f5e9" : "#f5f5f5",
                            color: String(e["Active/Inactive"]).toLowerCase() === "active"
                              ? P.green : P.muted,
                            border: `1px solid ${
                              String(e["Active/Inactive"]).toLowerCase() === "active"
                                ? "#a5d6a7" : "#ddd"}`,
                          }}>
                            {e["Active/Inactive"]}
                          </span>
                        ) : <span style={{ color:"#bbb" }}>—</span>}
                      </td>

                      {/* DOJ */}
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}`,
                        color:P.muted, whiteSpace:"nowrap" }}>{fmtDate(e["DOJ"])}</td>

                      {/* DOE */}
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}`,
                        color: retired ? P.purple : "#bbb", fontWeight: retired ? 600 : 400,
                        whiteSpace:"nowrap" }}>
                        {retired ? fmtDate(e["DOE"]) : "—"}
                      </td>

                      {/* Nokia Ramp Date */}
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}`,
                        color:P.muted, whiteSpace:"nowrap" }}>
                        {fmtDate(e["Nokia Ramp Date"])}
                      </td>

                      {/* Nokia Ramp Down Date */}
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}`,
                        color:P.muted, whiteSpace:"nowrap" }}>
                        {fmtDate(e["Nokia Ramp down Date"])}
                      </td>

                      {/* Nokia LWD */}
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}`,
                        color:P.muted, whiteSpace:"nowrap" }}>
                        {fmtDate(e["Nokia LWD"])}
                      </td>

                      {/* Ramp Down Issue Date */}
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}`,
                        color:P.muted, whiteSpace:"nowrap" }}>
                        {fmtDate(e["Ramp down issue Date"])}
                      </td>

                      {/* Bench Start Date */}
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}`,
                        color:P.muted, whiteSpace:"nowrap" }}>
                        {fmtDate(e["Bench start Date"])}
                      </td>

                      {/* Bench End Date */}
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}`,
                        color:P.muted, whiteSpace:"nowrap" }}>
                        {fmtDate(e["Bench End Date"])}
                      </td>

                      {/* Employment status (Active / Resigned) */}
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}` }}>
                        {retired
                          ? <span style={{ padding:"2px 7px", borderRadius:3, fontSize:9, fontWeight:700,
                              background:"#f3e5f5", color:P.purple, border:`1px solid #ce93d8` }}>
                              🚪 Resigned
                            </span>
                          : <span style={{ padding:"2px 7px", borderRadius:3, fontSize:9, fontWeight:700,
                              background:"#e8f5e9", color:P.green, border:`1px solid #a5d6a7` }}>
                              ✓ Active
                            </span>
                        }
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={20} style={{ textAlign:"center", padding:24, color:P.muted }}>
                    No employees match the current filters.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}