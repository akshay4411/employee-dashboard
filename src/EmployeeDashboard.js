import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from "recharts";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const GAS_URL =
  "https://script.google.com/macros/s/AKfycbxAkN7YAgKtvLfeOXg7J6wflXMqJ27e08bwOdirTH-V4IB3KSGK2JGochP49vtYs9W3/exec";

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
  muted:  "#6b7a8d",
  bg:     "#f0f4f8",
  card:   "#ffffff",
  border: "#dde3ea",
  stripe: "#f5f9ff",
};
const BAR_COLORS = [P.blue1, P.blue2, P.blue3, P.blue4, "#64B5F6", "#90CAF9"];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
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

// Moved outside component so useMemo deps are stable (fixes react-hooks/exhaustive-deps)
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

// ─── SHARED UI ───────────────────────────────────────────────────────────────
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
    {title && <div style={{ fontSize: 11, fontWeight: 700, color: P.dark, marginBottom: 8,
      paddingBottom: 5, borderBottom: `1px solid ${P.bg}` }}>{title}</div>}
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

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function EmployeeDashboard() {
  const [rawRows,  setRawRows]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [tab,      setTab]      = useState("Summary");

  const [fProject,  setFProject]  = useState("All");
  const [fLocation, setFLocation] = useState("All");
  const [fType,     setFType]     = useState("All");
  const [fGrade,    setFGrade]    = useState("All");
  const [fFunction, setFFunction] = useState("All");
  const [fBilling,  setFBilling]  = useState("All");
  const [fStatus,   setFStatus]   = useState("All");
  const [search,    setSearch]    = useState("");
  const [showSrch,  setShowSrch]  = useState(false);

  // ── fetch ──────────────────────────────────────────────────────────────────
  const load = () => {
    setLoading(true); setError(null);
    fetch(`${GAS_URL}?t=${Date.now()}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((j)  => { setRawRows(normaliseRows(j)); setLoading(false); })
      .catch((e) => { setError(e.message);          setLoading(false); });
  };
  useEffect(load, []);

  // ── unique employees (latest mapping per ID) ───────────────────────────────
  const employees = useMemo(() => latestPerEmployee(rawRows), [rawRows]);

  // ── filter options ─────────────────────────────────────────────────────────
  const projects  = useMemo(() => uniq(employees, "Project Name"),                     [employees]);
  const locations = useMemo(() => uniq(employees, "Location/City"),                    [employees]);
  const types     = useMemo(() => uniq(employees, "Emp Type"),                         [employees]);
  const grades    = useMemo(() => uniq(employees, "Grade"),                            [employees]);
  const functions = useMemo(() => uniq(employees, "Function (Sub SU) - Sub Function"), [employees]);
  const billings  = useMemo(() => uniq(employees, "Billing Model"),                    [employees]);

  const clearAll = () => {
    setFProject("All"); setFLocation("All"); setFType("All"); setFGrade("All");
    setFFunction("All"); setFBilling("All"); setFStatus("All"); setSearch("");
  };

  // ── filtered set ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => employees.filter((r) =>
    (fProject  === "All" || r["Project Name"]                     === fProject)  &&
    (fLocation === "All" || r["Location/City"]                    === fLocation) &&
    (fType     === "All" || r["Emp Type"]                         === fType)     &&
    (fGrade    === "All" || r["Grade"]                            === fGrade)    &&
    (fFunction === "All" || r["Function (Sub SU) - Sub Function"] === fFunction) &&
    (fBilling  === "All" || r["Billing Model"]                    === fBilling)  &&
    (fStatus   === "All" || r["Status (Billable / Bench)"]        === fStatus)   &&
    (!search   || (r["Emp Name"]||"").toLowerCase().includes(search.toLowerCase()))
  ), [employees, fProject, fLocation, fType, fGrade, fFunction, fBilling, fStatus, search]);

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const total    = filtered.length;
  const billable = filtered.filter((r) => r["Status (Billable / Bench)"] === "Billable").length;
  const bench    = total - billable;
  const billPct  = total > 0 ? (billable / total) * 100 : 0;
  const totalRev = filtered.reduce((s, r) => s + (Number(r["Bill Rate"]) || 0), 0);

  // ── chart data ─────────────────────────────────────────────────────────────
  const byProject  = useMemo(() => grp(filtered, "Project Name"),                     [filtered]);
  const byLocation = useMemo(() => grp(filtered, "Location/City"),                    [filtered]);
  const byFunction = useMemo(() => grp(filtered, "Function (Sub SU) - Sub Function"), [filtered]);

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

  const donutData = [
    { name: "Billable", value: billable },
    { name: "Bench",    value: bench    },
  ];

  // ── status toggle pill ─────────────────────────────────────────────────────
  const StatusPill = ({ st }) => {
    const on = fStatus === st;
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

  // ── loading / error ────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "70vh", background: P.bg,
      fontFamily: "'Segoe UI',sans-serif", gap: 16 }}>
      <div style={{ width: 46, height: 46, border: `5px solid ${P.border}`,
        borderTop: `5px solid ${P.blue2}`, borderRadius: "50%",
        animation: "spin .8s linear infinite" }} />
      <div style={{ color: P.muted, fontSize: 13 }}>Fetching dashboard data from Google Sheets…</div>
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
          border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 600 }}>
          ↻ Retry
        </button>
      </div>
    </div>
  );

  // ── RENDER ─────────────────────────────────────────────────────────────────
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
          <button onClick={load} style={{ background: "rgba(255,255,255,.15)",
            border: "1px solid rgba(255,255,255,.3)", color: "#fff",
            borderRadius: 5, padding: "3px 10px", fontSize: 11, cursor: "pointer" }}>
            ↻ Refresh
          </button>
          {["Summary", "Detailed View"].map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "4px 13px", borderRadius: 4, cursor: "pointer", fontSize: 11,
              border: "1px solid rgba(255,255,255,.35)",
              background: tab === t ? "#fff" : "transparent",
              color:       tab === t ? P.dark : "#fff",
              fontWeight:  tab === t ? 700    : 400,
            }}>{t}{t === "Detailed View" ? " ▾" : ""}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>

        {/* ── KPI ROW ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
          {[
            { accent:P.dark,   icon:"👥", bg:"#e3eaf5", label:"Total Employees",
              val:<>{total}</>, sub:`${rawRows.length} total records` },
            { accent:P.blue2,  icon:"✅", bg:"#e3f2fd", label:"Billable Employees",
              val:<span style={{color:P.blue1}}>{billable}</span>, sub:"Active on projects" },
            { accent:P.red,    icon:"⏸️", bg:"#fdecea", label:"Bench Employees",
              val:<span style={{color:P.red}}>{bench}</span>, sub:"Awaiting assignment" },
            null, // donut card
            { accent:P.orange, icon:"💰", bg:"#fff3e0", label:"Total Bill Rate",
              val:<span style={{fontSize:13, color:P.orange}}>{fmt(totalRev)}</span>,
              sub:"Sum of current bill rates" },
          ].map((k, i) => {
            if (i === 3) return (
              <div key={i} style={{ background:P.card, borderRadius:8, padding:"10px 12px",
                boxShadow:"0 1px 4px rgba(0,0,0,.08)", display:"flex", alignItems:"center",
                gap:10, borderLeft:`3px solid ${P.green}` }}>
                <DonutGauge pct={billPct} color={P.green} />
                <div>
                  <div style={{ fontSize:10, color:P.muted, fontWeight:500, marginBottom:1 }}>Billable %</div>
                  <div style={{ fontSize:20, fontWeight:800, color:P.green, lineHeight:1 }}>
                    {billPct.toFixed(1)}%
                  </div>
                  <div style={{ fontSize:9, color:"#aaa", marginTop:2 }}>of active workforce</div>
                </div>
              </div>
            );
            return (
              <div key={i} style={{ background:P.card, borderRadius:8, padding:"10px 12px",
                boxShadow:"0 1px 4px rgba(0,0,0,.08)", display:"flex", alignItems:"center",
                gap:10, borderLeft:`3px solid ${k.accent}` }}>
                <div style={{ width:36, height:36, borderRadius:7, background:k.bg,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:16, flexShrink:0 }}>{k.icon}</div>
                <div>
                  <div style={{ fontSize:10, color:P.muted, fontWeight:500, marginBottom:1 }}>{k.label}</div>
                  <div style={{ fontSize:20, fontWeight:800, lineHeight:1 }}>{k.val}</div>
                  <div style={{ fontSize:9, color:"#aaa", marginTop:2 }}>{k.sub}</div>
                </div>
              </div>
            );
          })}
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
                {[["Billable",P.blue2],["Bench",P.red]].map(([l,c])=>(
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

          {/* BY PROJECT */}
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

        {/* ── ROW 3: Location + Revenue + Trend ── */}
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

          <Card title="Mapping Activity Trend">
            <ResponsiveContainer width="100%" height={130}>
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
        </div>

        {/* ── ROW 4: Function + Employee Table ── */}
        <div style={{ display:"grid", gridTemplateColumns:"200px 1fr", gap:10 }}>

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
            <div style={{ fontSize:11, fontWeight:700, color:P.dark, marginBottom:7,
              display:"flex", alignItems:"center", justifyContent:"space-between",
              paddingBottom:5, borderBottom:`1px solid ${P.bg}` }}>
              <span>Employee Details</span>
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
              </div>
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
              <thead>
                <tr style={{ background:P.dark, color:"#fff" }}>
                  {["Emp ID","Emp Name","Project","Function","Status","Bill Rate","Location","Grade","Billing Model"].map((h)=>(
                    <th key={h} style={{ padding:"6px 10px", textAlign:"left",
                      fontWeight:600, fontSize:10, whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => {
                  const st = e["Status (Billable / Bench)"];
                  const even = i % 2 === 0;
                  return (
                    <tr key={`${e["Emp ID"]}-${i}`}
                      style={{ background: even ? P.card : P.stripe }}
                      onMouseEnter={(ev) => (ev.currentTarget.style.background = "#e8f0fe")}
                      onMouseLeave={(ev) => (ev.currentTarget.style.background = even ? P.card : P.stripe)}>
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}`,
                        color:P.muted, fontFamily:"monospace" }}>{e["Emp ID"]}</td>
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}`,
                        fontWeight:600 }}>{e["Emp Name"]}</td>
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}` }}>{e["Project Name"]}</td>
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}` }}>
                        {e["Function (Sub SU) - Sub Function"]}</td>
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}` }}>
                        <span style={{ padding:"2px 7px", borderRadius:3, fontSize:9, fontWeight:700,
                          background:st==="Billable"?P.blue2:P.red, color:"#fff" }}>{st}</span>
                      </td>
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}` }}>
                        {Number(e["Bill Rate"]) > 0
                          ? <span style={{ fontWeight:600, color:P.green }}>
                              ₹{Number(e["Bill Rate"]).toLocaleString("en-IN")}
                            </span>
                          : <span style={{ color:"#bbb" }}>—</span>}
                      </td>
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}` }}>{e["Location/City"]}</td>
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}` }}>
                        <span style={{ background:"#e3eaf5", color:P.dark, padding:"2px 6px",
                          borderRadius:3, fontSize:9, fontWeight:700 }}>{e["Grade"]}</span>
                      </td>
                      <td style={{ padding:"5px 10px", borderBottom:`1px solid ${P.bg}` }}>{e["Billing Model"]}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign:"center", padding:24, color:P.muted }}>
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