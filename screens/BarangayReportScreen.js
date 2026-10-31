import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  Platform,
  KeyboardAvoidingView,
  StatusBar,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { BASE_URL, getSession } from "./services/api";

// ── Route names ──
const ROUTES = {
  login: "Login",
  notifications: "Notifications",
};

// Used by LoginScreen / SplashScreen to decide who sees this screen
export const isBarangayRole = (role = "") =>
  /barangay|brgy/i.test(String(role));

const CRIME_TYPES = [
  "Carnapping - MC",
  "Carnapping - MV",
  "Homicide",
  "Murder",
  "Physical Injury",
  "Rape",
  "Robbery",
  "Special Complex Crime",
  "Theft",
];
const PERSON_ROLES = ["Victim", "Complainant", "Witness", "Respondent"];
const ROLE_META = {
  Victim: { color: "#c1272d", icon: "person-outline" },
  Complainant: { color: "#2563eb", icon: "chatbubble-ellipses-outline" },
  Witness: { color: "#d97706", icon: "eye-outline" },
  Respondent: { color: "#7c3aed", icon: "shield-outline" },
};
const PHOTO_MAX = 5;
const VIDEO_MAX = 1;
const PHOTO_MAX_MB = 8;
const VIDEO_MAX_MB = 80;
const NARRATIVE_MAX = 3000;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const DARK = "#0a1628";
const NAVY = "#1e3a5f";
const RED = "#c1272d";
const BG = "#f1f5f9";

const STATUS_META = {
  Pending: { bg: "#fef3c7", fg: "#92400e", icon: "time-outline" },
  "Under Investigation": {
    bg: "#dbeafe",
    fg: "#1e40af",
    icon: "search-outline",
  },
  Solved: { bg: "#d1fae5", fg: "#065f46", icon: "checkmark-circle-outline" },
  Cleared: { bg: "#ccfbf1", fg: "#0f766e", icon: "shield-checkmark-outline" },
};
const STATUS_FILTERS = [
  "All",
  "Pending",
  "Under Investigation",
  "Solved",
  "Cleared",
];

// ── helpers ─────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");
// Local "YYYY-MM-DDTHH:mm" — same format the web datetime-local input sends
const toLocalString = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtDateTime = (d) => {
  if (!d) return "Select date & time";
  const h = d.getHours() % 12 || 12;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}  ${h}:${pad(d.getMinutes())} ${d.getHours() >= 12 ? "PM" : "AM"}`;
};
const fmtServerDate = (str) => {
  if (!str) return "N/A";
  const d = new Date(str);
  if (isNaN(d.getTime())) return "N/A";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const authFetch = async (path, options = {}) => {
  const session = await getSession();
  if (!session?.token) throw new Error("Not logged in");
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${session.token}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
};

const newPerson = (role = "Victim") => ({
  role,
  first_name: "",
  middle_name: "",
  last_name: "",
  contact_number: "",
  gender: "Male",
  nationality: "FILIPINO",
  house_street: "",
  relationship_to_victim: "",
  witness_statement: "",
});

const openDateTime = (current, onPicked) => {
  DateTimePickerAndroid.open({
    value: current || new Date(),
    mode: "date",
    maximumDate: new Date(),
    onChange: (e, date) => {
      if (e.type !== "set" || !date) return;
      DateTimePickerAndroid.open({
        value: date,
        mode: "time",
        onChange: (e2, time) => {
          if (e2.type !== "set" || !time) return;
          const merged = new Date(date);
          merged.setHours(time.getHours(), time.getMinutes(), 0, 0);
          onPicked(merged);
        },
      });
    },
  });
};

// ── small UI pieces ─────────────────────────────────────────────────────────
function SectionCard({ icon, title, subtitle, children }) {
  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <View style={s.cardIcon}>
          <Ionicons name={icon} size={16} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>{title}</Text>
          {!!subtitle && <Text style={s.cardSub}>{subtitle}</Text>}
        </View>
      </View>
      <View style={s.cardBody}>{children}</View>
    </View>
  );
}

function Field({ label, required, error, hint, children, style }) {
  return (
    <View style={[s.group, style]}>
      <Text style={s.label}>
        {label}
        {required ? <Text style={s.req}> *</Text> : null}
      </Text>
      {children}
      {!!hint && !error && <Text style={s.hint}>{hint}</Text>}
      {!!error && (
        <View style={s.errRow}>
          <Ionicons name="alert-circle" size={13} color={RED} />
          <Text style={s.err}> {error}</Text>
        </View>
      )}
    </View>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[s.chip, active && s.chipActive]}
      activeOpacity={0.8}
    >
      <Text style={[s.chipTxt, active && s.chipTxtActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function DateField({ label, value, onChange, error }) {
  return (
    <Field label={label} required error={error}>
      {Platform.OS === "android" ? (
        <TouchableOpacity
          style={[s.input, s.rowBetween, !!error && s.inputErr]}
          onPress={() => openDateTime(value, onChange)}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <Ionicons
              name="calendar-outline"
              size={17}
              color={value ? NAVY : "#9ca3af"}
              style={{ marginRight: 10 }}
            />
            <Text style={value ? s.inputTxt : s.placeholder}>
              {fmtDateTime(value)}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={16} color="#9ca3af" />
        </TouchableOpacity>
      ) : (
        <View style={{ alignItems: "flex-start" }}>
          <DateTimePicker
            value={value || new Date()}
            mode="datetime"
            display="compact"
            maximumDate={new Date()}
            onChange={(e, d) => d && onChange(d)}
          />
        </View>
      )}
      <TouchableOpacity style={s.nowBtn} onPress={() => onChange(new Date())}>
        <Ionicons name="time-outline" size={13} color="#2563eb" />
        <Text style={s.nowTxt}> Use current time</Text>
      </TouchableOpacity>
    </Field>
  );
}

function DetectStatus({ detect }) {
  const map = {
    detecting: {
      bg: "#eff6ff",
      fg: "#1e40af",
      icon: null,
      txt: "AI is analyzing your narrative...",
    },
    ok: {
      bg: "#ecfdf5",
      fg: "#065f46",
      icon: "sparkles",
      txt: "Auto-detected by AI",
    },
    guess: {
      bg: "#fffbeb",
      fg: "#92400e",
      icon: "alert-circle",
      txt: "AI best guess — please verify",
    },
    notIndexed: {
      bg: "#fef2f2",
      fg: "#991b1b",
      icon: "close-circle",
      txt: "Not a valid index crime — please choose one manually",
    },
    limited: {
      bg: "#fffbeb",
      fg: "#92400e",
      icon: "hourglass-outline",
      txt: "AI limit reached — choose the crime type manually",
    },
    error: {
      bg: "#fffbeb",
      fg: "#92400e",
      icon: "cloud-offline-outline",
      txt: "AI detection failed — choose the crime type manually",
    },
  };
  const m = map[detect];
  if (!m) return null;
  return (
    <View style={[s.detectBox, { backgroundColor: m.bg }]}>
      {m.icon ? (
        <Ionicons name={m.icon} size={14} color={m.fg} />
      ) : (
        <ActivityIndicator size="small" color={m.fg} />
      )}
      <Text style={[s.detectTxt, { color: m.fg }]}>{m.txt}</Text>
    </View>
  );
}

// ── screen ──────────────────────────────────────────────────────────────────
export default function BarangayReportScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const TAB_H = 55 + Math.max(insets.bottom, 25); // matches the tab bar in App.js

  const [tab, setTab] = useState(
    route?.params?.initialTab === "reports" ? "reports" : "submit",
  );
  const [barangay, setBarangay] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [crimeType, setCrimeType] = useState("");
  const [crimeSource, setCrimeSource] = useState(""); // "" | "ai" | "manual"
  const [detect, setDetect] = useState("idle"); // idle|detecting|ok|guess|notIndexed|limited|error
  const [showCrimeModal, setShowCrimeModal] = useState(false);

  const [commission, setCommission] = useState(null);
  const [reported, setReported] = useState(null);
  const [street, setStreet] = useState("");
  const [narrative, setNarrative] = useState("");
  const [persons, setPersons] = useState([newPerson()]);
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All");

  // Barangay lock — same logic as the web form
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const session = await getSession();
        let code = session?.user?.assigned_barangay_code || null;
        try {
          const { data } = await authFetch("/users/profile");
          if (data?.user?.barangay_code) code = data.user.barangay_code;
        } catch {}
        if (!code) {
          if (alive) setBarangay("");
          return;
        }
        if (!/^\d+$/.test(String(code))) {
          if (alive) setBarangay(String(code));
          return;
        }
        try {
          const res = await fetch(
            `https://psgc.gitlab.io/api/barangays/${code}.json`,
          );
          const b = await res.json();
          if (alive) setBarangay(b?.name || String(code));
        } catch {
          if (alive) setBarangay(String(code));
        }
      } finally {
        if (alive) setLoadingProfile(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const loadReports = useCallback(async () => {
    try {
      const { data } = await authFetch("/blotters/brgy-reports/mine");
      if (data?.success) setReports(data.data);
    } catch {
    } finally {
      setLoadingReports(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    if (route?.params?.initialTab) setTab(route.params.initialTab);
  }, [route?.params?.initialTab]);

  useEffect(() => {
    const unsub = navigation.addListener("focus", loadReports); // refresh when tab regains focus
    return unsub;
  }, [navigation, loadReports]);

  // Live status updates while the "My Reports" tab is open
  useEffect(() => {
    if (tab !== "reports") return;
    const t = setInterval(loadReports, 10000);
    return () => clearInterval(t);
  }, [tab, loadReports]);

  const updatePerson = (i, field, value) =>
    setPersons((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)),
    );

  // ── AI crime-type detection (same endpoint as web) ──
  const detectCrime = async () => {
    if (crimeSource === "manual" || narrative.trim().length < 20) return;
    setDetect("detecting");
    try {
      const { data } = await authFetch("/blotters/detect-crime-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ narrative }),
      });
      if (!data?.success) {
        setDetect("error");
        return;
      }
      if (data.not_an_index_crime && data.confident) {
        setCrimeType("");
        setCrimeSource("");
        setDetect("notIndexed");
        return;
      }
      if (data.rate_limited) {
        setDetect("limited");
        return;
      }
      if (data.crime_type) {
        setCrimeType(data.crime_type);
        setCrimeSource("ai");
        setDetect(data.confident && !data.fallback ? "ok" : "guess");
      } else {
        setDetect("idle");
      }
    } catch {
      setDetect("error");
    }
  };

  // ── evidence ──
  const addMedia = async (kind, source) => {
    const photos = files.filter((f) => f.kind === "photo").length;
    const videos = files.filter((f) => f.kind === "video").length;
    if (kind === "photo" && photos >= PHOTO_MAX)
      return Alert.alert("Limit reached", `Up to ${PHOTO_MAX} photos.`);
    if (kind === "video" && videos >= VIDEO_MAX)
      return Alert.alert("Limit reached", `Up to ${VIDEO_MAX} video.`);

    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted)
        return Alert.alert(
          "Permission needed",
          "Allow camera access to take evidence photos.",
        );
    }
    const opts = {
      mediaTypes: [kind === "photo" ? "images" : "videos"],
      quality: 0.7,
    };
    if (kind === "video") opts.videoMaxDuration = 60;

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled || !result.assets?.length) return;

    const a = result.assets[0];
    const maxMb = kind === "photo" ? PHOTO_MAX_MB : VIDEO_MAX_MB;
    if (a.fileSize && a.fileSize > maxMb * 1024 * 1024) {
      return Alert.alert(
        "File too large",
        `${kind === "photo" ? "Photos" : "Videos"} must be under ${maxMb}MB.`,
      );
    }
    const type = a.mimeType || (kind === "photo" ? "image/jpeg" : "video/mp4");
    const ext = type.split("/")[1] || (kind === "photo" ? "jpg" : "mp4");
    setFiles((prev) => [
      ...prev,
      {
        uri: a.uri,
        kind,
        type,
        name: a.fileName || `${kind}_${Date.now()}.${ext}`,
      },
    ]);
  };

  const uploadFile = async (blotterId, f) => {
    try {
      const session = await getSession();
      const fd = new FormData();
      fd.append("file", { uri: f.uri, name: f.name, type: f.type });
      // Do NOT set Content-Type here — fetch must add the multipart boundary itself
      const res = await fetch(`${BASE_URL}/blotters/${blotterId}/attachments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      return res.ok && data.success !== false;
    } catch {
      return false;
    }
  };

  // ── validation (mirrors the web form) ──
  const validate = () => {
    const e = {};
    const now = new Date();
    if (detect === "notIndexed" && !crimeType) {
      e.crime =
        "AI detected this narrative is not a valid index crime. Please choose a crime type.";
    }
    if (!commission) e.commission = "Required";
    else if (commission > now) e.commission = "Cannot be a future date";
    if (!reported) e.reported = "Required";
    else if (reported > now) e.reported = "Cannot be a future date";
    else if (commission && reported < commission)
      e.reported = "Cannot be before the incident";
    if (!barangay) e.barangay = "No barangay assigned to this account";
    if (street.trim().length < 2) e.street = "At least 2 characters";
    if (narrative.trim().length < 20) e.narrative = "At least 20 characters";
    persons.forEach((p, i) => {
      if (!p.first_name.trim()) e[`p${i}_first`] = "Required";
      if (!p.last_name.trim()) e[`p${i}_last`] = "Required";
      if (p.contact_number && p.contact_number.length !== 11)
        e[`p${i}_contact`] = "Must be 11 digits";
    });
    return e;
  };

  const resetForm = () => {
    setCrimeType("");
    setCrimeSource("");
    setDetect("idle");
    setCommission(null);
    setReported(null);
    setStreet("");
    setNarrative("");
    setPersons([newPerson()]);
    setFiles([]);
    setErrors({});
  };

  const submit = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      Alert.alert("Check the form", "Please fix the fields marked in red.");
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        incident_type: crimeType || "Special Complex Crime", // same fallback as web
        date_time_commission: toLocalString(commission),
        date_time_reported: toLocalString(reported),
        place_barangay: barangay,
        place_street: street.trim(),
        narrative: narrative.trim(),
        victims: persons.map((p) => ({
          ...p,
          first_name: p.first_name.trim(),
          middle_name: p.middle_name.trim(),
          last_name: p.last_name.trim(),
          contact: p.contact_number,
        })),
      };
      const { ok, data } = await authFetch("/blotters/brgy-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!ok || !data?.success) {
        Alert.alert(
          "Submission failed",
          data?.errors
            ? data.errors.join("\n")
            : data?.message || "Please try again.",
        );
        return;
      }
      const blotterId = data.data.blotter_id;
      let failed = 0;
      for (const f of files) {
        const done = await uploadFile(blotterId, f);
        if (!done) failed += 1;
      }
      Alert.alert(
        "Report submitted",
        `Reference No.: ${data.data.blotter_entry_number}` +
          (failed ? `\n\n${failed} attachment(s) failed to upload.` : ""),
      );
      resetForm();
      setTab("reports");
      loadReports();
    } catch {
      Alert.alert("Failed to submit", "Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── derived ──
  const photoCount = files.filter((f) => f.kind === "photo").length;
  const videoCount = files.filter((f) => f.kind === "video").length;

  const checks = [
    !!commission,
    !!reported,
    street.trim().length >= 2,
    narrative.trim().length >= 20,
    persons.every((p) => p.first_name.trim() && p.last_name.trim()),
  ];
  const doneCount = checks.filter(Boolean).length;
  const progress = doneCount / checks.length;
  const errorCount = Object.keys(errors).length;

  const statusCounts = STATUS_FILTERS.reduce((acc, st) => {
    acc[st] =
      st === "All"
        ? reports.length
        : reports.filter((r) => r.status === st).length;
    return acc;
  }, {});
  const filteredReports =
    statusFilter === "All"
      ? reports
      : reports.filter((r) => r.status === statusFilter);

  const narrLen = narrative.length;
  const narrColor =
    narrLen > NARRATIVE_MAX * 0.9 ? RED : narrLen >= 20 ? "#16a34a" : "#9ca3af";

  // ── render ──
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={DARK} />

      {/* HEADER */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.hTitle}>B.A.N.T.A.Y.</Text>
            <View style={s.brgyPill}>
              <Ionicons name="location" size={11} color="#93c5fd" />
              <Text style={s.brgyPillTxt}>
                {loadingProfile
                  ? " Loading..."
                  : barangay
                    ? ` Brgy. ${barangay}`
                    : " No barangay assigned"}
              </Text>
            </View>
          </View>
          <View style={s.logoCircle}>
            <Ionicons name="shield-checkmark" size={22} color="#fff" />
          </View>
        </View>

        <View style={s.segment}>
          <TouchableOpacity
            style={[s.segBtn, tab === "submit" && s.segBtnOn]}
            onPress={() => setTab("submit")}
            activeOpacity={0.85}
          >
            <Ionicons
              name="create-outline"
              size={15}
              color={tab === "submit" ? DARK : "rgba(255,255,255,0.7)"}
            />
            <Text style={[s.segTxt, tab === "submit" && s.segTxtOn]}>
              {" "}
              Submit Report
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.segBtn, tab === "reports" && s.segBtnOn]}
            onPress={() => setTab("reports")}
            activeOpacity={0.85}
          >
            <Ionicons
              name="folder-open-outline"
              size={15}
              color={tab === "reports" ? DARK : "rgba(255,255,255,0.7)"}
            />
            <Text style={[s.segTxt, tab === "reports" && s.segTxtOn]}>
              {" "}
              My Reports
            </Text>
            <View
              style={[
                s.countBadge,
                tab === "reports" && { backgroundColor: RED },
              ]}
            >
              <Text style={s.countBadgeTxt}>{reports.length}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {tab === "submit" ? (
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: BG }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={[s.scroll, { paddingBottom: TAB_H + 24 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Legal notice */}
            <View style={s.notice}>
              <View style={s.noticeIcon}>
                <Ionicons name="shield-half-outline" size={18} color={RED} />
              </View>
              <Text style={s.noticeTxt}>
                This report goes directly to{" "}
                <Text style={{ fontWeight: "800" }}>PNP Bacoor</Text> for
                review. Filing a false report is punishable by law.
              </Text>
            </View>

            {/* Progress */}
            <View style={s.progressCard}>
              <View style={s.rowBetween}>
                <Text style={s.progressTitle}>Form progress</Text>
                <Text style={s.progressCount}>
                  {doneCount} of {checks.length} required done
                </Text>
              </View>
              <View style={s.progressTrack}>
                <View
                  style={[
                    s.progressFill,
                    {
                      width: `${progress * 100}%`,
                      backgroundColor: progress === 1 ? "#16a34a" : "#2563eb",
                    },
                  ]}
                />
              </View>
            </View>

            {errorCount > 0 && (
              <View style={s.errBanner}>
                <Ionicons name="alert-circle" size={16} color={RED} />
                <Text style={s.errBannerTxt}>
                  {" "}
                  {errorCount} field{errorCount > 1 ? "s need" : " needs"} your
                  attention
                </Text>
              </View>
            )}

            {/* 1. Incident details */}
            <SectionCard
              icon="alert-circle-outline"
              title="Incident Details"
              subtitle="What happened and when"
            >
              <Field label="Crime Type" error={errors.crime}>
                <TouchableOpacity
                  style={[s.input, s.rowBetween, !!errors.crime && s.inputErr]}
                  onPress={() => setShowCrimeModal(true)}
                  activeOpacity={0.8}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      flex: 1,
                    }}
                  >
                    <Ionicons
                      name={crimeType ? "flag" : "sparkles"}
                      size={16}
                      color={crimeType ? NAVY : "#7c3aed"}
                      style={{ marginRight: 10 }}
                    />
                    <Text style={crimeType ? s.inputTxt : s.placeholder}>
                      {crimeType || "Auto-detect with AI"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={16} color="#9ca3af" />
                </TouchableOpacity>
                {crimeSource === "manual" && detect === "idle" && (
                  <View style={[s.detectBox, { backgroundColor: "#f1f5f9" }]}>
                    <Ionicons
                      name="hand-left-outline"
                      size={14}
                      color="#475569"
                    />
                    <Text style={[s.detectTxt, { color: "#475569" }]}>
                      Selected manually
                    </Text>
                  </View>
                )}
                <DetectStatus detect={detect} />
              </Field>

              <DateField
                label="Date & Time of Incident"
                value={commission}
                onChange={setCommission}
                error={errors.commission}
              />
              <DateField
                label="Date & Time Reported"
                value={reported}
                onChange={setReported}
                error={errors.reported}
              />
            </SectionCard>

            {/* 2. Location */}
            <SectionCard
              icon="location-outline"
              title="Location"
              subtitle="Where it happened"
            >
              <Field label="Barangay" required error={errors.barangay}>
                <View style={[s.input, s.locked]}>
                  <Ionicons name="lock-closed" size={14} color="#64748b" />
                  <Text
                    style={[s.inputTxt, { marginLeft: 10, fontWeight: "700" }]}
                  >
                    {barangay || "—"}
                  </Text>
                </View>
                <Text style={s.hint}>Locked to your assigned barangay</Text>
              </Field>

              <Field label="Street / Location" required error={errors.street}>
                <TextInput
                  style={[s.input, !!errors.street && s.inputErr]}
                  value={street}
                  placeholder="e.g. Rizal St., near corner Mabini"
                  placeholderTextColor="#9ca3af"
                  onChangeText={(t) =>
                    setStreet(t.replace(/[^A-Za-z0-9Ññ.,\s-]/g, ""))
                  }
                />
              </Field>
            </SectionCard>

            {/* 3. Narrative */}
            <SectionCard
              icon="document-text-outline"
              title="Narrative"
              subtitle="Describe what happened in detail"
            >
              <Field label="Narrative" required error={errors.narrative}>
                <TextInput
                  style={[
                    s.input,
                    s.textarea,
                    !!errors.narrative && s.inputErr,
                  ]}
                  value={narrative}
                  multiline
                  maxLength={NARRATIVE_MAX}
                  placeholder="Who, what, when, where, and how? (minimum 20 characters)"
                  placeholderTextColor="#9ca3af"
                  onChangeText={(t) => {
                    setNarrative(t);
                    if (detect !== "idle" && detect !== "detecting")
                      setDetect("idle");
                  }}
                  onBlur={detectCrime}
                />
                <View style={[s.rowBetween, { marginTop: 6 }]}>
                  {narrative.trim().length >= 20 && crimeSource !== "manual" ? (
                    <TouchableOpacity
                      style={s.detectBtn}
                      onPress={detectCrime}
                      disabled={detect === "detecting"}
                    >
                      <Ionicons name="sparkles" size={12} color="#7c3aed" />
                      <Text style={s.detectBtnTxt}> Detect crime type</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={s.hintInline}>
                      AI detects the crime type from this
                    </Text>
                  )}
                  <Text style={[s.counter, { color: narrColor }]}>
                    {narrLen}/{NARRATIVE_MAX}
                  </Text>
                </View>
              </Field>
            </SectionCard>

            {/* 4. Persons */}
            <SectionCard
              icon="people-outline"
              title="Persons Involved"
              subtitle="Victims, complainants, witnesses, respondents"
            >
              {persons.map((p, i) => {
                const rc = ROLE_META[p.role];
                return (
                  <View
                    key={i}
                    style={[s.person, { borderLeftColor: rc.color }]}
                  >
                    <View style={s.personHead}>
                      <View
                        style={[s.personBadge, { backgroundColor: rc.color }]}
                      >
                        <Ionicons name={rc.icon} size={13} color="#fff" />
                      </View>
                      <Text style={s.personTitle}>
                        {p.role} #{i + 1}
                      </Text>
                      {persons.length > 1 && (
                        <TouchableOpacity
                          style={s.removeBtn}
                          onPress={() =>
                            setPersons((prev) =>
                              prev.filter((_, idx) => idx !== i),
                            )
                          }
                        >
                          <Ionicons
                            name="trash-outline"
                            size={13}
                            color={RED}
                          />
                          <Text style={s.removeTxt}> Remove</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={s.chipRow}>
                      {PERSON_ROLES.map((r) => (
                        <Chip
                          key={r}
                          label={r}
                          active={p.role === r}
                          onPress={() => updatePerson(i, "role", r)}
                        />
                      ))}
                    </View>

                    <View style={s.twoCol}>
                      <Field
                        label="First Name"
                        required
                        error={errors[`p${i}_first`]}
                        style={{ flex: 1 }}
                      >
                        <TextInput
                          style={[
                            s.input,
                            !!errors[`p${i}_first`] && s.inputErr,
                          ]}
                          value={p.first_name}
                          maxLength={50}
                          placeholder="First name"
                          placeholderTextColor="#9ca3af"
                          onChangeText={(t) =>
                            updatePerson(
                              i,
                              "first_name",
                              t.replace(/[^A-Za-zÑñ\s'-]/g, ""),
                            )
                          }
                        />
                      </Field>
                      <Field
                        label="Last Name"
                        required
                        error={errors[`p${i}_last`]}
                        style={{ flex: 1 }}
                      >
                        <TextInput
                          style={[
                            s.input,
                            !!errors[`p${i}_last`] && s.inputErr,
                          ]}
                          value={p.last_name}
                          maxLength={50}
                          placeholder="Last name"
                          placeholderTextColor="#9ca3af"
                          onChangeText={(t) =>
                            updatePerson(
                              i,
                              "last_name",
                              t.replace(/[^A-Za-zÑñ\s'-]/g, ""),
                            )
                          }
                        />
                      </Field>
                    </View>

                    <Field label="Middle Name">
                      <TextInput
                        style={s.input}
                        value={p.middle_name}
                        maxLength={50}
                        placeholder="Middle name (optional)"
                        placeholderTextColor="#9ca3af"
                        onChangeText={(t) =>
                          updatePerson(
                            i,
                            "middle_name",
                            t.replace(/[^A-Za-zÑñ\s'-]/g, ""),
                          )
                        }
                      />
                    </Field>

                    <Field label="Gender">
                      <View style={s.genderRow}>
                        {["Male", "Female"].map((g) => (
                          <TouchableOpacity
                            key={g}
                            style={[
                              s.genderBtn,
                              p.gender === g && s.genderBtnOn,
                            ]}
                            onPress={() => updatePerson(i, "gender", g)}
                            activeOpacity={0.85}
                          >
                            <Ionicons
                              name={g === "Male" ? "male" : "female"}
                              size={15}
                              color={p.gender === g ? "#fff" : "#64748b"}
                            />
                            <Text
                              style={[
                                s.genderTxt,
                                p.gender === g && { color: "#fff" },
                              ]}
                            >
                              {" "}
                              {g}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </Field>

                    <Field
                      label="Contact Number"
                      error={errors[`p${i}_contact`]}
                    >
                      <TextInput
                        style={[
                          s.input,
                          !!errors[`p${i}_contact`] && s.inputErr,
                        ]}
                        value={p.contact_number}
                        keyboardType="number-pad"
                        maxLength={11}
                        placeholder="09XXXXXXXXX"
                        placeholderTextColor="#9ca3af"
                        onChangeText={(t) =>
                          updatePerson(
                            i,
                            "contact_number",
                            t.replace(/\D/g, ""),
                          )
                        }
                      />
                    </Field>

                    <Field label="House / Street Address">
                      <TextInput
                        style={s.input}
                        value={p.house_street}
                        maxLength={200}
                        placeholder="House No. / Street (optional)"
                        placeholderTextColor="#9ca3af"
                        onChangeText={(t) => updatePerson(i, "house_street", t)}
                      />
                    </Field>

                    {p.role === "Witness" && (
                      <Field label="Witness Statement (optional)">
                        <TextInput
                          style={[s.input, s.textareaSm]}
                          value={p.witness_statement}
                          multiline
                          maxLength={500}
                          placeholder="Brief statement of what was witnessed..."
                          placeholderTextColor="#9ca3af"
                          onChangeText={(t) =>
                            updatePerson(i, "witness_statement", t)
                          }
                        />
                      </Field>
                    )}
                  </View>
                );
              })}

              <Text style={s.addLabel}>Add another person</Text>
              <View style={s.addGrid}>
                {PERSON_ROLES.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[s.addBtn, { borderColor: ROLE_META[r].color }]}
                    onPress={() =>
                      setPersons((prev) => [...prev, newPerson(r)])
                    }
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="add-circle"
                      size={16}
                      color={ROLE_META[r].color}
                    />
                    <Text style={[s.addBtnTxt, { color: ROLE_META[r].color }]}>
                      {" "}
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </SectionCard>

            {/* 5. Evidence */}
            <SectionCard
              icon="camera-outline"
              title="CCTV / Evidence"
              subtitle="Optional — photos and video"
            >
              <View style={s.evidenceRow}>
                <TouchableOpacity
                  style={[s.evTile, photoCount >= PHOTO_MAX && s.evTileOff]}
                  onPress={() => addMedia("photo", "camera")}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera" size={22} color={NAVY} />
                  <Text style={s.evTileTxt}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.evTile, photoCount >= PHOTO_MAX && s.evTileOff]}
                  onPress={() => addMedia("photo", "library")}
                  activeOpacity={0.8}
                >
                  <Ionicons name="images" size={22} color={NAVY} />
                  <Text style={s.evTileTxt}>Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.evTile, videoCount >= VIDEO_MAX && s.evTileOff]}
                  onPress={() => addMedia("video", "library")}
                  activeOpacity={0.8}
                >
                  <Ionicons name="videocam" size={22} color={NAVY} />
                  <Text style={s.evTileTxt}>Video</Text>
                </TouchableOpacity>
              </View>

              <View style={[s.rowBetween, { marginTop: 10 }]}>
                <Text style={s.hintInline}>
                  {photoCount}/{PHOTO_MAX} photos · {videoCount}/{VIDEO_MAX}{" "}
                  video
                </Text>
                <Text style={s.hintInline}>
                  Max {PHOTO_MAX_MB}MB photo · {VIDEO_MAX_MB}MB video
                </Text>
              </View>

              {files.length > 0 && (
                <View style={s.thumbRow}>
                  {files.map((f, idx) => (
                    <View key={idx} style={s.thumb}>
                      {f.kind === "photo" ? (
                        <Image source={{ uri: f.uri }} style={s.thumbImg} />
                      ) : (
                        <View style={[s.thumbImg, s.videoBox]}>
                          <Ionicons name="play-circle" size={30} color="#fff" />
                        </View>
                      )}
                      <TouchableOpacity
                        style={s.thumbX}
                        onPress={() =>
                          setFiles((prev) => prev.filter((_, k) => k !== idx))
                        }
                      >
                        <Ionicons name="close" size={13} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </SectionCard>

            {/* Submit */}
            <TouchableOpacity
              style={[s.submit, submitting && { opacity: 0.6 }]}
              onPress={submit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={17} color="#fff" />
                  <Text style={s.submitTxt}> Submit Incident Report</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={s.disclaimer}>
              By submitting, you confirm the information above is true and
              accurate.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <ScrollView
          style={{ backgroundColor: BG }}
          contentContainerStyle={[s.scroll, { paddingBottom: TAB_H + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadReports();
              }}
              colors={[NAVY]}
              tintColor={NAVY}
            />
          }
        >
          {loadingReports ? (
            <ActivityIndicator
              style={{ marginTop: 40 }}
              color={NAVY}
              size="large"
            />
          ) : reports.length === 0 ? (
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Ionicons
                  name="document-text-outline"
                  size={34}
                  color="#9ca3af"
                />
              </View>
              <Text style={s.emptyTitle}>No reports submitted yet</Text>
              <Text style={s.emptySub}>
                Incident reports you submit will appear here with their live
                status.
              </Text>
              <TouchableOpacity
                style={s.emptyBtn}
                onPress={() => setTab("submit")}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={s.emptyBtnTxt}> Submit a report</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flexGrow: 0, marginBottom: 12 }}
                contentContainerStyle={{ gap: 8, paddingRight: 8 }}
              >
                {STATUS_FILTERS.map((st) => {
                  const active = statusFilter === st;
                  return (
                    <TouchableOpacity
                      key={st}
                      style={[s.filterChip, active && s.filterChipOn]}
                      onPress={() => setStatusFilter(st)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[s.filterChipTxt, active && { color: "#fff" }]}
                      >
                        {st}
                      </Text>
                      <View
                        style={[
                          s.filterCount,
                          active && {
                            backgroundColor: "rgba(255,255,255,0.25)",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.filterCountTxt,
                            active && { color: "#fff" },
                          ]}
                        >
                          {statusCounts[st]}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {filteredReports.length === 0 ? (
                <View style={[s.empty, { marginTop: 30 }]}>
                  <Text style={s.emptyTitle}>
                    No {statusFilter.toLowerCase()} reports
                  </Text>
                </View>
              ) : (
                filteredReports.map((r) => {
                  const m = STATUS_META[r.status] || STATUS_META.Pending;
                  const resp = r.responder;
                  const respName = resp
                    ? `${resp.rank_abbreviation ? resp.rank_abbreviation + ". " : ""}${resp.first_name || ""} ${resp.last_name || ""}`.trim()
                    : "";
                  return (
                    <View
                      key={r.blotter_id}
                      style={[s.reportCard, { borderLeftColor: m.fg }]}
                    >
                      <View style={s.rowBetween}>
                        <Text style={s.refNo}>{r.blotter_entry_number}</Text>
                        <View style={[s.statusPill, { backgroundColor: m.bg }]}>
                          <Ionicons name={m.icon} size={12} color={m.fg} />
                          <Text style={[s.statusTxt, { color: m.fg }]}>
                            {" "}
                            {r.status}
                          </Text>
                        </View>
                      </View>

                      <Text style={s.reportType}>{r.incident_type}</Text>

                      <View style={s.metaRow}>
                        <Ionicons
                          name="location-outline"
                          size={13}
                          color="#94a3b8"
                        />
                        <Text style={s.reportMeta}>
                          {" "}
                          {r.place_street || "—"}
                        </Text>
                      </View>
                      <View style={s.metaRow}>
                        <Ionicons
                          name="calendar-outline"
                          size={13}
                          color="#94a3b8"
                        />
                        <Text style={s.reportMeta}>
                          {" "}
                          Reported {fmtServerDate(r.date_time_reported)}
                        </Text>
                      </View>

                      <View style={s.responderRow}>
                        <View
                          style={[
                            s.responderIcon,
                            !resp && { backgroundColor: "#e5e7eb" },
                          ]}
                        >
                          <Ionicons
                            name="shield"
                            size={13}
                            color={resp ? "#fff" : "#9ca3af"}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.responderLbl}>Assigned responder</Text>
                          <Text
                            style={[
                              s.responderName,
                              !resp && { color: "#9ca3af", fontWeight: "500" },
                            ]}
                          >
                            {respName || "Not yet assigned"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* Crime type picker */}
      <Modal
        visible={showCrimeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCrimeModal(false)}
      >
        <View style={s.overlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowCrimeModal(false)}
          />
          <View
            style={[
              s.sheet,
              { paddingBottom: Math.max(insets.bottom + 12, 20) },
            ]}
          >
            <View style={s.handle} />
            <View style={[s.rowBetween, { marginBottom: 6 }]}>
              <Text style={s.sheetTitle}>Crime Type</Text>
              <TouchableOpacity onPress={() => setShowCrimeModal(false)}>
                <Ionicons name="close" size={22} color={NAVY} />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 440 }}
            >
              <TouchableOpacity
                style={s.option}
                onPress={() => {
                  setCrimeType("");
                  setCrimeSource("");
                  setDetect("idle");
                  setShowCrimeModal(false);
                }}
              >
                <View style={[s.optionIcon, { backgroundColor: "#ede9fe" }]}>
                  <Ionicons name="sparkles" size={15} color="#7c3aed" />
                </View>
                <Text style={[s.optionTxt, !crimeType && s.optionActive]}>
                  Auto-detect with AI
                </Text>
                {!crimeType && (
                  <Ionicons name="checkmark-circle" size={20} color={RED} />
                )}
              </TouchableOpacity>
              {CRIME_TYPES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={s.option}
                  onPress={() => {
                    setCrimeType(c);
                    setCrimeSource("manual");
                    setDetect("idle");
                    setShowCrimeModal(false);
                  }}
                >
                  <View style={s.optionIcon}>
                    <Ionicons name="flag" size={14} color={NAVY} />
                  </View>
                  <Text
                    style={[s.optionTxt, crimeType === c && s.optionActive]}
                  >
                    {c}
                  </Text>
                  {crimeType === c && (
                    <Ionicons name="checkmark-circle" size={20} color={RED} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DARK },

  // header
  header: {
    backgroundColor: DARK,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  headerTop: { flexDirection: "row", alignItems: "center" },
  hTitle: { color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: 1 },
  brgyPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(147,197,253,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
  },
  brgyPillTxt: { color: "#dbeafe", fontSize: 11, fontWeight: "600" },
  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  segment: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 4,
    marginTop: 14,
  },
  segBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 9,
  },
  segBtnOn: { backgroundColor: "#fff" },
  segTxt: { fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.7)" },
  segTxtOn: { color: DARK },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    marginLeft: 6,
  },
  countBadgeTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },

  scroll: { padding: 14 },

  // notice + progress
  notice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  noticeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
  },
  noticeTxt: { flex: 1, fontSize: 12, color: "#7f1d1d", lineHeight: 17 },
  progressCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  progressTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: NAVY,
    textTransform: "uppercase",
  },
  progressCount: { fontSize: 11, color: "#64748b", fontWeight: "600" },
  progressTrack: {
    height: 6,
    backgroundColor: "#e2e8f0",
    borderRadius: 3,
    marginTop: 10,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },
  errBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderLeftWidth: 4,
    borderLeftColor: RED,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errBannerTxt: { color: "#991b1b", fontSize: 12, fontWeight: "700" },

  // cards
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e8edf3",
    overflow: "hidden",
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#fafbfd",
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 15, fontWeight: "800", color: NAVY },
  cardSub: { fontSize: 11, color: "#94a3b8", marginTop: 1 },
  cardBody: { padding: 14, paddingBottom: 4 },

  // fields
  group: { marginBottom: 14 },
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  req: { color: RED },
  input: {
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  inputTxt: { fontSize: 14, color: "#0f172a" },
  placeholder: { fontSize: 14, color: "#9ca3af" },
  inputErr: { borderColor: RED, backgroundColor: "#fffafa" },
  locked: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eef2f7",
    borderColor: "#dbe2ea",
  },
  textarea: { minHeight: 130, textAlignVertical: "top" },
  textareaSm: { minHeight: 80, textAlignVertical: "top" },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  twoCol: { flexDirection: "row", gap: 10 },
  errRow: { flexDirection: "row", alignItems: "center", marginTop: 5 },
  err: { color: RED, fontSize: 12, fontWeight: "600", flex: 1 },
  hint: { fontSize: 11, color: "#94a3b8", marginTop: 5 },
  hintInline: { fontSize: 11, color: "#94a3b8" },
  counter: { fontSize: 11, fontWeight: "700" },
  nowBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 8,
    paddingVertical: 4,
  },
  nowTxt: { color: "#2563eb", fontSize: 12, fontWeight: "700" },

  detectBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  detectTxt: { flex: 1, fontSize: 12, fontWeight: "700" },
  detectBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f3ff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  detectBtnTxt: { color: "#7c3aed", fontSize: 11, fontWeight: "800" },

  // persons
  person: {
    borderWidth: 1,
    borderColor: "#e8edf3",
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    backgroundColor: "#fcfdff",
  },
  personHead: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  personBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  personTitle: { flex: 1, fontSize: 14, fontWeight: "800", color: NAVY },
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  removeTxt: { color: RED, fontWeight: "700", fontSize: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#dbe2ea",
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: NAVY, borderColor: NAVY },
  chipTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  chipTxtActive: { color: "#fff" },
  genderRow: { flexDirection: "row", gap: 10 },
  genderBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  genderBtnOn: { backgroundColor: NAVY, borderColor: NAVY },
  genderTxt: { fontSize: 13, fontWeight: "700", color: "#64748b" },
  addLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94a3b8",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  addGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  addBtn: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    backgroundColor: "#fff",
  },
  addBtnTxt: { fontSize: 12, fontWeight: "800" },

  // evidence
  evidenceRow: { flexDirection: "row", gap: 10 },
  evTile: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#b6c3d4",
    backgroundColor: "#f8fafc",
    gap: 6,
  },
  evTileOff: { opacity: 0.4 },
  evTileTxt: { fontSize: 12, fontWeight: "800", color: NAVY },
  thumbRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
    marginBottom: 10,
  },
  thumb: { width: 84, height: 84 },
  thumbImg: { width: 84, height: 84, borderRadius: 12 },
  videoBox: {
    backgroundColor: "#4f46e5",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbX: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: RED,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },

  // submit
  submit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: RED,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: RED,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitTxt: { color: "#fff", fontSize: 15, fontWeight: "800" },
  disclaimer: {
    textAlign: "center",
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 10,
    lineHeight: 16,
  },

  // my reports
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
  },
  filterChipOn: { backgroundColor: NAVY, borderColor: NAVY },
  filterChipTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  filterCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    marginLeft: 6,
  },
  filterCountTxt: { fontSize: 11, fontWeight: "800", color: "#475569" },
  reportCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e8edf3",
    borderLeftWidth: 4,
  },
  refNo: { fontSize: 12, fontWeight: "800", color: NAVY, letterSpacing: 0.3 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  statusTxt: { fontSize: 11, fontWeight: "800" },
  reportType: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 10,
    marginBottom: 6,
  },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  reportMeta: { fontSize: 12, color: "#64748b", flex: 1 },
  responderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  responderIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  responderLbl: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  responderName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 1,
  },

  empty: { alignItems: "center", marginTop: 50, paddingHorizontal: 30 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: "#374151" },
  emptySub: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    backgroundColor: NAVY,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
  },
  emptyBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },

  // crime modal (bottom sheet)
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#dee2e6",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 17, fontWeight: "800", color: NAVY },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 12,
  },
  optionIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "#e0e7f1",
    alignItems: "center",
    justifyContent: "center",
  },
  optionTxt: { flex: 1, fontSize: 15, color: "#374151", fontWeight: "500" },
  optionActive: { color: RED, fontWeight: "800" },
});
