
// ================================================================================
// FILE 2: Capstone-Mobile-App/screens/BarangayReportScreen.js   (paste the whole file)
// ================================================================================
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { BASE_URL, getSession, getDeviceId, logout } from "./services/api";

// ── Change these if your navigator uses different route names ──

const ROUTES = {
  login: "Login",
  notifications: "Notifications",
  profile: "BarangayProfile",
};

// Use this in LoginScreen / SplashScreen to decide who sees this screen
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
const PHOTO_MAX = 5;
const VIDEO_MAX = 1;
const PHOTO_MAX_MB = 8;
const VIDEO_MAX_MB = 80;
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

const NAVY = "#1e3a5f";
const RED = "#c1272d";

// ── helpers ─────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");
// Local "YYYY-MM-DDTHH:mm" — the same format the web datetime-local input sends
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

const statusColors = (status) => {
  if (status === "Under Investigation") return { bg: "#dbeafe", fg: "#1e40af" };
  if (status === "Solved") return { bg: "#d1fae5", fg: "#065f46" };
  if (status === "Cleared") return { bg: "#ccfbf1", fg: "#0f766e" };
  return { bg: "#fef3c7", fg: "#92400e" }; // Pending
};

// ── small UI pieces ─────────────────────────────────────────────────────────
function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[s.chip, active && s.chipActive]}
    >
      <Text style={[s.chipTxt, active && s.chipTxtActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function DateField({ label, value, onChange, error }) {
  return (
    <View style={s.group}>
      <Text style={s.label}>
        {label} <Text style={s.req}>*</Text>
      </Text>
      {Platform.OS === "android" ? (
        <TouchableOpacity
          style={[s.input, s.rowBetween, !!error && s.inputErr]}
          onPress={() => openDateTime(value, onChange)}
        >
          <Text style={value ? s.inputTxt : s.placeholder}>
            {fmtDateTime(value)}
          </Text>
          <Ionicons name="calendar-outline" size={18} color="#64748b" />
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
      <TouchableOpacity onPress={() => onChange(new Date())}>
        <Text style={s.link}>Use current time</Text>
      </TouchableOpacity>
      {!!error && <Text style={s.err}>{error}</Text>}
    </View>
  );
}

// ── screen ──────────────────────────────────────────────────────────────────
export default function BarangayReportScreen({ navigation, route }) {
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
    const unsub = navigation.addListener("focus", loadReports); // refresh when coming back from Notifications/Profile
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

  const handleLogout = () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          try {
            const deviceId = await getDeviceId();
            await authFetch("/notifications/push-token", {
              method: "DELETE",
              headers: { "X-Device-Id": deviceId },
            });
          } catch {}
          const session = await getSession();
          await logout(session?.token);
          navigation.reset({ index: 0, routes: [{ name: ROUTES.login }] });
        },
      },
    ]);
  };

  const photoCount = files.filter((f) => f.kind === "photo").length;
  const videoCount = files.filter((f) => f.kind === "video").length;

  // ── render ──
  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.hTitle}>B.A.N.T.A.Y.</Text>
          <Text style={s.hSub}>
            {loadingProfile
              ? "Loading..."
              : barangay
                ? `Brgy. ${barangay}`
                : "No barangay assigned"}
          </Text>
        </View>
        <TouchableOpacity
          style={s.iconBtn}
          onPress={() => navigation.navigate(ROUTES.notifications)}
        >
          <Ionicons name="notifications-outline" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={s.iconBtn}
          onPress={() => navigation.navigate(ROUTES.profile)}
        >
          <Ionicons name="person-circle-outline" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={s.iconBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={s.tabs}>
        <TouchableOpacity
          style={[s.tab, tab === "submit" && s.tabActive]}
          onPress={() => setTab("submit")}
        >
          <Text style={[s.tabTxt, tab === "submit" && s.tabTxtActive]}>
            Submit Report
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, tab === "reports" && s.tabActive]}
          onPress={() => setTab("reports")}
        >
          <Text style={[s.tabTxt, tab === "reports" && s.tabTxtActive]}>
            My Reports ({reports.length})
          </Text>
        </TouchableOpacity>
      </View>

      {tab === "submit" ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={s.alert}>
              <Ionicons name="warning-outline" size={16} color={RED} />
              <Text style={s.alertTxt}>
                This report goes directly to PNP Bacoor for review. Filing a
                false report is punishable by law.
              </Text>
            </View>

            {/* Incident details */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Incident Details</Text>

              <View style={s.group}>
                <Text style={s.label}>Crime Type</Text>
                <TouchableOpacity
                  style={[s.input, s.rowBetween, !!errors.crime && s.inputErr]}
                  onPress={() => setShowCrimeModal(true)}
                >
                  <Text style={crimeType ? s.inputTxt : s.placeholder}>
                    {crimeType || "Auto-detect with AI"}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#64748b" />
                </TouchableOpacity>
                {detect === "detecting" && (
                  <Text style={s.badgeInfo}>Detecting crime type...</Text>
                )}
                {detect === "ok" && (
                  <Text style={s.badgeOk}>✓ Auto-detected by AI</Text>
                )}
                {detect === "guess" && (
                  <Text style={s.badgeWarn}>
                    ⚠ AI best guess — please verify
                  </Text>
                )}
                {detect === "notIndexed" && (
                  <Text style={s.badgeBad}>
                    ✗ Not a valid index crime — please review
                  </Text>
                )}
                {detect === "limited" && (
                  <Text style={s.badgeWarn}>
                    AI limit reached — choose the crime type manually
                  </Text>
                )}
                {detect === "error" && (
                  <Text style={s.badgeWarn}>
                    AI detection failed — choose the crime type manually
                  </Text>
                )}
                {!!errors.crime && <Text style={s.err}>{errors.crime}</Text>}
              </View>

              <View style={s.group}>
                <Text style={s.label}>
                  Barangay <Text style={s.req}>*</Text>
                </Text>
                <View style={[s.input, s.locked]}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={14}
                    color="#64748b"
                  />
                  <Text style={[s.inputTxt, { marginLeft: 8 }]}>
                    {barangay || "—"}
                  </Text>
                </View>
                {!!errors.barangay && (
                  <Text style={s.err}>{errors.barangay}</Text>
                )}
              </View>

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

              <View style={s.group}>
                <Text style={s.label}>
                  Street / Location <Text style={s.req}>*</Text>
                </Text>
                <TextInput
                  style={[s.input, !!errors.street && s.inputErr]}
                  value={street}
                  placeholder="e.g. Rizal St., near corner Mabini"
                  placeholderTextColor="#9ca3af"
                  onChangeText={(t) =>
                    setStreet(t.replace(/[^A-Za-z0-9Ññ.,\s-]/g, ""))
                  }
                />
                {!!errors.street && <Text style={s.err}>{errors.street}</Text>}
              </View>

              <View style={s.group}>
                <Text style={s.label}>
                  Narrative <Text style={s.req}>*</Text>
                </Text>
                <TextInput
                  style={[
                    s.input,
                    s.textarea,
                    !!errors.narrative && s.inputErr,
                  ]}
                  value={narrative}
                  multiline
                  maxLength={3000}
                  placeholder="Describe what happened in detail (minimum 20 characters)"
                  placeholderTextColor="#9ca3af"
                  onChangeText={(t) => {
                    setNarrative(t);
                    if (detect !== "idle" && detect !== "detecting")
                      setDetect("idle");
                  }}
                  onBlur={detectCrime}
                />
                <Text style={s.hint}>{narrative.length}/3000 characters</Text>
                {!!errors.narrative && (
                  <Text style={s.err}>{errors.narrative}</Text>
                )}
              </View>
            </View>

            {/* Persons involved */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Persons Involved</Text>
              {persons.map((p, i) => (
                <View key={i} style={s.person}>
                  <View style={s.rowBetween}>
                    <Text style={s.personTitle}>
                      {p.role} #{i + 1}
                    </Text>
                    {persons.length > 1 && (
                      <TouchableOpacity
                        onPress={() =>
                          setPersons((prev) =>
                            prev.filter((_, idx) => idx !== i),
                          )
                        }
                      >
                        <Text style={s.remove}>Remove</Text>
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

                  <View style={s.group}>
                    <Text style={s.label}>
                      First Name <Text style={s.req}>*</Text>
                    </Text>
                    <TextInput
                      style={[s.input, !!errors[`p${i}_first`] && s.inputErr]}
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
                    {!!errors[`p${i}_first`] && (
                      <Text style={s.err}>{errors[`p${i}_first`]}</Text>
                    )}
                  </View>
                  <View style={s.group}>
                    <Text style={s.label}>Middle Name</Text>
                    <TextInput
                      style={s.input}
                      value={p.middle_name}
                      maxLength={50}
                      placeholder="Middle name"
                      placeholderTextColor="#9ca3af"
                      onChangeText={(t) =>
                        updatePerson(
                          i,
                          "middle_name",
                          t.replace(/[^A-Za-zÑñ\s'-]/g, ""),
                        )
                      }
                    />
                  </View>
                  <View style={s.group}>
                    <Text style={s.label}>
                      Last Name <Text style={s.req}>*</Text>
                    </Text>
                    <TextInput
                      style={[s.input, !!errors[`p${i}_last`] && s.inputErr]}
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
                    {!!errors[`p${i}_last`] && (
                      <Text style={s.err}>{errors[`p${i}_last`]}</Text>
                    )}
                  </View>
                  <View style={s.group}>
                    <Text style={s.label}>Contact Number</Text>
                    <TextInput
                      style={[s.input, !!errors[`p${i}_contact`] && s.inputErr]}
                      value={p.contact_number}
                      keyboardType="number-pad"
                      maxLength={11}
                      placeholder="09XXXXXXXXX"
                      placeholderTextColor="#9ca3af"
                      onChangeText={(t) =>
                        updatePerson(i, "contact_number", t.replace(/\D/g, ""))
                      }
                    />
                    {!!errors[`p${i}_contact`] && (
                      <Text style={s.err}>{errors[`p${i}_contact`]}</Text>
                    )}
                  </View>
                  <View style={s.group}>
                    <Text style={s.label}>House / Street Address</Text>
                    <TextInput
                      style={s.input}
                      value={p.house_street}
                      maxLength={200}
                      placeholder="House No. / Street (optional)"
                      placeholderTextColor="#9ca3af"
                      onChangeText={(t) => updatePerson(i, "house_street", t)}
                    />
                  </View>
                  <View style={s.group}>
                    <Text style={s.label}>Gender</Text>
                    <View style={s.chipRow}>
                      {["Male", "Female"].map((g) => (
                        <Chip
                          key={g}
                          label={g}
                          active={p.gender === g}
                          onPress={() => updatePerson(i, "gender", g)}
                        />
                      ))}
                    </View>
                  </View>
                  {p.role === "Witness" && (
                    <View style={s.group}>
                      <Text style={s.label}>Witness Statement (optional)</Text>
                      <TextInput
                        style={[s.input, s.textarea]}
                        value={p.witness_statement}
                        multiline
                        maxLength={500}
                        placeholder="Brief statement of what was witnessed..."
                        placeholderTextColor="#9ca3af"
                        onChangeText={(t) =>
                          updatePerson(i, "witness_statement", t)
                        }
                      />
                    </View>
                  )}
                </View>
              ))}
              <View style={s.chipRow}>
                {PERSON_ROLES.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={s.addBtn}
                    onPress={() =>
                      setPersons((prev) => [...prev, newPerson(r)])
                    }
                  >
                    <Text style={s.addBtnTxt}>+ Add {r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Evidence */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Attach CCTV / Evidence (optional)</Text>
              <Text style={s.hint}>
                {photoCount}/{PHOTO_MAX} photos · {videoCount}/{VIDEO_MAX} video
                · Photos under {PHOTO_MAX_MB}MB, videos under {VIDEO_MAX_MB}MB
              </Text>
              <View style={[s.chipRow, { marginTop: 10 }]}>
                <TouchableOpacity
                  style={s.evBtn}
                  onPress={() => addMedia("photo", "camera")}
                >
                  <Ionicons name="camera-outline" size={16} color={NAVY} />
                  <Text style={s.evBtnTxt}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.evBtn}
                  onPress={() => addMedia("photo", "library")}
                >
                  <Ionicons name="image-outline" size={16} color={NAVY} />
                  <Text style={s.evBtnTxt}>Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.evBtn}
                  onPress={() => addMedia("video", "library")}
                >
                  <Ionicons name="videocam-outline" size={16} color={NAVY} />
                  <Text style={s.evBtnTxt}>Video</Text>
                </TouchableOpacity>
              </View>
              <View style={s.thumbRow}>
                {files.map((f, idx) => (
                  <View key={idx} style={s.thumb}>
                    {f.kind === "photo" ? (
                      <Image source={{ uri: f.uri }} style={s.thumbImg} />
                    ) : (
                      <View style={[s.thumbImg, s.videoBox]}>
                        <Ionicons name="videocam" size={26} color="#fff" />
                      </View>
                    )}
                    <TouchableOpacity
                      style={s.thumbX}
                      onPress={() =>
                        setFiles((prev) => prev.filter((_, k) => k !== idx))
                      }
                    >
                      <Text style={{ color: "#fff", fontWeight: "700" }}>
                        ×
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[s.submit, submitting && { opacity: 0.6 }]}
              onPress={submit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#fff" />
                  <Text style={s.submitTxt}> Submit Incident Report</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadReports();
              }}
            />
          }
        >
          {loadingReports ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={NAVY} />
          ) : reports.length === 0 ? (
            <View style={s.empty}>
              <Ionicons
                name="document-text-outline"
                size={40}
                color="#9ca3af"
              />
              <Text style={s.emptyTitle}>No reports submitted yet</Text>
              <Text style={s.hint}>
                Your submitted incident reports will appear here.
              </Text>
            </View>
          ) : (
            reports.map((r) => {
              const c = statusColors(r.status);
              const resp = r.responder;
              return (
                <View key={r.blotter_id} style={s.reportCard}>
                  <View style={s.rowBetween}>
                    <Text style={s.refNo}>{r.blotter_entry_number}</Text>
                    <View style={[s.badge, { backgroundColor: c.bg }]}>
                      <Text style={[s.badgeTxt, { color: c.fg }]}>
                        {r.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.reportType}>{r.incident_type}</Text>
                  <Text style={s.reportMeta}>{r.place_street}</Text>
                  <Text style={s.reportMeta}>
                    Reported: {fmtServerDate(r.date_time_reported)}
                  </Text>
                  <Text style={s.reportMeta}>
                    Responder:{" "}
                    {resp
                      ? `${resp.rank_abbreviation ? resp.rank_abbreviation + ". " : ""}${resp.first_name || ""} ${resp.last_name || ""}`.trim()
                      : "—"}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Crime type picker */}
      <Modal
        visible={showCrimeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCrimeModal(false)}
      >
        <TouchableOpacity
          style={s.overlay}
          activeOpacity={1}
          onPress={() => setShowCrimeModal(false)}
        >
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Crime Type</Text>
            <TouchableOpacity
              style={s.option}
              onPress={() => {
                setCrimeType("");
                setCrimeSource("");
                setDetect("idle");
                setShowCrimeModal(false);
              }}
            >
              <Text style={[s.optionTxt, !crimeType && s.optionActive]}>
                Auto-detect with AI
              </Text>
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
                <Text style={[s.optionTxt, crimeType === c && s.optionActive]}>
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f1f5f9" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: NAVY,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  hTitle: { color: "#fff", fontSize: 18, fontWeight: "800", letterSpacing: 1 },
  hSub: { color: "#cbd5e1", fontSize: 12, marginTop: 2 },
  iconBtn: { padding: 6, marginLeft: 4 },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: RED },
  tabTxt: { fontSize: 14, fontWeight: "600", color: "#64748b" },
  tabTxtActive: { color: RED },
  scroll: { padding: 14, paddingBottom: 40 },
  alert: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderLeftWidth: 4,
    borderLeftColor: RED,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  alertTxt: { flex: 1, fontSize: 12, color: "#7f1d1d" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: NAVY,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  group: { marginBottom: 12 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 5,
    textTransform: "uppercase",
  },
  req: { color: RED },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
    backgroundColor: "#fff",
  },
  inputTxt: { fontSize: 14, color: "#0f172a" },
  placeholder: { fontSize: 14, color: "#9ca3af" },
  inputErr: { borderColor: RED },
  locked: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
  },
  textarea: { minHeight: 110, textAlignVertical: "top" },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  err: { color: RED, fontSize: 12, marginTop: 4 },
  hint: { fontSize: 11, color: "#9ca3af", marginTop: 4 },
  link: { color: "#2563eb", fontSize: 12, marginTop: 6, fontWeight: "600" },
  badgeInfo: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "700",
    color: "#1e40af",
  },
  badgeOk: { marginTop: 6, fontSize: 11, fontWeight: "700", color: "#065f46" },
  badgeWarn: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "700",
    color: "#92400e",
  },
  badgeBad: { marginTop: 6, fontSize: 11, fontWeight: "700", color: "#991b1b" },
  person: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#f8fafc",
  },
  personTitle: { fontSize: 13, fontWeight: "800", color: NAVY },
  remove: { color: RED, fontWeight: "700", fontSize: 12 },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: NAVY, borderColor: NAVY },
  chipTxt: { fontSize: 12, fontWeight: "600", color: "#475569" },
  chipTxtActive: { color: "#fff" },
  addBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: NAVY,
    borderStyle: "dashed",
  },
  addBtnTxt: { color: NAVY, fontWeight: "700", fontSize: 12 },
  evBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: NAVY,
    backgroundColor: "#fff",
  },
  evBtnTxt: { color: NAVY, fontWeight: "700", fontSize: 12 },
  thumbRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  thumb: { width: 84, height: 84 },
  thumbImg: { width: 84, height: 84, borderRadius: 8 },
  videoBox: {
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbX: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.65)",
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  submit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: RED,
    paddingVertical: 14,
    borderRadius: 10,
  },
  submitTxt: { color: "#fff", fontSize: 15, fontWeight: "800" },
  empty: { alignItems: "center", marginTop: 60 },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
    marginTop: 10,
  },
  reportCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  refNo: { fontSize: 13, fontWeight: "800", color: NAVY },
  reportType: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginTop: 6,
  },
  reportMeta: { fontSize: 12, color: "#6b7280", marginTop: 3 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeTxt: { fontSize: 11, fontWeight: "700" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 24,
  },
  sheet: { backgroundColor: "#fff", borderRadius: 14, padding: 16 },
  sheetTitle: { fontSize: 16, fontWeight: "800", color: NAVY, marginBottom: 8 },
  option: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  optionTxt: { fontSize: 15, color: "#374151" },
  optionActive: { color: RED, fontWeight: "800" },
});
