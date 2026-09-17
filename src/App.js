// import { useState, useEffect } from "react";
// import EmployeeDashboard from "./EmployeeDashboard";
// import LoginPage from "./Loginpage";

// export default function App() {
//   const [user, setUser] = useState(null);   // null = not logged in
//   const [ready, setReady] = useState(false); // prevents flash before session check

//   // ── Restore session from sessionStorage on page load ──────────────────────
//   useEffect(() => {
//     try {
//       const stored = sessionStorage.getItem("movate_auth");
//       if (stored) {
//         const parsed = JSON.parse(stored);
//         // Accept session only if it was created in the last 8 hours
//         const loginAt  = new Date(parsed.loginAt).getTime();
//         const eightHrs = 8 * 60 * 60 * 1000;
//         if (Date.now() - loginAt < eightHrs) {
//           setUser(parsed);
//         } else {
//           sessionStorage.removeItem("movate_auth"); // expired
//         }
//       }
//     } catch (_) {
//       sessionStorage.removeItem("movate_auth");
//     }
//     setReady(true);
//   }, []);

//   const handleLoginSuccess = (userData) => setUser(userData);

//   const handleLogout = () => {
//     sessionStorage.removeItem("movate_auth");
//     setUser(null);
//   };

//   // Avoid flashing login page before session is checked
//   if (!ready) return null;

//   if (!user) {
//     return <LoginPage onLoginSuccess={handleLoginSuccess} />;
//   }

//   return <EmployeeDashboard user={user} onLogout={handleLogout} />;
// }
#!/usr/bin/env python3

"""

IMS Daily Report — Automation Tool (GUI)

==========================================

A Tkinter desktop GUI wrapping the original IMS Daily Report automation

script (v5). Lets you pick raw export file(s), optional alarm-list

reference file(s), and an output path, then runs the exact same

step-by-step workflow as the CLI version — with a live log and a

progress bar instead of a terminal.

Run with:

    python ims_daily_report_gui.py

Requires: openpyxl  (pip install openpyxl)

Tkinter ships with standard Python on Windows/macOS; on Linux you may

need to install it separately (e.g. `sudo apt install python3-tk`).

"""

from __future__ import annotations

import csv

import queue

import sys

import threading

import time

import traceback

from datetime import datetime, timedelta

from pathlib import Path

from typing import Callable, Optional

import tkinter as tk

from tkinter import filedialog, messagebox, ttk

from openpyxl import Workbook, load_workbook

from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

from openpyxl.utils import get_column_letter

# ---------------------------------------------------------------------------

# ---------------------------  CORE LOGIC (v5)  ----------------------------

# ---------------------------------------------------------------------------

# This section is the original automation logic, unchanged in behavior.

# The only difference from the CLI script is that `log` callbacks are

# routed into the GUI's log panel instead of stdout, and long loops

# periodically check a `cancel_event` so the user can stop a run.

COL_AGENT = "agent"

COL_FIRST_OCCURRENCE = "firstoccurrence"

COL_CLEAR_OCCURRENCE = "clearoccurrence"

COL_SUMMARY = "summary"

COL_TTINCIDENT = "ttincident"

COL_CORRELATIONPARAM = "correlationparam"

COL_ALU_EQUIPROLE = "alu_equiprole"

BUCKET_1_HEADER = "Bucket_1"

BUCKET_2_HEADER = "Bucket_2"

VLOOKUP_HEADER = "VLOOKUP"

TARGET_AGENTS = {

    "bha_madagascar_zteims",

    "bha_niger_zteims",

    "bha_zambia_netact_ims",

    "bha_uganda_u2000_cr",

    "unknown",

}

EXCEL_EPOCH = datetime(1899, 12, 30)

DATE_STRING_FORMATS = (

    "%d-%m-%Y %H:%M:%S",

    "%d-%m-%Y %H:%M",

    "%d/%m/%Y %H:%M:%S",

    "%d/%m/%Y %H:%M",

    "%Y-%m-%d %H:%M:%S",

    "%Y-%m-%d %H:%M",

)

HEADER_FONT = Font(bold=True, color="FFFFFF")

HEADER_FILL = PatternFill("solid", fgColor="4472C4")

AGENT_FILL = PatternFill("solid", fgColor="D9E1F2")

BUCKET_FILL = PatternFill("solid", fgColor="F2F2F2")

REVIEW_FILL = PatternFill("solid", fgColor="FFFF00")

GRANDTOTAL_FILL = PatternFill("solid", fgColor="FFC000")

THIN_SIDE = Side(style="thin", color="BFBFBF")

THIN_BORDER = Border(left=THIN_SIDE, right=THIN_SIDE, top=THIN_SIDE, bottom=THIN_SIDE)

LogFn = Callable[[str], None]


class CancelledError(Exception):

    """Raised internally when the user cancels a run."""


def _default_log(msg: str) -> None:

    print(msg)


def _is_blank(value) -> bool:

    if value is None:

        return True

    if isinstance(value, str) and value.strip().lower() in ("", "null"):

        return True

    return False


def _is_epoch_placeholder(value) -> bool:

    return isinstance(value, datetime) and value.year == 1970


def _normalize_agent(value) -> str:

    if value is None:

        return ""

    import re

    return re.sub(r"[^a-z0-9]", "", str(value).lower())


def _is_target_agent(value) -> bool:

    normalized = _normalize_agent(value)

    return normalized in {_normalize_agent(a) for a in TARGET_AGENTS}


def _is_zambia(value) -> bool:

    normalized = _normalize_agent(value)

    return normalized == _normalize_agent("BHA_Zambia_NetAct_IMS")


# --- Alarm-list / VLOOKUP matching helpers -------------------------------

#

# These replace two bugs found against real data:

#

# 1. Column detection: read_alarm_list only recognized a column literally

#    named "summary". Some alarm-list workbooks (e.g. a Huawei ZLD export)

#    name the equivalent column "AlarmName" instead, so that file's real

#    alarm names were never loaded — every lookup against it silently

#    fell back to matching on the wrong column (e.g. "NodeName") and came

#    back #N/A even when the alarm was clearly listed.

# 2. Zambia's "direct" (no text-to-columns) match assumed its summary

#    field was a bare description. In the real exports it is always

#    "<code>|<description>", the same "number|text" shape as every other

#    agent — so the direct compare never matched. Both branches now use

#    one shared, trimmed/normalized extraction so the behavior for

#    Zambia is no longer a special case.

SUMMARY_HEADER_CANDIDATES = (

    "summary",

    "alarm name",

    "alarmname",

    "alarm description",

    "description",

    "alarm",

)


def _normalize_text(value) -> str:

    """Trim + collapse whitespace (incl. non-breaking spaces) + lowercase.

    Applied on both sides of the alarm-list comparison so that trailing

    padding in a source workbook (a common cause of false '#N/A's) and

    ordinary leading/trailing whitespace never break a match.

    """

    if value is None:

        return ""

    text = str(value).replace("\xa0", " ")

    text = " ".join(text.split())

    return text.strip().lower()


def _find_summary_column(headers: list) -> int:

    """Find the alarm-name/summary column in an alarm-list file's headers.

    Prefers an exact (case-insensitive) header match against known names;

    falls back to a substring match; falls back to column 0 only if

    nothing at all resembles a summary/alarm-name column.

    """

    lowered = [str(h).strip().lower() if h else "" for h in headers]

    for cand in SUMMARY_HEADER_CANDIDATES:

        for i, h in enumerate(lowered):

            if h == cand:

                return i

    for cand in SUMMARY_HEADER_CANDIDATES:

        for i, h in enumerate(lowered):

            if cand in h:

                return i

    return 0


def _extract_alarm_key(summary_val) -> str:

    """Extract the comparable alarm-name key from a raw 'summary' value.

    Raw summaries are shaped "<code>|<description>" for every target

    agent, Zambia included. When a pipe is present we take the text

    after the first one (the description); otherwise we use the whole

    value. Either way the result is trimmed/normalized with

    _normalize_text before comparison, matching how alarm-list keys are

    built in read_alarm_list.

    """

    if isinstance(summary_val, str) and "|" in summary_val:

        part = summary_val.split("|", 1)[1]

    else:

        part = summary_val

    return _normalize_text(part)


def _parse_datetime_value(value):

    if isinstance(value, datetime):

        return value

    if value is None:

        return None

    if isinstance(value, (int, float)):

        try:

            return EXCEL_EPOCH + timedelta(days=float(value))

        except (ValueError, OverflowError):

            return value

    if isinstance(value, str):

        v = value.strip()

        if not v:

            return None

        for fmt in DATE_STRING_FORMATS:

            try:

                return datetime.strptime(v, fmt)

            except ValueError:

                continue

    return value


def _read_any_table(path: Path) -> tuple[list, list[tuple]]:

    suffix = path.suffix.lower()

    if suffix in (".xlsx", ".xlsm"):

        wb = load_workbook(path, data_only=True)

        ws = wb[wb.sheetnames[0]]

        headers = [c.value for c in next(ws.iter_rows(min_row=1, max_row=1))]

        rows = []

        for row in ws.iter_rows(min_row=2, values_only=True):

            if all(v is None for v in row):

                continue

            rows.append(row)

    elif suffix == ".csv":

        with open(path, newline="", encoding="utf-8-sig") as f:

            reader = csv.reader(f)

            headers = next(reader)

            rows = [tuple(r) for r in reader if any(r)]

    else:

        raise ValueError(f"Unsupported format: {suffix}")

    return headers, rows


def read_raw_files(paths: list[Path], log: LogFn = _default_log) -> tuple[list[str], list[tuple]]:

    if not paths:

        raise ValueError("No raw files supplied")

    reference_headers = None

    combined_rows = []

    for path in paths:

        headers, rows = _read_any_table(path)

        headers = [str(h).strip() if h else h for h in headers]

        if reference_headers is None:

            reference_headers = headers

        elif headers != reference_headers:

            raise ValueError(f"Column mismatch in {path.name}")

        log(f"[ok] {path.name}: {len(rows)} rows read")

        combined_rows.extend(rows)

    for col in (COL_AGENT, COL_FIRST_OCCURRENCE, COL_CLEAR_OCCURRENCE, COL_SUMMARY, COL_TTINCIDENT):

        if col not in reference_headers:

            raise ValueError(f"Missing column: {col}")

    date_cols = [reference_headers.index(c) for c in (COL_FIRST_OCCURRENCE, COL_CLEAR_OCCURRENCE) if c in reference_headers]

    normalized = []

    for row in combined_rows:

        row = list(row)

        for idx in date_cols:

            row[idx] = _parse_datetime_value(row[idx])

        normalized.append(tuple(row))

    return reference_headers, normalized


def filter_target_agents(headers: list[str], rows: list[tuple], log: LogFn = _default_log) -> list[tuple]:

    agent_idx = headers.index(COL_AGENT)

    kept = [row for row in rows if _is_target_agent(row[agent_idx])]

    log(f"[ok] kept {len(kept)} of {len(rows)} rows (target agents)")

    return kept


def filter_equiprole(headers: list[str], rows: list[tuple], log: LogFn = _default_log) -> list[tuple]:

    if COL_ALU_EQUIPROLE not in headers:

        return rows

    idx = headers.index(COL_ALU_EQUIPROLE)

    kept = []

    removed = 0

    for row in rows:

        val = row[idx]

        if val and str(val).strip().upper() in ("PACO", "NSS"):

            removed += 1

        else:

            kept.append(row)

    if removed:

        log(f"[ok] removed {removed} rows (PACO/NSS equiprole)")

    return kept


def read_alarm_list(paths: Optional[list[Path]], log: LogFn = _default_log) -> Optional[dict]:

    if not paths:

        return None

    alarms = {}

    for path in paths:

        headers, rows = _read_any_table(path)

        summary_idx = _find_summary_column(headers)

        header_name = headers[summary_idx] if summary_idx < len(headers) else None

        log(f"[ok] {path.name}: matching on column {summary_idx!r} ({header_name!r})")

        loaded_here = 0

        for row in rows:

            if summary_idx < len(row) and row[summary_idx]:

                summary = _normalize_text(row[summary_idx])

                if summary:

                    alarms[summary] = True

                    loaded_here += 1

        log(f"[ok] {path.name}: {loaded_here} alarm summaries loaded (total {len(alarms)})")

    return alarms if alarms else None


def build_report(

    raw_files: list[Path],

    output_path: Path,

    alarm_list_files: Optional[list[Path]] = None,

    log: LogFn = _default_log,

    progress: Optional[Callable[[float, str], None]] = None,

    cancel_event: Optional[threading.Event] = None,

) -> None:

    """Build report following exact step-by-step workflow."""

    def _report(pct: float, stage: str) -> None:

        if progress:

            progress(pct, stage)

    def _check_cancel() -> None:

        if cancel_event is not None and cancel_event.is_set():

            raise CancelledError("Cancelled by user")

    _report(0.02, "Reading raw files...")

    raw_headers, rows = read_raw_files(raw_files, log=log)

    _check_cancel()

    _report(0.10, "Filtering target agents...")

    rows = filter_target_agents(raw_headers, rows, log=log)

    _check_cancel()

    _report(0.14, "Filtering equiprole...")

    rows = filter_equiprole(raw_headers, rows, log=log)

    _check_cancel()

    _report(0.18, "Reading alarm list...")

    alarm_list = read_alarm_list(alarm_list_files, log=log)

    _check_cancel()

    out_headers = []

    for h in raw_headers:

        out_headers.append(h)

        if h == COL_CLEAR_OCCURRENCE:

            out_headers.append(BUCKET_1_HEADER)

            out_headers.append(BUCKET_2_HEADER)

            if alarm_list:

                out_headers.append(VLOOKUP_HEADER)

    wb = Workbook()

    sheet1 = wb.active

    sheet1.title = "Sheet1"

    club_data = wb.create_sheet("club data")

    for c, h in enumerate(out_headers, 1):

        cell = club_data.cell(row=1, column=c, value=h)

        cell.font = HEADER_FONT

        cell.fill = HEADER_FILL

    raw_idx = {h: i for i, h in enumerate(raw_headers)}

    first_idx = raw_idx[COL_FIRST_OCCURRENCE]

    clear_idx = raw_idx[COL_CLEAR_OCCURRENCE]

    summary_idx = raw_idx[COL_SUMMARY]

    ttinc_idx = raw_idx[COL_TTINCIDENT]

    corr_idx = raw_idx.get(COL_CORRELATIONPARAM)

    agent_idx = raw_idx[COL_AGENT]

    clear_col = out_headers.index(COL_CLEAR_OCCURRENCE) + 1

    first_col = out_headers.index(COL_FIRST_OCCURRENCE) + 1

    bucket1_col = out_headers.index(BUCKET_1_HEADER) + 1

    bucket2_col = out_headers.index(BUCKET_2_HEADER) + 1

    clear_letter = get_column_letter(clear_col)

    first_letter = get_column_letter(first_col)

    log("[progress] writing data rows...")

    _report(0.20, "Writing data rows...")

    bucket2_values = []

    total_rows = max(len(rows), 1)

    for i, raw_row in enumerate(rows):

        data_row_idx = i + 2

        if i % 500 == 0:

            _check_cancel()

            _report(0.20 + 0.55 * (i / total_rows), f"Writing row {i+1} of {total_rows}...")

        first_val = raw_row[first_idx]

        clear_val = raw_row[clear_idx]

        summary_val = raw_row[summary_idx]

        ttinc_val = raw_row[ttinc_idx]

        corr_val = raw_row[corr_idx] if corr_idx else None

        agent_val = raw_row[agent_idx]

        is_zambia = _is_zambia(agent_val)

        out_col = 1

        for h in raw_headers:

            val = raw_row[raw_idx[h]]

            if h == COL_CLEAR_OCCURRENCE:

                club_data.cell(row=data_row_idx, column=out_col, value=val)

                if isinstance(val, datetime):

                    club_data.cell(row=data_row_idx, column=out_col).number_format = "dd/mm/yyyy hh:mm:ss"

                out_col += 1

                bucket1_cell = club_data.cell(row=data_row_idx, column=out_col)

                bucket1_cell.value = f"={clear_letter}{data_row_idx}-{first_letter}{data_row_idx}"

                bucket1_cell.number_format = "hh:mm:ss"

                out_col += 1

                club_data.cell(row=data_row_idx, column=out_col, value="")

                out_col += 1

                if alarm_list:

                    vlookup_cell = club_data.cell(row=data_row_idx, column=out_col)

                    extracted = _extract_alarm_key(summary_val)

                    if extracted and extracted in alarm_list:

                        vlookup_cell.value = extracted

                    else:

                        vlookup_cell.value = "#N/A" if extracted else ""

                    out_col += 1

                continue

            cell = club_data.cell(row=data_row_idx, column=out_col, value=val)

            if isinstance(val, datetime):

                cell.number_format = "dd/mm/yyyy hh:mm:ss"

            out_col += 1

        bucket2 = ""

        if ttinc_val and "INC" in str(ttinc_val).upper():

            bucket2 = "Netcool TT"

        elif corr_val and not _is_blank(corr_val):

            corr_str = str(corr_val).strip()

            if corr_str.lower() not in ("null", ""):

                bucket2 = corr_str

        elif alarm_list:

            extracted = _extract_alarm_key(summary_val)

            if extracted and extracted not in alarm_list:

                bucket2 = "Not Part of Alarm List"

        if not bucket2 and _is_epoch_placeholder(clear_val):

            bucket2 = "Auto TT system fail" if is_zambia else "Manual/Semi-Auto TT to be created"

        if not bucket2 and isinstance(first_val, datetime) and isinstance(clear_val, datetime):

            duration = (clear_val - first_val).total_seconds()

            if 0 <= duration < 600:

                bucket2 = "Less than 10 min."

        if not bucket2:

            bucket2 = "Auto TT system fail" if is_zambia else "Manual/Semi-Auto TT to be created"

        club_data.cell(row=data_row_idx, column=bucket2_col, value=bucket2)

        if bucket2 in ("Not Part of Alarm List", "Manual/Semi-Auto TT to be created", "Auto TT system fail"):

            club_data.cell(row=data_row_idx, column=bucket2_col).fill = REVIEW_FILL

        bucket2_values.append(bucket2)

        if data_row_idx % 10000 == 2:

            log(f"[progress] row {data_row_idx-1}...")

            time.sleep(0)

    _check_cancel()

    log("[progress] building pivot table...")

    _report(0.80, "Building pivot table...")

    agent_counts = {}

    for row, bucket2 in zip(rows, bucket2_values):

        agent = row[agent_idx]

        if agent not in agent_counts:

            agent_counts[agent] = {}

        agent_counts[agent][bucket2] = agent_counts[agent].get(bucket2, 0) + 1

    agents = sorted(agent_counts.keys())

    sheet1.cell(row=3, column=1, value="Row Labels")

    sheet1.cell(row=3, column=2, value="Count of Bucket2")

    for c in (sheet1.cell(row=3, column=1), sheet1.cell(row=3, column=2)):

        c.font = HEADER_FONT

        c.fill = HEADER_FILL

        c.border = THIN_BORDER

    r = 4

    for agent in agents:

        agent_cell = sheet1.cell(row=r, column=1, value=agent)

        count_cell = sheet1.cell(row=r, column=2, value=sum(agent_counts[agent].values()))

        for c in (agent_cell, count_cell):

            c.font = Font(bold=True)

            c.fill = AGENT_FILL

            c.border = THIN_BORDER

        r += 1

        for bucket2, count in sorted(agent_counts[agent].items(), key=lambda x: -x[1]):

            bucket_cell = sheet1.cell(row=r, column=1, value=bucket2)

            bucket_cell.alignment = Alignment(indent=1)

            count_cell = sheet1.cell(row=r, column=2, value=count)

            fill = REVIEW_FILL if bucket2 in ("Not Part of Alarm List", "Manual/Semi-Auto TT to be created", "Auto TT system fail") else BUCKET_FILL

            for c in (bucket_cell, count_cell):

                c.fill = fill

                c.border = THIN_BORDER

            r += 1

    total_label = sheet1.cell(row=r, column=1, value="Grand Total")

    total_value = sheet1.cell(row=r, column=2, value=len(rows))

    for c in (total_label, total_value):

        c.font = Font(bold=True)

        c.fill = GRANDTOTAL_FILL

        c.border = THIN_BORDER

    sheet1.column_dimensions["A"].width = 42

    sheet1.column_dimensions["B"].width = 18

    for col in range(1, len(out_headers) + 1):

        club_data.column_dimensions[get_column_letter(col)].width = 16

    club_data.freeze_panes = "A2"

    _report(0.97, "Saving workbook...")

    wb.save(output_path)

    log(f"[ok] Report written to: {output_path}")

    _report(1.0, "Done")


# ---------------------------------------------------------------------------

# --------------------------------  GUI  ------------------------------------

# ---------------------------------------------------------------------------

APP_TITLE = "IMS Daily Report — Automation Tool"

BG = "#1f2430"

PANEL = "#262b3a"

ACCENT = "#4472C4"

ACCENT_HOVER = "#5b86d6"

TEXT_MAIN = "#e6e8ef"

TEXT_DIM = "#9aa1b4"

GOOD = "#3ecf8e"

WARN = "#f2c94c"

BAD = "#eb5757"


class FileListPanel(ttk.Frame):

    """A labeled panel with a listbox of file paths plus Add/Remove buttons."""

    def __init__(self, parent, title: str, subtitle: str, filetypes, allow_empty: bool = False):

        super().__init__(parent, style="Panel.TFrame", padding=12)

        self.filetypes = filetypes

        self.allow_empty = allow_empty

        self.paths: list[Path] = []

        header = ttk.Frame(self, style="Panel.TFrame")

        header.pack(fill="x")

        ttk.Label(header, text=title, style="PanelTitle.TLabel").pack(side="left")

        if allow_empty:

            ttk.Label(header, text=" (optional)", style="PanelSubtitle.TLabel").pack(side="left")

        ttk.Label(self, text=subtitle, style="PanelSubtitle.TLabel", wraplength=380, justify="left").pack(

            fill="x", pady=(2, 8)

        )

        list_frame = ttk.Frame(self, style="Panel.TFrame")

        list_frame.pack(fill="both", expand=True)

        self.listbox = tk.Listbox(

            list_frame,

            height=5,

            bg="#161a24",

            fg=TEXT_MAIN,

            selectbackground=ACCENT,

            selectforeground="#ffffff",

            relief="flat",

            highlightthickness=1,

            highlightbackground="#333a4d",

            highlightcolor=ACCENT,

            font=("Segoe UI", 9),

        )

        self.listbox.pack(side="left", fill="both", expand=True)

        scrollbar = ttk.Scrollbar(list_frame, orient="vertical", command=self.listbox.yview)

        scrollbar.pack(side="right", fill="y")

        self.listbox.configure(yscrollcommand=scrollbar.set)

        btn_row = ttk.Frame(self, style="Panel.TFrame")

        btn_row.pack(fill="x", pady=(8, 0))

        ttk.Button(btn_row, text="+ Add file(s)", style="Secondary.TButton", command=self._add_files).pack(

            side="left"

        )

        ttk.Button(btn_row, text="Remove selected", style="Secondary.TButton", command=self._remove_selected).pack(

            side="left", padx=(8, 0)

        )

        ttk.Button(btn_row, text="Clear", style="Secondary.TButton", command=self._clear).pack(

            side="left", padx=(8, 0)

        )

    def _add_files(self):

        chosen = filedialog.askopenfilenames(title="Select file(s)", filetypes=self.filetypes)

        for c in chosen:

            p = Path(c)

            if p not in self.paths:

                self.paths.append(p)

                self.listbox.insert("end", p.name)

    def _remove_selected(self):

        selection = list(self.listbox.curselection())

        for idx in reversed(selection):

            self.listbox.delete(idx)

            del self.paths[idx]

    def _clear(self):

        self.listbox.delete(0, "end")

        self.paths.clear()


class IMSReportApp(tk.Tk):

    def __init__(self):

        super().__init__()

        self.title(APP_TITLE)

        self.geometry("980x760")

        self.minsize(860, 660)

        self.configure(bg=BG)

        self._worker: Optional[threading.Thread] = None

        self._cancel_event = threading.Event()

        self._msg_queue: "queue.Queue[tuple]" = queue.Queue()

        self.output_path: Optional[Path] = None

        self._build_style()

        self._build_layout()

        self.after(80, self._poll_queue)

    # ---------------------------------------------------------- styling --

    def _build_style(self):

        style = ttk.Style(self)

        try:

            style.theme_use("clam")

        except tk.TclError:

            pass

        style.configure("Root.TFrame", background=BG)

        style.configure("Panel.TFrame", background=PANEL)

        style.configure(

            "Header.TLabel", background=BG, foreground=TEXT_MAIN, font=("Segoe UI", 18, "bold")

        )

        style.configure(

            "SubHeader.TLabel", background=BG, foreground=TEXT_DIM, font=("Segoe UI", 10)

        )

        style.configure(

            "PanelTitle.TLabel", background=PANEL, foreground=TEXT_MAIN, font=("Segoe UI", 11, "bold")

        )

        style.configure(

            "PanelSubtitle.TLabel", background=PANEL, foreground=TEXT_DIM, font=("Segoe UI", 9)

        )

        style.configure(

            "Status.TLabel", background=BG, foreground=TEXT_DIM, font=("Segoe UI", 9)

        )

        style.configure(

            "Primary.TButton",

            background=ACCENT,

            foreground="#ffffff",

            font=("Segoe UI", 11, "bold"),

            padding=(18, 10),

            borderwidth=0,

        )

        style.map(

            "Primary.TButton",

            background=[("active", ACCENT_HOVER), ("disabled", "#3a4152")],

            foreground=[("disabled", "#7a8194")],

        )

        style.configure(

            "Secondary.TButton",

            background="#333a4d",

            foreground=TEXT_MAIN,

            font=("Segoe UI", 9),

            padding=(10, 6),

            borderwidth=0,

        )

        style.map("Secondary.TButton", background=[("active", "#454e66")])

        style.configure(

            "Danger.TButton",

            background="#3a2a2e",

            foreground="#f5a3a3",

            font=("Segoe UI", 9),

            padding=(10, 6),

            borderwidth=0,

        )

        style.map("Danger.TButton", background=[("active", "#4d3438")])

        style.configure(

            "TProgressbar",

            troughcolor="#161a24",

            background=ACCENT,

            bordercolor=PANEL,

            lightcolor=ACCENT,

            darkcolor=ACCENT,

            thickness=14,

        )

    # ----------------------------------------------------------- layout --

    def _build_layout(self):

        root = ttk.Frame(self, style="Root.TFrame", padding=20)

        root.pack(fill="both", expand=True)

        # Header

        header = ttk.Frame(root, style="Root.TFrame")

        header.pack(fill="x")

        ttk.Label(header, text="IMS Daily Report", style="Header.TLabel").pack(anchor="w")

        ttk.Label(

            header,

            text="Bucket_1 / Bucket_2 classification, alarm-list VLOOKUP and pivot summary — automated.",

            style="SubHeader.TLabel",

        ).pack(anchor="w", pady=(2, 16))

        # Two-column input area

        input_row = ttk.Frame(root, style="Root.TFrame")

        input_row.pack(fill="x")

        input_row.columnconfigure(0, weight=1)

        input_row.columnconfigure(1, weight=1)

        self.raw_panel = FileListPanel(

            input_row,

            title="Raw alarm export(s)",

            subtitle="One or more .xlsx / .csv exports with matching columns "

            "(agent, firstoccurrence, clearoccurrence, summary, ttincident, ...).",

            filetypes=[("Excel/CSV", "*.xlsx *.xlsm *.csv"), ("All files", "*.*")],

        )

        self.raw_panel.grid(row=0, column=0, sticky="nsew", padx=(0, 10))

        self.alarm_panel = FileListPanel(

            input_row,

            title="Alarm list reference",

            subtitle="Reference file(s) with a 'summary' column, used for the VLOOKUP step. "

            "Leave empty to skip the VLOOKUP / alarm-list columns.",

            filetypes=[("Excel/CSV", "*.xlsx *.xlsm *.csv"), ("All files", "*.*")],

            allow_empty=True,

        )

        self.alarm_panel.grid(row=0, column=1, sticky="nsew", padx=(10, 0))

        # Output row

        out_panel = ttk.Frame(root, style="Panel.TFrame", padding=12)

        out_panel.pack(fill="x", pady=(14, 0))

        ttk.Label(out_panel, text="Output workbook", style="PanelTitle.TLabel").pack(anchor="w")

        out_row = ttk.Frame(out_panel, style="Panel.TFrame")

        out_row.pack(fill="x", pady=(8, 0))

        self.output_var = tk.StringVar(value="(defaults to IMS_Report_<date>.xlsx next to the first raw file)")

        self.output_entry = tk.Entry(

            out_row,

            textvariable=self.output_var,

            bg="#161a24",

            fg=TEXT_DIM,

            relief="flat",

            highlightthickness=1,

            highlightbackground="#333a4d",

            highlightcolor=ACCENT,

            font=("Segoe UI", 9),

            state="readonly",

            readonlybackground="#161a24",

        )

        self.output_entry.pack(side="left", fill="x", expand=True, ipady=6, padx=(0, 8))

        ttk.Button(out_row, text="Choose output file...", style="Secondary.TButton", command=self._choose_output).pack(

            side="left"

        )

        # Run controls

        controls = ttk.Frame(root, style="Root.TFrame")

        controls.pack(fill="x", pady=(16, 8))

        self.run_btn = ttk.Button(controls, text="▶  Run report", style="Primary.TButton", command=self._on_run)

        self.run_btn.pack(side="left")

        self.cancel_btn = ttk.Button(controls, text="Cancel", style="Danger.TButton", command=self._on_cancel, state="disabled")

        self.cancel_btn.pack(side="left", padx=(10, 0))

        self.status_label = ttk.Label(controls, text="Ready.", style="Status.TLabel")

        self.status_label.pack(side="left", padx=(16, 0))

        # Progress bar

        self.progress = ttk.Progressbar(root, style="TProgressbar", mode="determinate", maximum=100)

        self.progress.pack(fill="x", pady=(4, 12))

        # Log panel

        log_panel = ttk.Frame(root, style="Panel.TFrame", padding=(12, 10))

        log_panel.pack(fill="both", expand=True)

        ttk.Label(log_panel, text="Log", style="PanelTitle.TLabel").pack(anchor="w")

        log_frame = ttk.Frame(log_panel, style="Panel.TFrame")

        log_frame.pack(fill="both", expand=True, pady=(6, 0))

        self.log_text = tk.Text(

            log_frame,

            bg="#12151d",

            fg=TEXT_MAIN,

            insertbackground=TEXT_MAIN,

            relief="flat",

            font=("Consolas", 9),

            wrap="word",

            state="disabled",

        )

        self.log_text.pack(side="left", fill="both", expand=True)

        log_scroll = ttk.Scrollbar(log_frame, orient="vertical", command=self.log_text.yview)

        log_scroll.pack(side="right", fill="y")

        self.log_text.configure(yscrollcommand=log_scroll.set)

        self.log_text.tag_configure("ok", foreground=GOOD)

        self.log_text.tag_configure("warn", foreground=WARN)

        self.log_text.tag_configure("error", foreground=BAD)

        self.log_text.tag_configure("progress", foreground=TEXT_DIM)

    # ------------------------------------------------------- interactions --

    def _choose_output(self):

        path = filedialog.asksaveasfilename(

            title="Save report as",

            defaultextension=".xlsx",

            filetypes=[("Excel Workbook", "*.xlsx")],

        )

        if path:

            self.output_path = Path(path)

            self.output_entry.configure(state="normal")

            self.output_var.set(str(self.output_path))

            self.output_entry.configure(state="readonly", fg=TEXT_MAIN)

    def _append_log(self, msg: str):

        tag = None

        if msg.startswith("[ok]"):

            tag = "ok"

        elif msg.startswith("[warn]"):

            tag = "warn"

        elif msg.startswith("[error]"):

            tag = "error"

        elif msg.startswith("[progress]"):

            tag = "progress"

        self.log_text.configure(state="normal")

        self.log_text.insert("end", msg + "\n", tag)

        self.log_text.see("end")

        self.log_text.configure(state="disabled")

    def _set_running(self, running: bool):

        self.run_btn.configure(state="disabled" if running else "normal")

        self.cancel_btn.configure(state="normal" if running else "disabled")

    def _on_run(self):

        if self._worker and self._worker.is_alive():

            return

        raw_files = list(self.raw_panel.paths)

        alarm_files = list(self.alarm_panel.paths) or None

        if not raw_files:

            messagebox.showwarning(APP_TITLE, "Add at least one raw alarm export file first.")

            return

        output_path = self.output_path or raw_files[0].with_name(

            f"IMS_Report_{datetime.now():%d%b%Y}.xlsx"

        )

        self.log_text.configure(state="normal")

        self.log_text.delete("1.0", "end")

        self.log_text.configure(state="disabled")

        self.progress["value"] = 0

        self.status_label.configure(text="Running...")

        self._cancel_event.clear()

        self._set_running(True)

        self._worker = threading.Thread(

            target=self._run_worker, args=(raw_files, output_path, alarm_files), daemon=True

        )

        self._worker.start()

    def _on_cancel(self):

        self._cancel_event.set()

        self.status_label.configure(text="Cancelling...")

        self.cancel_btn.configure(state="disabled")

    def _run_worker(self, raw_files, output_path, alarm_files):

        def log(msg: str):

            self._msg_queue.put(("log", msg))

        def progress(pct: float, stage: str):

            self._msg_queue.put(("progress", pct, stage))

        try:

            build_report(

                raw_files,

                output_path,

                alarm_list_files=alarm_files,

                log=log,

                progress=progress,

                cancel_event=self._cancel_event,

            )

            self._msg_queue.put(("done", output_path))

        except CancelledError:

            self._msg_queue.put(("cancelled", None))

        except Exception as exc:  # noqa: BLE001

            self._msg_queue.put(("error", f"{exc}\n{traceback.format_exc()}"))

    def _poll_queue(self):

        try:

            while True:

                item = self._msg_queue.get_nowait()

                kind = item[0]

                if kind == "log":

                    self._append_log(item[1])

                elif kind == "progress":

                    pct, stage = item[1], item[2]

                    self.progress["value"] = pct * 100

                    self.status_label.configure(text=stage)

                elif kind == "done":

                    output_path = item[1]

                    self._set_running(False)

                    self.status_label.configure(text="Done.")

                    self._append_log(f"[ok] Finished — saved to {output_path}")

                    messagebox.showinfo(APP_TITLE, f"Report complete:\n{output_path}")

                elif kind == "cancelled":

                    self._set_running(False)

                    self.status_label.configure(text="Cancelled.")

                    self._append_log("[warn] Run cancelled by user.")

                elif kind == "error":

                    self._set_running(False)

                    self.status_label.configure(text="Error.")

                    self._append_log(f"[error] {item[1]}")

                    messagebox.showerror(APP_TITLE, f"Something went wrong:\n{item[1].splitlines()[0]}")

        except queue.Empty:

            pass

        self.after(80, self._poll_queue)


def main():

    app = IMSReportApp()

    app.mainloop()


if __name__ == "__main__":

    main()
 
