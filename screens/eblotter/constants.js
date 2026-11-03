// screens/eblotter/constants.js
export const C = {
  navy: "#0d1f3c",
  navyMid: "#19376D",
  navy50: "#EEF3FF",
  red: "#B91C1C",
  redBg: "#FEE2E2",
  green: "#15803D",
  greenBg: "#DCFCE7",
  amber: "#B45309",
  amberBg: "#FEF3C7",
  slate: "#334155",
  slate100: "#F1F5F9",
  white: "#FFFFFF",
  bg: "#F1F5F9",
  border: "#E2E8F0",
  text: "#0F172A",
  sub: "#475569",
  muted: "#94A3B8",
  faint: "#CBD5E1",
};

export const STATUS_CFG = {
  Pending: { bg: "#F1F5F9", fg: "#475569", dot: "#64748b" },
  "Under Investigation": { bg: "#FEF3C7", fg: "#B45309", dot: "#F59E0B" },
  Resolved: { bg: "#F3E8FF", fg: "#7C3AED", dot: "#7C3AED" },
  Cleared: { bg: "#F3E8FF", fg: "#7C3AED", dot: "#7C3AED" },
  Solved: { bg: C.greenBg, fg: C.green, dot: C.green },
  "Referred to Case": { bg: C.slate100, fg: C.slate, dot: C.muted },
  Urgent: { bg: C.redBg, fg: C.red, dot: C.red },
};

export const INCIDENT_COLORS = {
  Murder: "#7c3aed",
  Homicide: "#8b5cf6",
  Rape: "#ec4899",
  Robbery: "#ef4444",
  Theft: "#f97316",
  "Physical Injury": "#eab308",
  "Carnapping - MC": "#3b82f6",
  "Carnapping - MV": "#0ea5e9",
  "Special Complex Crime": "#14b8a6",
};

export const API = "https://bantay-system-production.up.railway.app";
export const PAGE_SIZE = 10;
export const PSGC = "https://psgc.gitlab.io/api";
export const NCR_CODE = "130000000";
export const BACOOR_CENTER = [120.964, 14.4341];
export const BLANK_F = {
  search: "",
  status: "",
  incident_type: "",
  barangay: "",
  date_from: null,
  date_to: null,
  data_source: "",
};

export const CRIME_MAP = {
  Murder: "MURDER",
  Homicide: "HOMICIDE",
  "Physical Injury": "PHYSICAL INJURIES",
  Rape: "RAPE",
  Robbery: "ROBBERY",
  Theft: "THEFT",
  "Carnapping - MC": "CARNAPPING - MC",
  "Carnapping - MV": "CARNAPPING - MV",
  "Special Complex Crime": "SPECIAL COMPLEX CRIME",
};

export const INCIDENTS = [
  "Carnapping - MC",
  "Carnapping - MV",
  "Homicide",
  "Murder",
  "Physical Injury",
  "Rape",
  "Robbery",
  "Special Complex Crime",
  "Theft",
].sort();
export const STATUSES = ["Cleared", "Solved", "Under Investigation"];

export const NATS = [
  "FILIPINO",
  "AMERICAN",
  "CHINESE",
  "JAPANESE",
  "KOREAN",
  "INDIAN",
  "BRITISH",
  "AUSTRALIAN",
  "CANADIAN",
  "GERMAN",
  "FRENCH",
  "SPANISH",
  "INDONESIAN",
  "MALAYSIAN",
  "SINGAPOREAN",
  "THAI",
  "VIETNAMESE",
  "Other",
];
export const S_STAT = [
  "At Large",
  "In Custody",
  "Arrested",
  "Detained",
  "Released on Bail",
  "Deceased",
  "Unknown",
];
export const DEGREES = ["Principal", "Accomplice", "Accessory"];
export const INFO_OB = [
  "Personal",
  "Telephone",
  "Walk-in",
  "Online",
  "Email",
  "Third Party",
];
export const STAGES = ["CONSUMMATED", "ATTEMPTED", "FRUSTRATED"];
export const PRIV = ["Yes", "No", "Unknown"];
export const QUALIFIERS = ["Jr.", "Sr.", "II", "III", "IV", "V"];
export const ROLES = ["Victim", "Complainant", "Witness", "Respondent"];
export const RELATIONSHIPS = [
  "Self",
  "Parent",
  "Spouse",
  "Guardian",
  "Sibling",
  "Child",
  "Relative",
  "Other",
];
export const EDU_ATT = [
  "No Formal Education",
  "Elementary Undergraduate",
  "Elementary Graduate",
  "High School Undergraduate",
  "High School Graduate",
  "Vocational",
  "College Undergraduate",
  "College Graduate",
  "Post Graduate",
];
export const TOP_PLACE = [
  "Abandoned Structure (house, bldg, apartment/condo)",
  "Along the street",
  "Commercial/Business Establishment",
  "Construction/Industrial Barracks",
  "Farm/Ricefield",
  "Government Office/Establishment",
  "Onboard a vehicle (riding in/on)",
  "Parking Area (vacant lot, in bldg/structure, open parking)",
  "Recreational Place (resorts/parks)",
  "Residential (house/condo)",
  "River/Lake",
  "School (Grade/High School/College/University)",
  "Transportation Terminals (Tricycle, Jeep, FX, Bus, Train Station)",
  "Vacant Lot (unused/unoccupied open area)",
];
export const BRGY_MAP = {
  "ANIBAN 1": "ANIBAN I",
  "ANIBAN 2": "ANIBAN II",
  "HABAY 1": "HABAY I",
  "HABAY 2": "HABAY II",
  "MOLINO 1": "MOLINO I",
  "MOLINO 2": "MOLINO II",
  "MOLINO 3": "MOLINO III",
  "MOLINO 4": "MOLINO IV",
  "MOLINO 5": "MOLINO V",
  "MOLINO 6": "MOLINO VI",
  "MOLINO 7": "MOLINO VII",
  "NIOG 1": "NIOG",
  "TALABA 1": "TALABA I",
  "TALABA 2": "TALABA II",
  "TALABA 3": "TALABA III",
  "SALINAS 1": "SALINAS I",
  "SALINAS 2": "SALINAS II",
  "MALIKSI 1": "MALIKSI I",
  "MALIKSI 2": "MALIKSI II",
  "LIGAS 1": "LIGAS I",
  "LIGAS 2": "LIGAS II",
};
export const BACOOR_BARANGAYS = [
  "ANIBAN I",
  "ANIBAN II",
  "BAYANAN",
  "DULONG BAYAN",
  "HABAY I",
  "HABAY II",
  "KAINGIN (POB.)",
  "KAINGIN DIGMAN",
  "LIGAS I",
  "LIGAS II",
  "MABOLO",
  "MALIKSI I",
  "MALIKSI II",
  "MAMBOG I",
  "MAMBOG II",
  "MAMBOG III",
  "MAMBOG IV",
  "MOLINO I",
  "MOLINO II",
  "MOLINO III",
  "MOLINO IV",
  "MOLINO V",
  "MOLINO VI",
  "MOLINO VII",
  "NIOG",
  "P.F. ESPIRITU I (PANAPAAN)",
  "P.F. ESPIRITU II",
  "P.F. ESPIRITU III",
  "P.F. ESPIRITU IV",
  "P.F. ESPIRITU V",
  "P.F. ESPIRITU VI",
  "QUEENS ROW CENTRAL",
  "QUEENS ROW EAST",
  "QUEENS ROW WEST",
  "REAL",
  "SALINAS I",
  "SALINAS II",
  "SAN NICOLAS I",
  "SAN NICOLAS II",
  "SAN NICOLAS III",
  "SINEGUELASAN",
  "TALABA I",
  "TALABA II",
  "TALABA III",
  "ZAPOTE I",
  "ZAPOTE II",
  "ZAPOTE III",
];
export const LEGACY_BARANGAYS = [
  { label: "Alima (→ Sineguelasan)", value: "SINEGUELASAN" },
  { label: "Banalo (→ Sineguelasan)", value: "SINEGUELASAN" },
  { label: "Camposanto (→ Kaingin Pob.)", value: "KAINGIN (POB.)" },
  { label: "Daang Bukid (→ Kaingin Pob.)", value: "KAINGIN (POB.)" },
  { label: "Tabing Dagat (→ Kaingin Pob.)", value: "KAINGIN (POB.)" },
  { label: "Kaingin (→ Kaingin Digman)", value: "KAINGIN DIGMAN" },
  { label: "Digman (→ Kaingin Digman)", value: "KAINGIN DIGMAN" },
  {
    label: "Panapaan (→ P.F. Espiritu I)",
    value: "P.F. ESPIRITU I (PANAPAAN)",
  },
  { label: "Panapaan 2 (→ P.F. Espiritu II)", value: "P.F. ESPIRITU II" },
  { label: "Panapaan 4 (→ P.F. Espiritu IV)", value: "P.F. ESPIRITU IV" },
  { label: "Panapaan 5 (→ P.F. Espiritu V)", value: "P.F. ESPIRITU V" },
  { label: "Panapaan 6 (→ P.F. Espiritu VI)", value: "P.F. ESPIRITU VI" },
  { label: "Mabolo 1 (→ Mabolo)", value: "MABOLO" },
  { label: "Mabolo 2 (→ Mabolo)", value: "MABOLO" },
  { label: "Mabolo 3 (→ Mabolo)", value: "MABOLO" },
  { label: "Aniban 3 (→ Aniban I)", value: "ANIBAN I" },
  { label: "Aniban 4 (→ Aniban II)", value: "ANIBAN II" },
  { label: "Aniban 5 (→ Aniban I)", value: "ANIBAN I" },
  { label: "Maliksi 3 (→ Maliksi II)", value: "MALIKSI II" },
  { label: "Mambog 5 (→ Mambog II)", value: "MAMBOG II" },
  { label: "Niog 2 (→ Niog)", value: "NIOG" },
  { label: "Niog 3 (→ Niog)", value: "NIOG" },
  { label: "Real 2 (→ Real)", value: "REAL" },
  { label: "Salinas 3 (→ Salinas II)", value: "SALINAS II" },
  { label: "Salinas 4 (→ Salinas II)", value: "SALINAS II" },
  { label: "Talaba 4 (→ Talaba III)", value: "TALABA III" },
  { label: "Talaba 7 (→ Talaba I)", value: "TALABA I" },
];

export const titleCase = (str) => {
  const ROMANS = [
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
  ];
  const ABBREVS = ["P.F.", "POB."];
  return str
    .split(" ")
    .map((word) => {
      const upper = word.toUpperCase();
      if (ROMANS.includes(upper)) return upper;
      if (ABBREVS.includes(upper)) return upper;
      if (word.includes(".")) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
};
export const lettersOnly = (v) => v.replace(/[^A-Za-zÑñ\s'-]/g, "");

export const mkC = () => ({
  first_name: "",
  middle_name: "",
  last_name: "",
  qualifier: "",
  alias: "",
  gender: "Male",
  nationality: "FILIPINO",
  contact_number: "",
  region_code: "",
  province_code: "",
  municipality_code: "",
  barangay_code: "",
  house_street: "",
  info_obtained: "Personal",
  occupation: "",
  role: "Victim",
  relationship_to_victim: "",
  witness_statement: "",
});
export const mkS = () => ({
  first_name: "",
  middle_name: "",
  last_name: "",
  qualifier: "",
  alias: "",
  gender: "Male",
  birthday: "",
  age: "",
  birth_place: "",
  nationality: "FILIPINO",
  region_code: "",
  province_code: "",
  municipality_code: "",
  barangay_code: "",
  house_street: "",
  status: "At Large",
  location_if_arrested: "",
  degree_participation: "Principal",
  relation_to_victim: "",
  educational_attainment: "",
  height_cm: "",
  drug_used: false,
  motive: "",
  occupation: "",
});
export const mkO = (p = true) => ({
  is_principal_offense: p,
  offense_name: "",
  stage_of_felony: "",
  index_type: "Non-Index",
});
export const mkCase = () => ({
  incident_type: "",
  cop: "",
  date_time_commission: "",
  date_time_reported: "",
  place_region: "Region IV-A (CALABARZON)",
  place_district_province: "Cavite",
  place_city_municipality: "Bacoor City",
  place_barangay: "",
  place_street: "",
  is_private_place: "",
  narrative: "",
  amount_involved: "",
  referred_by_barangay: false,
  referred_to_barangay: "",
  referred_by_dilg: false,
  lat: "",
  lng: "",
});

// Shared ref so any input can clear a validation error by key.
export const _formErrRef = { current: {}, setter: null };
