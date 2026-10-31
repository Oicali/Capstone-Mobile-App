// =============================================================================
// FILE 1 of 2: screens/aiAssessmentHelpers.js   (NEW FILE, create it in screens/)
// =============================================================================
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as API from "./services/api";

// --- COLORS (same palette as DashboardScreen) --------------------------------
export const NAVY = "#0a1628";
export const NAVY_M = "#1e3a5f";
export const RED = "#c1272d";
export const WHITE = "#ffffff";
export const G50 = "#f8f9fa";
export const G100 = "#e9ecef";
export const G200 = "#dee2e6";
export const G400 = "#adb5bd";
export const G600 = "#6c757d";
export const G700 = "#495057";
export const G900 = "#212529";

// --- CONSTANTS ---------------------------------------------------------------
export const MIN_RECOMMENDED_DAYS = 238; // 34 weeks, matches backtest fold requirement
export const HISTORY_PREFIX = "ai_assessment_history_v2:";
export const MAX_HISTORY = 10; // newest 10 saved briefings per officer
export const INDEX_CRIMES = [
  "MURDER",
  "HOMICIDE",
  "PHYSICAL INJURY",
  "RAPE",
  "ROBBERY",
  "THEFT",
  "CARNAPPING - MC",
  "CARNAPPING - MV",
  "SPECIAL COMPLEX CRIME",
];
export const CRIME_DISPLAY = {
  MURDER: "Murder",
  HOMICIDE: "Homicide",
  "PHYSICAL INJURY": "Physical Injury",
  RAPE: "Rape",
  ROBBERY: "Robbery",
  THEFT: "Theft",
  "CARNAPPING - MC": "Carnapping - MC",
  "CARNAPPING - MV": "Carnapping - MV",
  "SPECIAL COMPLEX CRIME": "Special Complex Crime",
};
export const CRIME_PILL_LABEL = {
  MURDER: "Murder",
  THEFT: "Theft",
  RAPE: "Rape",
  ROBBERY: "Robbery",
  HOMICIDE: "Homicide",
  "SPECIAL COMPLEX CRIME": "Spec. Complex",
  "PHYSICAL INJURY": "Phys. Inj.",
  "CARNAPPING - MC": "Carnap MC",
  "CARNAPPING - MV": "Carnap MV",
};

// --- GENERAL HELPERS ---------------------------------------------------------
const ROMAN = new Set([
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
]);
export const formatBarangayLabel = (name = "") =>
  name.toLowerCase().replace(/\b\w+/g, (word) => {
    const upper = word.toUpperCase();
    if (ROMAN.has(upper)) return upper;
    if (upper === "P" || upper === "F") return upper;
    return word.charAt(0).toUpperCase() + word.slice(1);
  });

export const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
};

export const fmtStamp = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch (e) {
    return "";
  }
};

// --- SAVED HISTORY (per officer, stored on the phone) ------------------------
export const filterSummary = (f) => {
  const b = (f?.barangays || []).length;
  const c = f?.crimeTypes || [];
  const bTxt = b === 0 ? "All barangays" : `${b} barangay${b > 1 ? "s" : ""}`;
  const cTxt =
    c.length === 0
      ? "All crimes"
      : c.length <= 2
        ? c.map((x) => CRIME_DISPLAY[x] || x).join(", ")
        : `${c.length} crime types`;
  return `${bTxt} \u00B7 ${cTxt}`;
};

// Same filters = same signature (a newer result replaces the older one)
export const filterSig = (f) => {
  const b = JSON.stringify([...(f?.barangays || [])].map(String).sort());
  const c = JSON.stringify([...(f?.crimeTypes || [])].map(String).sort());
  return `${f?.dateFrom || ""}|${f?.dateTo || ""}|${b}|${c}`;
};

// Finds who is logged in so each officer only sees their own history.
// Falls back to one shared bucket if no usable id is found.
export const getUserKey = async () => {
  try {
    const session =
      typeof API.getSession === "function" ? await API.getSession() : null;
    const u = session?.user || session?.profile || {};
    const direct =
      u.id ??
      u.user_id ??
      u.userId ??
      u.username ??
      session?.userId ??
      session?.user_id ??
      session?.id ??
      session?.username;
    if (direct !== undefined && direct !== null && String(direct))
      return String(direct);

    const tok = session?.token;
    if (tok && typeof atob === "function") {
      const part = String(tok).split(".")[1];
      if (part) {
        let b64 = part.replace(/-/g, "+").replace(/_/g, "/");
        while (b64.length % 4) b64 += "=";
        const p = JSON.parse(atob(b64));
        const id = p.id ?? p.userId ?? p.user_id ?? p.sub ?? p.username;
        if (id !== undefined && id !== null && String(id)) return String(id);
      }
    }
  } catch (e) {
    // ignore, use shared bucket
  }
  return "shared";
};

export const loadHistory = async (userKey) => {
  try {
    const raw = await AsyncStorage.getItem(`${HISTORY_PREFIX}${userKey}`);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((x) => x && x.assessment) : [];
  } catch (e) {
    return [];
  }
};

export const persistHistory = async (userKey, list) => {
  try {
    await AsyncStorage.setItem(
      `${HISTORY_PREFIX}${userKey}`,
      JSON.stringify(list),
    );
  } catch (e) {
    // saving is best-effort, never block the screen
  }
};

// --- TEXT PARSERS (client-side, defensive: every field falls back to null) ---
const TIME_RE =
  /\d{1,2}:\d{2}\s?[AP]M(?:\s*[\u2013-]\s*\d{1,2}:\d{2}\s?[AP]M)?/i;
const DAY_RE = /\b(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)days?\b/i;

const capFirst = (str = "") =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : str;

// Breaks a paragraph into sentences without splitting "P.F." or "57.9%"
export const splitSentences = (text = "") =>
  String(text || "")
    .replace(/\*\*/g, "")
    .replace(/([a-z0-9%)])\.\s+(?=[A-Z])/g, "$1.\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

export const parseCrimeFacts = (text = "") => {
  const t = String(text || "");
  const inc = t.match(/(\d+)\s+incidents?/i);
  const cce = t.match(/CCE\s*(?:of\s*)?([\d.]+)\s*%/i);
  const cse = t.match(/CSE\s*(?:of\s*)?([\d.]+)\s*%/i);
  const tr = t.match(
    /trend[^.]{0,20}?(increasing|decreasing|stable|rising|declining|falling|upward|downward)/i,
  );
  const day = t.match(DAY_RE);
  const time = t.match(TIME_RE);
  const brgy =
    t.match(/Concentration in ([A-Z0-9][A-Z0-9.'()\s-]*?) indicates/) ||
    t.match(/([A-Z][A-Z0-9.'()\s-]*?) is identified as/);

  let trend = "unknown";
  if (tr) {
    const w = tr[1].toLowerCase();
    if (["increasing", "rising", "upward"].includes(w)) trend = "up";
    else if (["decreasing", "declining", "falling", "downward"].includes(w))
      trend = "down";
    else trend = "stable";
  }

  return {
    incidents: inc ? inc[1] : null,
    cce: cce ? cce[1] : null,
    cse: cse ? cse[1] : null,
    trend,
    day: day ? day[0] : null,
    time: time ? time[0] : null,
    barangay: brgy ? formatBarangayLabel(brgy[1].trim()) : null,
  };
};

export const TREND_META = {
  up: { icon: "trending-up", label: "Increasing", color: "#b91c1c" },
  down: { icon: "trending-down", label: "Decreasing", color: "#16a34a" },
  stable: { icon: "remove", label: "Stable", color: "#6b7280" },
  unknown: { icon: "remove", label: "", color: G400 },
};

export const parseOverall = (text = "") => {
  const t = String(text || "");
  const top = t.match(
    /needing the most attention is (.+?) with (\d+)\s*\/\s*100/i,
  );
  const peak = t.match(/Peak crime activity occurs on ([^.]+?)\.(?:\s|$)/i);
  const concern = t.match(
    /Notably,\s*(.+?) is a significant concern with (\d+) incidents?/i,
  );
  return {
    topName: top ? formatBarangayLabel(top[1].trim()) : null,
    topScore: top ? top[2] : null,
    peak: peak ? peak[1].trim() : null,
    concernName: concern ? concern[1].trim() : null,
    concernCount: concern ? concern[2] : null,
  };
};

// "At 12:00 AM - 1:00 AM, conduct foot patrol at Public Market."
const parseMustDo = (val = "") => {
  const m = val.match(/^At\s+(.+?),\s*(.+)$/i);
  if (!m) return { time: "", action: capFirst(val), place: "" };
  const time = m[1].trim();
  const rest = m[2].trim().replace(/\.$/, "");
  const idx = rest.toLowerCase().lastIndexOf(" at ");
  if (idx > 0) {
    return {
      time,
      action: capFirst(rest.slice(0, idx)),
      place: rest.slice(idx + 4),
    };
  }
  return { time, action: capFirst(rest), place: "" };
};

const OPS_LABEL_RE =
  /^(situation|mission|execution|must do(?:\s*\(\d+\))?|coordinating instructions)\s*:\s*(.*)$/i;

export const parseOperations = (raw = "") => {
  const prepared = String(raw || "")
    .replace(/\*\*/g, "")
    .replace(
      /\s+(Situation|Mission|Execution|Must Do(?: \(\d+\))?|Coordinating Instructions)\s*:/g,
      "\n$1:",
    );
  const lines = prepared
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const out = {
    situation: "",
    mission: "",
    execution: "",
    mustDo: [],
    coordinating: "",
    extra: [],
  };
  lines.forEach((line) => {
    const m = line.match(OPS_LABEL_RE);
    if (!m) {
      out.extra.push(line);
      return;
    }
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "situation") out.situation = val;
    else if (key === "mission") out.mission = val;
    else if (key === "execution") out.execution = val;
    else if (key.startsWith("must do")) out.mustDo.push(parseMustDo(val));
    else out.coordinating = val;
  });
  out.structured = !!(
    out.situation ||
    out.mission ||
    out.execution ||
    out.mustDo.length ||
    out.coordinating
  );
  return out;
};
