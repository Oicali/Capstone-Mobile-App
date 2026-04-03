// Profile

// ================================================================================
// ProfileScreen.js — BANTAY Mobile (REDESIGN v4 — Enhanced UI + Security Fixes)
// ================================================================================
// FIXES APPLIED:
// 1. startTimer() now calls POST /users/email/force-lock (fire & forget) when the
//    OTP timer expires with 0 resends — same fix as the web ProfileSettings.jsx.
//    Takes a `whichOtp` param ("old"|"new") so backend knows which lock to set.
// 2. goSessionLocked() now accepts an optional clearErrFn so the stale OTP error
//    is always cleared before transitioning to the session-locked screen.
// 3. oldResendsLeftRef / newResendsLeftRef keep resend counts in sync so the timer
//    can accurately read them at the moment of expiry (closure safety fix).
// 4. All existing email/profile/photo API connectivity is fully preserved.
// ================================================================================
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Platform, ActivityIndicator, AppState } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  TextInput,
  Image,
  KeyboardAvoidingView,
} from "react-native";
import { BASE_URL } from "../screens/services/api";

const PSGC_API = "https://psgc.gitlab.io/api";
const POLL_INTERVAL = 15000;

// ── Design Tokens ──────────────────────────────────────────────────────────────
const C = {
  navy: "#0B2D6B",
  navyDark: "#071D47",
  navyMid: "#1A3D7C",
  navyLight: "#EEF3FF",
  navySubtle: "#F4F7FF",
  red: "#C1272D",
  redLight: "#FDE8E8",
  green: "#059669",
  greenLight: "#D1FAE5",
  greenMid: "#ECFDF5",
  amber: "#B45309",
  amberLight: "#FEF3C7",
  danger: "#DC2626",
  dangerLight: "#FEF2F2",
  cyan: "#0891b2",
  cyanLight: "#E0F2FE",
  bg: "#F0F4FA",
  surface: "#FFFFFF",
  surfaceAlt: "#F8FAFC",
  border: "#E2E8F0",
  borderFocus: "#93A8D4",
  text: "#0F172A",
  textSub: "#475569",
  textMuted: "#94A3B8",
  textLight: "#CBD5E1",
  white: "#FFFFFF",
  gold: "#D97706",
  goldLight: "#FFF7ED",
};

// ── Utility helpers ────────────────────────────────────────────────────────────
const V = {
  name: (v, f, max = 50, req = true) => {
    if (!v || !v.trim()) return req ? `${f} is required` : null;
    if (v.length > max) return `${f} must not exceed ${max} characters`;
    if (!/^[a-zA-Z\s'\-.]+$/.test(v.trim()))
      return `${f} can only contain letters, spaces, hyphens, apostrophes`;
    return null;
  },
  suffix: (v) => {
    if (!v || !v.trim()) return null;
    const t = v.trim().toLowerCase();
    if (t.length > 5) return "Suffix must not exceed 5 characters";
    if (t === "sr." || t === "jr." || /^[ivxlcdm]+$/.test(t)) return null;
    return "Suffix must be Sr., Jr., or Roman Numeral (e.g., III)";
  },
  phone: (v, f) => {
    const c = v.replace(/\D/g, "");
    if (!c.length) return null;
    if (c.length !== 10) return `${f} must be exactly 10 digits`;
    if (!c.startsWith("9")) return `${f} must start with 9`;
    return null;
  },
  email: (v) => {
    if (!v || !v.trim()) return "Email is required";
    if (v.length > 255) return "Email must not exceed 255 characters";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()))
      return "Invalid email format";
    return null;
  },
  maskPhone: (p) => {
    if (!p) return "";
    const d = p.replace(/\D/g, "").replace(/^63/, "");
    return d.length < 3
      ? "*".repeat(d.length)
      : "*".repeat(d.length - 3) + d.slice(-3);
  },
  maskEmail: (e) => {
    if (!e) return "";
    const at = e.indexOf("@");
    if (at < 0) return e;
    const local = e.slice(0, at),
      domain = e.slice(at);
    if (local.length <= 1) return local + domain;
    if (local.length <= 4)
      return local[0] + "*".repeat(local.length - 1) + domain;
    return local[0] + "*".repeat(local.length - 4) + local.slice(-3) + domain;
  },
  formatDisplayName: (first, middle, last, suffix) => {
    const parts = [first];
    if (middle && middle.trim())
      parts.push(middle.trim()[0].toUpperCase() + ".");
    if (last) parts.push(last);
    if (suffix) parts.push(suffix);
    return parts.filter(Boolean).join(" ");
  },
};

// ── Loading Overlay ────────────────────────────────────────────────────────────
function LoadingOverlay({ visible, message = "Please wait…" }) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade">
      <View style={lo.overlay}>
        <View style={lo.box}>
          <ActivityIndicator size="large" color={C.navy} />
          <Text style={lo.text}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}
const lo = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(7,29,71,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  box: {
    backgroundColor: C.white,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 40,
    alignItems: "center",
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
    color: C.text,
    textAlign: "center",
    maxWidth: 200,
  },
});

// ── Confirm Modal ──────────────────────────────────────────────────────────────
function ConfirmModal({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  confirmColor = C.navy,
}) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade">
      <View style={cm.overlay}>
        <View style={cm.box}>
          <Text style={cm.title}>{title}</Text>
          <Text style={cm.msg}>{message}</Text>
          <View style={cm.row}>
            <TouchableOpacity style={cm.cancel} onPress={onCancel}>
              <Text style={cm.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[cm.confirm, { backgroundColor: confirmColor }]}
              onPress={onConfirm}
            >
              <Text style={cm.confirmTxt}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const cm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(7,29,71,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  box: {
    backgroundColor: C.white,
    borderRadius: 24,
    padding: 28,
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: C.text,
    marginBottom: 10,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  msg: {
    fontSize: 14,
    color: C.textSub,
    marginBottom: 26,
    textAlign: "center",
    lineHeight: 22,
  },
  row: { flexDirection: "row", gap: 10 },
  cancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: "center",
    backgroundColor: C.surfaceAlt,
  },
  cancelTxt: { fontSize: 14, fontWeight: "700", color: C.textSub },
  confirm: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  confirmTxt: { fontSize: 14, fontWeight: "800", color: C.white },
});

// ── OTP Boxes ──────────────────────────────────────────────────────────────────
function OtpBoxes({ values, onChange, disabled }) {
  const refs = Array.from({ length: 6 }, () => useRef(null));
  const handleChange = (val, idx) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    onChange(idx, digit);
    if (digit && idx < 5) refs[idx + 1].current?.focus();
  };
  const handleKey = (e, idx) => {
    if (e.nativeEvent.key === "Backspace" && !values[idx] && idx > 0) {
      refs[idx - 1].current?.focus();
      onChange(idx - 1, "");
    }
  };
  return (
    <View style={ob.row}>
      {values.map((v, i) => (
        <TextInput
          key={i}
          ref={refs[i]}
          style={[ob.box, disabled && ob.off, v && ob.filled]}
          value={v}
          maxLength={1}
          keyboardType="number-pad"
          onChangeText={(val) => handleChange(val, i)}
          onKeyPress={(e) => handleKey(e, i)}
          editable={!disabled}
          selectTextOnFocus
        />
      ))}
    </View>
  );
}
const ob = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginVertical: 20,
  },
  box: {
    width: 46,
    height: 54,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: C.navy,
    backgroundColor: C.surfaceAlt,
  },
  filled: {
    borderColor: C.navy,
    backgroundColor: C.white,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 3,
  },
  off: { backgroundColor: C.bg, borderColor: C.border, color: C.textLight },
});

// ── Progress Dots ──────────────────────────────────────────────────────────────
function ProgressDots({ current, total }) {
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[pd.dot, i < current && pd.done]} />
      ))}
    </View>
  );
}
const pd = StyleSheet.create({
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.border },
  done: { backgroundColor: C.navy },
});

// ── Info Row — individual field row inside a section card ─────────────────────
function InfoRow({
  icon,
  label,
  value,
  iconColor = C.navy,
  iconBg = C.navyLight,
  last = false,
}) {
  if (!value) return null;
  return (
    <View style={[ir.row, !last && ir.rowBorder]}>
      <View style={[ir.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={14} color={iconColor} />
      </View>
      <View style={ir.content}>
        <Text style={ir.label}>{label}</Text>
        <Text style={ir.value} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}
const ir = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  content: { flex: 1 },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: C.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  value: { fontSize: 14, fontWeight: "600", color: C.text, lineHeight: 20 },
});

// ── Section Card ───────────────────────────────────────────────────────────────
function SectionCard({ title, icon, children, accentColor = C.navy, collapsible = false, subtitle }) {
  const [expanded, setExpanded] = useState(false);
  const HeaderWrapper = collapsible ? TouchableOpacity : View;

  return (
    <View style={[sc.card, { borderLeftColor: accentColor }]}>
      <HeaderWrapper
        style={sc.header}
        onPress={collapsible ? () => setExpanded(v => !v) : undefined}
        activeOpacity={0.75}
      >
        <View style={[sc.iconWrap, { backgroundColor: accentColor }]}>
          <Ionicons name={icon} size={16} color={C.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[sc.title, { color: C.text }]}>{title}</Text>
          {!!subtitle && <Text style={sc.subtitle}>{subtitle}</Text>}
        </View>
        {collapsible && (
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={C.textMuted}
          />
        )}
      </HeaderWrapper>
      {(!collapsible || expanded) && <View style={sc.body}>{children}</View>}
    </View>
  );
}
const sc = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.white,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 14,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: "500",
    marginTop: 2,
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
});
// ── Action Card (top quick-action buttons) ────────────────────────────────────
function ActionCard({ icon, label, sublabel, color, onPress }) {
  return (
    <TouchableOpacity
      style={[ac.card, { borderTopColor: color }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[ac.iconWrap, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={ac.label}>{label}</Text>
      <Text style={ac.sub}>{sublabel}</Text>
    </TouchableOpacity>
  );
}
const ac = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: C.border,
    borderTopWidth: 3,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
    color: C.text,
    textAlign: "center",
  },
  sub: {
    fontSize: 10,
    fontWeight: "500",
    color: C.textMuted,
    textAlign: "center",
  },
});

// ── Edit Section Label ─────────────────────────────────────────────────────────
function SectionLabel({ icon, color, children }) {
  return (
    <View style={sl.row}>
      <View style={[sl.iconWrap, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon} size={12} color={color} />
      </View>
      <Text style={[sl.txt, { color }]}>{children}</Text>
      <View style={sl.line} />
    </View>
  );
}
const sl = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 22,
    marginBottom: 10,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  txt: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  line: { flex: 1, height: 1, backgroundColor: C.border },
});

// ═══════════════════════════════════════════════════════════════════════════════
export default function ProfileScreen({ navigation }) {
  const [profileData, setProfileData] = useState(null);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    middle_name: "",
    suffix: "",
    email: "",
    phone: "",
    alternate_phone: "",
    date_of_birth: "",
    gender: "Male",
    region_code: "",
    province_code: "",
    municipality_code: "",
    barangay_code: "",
    address_line: "",
  });
  const [originalFormData, setOriginalFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(null);
  const [showUsername, setShowUsername] = useState(false);
  const [confirm, setConfirm] = useState({
    visible: false,
    title: "",
    message: "",
    onConfirm: null,
    confirmText: "Confirm",
    confirmColor: C.navy,
  });
  const showConfirm = (
    title,
    message,
    onConfirm,
    confirmText = "Confirm",
    confirmColor = C.navy,
  ) =>
    setConfirm({
      visible: true,
      title,
      message,
      onConfirm,
      confirmText,
      confirmColor,
    });
  const hideConfirm = () => setConfirm((p) => ({ ...p, visible: false }));

  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [psgcLoading, setPsgcLoading] = useState({});
  const [resolvedAddr, setResolvedAddr] = useState({
    region: "",
    province: "",
    municipality: "",
    barangay: "",
  });
  const [phoneChanged, setPhoneChanged] = useState(false);
  const [altPhoneChanged, setAltPhoneChanged] = useState(false);

  const pollTimer = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const lastEtag = useRef(null);
  const isEditingRef = useRef(false);
  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(""), 5000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);
  useEffect(() => {
    if (errorMsg) {
      const t = setTimeout(() => setErrorMsg(""), 5000);
      return () => clearTimeout(t);
    }
  }, [errorMsg]);

  // ── EMAIL MODAL STATE ──────────────────────────────────────────────────────
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [emailStep, setEmailStep] = useState("checking");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailPasswordShow, setEmailPasswordShow] = useState(false);
  const [emailPasswordErr, setEmailPasswordErr] = useState("");
  const [emailPasswordLoading, setEmailPasswordLoading] = useState(false);
  const [emailCooldownHours, setEmailCooldownHours] = useState(0);
  const [emailLockedMins, setEmailLockedMins] = useState(0);
  const [emailSessionMins, setEmailSessionMins] = useState(0);
  const [emailSessionCountdown, setEmailSessionCountdown] = useState("");
const [emailPwLockedCountdown, setEmailPwLockedCountdown] = useState("");
const [emailSessionUntilTs, setEmailSessionUntilTs] = useState(null);
const [emailPwLockedUntilTs, setEmailPwLockedUntilTs] = useState(null);
const emailLockedCountdownRef = useRef(null);
  // Live countdown for cooldown screen
  const [emailBlockedUntilTs, setEmailBlockedUntilTs] = useState(null);
  const [emailCooldownCountdown, setEmailCooldownCountdown] = useState("");
  const emailCooldownTimerRef = useRef(null);
  const [emailOldMasked, setEmailOldMasked] = useState("");
  const [emailNewAddress, setEmailNewAddress] = useState("");
  const [emailNewErr, setEmailNewErr] = useState("");
  const [emailModalLoading, setEmailModalLoading] = useState(false);
  const [emailModalErr, setEmailModalErr] = useState("");
  const [oldOtpValues, setOldOtpValues] = useState(["", "", "", "", "", ""]);
  const [oldOtpError, setOldOtpError] = useState("");
  const [oldOtpTimer, setOldOtpTimer] = useState(0);
  const [oldResendsLeft, setOldResendsLeft] = useState(3);
  const [oldOtpState, setOldOtpState] = useState("active");
  const oldOtpTimerRef = useRef(null);
  const oldResendsLeftRef = useRef(3); // ← closure-safe ref
  const isResendingOldRef = useRef(false);
  const [newOtpValues, setNewOtpValues] = useState(["", "", "", "", "", ""]);
  const [newOtpError, setNewOtpError] = useState("");
  const [newOtpTimer, setNewOtpTimer] = useState(0);
  const [newResendsLeft, setNewResendsLeft] = useState(3);
  const newResendsLeftRef = useRef(3); // ← closure-safe ref
  const [newOtpMasked, setNewOtpMasked] = useState("");
  const [newOtpState, setNewOtpState] = useState("active");
  const newOtpTimerRef = useRef(null);
  const isResendingNewRef = useRef(false);
  const emailStepRef = useRef("checking");

  useEffect(() => {
    emailStepRef.current = emailStep;
  }, [emailStep]);
  useEffect(() => {
    oldResendsLeftRef.current = oldResendsLeft;
  }, [oldResendsLeft]);
  useEffect(() => {
    newResendsLeftRef.current = newResendsLeft;
  }, [newResendsLeft]);

  // ── Live countdown for email cooldown screen ───────────────────────────────
  useEffect(() => {
    clearInterval(emailCooldownTimerRef.current);
    if (emailStep !== "cooldown" || !emailBlockedUntilTs) return;
    const tick = () => {
      const ms = emailBlockedUntilTs - Date.now();
      if (ms <= 0) {
        setEmailCooldownCountdown("0m 00s");
        clearInterval(emailCooldownTimerRef.current);
        return;
      }
      const totalSecs = Math.ceil(ms / 1000);
      const h = Math.floor(totalSecs / 3600);
      const m = Math.floor((totalSecs % 3600) / 60);
      const s = totalSecs % 60;
      setEmailCooldownCountdown(
        h > 0
          ? `${h}h ${String(m).padStart(2, "0")}m`
          : `${m}m ${String(s).padStart(2, "0")}s`,
      );
    };
    tick();
    emailCooldownTimerRef.current = setInterval(tick, 1000);
    return () => clearInterval(emailCooldownTimerRef.current);
  }, [emailStep, emailBlockedUntilTs]);

  useEffect(() => {
  clearInterval(emailLockedCountdownRef.current);
  const activeTs = emailStep === "session-locked" ? emailSessionUntilTs
    : emailStep === "pw-locked" ? emailPwLockedUntilTs : null;
  if (!activeTs) return;
  const tick = () => {
    const ms = activeTs - Date.now();
    if (ms <= 0) {
      const str = "0m 00s";
      if (emailStep === "session-locked") setEmailSessionCountdown(str);
      if (emailStep === "pw-locked") setEmailPwLockedCountdown(str);
      clearInterval(emailLockedCountdownRef.current);
      return;
    }
    const totalSecs = Math.ceil(ms / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const sc = totalSecs % 60;
    const str = h > 0
      ? `${h}h ${String(m).padStart(2, "0")}m`
      : `${m}m ${String(sc).padStart(2, "0")}s`;
    if (emailStep === "session-locked") setEmailSessionCountdown(str);
    if (emailStep === "pw-locked") setEmailPwLockedCountdown(str);
  };
  tick();
  emailLockedCountdownRef.current = setInterval(tick, 1000);
  return () => clearInterval(emailLockedCountdownRef.current);
}, [emailStep, emailSessionUntilTs, emailPwLockedUntilTs]);

  const canResendOld =
    oldResendsLeft > 0 &&
    (oldOtpTimer === 0 || oldOtpState === "attempts-exceeded");
  const canResendNew =
    newResendsLeft > 0 &&
    (newOtpTimer === 0 || newOtpState === "attempts-exceeded");
  const EMAIL_STEPS = [
    "password",
    "old-send",
    "old-otp",
    "new-email",
    "new-otp",
    "done",
  ];
  const emailStepIdx = EMAIL_STEPS.indexOf(emailStep) + 1;

  // ── FIX: startTimer now accepts resendsLeftRef + whichOtp for force-lock ──
  const startTimer = (
    expiresAt,
    setTimer,
    setOtpState,
    timerRef,
    resendsLeftRef,
    whichOtp,
  ) => {
    clearInterval(timerRef.current);
    setOtpState("active");
    const tick = () => {
      const secs = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setTimer(secs);
      if (secs <= 0) {
        clearInterval(timerRef.current);
        const resendsRemaining = resendsLeftRef.current;
        const currentStep = emailStepRef.current;
        if (
          resendsRemaining <= 0 &&
          (currentStep === "old-otp" || currentStep === "new-otp")
        ) {
          // FIX: Persist lock to backend so it survives logout/re-login
          AsyncStorage.getItem("token")
            .then((token) => {
              fetch(`${BASE_URL}/users/email/force-lock`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ which: whichOtp }),
              }).catch(() => {});
            })
            .catch(() => {});
          const lockMins = 15;
          AsyncStorage.setItem(
            "cem_session_locked",
            JSON.stringify({ until: Date.now() + lockMins * 60_000 }),
          ).catch(() => {});
          // FIX: Clear stale OTP error before transitioning to lock screen
          if (whichOtp === "old") setOldOtpError("");
          else setNewOtpError("");
          setEmailSessionMins(lockMins);
          setEmailStep("session-locked");
          return;
        }
        setOtpState((prev) =>
          prev === "attempts-exceeded" ? "attempts-exceeded" : "expired",
        );
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
  };

  const formatTimer = (secs) =>
    `${Math.floor(secs / 60)
      .toString()
      .padStart(2, "0")}:${(secs % 60).toString().padStart(2, "0")}`;

  useEffect(() => {
    loadProfile(true);
    startPolling();
    const sub = AppState.addEventListener("change", (nextState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === "active"
      )
        silentRefresh();
      appStateRef.current = nextState;
    });
    return () => {
      stopPolling();
      sub.remove();
      clearInterval(oldOtpTimerRef.current);
      clearInterval(newOtpTimerRef.current);
    };
  }, []);

  const startPolling = () => {
    stopPolling();
    pollTimer.current = setInterval(() => {
      if (!isEditingRef.current) silentRefresh();
    }, POLL_INTERVAL);
  };
  const stopPolling = () => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  };

  const silentRefresh = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      setRefreshing(true);
      const res = await fetch(`${BASE_URL}/users/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (res.status === 401) {
        stopPolling();
        await AsyncStorage.clear();
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        return;
      }
      if (!res.ok) return;
      const json = await res.json();
      if (!json.success || !json.user) return;
      const newStr = JSON.stringify(json.user);
      if (newStr === lastEtag.current) return;
      lastEtag.current = newStr;
      await AsyncStorage.setItem("user", JSON.stringify(json.user));
      applyToState(json.user);
      await resolveAddressNames(json.user);
    } catch (_) {
    } finally {
      setRefreshing(false);
    }
  };

  const loadProfile = async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        setLoading(false);
        return;
      }
      const res = await fetch(`${BASE_URL}/users/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (res.status === 401) {
        await AsyncStorage.clear();
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        return;
      }
      const json = await res.json();
      if (res.ok && json.success && json.user) {
        lastEtag.current = JSON.stringify(json.user);
        await AsyncStorage.setItem("user", JSON.stringify(json.user));
        applyToState(json.user);
        await resolveAddressNames(json.user);
      } else {
        const cached = await AsyncStorage.getItem("user");
        if (cached) {
          const u = JSON.parse(cached);
          applyToState(u);
          await resolveAddressNames(u);
        }
        setErrorMsg(json.message || "Could not load profile");
      }
    } catch {
      try {
        const cached = await AsyncStorage.getItem("user");
        if (cached) {
          const u = JSON.parse(cached);
          applyToState(u);
          await resolveAddressNames(u);
        }
      } catch {}
      setErrorMsg("Network error - showing cached data");
    } finally {
      setLoading(false);
    }
  };

  const applyToState = (u) => {
    const phone = u.phone ? u.phone.replace(/^\+63/, "") : "";
    const altPhone = u.alternate_phone
      ? u.alternate_phone.replace(/^\+63/, "")
      : "";
    const fv = {
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      middle_name: u.middle_name || "",
      suffix: u.suffix || "",
      date_of_birth: u.date_of_birth ? u.date_of_birth.split("T")[0] : "",
      gender: u.gender || "Male",
      phone,
      alternate_phone: altPhone,
      email: u.email || "",
      region_code: u.region_code || "",
      province_code: u.province_code || "",
      municipality_code: u.municipality_code || "",
      barangay_code: u.barangay_code || "",
      address_line: u.address_line || "",
    };
    setProfileData(u);
    setFormData(fv);
    setOriginalFormData(fv);
  };

  const loadRegions = useCallback(async () => {
    setPsgcLoading((p) => ({ ...p, regions: true }));
    let arr = [];
    try {
      const d = await (await fetch(`${PSGC_API}/regions/`)).json();
      arr = Array.isArray(d)
        ? d.sort((a, b) => a.name.localeCompare(b.name))
        : [];
      setRegions(arr);
    } catch {}
    setPsgcLoading((p) => ({ ...p, regions: false }));
    return arr;
  }, []);
  const loadProvinces = useCallback(async (rc) => {
    if (!rc) {
      setProvinces([]);
      setMunicipalities([]);
      setBarangays([]);
      return [];
    }
    setPsgcLoading((p) => ({ ...p, provinces: true }));
    let arr = [];
    try {
      const d = await (
        await fetch(`${PSGC_API}/regions/${rc}/provinces/`)
      ).json();
      arr = Array.isArray(d)
        ? d.sort((a, b) => a.name.localeCompare(b.name))
        : [];
      setProvinces(arr);
    } catch {}
    setMunicipalities([]);
    setBarangays([]);
    setPsgcLoading((p) => ({ ...p, provinces: false }));
    return arr;
  }, []);
  const loadMunicipalities = useCallback(async (pc) => {
    if (!pc) {
      setMunicipalities([]);
      setBarangays([]);
      return [];
    }
    setPsgcLoading((p) => ({ ...p, municipalities: true }));
    let arr = [];
    try {
      const d = await (
        await fetch(`${PSGC_API}/provinces/${pc}/cities-municipalities/`)
      ).json();
      arr = Array.isArray(d)
        ? d.sort((a, b) => a.name.localeCompare(b.name))
        : [];
      setMunicipalities(arr);
    } catch {}
    setBarangays([]);
    setPsgcLoading((p) => ({ ...p, municipalities: false }));
    return arr;
  }, []);
  const loadBarangays = useCallback(async (mc) => {
    if (!mc) {
      setBarangays([]);
      return [];
    }
    setPsgcLoading((p) => ({ ...p, barangays: true }));
    let arr = [];
    try {
      const d = await (
        await fetch(`${PSGC_API}/cities-municipalities/${mc}/barangays/`)
      ).json();
      arr = Array.isArray(d)
        ? d.sort((a, b) => a.name.localeCompare(b.name))
        : [];
      setBarangays(arr);
    } catch {}
    setPsgcLoading((p) => ({ ...p, barangays: false }));
    return arr;
  }, []);

  const resolveAddressNames = async (u) => {
    if (u.region && u.province) {
      setResolvedAddr({
        region: u.region || "",
        province: u.province || "",
        municipality: u.municipality || u.city || "",
        barangay: u.barangay || "",
      });
      return;
    }
    if (!u.region_code) return;
    try {
      const [rArr, pArr, mArr, bArr] = await Promise.all([
        fetch(`${PSGC_API}/regions/`)
          .then((r) => r.json())
          .catch(() => []),
        u.region_code
          ? fetch(`${PSGC_API}/regions/${u.region_code}/provinces/`)
              .then((r) => r.json())
              .catch(() => [])
          : Promise.resolve([]),
        u.province_code
          ? fetch(
              `${PSGC_API}/provinces/${u.province_code}/cities-municipalities/`,
            )
              .then((r) => r.json())
              .catch(() => [])
          : Promise.resolve([]),
        u.municipality_code
          ? fetch(
              `${PSGC_API}/cities-municipalities/${u.municipality_code}/barangays/`,
            )
              .then((r) => r.json())
              .catch(() => [])
          : Promise.resolve([]),
      ]);
      setResolvedAddr({
        region:
          (Array.isArray(rArr)
            ? rArr.find((x) => x.code === u.region_code)?.name
            : "") || "",
        province:
          (Array.isArray(pArr)
            ? pArr.find((x) => x.code === u.province_code)?.name
            : "") || "",
        municipality:
          (Array.isArray(mArr)
            ? mArr.find((x) => x.code === u.municipality_code)?.name
            : "") || "",
        barangay:
          (Array.isArray(bArr)
            ? bArr.find((x) => x.code === u.barangay_code)?.name
            : "") || "",
      });
    } catch (e) {
      console.error("resolveAddressNames:", e);
    }
  };

  const resolveFromArrays = async (rc, pc, mc, bc) => {
    let bArr = barangays;
    if (!bArr.find((x) => x.code === bc) && mc) bArr = await loadBarangays(mc);
    setResolvedAddr({
      region: regions.find((x) => x.code === rc)?.name || "",
      province: provinces.find((x) => x.code === pc)?.name || "",
      municipality: municipalities.find((x) => x.code === mc)?.name || "",
      barangay: bArr.find((x) => x.code === bc)?.name || "",
    });
  };

  const validate = () => {
    const e = {};
    const fn = V.name(formData.first_name, "First name");
    if (fn) e.first_name = fn;
    const ln = V.name(formData.last_name, "Last name");
    if (ln) e.last_name = ln;
    if (formData.middle_name) {
      const mn = V.name(formData.middle_name, "Middle name", 50, false);
      if (mn) e.middle_name = mn;
    }
    const sf = V.suffix(formData.suffix);
    if (sf) e.suffix = sf;
    if (phoneChanged && formData.phone) {
      const pe = V.phone(formData.phone, "Phone");
      if (pe) e.phone = pe;
    }
    if (altPhoneChanged && formData.alternate_phone) {
      const ape = V.phone(formData.alternate_phone, "Alternate phone");
      if (ape) e.alternate_phone = ape;
    }
    const ep = phoneChanged ? formData.phone : originalFormData.phone;
    const eap = altPhoneChanged
      ? formData.alternate_phone
      : originalFormData.alternate_phone;
    if (ep && eap && ep.replace(/\D/g, "") === eap.replace(/\D/g, ""))
      e.alternate_phone = "Alternate phone cannot be same as primary";
    if ((formData.address_line || "").length > 255)
      e.address_line = "Max 255 characters";
    if (!formData.region_code) e.region_code = "Region is required";
    if (!formData.province_code) e.province_code = "Province is required";
    if (!formData.municipality_code)
      e.municipality_code = "City / Municipality is required";
    if (!formData.barangay_code) e.barangay_code = "Barangay is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onChange = (name, value) => {
    if (["first_name", "last_name", "middle_name"].includes(name))
      value = value.replace(/[^a-zA-Z\s'\-.]/g, "").slice(0, 50);
    else if (name === "suffix")
      value = value.replace(/[^ivxlcdmjrsr.\s]/gi, "").slice(0, 5);
    else if (name === "address_line") value = value.slice(0, 255);
    setFormData((p) => ({ ...p, [name]: value }));
    if (errors[name])
      setErrors((p) => {
        const n = { ...p };
        delete n[name];
        return n;
      });
  };
  const onPhone = (name, value) => {
    const d = value.replace(/\D/g, "").slice(0, 10);
    setFormData((p) => ({ ...p, [name]: d }));
    if (name === "phone") setPhoneChanged(d.length > 0);
    if (name === "alternate_phone") setAltPhoneChanged(d.length > 0);
    if (errors[name])
      setErrors((p) => {
        const n = { ...p };
        delete n[name];
        return n;
      });
  };
  const onRegion = async (code) => {
    setFormData((p) => ({
      ...p,
      region_code: code,
      province_code: "",
      municipality_code: "",
      barangay_code: "",
    }));
    setShowDropdown(null);
    await loadProvinces(code);
  };
  const onProvince = async (code) => {
    setFormData((p) => ({
      ...p,
      province_code: code,
      municipality_code: "",
      barangay_code: "",
    }));
    setShowDropdown(null);
    await loadMunicipalities(code);
  };
  const onMunicipality = async (code) => {
    setFormData((p) => ({ ...p, municipality_code: code, barangay_code: "" }));
    setShowDropdown(null);
    await loadBarangays(code);
  };
  const onBarangay = (code) => {
    setFormData((p) => ({ ...p, barangay_code: code }));
    setShowDropdown(null);
  };

  const startEdit = async () => {
    stopPolling();
    setFormData({ ...originalFormData, phone: "", alternate_phone: "" });
    setPhoneChanged(false);
    setAltPhoneChanged(false);
    setErrors({});
    setIsEditing(true);
    await loadRegions();
    if (originalFormData.region_code) {
      await loadProvinces(originalFormData.region_code);
      if (originalFormData.province_code) {
        await loadMunicipalities(originalFormData.province_code);
        if (originalFormData.municipality_code)
          await loadBarangays(originalFormData.municipality_code);
      }
    }
  };
  const cancelEdit = () => {
    setFormData(originalFormData);
    setErrors({});
    setPhoneChanged(false);
    setAltPhoneChanged(false);
    setIsEditing(false);
    startPolling();
  };

  const onSavePress = () => {
    if (!validate()) {
      setErrorMsg("Please fix the errors before saving.");
      return;
    }
    showConfirm(
      "Save Changes",
      "Are you sure you want to save these changes to your profile?",
      () => {
        hideConfirm();
        doSave();
      },
      "Yes, Save",
    );
  };

  const doSave = async () => {
    setIsSaving(true);
    setSuccessMsg("");
    setErrorMsg("");
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        setErrorMsg("Not authenticated");
        setIsSaving(false);
        return;
      }
      const cap = (s) =>
        s
          ?.trim()
          .split(" ")
          .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
          .join(" ");
      let fmt = { ...formData };
      if (fmt.first_name) fmt.first_name = cap(fmt.first_name);
      if (fmt.last_name) fmt.last_name = cap(fmt.last_name);
      if (fmt.middle_name) fmt.middle_name = cap(fmt.middle_name);
      if (fmt.suffix) {
        const t = fmt.suffix.trim();
        fmt.suffix =
          t.toLowerCase() === "sr."
            ? "Sr."
            : t.toLowerCase() === "jr."
              ? "Jr."
              : /^[ivxlcdm]+$/i.test(t)
                ? t.toUpperCase()
                : t;
      }
      fmt.phone =
        phoneChanged && fmt.phone
          ? `+63${fmt.phone.trim()}`
          : originalFormData.phone
            ? `+63${originalFormData.phone}`
            : "";
      fmt.alternate_phone =
        altPhoneChanged && fmt.alternate_phone
          ? `+63${fmt.alternate_phone.trim()}`
          : originalFormData.alternate_phone
            ? `+63${originalFormData.alternate_phone}`
            : "";
      fmt.email = originalFormData.email || "";
      const fd = new FormData();
      [
        "first_name",
        "last_name",
        "middle_name",
        "suffix",
        "gender",
        "email",
        "phone",
        "alternate_phone",
        "region_code",
        "province_code",
        "municipality_code",
        "barangay_code",
        "address_line",
        "date_of_birth",
      ].forEach((k) => {
        if (fmt[k] != null && fmt[k].toString().trim() !== "")
          fd.append(k, fmt[k].toString());
      });
      const res = await fetch(
        `${BASE_URL}/users/profile/${String(profileData.user_id)}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        if (json.errors && Array.isArray(json.errors)) {
          const be = {};
          json.errors.forEach((e) => {
            if (e.field) be[e.field] = e.message;
          });
          if (Object.keys(be).length) setErrors(be);
        }
        setErrorMsg(json.message || "Failed to update profile");
        setIsSaving(false);
        return;
      }
      await resolveFromArrays(
        fmt.region_code,
        fmt.province_code,
        fmt.municipality_code,
        fmt.barangay_code,
      );
      const fresh = json.user || { ...profileData, ...fmt };
      lastEtag.current = JSON.stringify(fresh);
      await AsyncStorage.setItem("user", JSON.stringify(fresh));
      applyToState(fresh);
      setSuccessMsg("Profile updated successfully!");
      setIsEditing(false);
      setPhoneChanged(false);
      setAltPhoneChanged(false);
      startPolling();
    } catch (err) {
      console.error("doSave:", err);
      setErrorMsg("Network error. Check your connection.");
    } finally {
      setIsSaving(false);
    }
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setErrorMsg("Gallery permission required");
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!r.canceled && r.assets[0]) {
      setShowPhotoModal(false);
      confirmUploadPhoto(r.assets[0].uri);
    }
  };
  const takeWithCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setErrorMsg("Camera permission required");
      return;
    }
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!r.canceled && r.assets[0]) {
      setShowPhotoModal(false);
      confirmUploadPhoto(r.assets[0].uri);
    }
  };
  const confirmUploadPhoto = (uri) =>
    showConfirm(
      "Update Profile Photo",
      "Are you sure you want to update your profile photo?",
      () => {
        hideConfirm();
        uploadPhoto(uri);
      },
      "Yes, Update",
    );
  const uploadPhoto = async (uri) => {
    try {
      setUploadingPhoto(true);
      const token = await AsyncStorage.getItem("token");
      const fd = new FormData();
      if (Platform.OS === "web") {
        const blob = await (await fetch(uri)).blob();
        fd.append("profilePicture", blob, "profile.jpg");
      } else {
        fd.append("profilePicture", {
          uri,
          type: "image/jpeg",
          name: "profile.jpg",
        });
      }
      const res = await fetch(`${BASE_URL}/users/profile/picture`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.message || "Failed to upload photo");
      } else {
        const newPic = json.profile_picture;
        setProfileData((p) => ({ ...p, profile_picture: newPic }));
        const cached = await AsyncStorage.getItem("user");
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed.profile_picture = newPic;
          lastEtag.current = JSON.stringify(parsed);
          await AsyncStorage.setItem("user", JSON.stringify(parsed));
        }
        setSuccessMsg("Profile photo updated!");
      }
    } catch (err) {
      console.error("uploadPhoto:", err);
      setErrorMsg("Error uploading photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const logout = () =>
    showConfirm(
      "Logout",
      "Are you sure you want to logout?",
      async () => {
        hideConfirm();
        stopPolling();
        await AsyncStorage.clear();
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
      },
      "Logout",
      C.red,
    );

  // ── EMAIL FLOW ─────────────────────────────────────────────────────────────
  const resetEmailModal = () => {
    setEmailPassword("");
    setEmailPasswordShow(false);
    setEmailPasswordErr("");
    setEmailNewAddress("");
    setEmailNewErr("");
    setEmailModalErr("");
    setOldOtpValues(["", "", "", "", "", ""]);
    setOldOtpError("");
    setOldOtpTimer(0);
    setOldResendsLeft(3);
    setOldOtpState("active");
    setNewOtpValues(["", "", "", "", "", ""]);
    setNewOtpError("");
    setNewOtpTimer(0);
    setNewResendsLeft(3);
    setNewOtpMasked("");
    setNewOtpState("active");
    setEmailOldMasked("");
    clearInterval(oldOtpTimerRef.current);
    clearInterval(newOtpTimerRef.current);
    isResendingOldRef.current = false;
    isResendingNewRef.current = false;
    oldResendsLeftRef.current = 3;
    newResendsLeftRef.current = 3;
  };
  const openEmailModal = async () => {
  resetEmailModal();
  setEmailModalVisible(true);
  setEmailStep("checking");

  // FIX 4: Check AsyncStorage for active pw lock FIRST
  try {
    const savedPwLock = await AsyncStorage.getItem("cem_pw_locked");
    if (savedPwLock) {
      const { until } = JSON.parse(savedPwLock);
      if (Date.now() < until) {
        setEmailPwLockedUntilTs(until);
        setEmailLockedMins(Math.ceil((until - Date.now()) / 60_000));
        setEmailStep("pw-locked");
        return;
      }
      await AsyncStorage.removeItem("cem_pw_locked");
    }
  } catch {
    await AsyncStorage.removeItem("cem_pw_locked");
  }

  // Check session lock
  try {
    const stored = await AsyncStorage.getItem("cem_session_locked");
    if (stored) {
      const { until } = JSON.parse(stored);
      if (Date.now() < until) {
        setEmailSessionMins(Math.ceil((until - Date.now()) / 60_000));
        setEmailSessionUntilTs(until);
        setEmailStep("session-locked");
        return;
      }
      await AsyncStorage.removeItem("cem_session_locked");
    }
  } catch {
    await AsyncStorage.removeItem("cem_session_locked");
  }

  // Call API status check
  try {
    const token = await AsyncStorage.getItem("token");
    const res = await fetch(`${BASE_URL}/users/email/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await res.json();
    if (d.blocked) {
      const hrs = d.hoursLeft ?? 24;
      setEmailCooldownHours(hrs);
      setEmailBlockedUntilTs(Date.now() + (d.msLeft ?? hrs * 3_600_000));
      setEmailStep("cooldown");
      return;
    } else if (d.sessionLocked) {
      const lm = d.minsLeft ?? 15;
      setEmailSessionMins(lm);
      const untilTs = Date.now() + (d.msLeft ?? lm * 60_000);
      setEmailSessionUntilTs(untilTs);
      await AsyncStorage.setItem(
        "cem_session_locked",
        JSON.stringify({ until: untilTs }),
      );
      setEmailStep("session-locked");
    } else if (d.pwLocked) {
      const lm = d.minsLeft ?? 15;
      setEmailLockedMins(lm);
      try {
        const saved = await AsyncStorage.getItem("cem_pw_locked");
        if (saved) {
          const { until } = JSON.parse(saved);
          if (Date.now() < until) {
            setEmailPwLockedUntilTs(until);
            setEmailStep("pw-locked");
            return;
          }
          await AsyncStorage.removeItem("cem_pw_locked");
        }
      } catch {}
      const untilTs = Date.now() + (d.msLeft ?? lm * 60_000);
      setEmailPwLockedUntilTs(untilTs);
      await AsyncStorage.setItem(
        "cem_pw_locked",
        JSON.stringify({ until: untilTs }),
      );
      setEmailStep("pw-locked");
    } else {
      setEmailStep("password");
    }
  } catch {
    setEmailStep("password");
  }
};
  
const closeEmailModal = async () => {
  setEmailModalVisible(false);
  clearInterval(oldOtpTimerRef.current);
  clearInterval(newOtpTimerRef.current);
  clearInterval(emailCooldownTimerRef.current);
  clearInterval(emailLockedCountdownRef.current);
  // Clean up expired locks
  try {
    const saved = await AsyncStorage.getItem("cem_pw_locked");
    if (saved) {
      const { until } = JSON.parse(saved);
      if (Date.now() >= until) {
        await AsyncStorage.removeItem("cem_pw_locked");
      }
    }
  } catch {}
};
  const saveSessionLock = async (lm) => {
    await AsyncStorage.setItem(
      "cem_session_locked",
      JSON.stringify({ until: Date.now() + lm * 60_000 }),
    );
  };
  // FIX: clearErrFn parameter clears stale OTP error before showing lock screen
 const goSessionLocked = async (lm, clearErrFn) => {
  if (clearErrFn) clearErrFn("");
  setEmailSessionMins(lm);
  setEmailSessionUntilTs(Date.now() + lm * 60_000); // ← ADDED
  await saveSessionLock(lm);
  setEmailStep("session-locked");
};
  const handleEmailVerifyPassword = async () => {
    if (!emailPassword.trim()) {
      setEmailPasswordErr("Password is required");
      return;
    }
    setEmailPasswordLoading(true);
    setEmailPasswordErr("");
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${BASE_URL}/users/email/verify-password`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: emailPassword }),
      });
      const d = await res.json();
      if (!res.ok) {


 if (d.pwLocked || d.locked) {
  const lm = d.minutesLeft ?? 15;
  setEmailLockedMins(lm);
  const untilTs = Date.now() + (d.msLeft ?? lm * 60_000);
  setEmailPwLockedUntilTs(untilTs);
  // Save to AsyncStorage so timer persists on reopen
  await AsyncStorage.setItem(
    "cem_pw_locked",
    JSON.stringify({ until: untilTs }),
  );
  setEmailStep("pw-locked");
  return;
}
        if (d.blocked) {
          const hrs = d.hoursLeft ?? 24;
          setEmailCooldownHours(hrs);
          setEmailBlockedUntilTs(Date.now() + (d.msLeft ?? hrs * 3_600_000));
          setEmailStep("cooldown");
          return;
        }
        if (d.sessionLocked) {
          await goSessionLocked(d.minutesLeft ?? 15);
          return;
        }
        setEmailPasswordErr(d.message || "Incorrect password");
        return;
      }
      setEmailStep("old-send");
    } catch {
      setEmailPasswordErr("Network error. Try again.");
    } finally {
      setEmailPasswordLoading(false);
    }
  };
  const handleSendOldOtp = async () => {
    if (isResendingOldRef.current) return;
    isResendingOldRef.current = true;
    setEmailModalLoading(true);
    setOldOtpError("");
    setEmailModalErr("");
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${BASE_URL}/users/email/request-old-otp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.sessionLocked) {
          await goSessionLocked(d.minutesLeft ?? 15, setOldOtpError);
          return;
        }
        if (d.resendLocked || res.status === 429) {
          setEmailModalErr("");
          if (emailStep !== "old-otp") setEmailStep("old-otp");
          return;
        }
        setOldOtpError(d.message || "Failed to send code");
        return;
      }
      setEmailOldMasked(d.maskedEmail || "");
      const rl = d.resendsLeft ?? 2;
      setOldResendsLeft(rl);
      oldResendsLeftRef.current = rl;
      setOldOtpValues(["", "", "", "", "", ""]);
      setOldOtpState("active");
      if (emailStep !== "old-otp") setEmailStep("old-otp");
      if (d.otpExpiresAt)
        startTimer(
          d.otpExpiresAt,
          setOldOtpTimer,
          setOldOtpState,
          oldOtpTimerRef,
          oldResendsLeftRef,
          "old",
        );
    } catch {
      setOldOtpError("Network error. Try again.");
    } finally {
      setEmailModalLoading(false);
      isResendingOldRef.current = false;
    }
  };
  const handleVerifyOldOtp = async () => {
    const code = oldOtpValues.join("");
    if (code.length !== 6) {
      setOldOtpError("Please enter all 6 digits");
      return;
    }
    setEmailModalLoading(true);
    setOldOtpError("");
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${BASE_URL}/users/email/verify-old-otp`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ otp: code }),
      });
      const d = await res.json();
      if (!res.ok) {
        // FIX: clear error first
        if (d.sessionLocked || d.autoClose) {
          await goSessionLocked(d.minutesLeft ?? 15, setOldOtpError);
          return;
        }
        if (d.forceResend || d.attemptLocked || res.status === 429) {
          setOldOtpState("attempts-exceeded");
          setOldOtpValues(["", "", "", "", "", ""]);
          clearInterval(oldOtpTimerRef.current);
          setOldOtpTimer(0);
          if (d.resendsLeft !== undefined) {
            setOldResendsLeft(d.resendsLeft);
            oldResendsLeftRef.current = d.resendsLeft;
          }
          setOldOtpError(
            "Too many incorrect attempts. Please request a new code.",
          );
          return;
        }
        setOldOtpError(d.message || "Incorrect code");
        setOldOtpValues(["", "", "", "", "", ""]);
        return;
      }
      clearInterval(oldOtpTimerRef.current);
      setEmailStep("new-email");
    } catch {
      setOldOtpError("Network error. Try again.");
    } finally {
      setEmailModalLoading(false);
    }
  };
  const handleSendNewOtp = async () => {
    const err = V.email(emailNewAddress);
    if (err) {
      setEmailNewErr(err);
      return;
    }
    if (isResendingNewRef.current) return;
    isResendingNewRef.current = true;
    setEmailModalLoading(true);
    setEmailNewErr("");
    setNewOtpError("");
    setEmailModalErr("");
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${BASE_URL}/users/email/request-new-otp`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newEmail: emailNewAddress.trim().toLowerCase(),
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.sessionLocked) {
          await goSessionLocked(d.minutesLeft ?? 15, setNewOtpError);
          return;
        }
        if (d.resendLocked || res.status === 429) {
          setEmailModalErr("");
          if (emailStep !== "new-otp") setEmailStep("new-otp");
          return;
        }
        setEmailNewErr(d.message || "Failed to send code");
        return;
      }
      setNewOtpMasked(d.maskedEmail || "");
      const rl = d.resendsLeft ?? 2;
      setNewResendsLeft(rl);
      newResendsLeftRef.current = rl;
      setNewOtpValues(["", "", "", "", "", ""]);
      setNewOtpState("active");
      if (emailStep !== "new-otp") setEmailStep("new-otp");
      if (d.otpExpiresAt)
        startTimer(
          d.otpExpiresAt,
          setNewOtpTimer,
          setNewOtpState,
          newOtpTimerRef,
          newResendsLeftRef,
          "new",
        );
    } catch {
      setEmailNewErr("Network error. Try again.");
    } finally {
      setEmailModalLoading(false);
      isResendingNewRef.current = false;
    }
  };
  const handleVerifyNewOtp = async () => {
    const code = newOtpValues.join("");
    if (code.length !== 6) {
      setNewOtpError("Please enter all 6 digits");
      return;
    }
    setEmailModalLoading(true);
    setNewOtpError("");
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${BASE_URL}/users/email/verify-new-otp`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ otp: code }),
      });
      const d = await res.json();
      if (!res.ok) {
        // FIX: clear error first
        if (d.sessionLocked || d.autoClose) {
          await goSessionLocked(d.minutesLeft ?? 15, setNewOtpError);
          return;
        }
        if (d.forceResend || d.attemptLocked || res.status === 429) {
          setNewOtpState("attempts-exceeded");
          setNewOtpValues(["", "", "", "", "", ""]);
          clearInterval(newOtpTimerRef.current);
          setNewOtpTimer(0);
          if (d.resendsLeft !== undefined) {
            setNewResendsLeft(d.resendsLeft);
            newResendsLeftRef.current = d.resendsLeft;
          }
          setNewOtpError(
            "Too many incorrect attempts. Please request a new code.",
          );
          return;
        }
        setNewOtpError(d.message || "Incorrect code");
        setNewOtpValues(["", "", "", "", "", ""]);
        return;
      }
      clearInterval(newOtpTimerRef.current);
      await saveVerifiedEmail(emailNewAddress.trim().toLowerCase());
    } catch {
      setNewOtpError("Network error. Try again.");
    } finally {
      setEmailModalLoading(false);
    }
  };
  const saveVerifiedEmail = async (newEmail) => {
    setEmailModalLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const fd = new FormData();
      fd.append("email", newEmail);
      [
        "first_name",
        "last_name",
        "middle_name",
        "suffix",
        "gender",
        "phone",
        "alternate_phone",
        "region_code",
        "province_code",
        "municipality_code",
        "barangay_code",
        "address_line",
      ].forEach((k) => {
        const v = originalFormData[k];
        if (v != null && v.toString().trim() !== "") fd.append(k, v.toString());
      });
      if (originalFormData.phone)
        fd.set("phone", `+63${originalFormData.phone}`);
      if (originalFormData.alternate_phone)
        fd.set("alternate_phone", `+63${originalFormData.alternate_phone}`);
      const res = await fetch(
        `${BASE_URL}/users/profile/${String(profileData.user_id)}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        setNewOtpError(json.message || "Failed to save new email");
        return;
      }
      const fresh = json.user || { ...profileData, email: newEmail };
      lastEtag.current = JSON.stringify(fresh);
      await AsyncStorage.setItem("user", JSON.stringify(fresh));
      applyToState(fresh);
      setEmailStep("done");
    } catch {
      setNewOtpError("Network error saving email. Try again.");
    } finally {
      setEmailModalLoading(false);
    }
  };
  const handleResendOldOtp = async () => {
    if (!canResendOld) return;
    await handleSendOldOtp();
  };
  const handleResendNewOtp = async () => {
    if (!canResendNew) return;
    await handleSendNewOtp();
  };

  // ── Dropdown (edit modal) ─────────────────────────────────────────────────
  const ZMAP = {
    region: 4000,
    province: 3000,
    municipality: 2000,
    barangay: 1000,
  };
  const Dropdown = ({
    id,
    label,
    value,
    items,
    onSelect,
    loading: dLoad,
    disabled,
    error,
  }) => (
    <View
      style={[
        ef.dropdownGroup,
        { zIndex: showDropdown === id ? ZMAP[id] : 10 },
      ]}
    >
      <Text style={ef.fieldLabelSm}>{label}</Text>
      <TouchableOpacity
        style={[
          ef.dropdown,
          error && ef.dropdownErr,
          disabled && ef.dropdownOff,
        ]}
        onPress={() =>
          !disabled &&
          !isSaving &&
          setShowDropdown(showDropdown === id ? null : id)
        }
      >
        <Ionicons
          name="location-outline"
          size={14}
          color={disabled ? C.textLight : C.textMuted}
          style={{ marginRight: 8 }}
        />
        <Text style={[ef.dropdownTxt, !value && ef.dropdownPlaceholder]}>
          {items.find((i) => i.code === value)?.name ||
            `Select ${label.replace(" *", "")}`}
        </Text>
        <Ionicons
          name={showDropdown === id ? "chevron-up" : "chevron-down"}
          size={16}
          color={disabled ? C.textLight : C.navy}
        />
      </TouchableOpacity>
      {showDropdown === id && (
        <View style={ef.ddList}>
          {dLoad ? (
            <View style={ef.ddLoader}>
              <ActivityIndicator size="small" color={C.navy} />
              <Text style={ef.ddLoaderTxt}>Loading…</Text>
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: 200 }}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {items.map((item) => (
                <TouchableOpacity
                  key={item.code}
                  style={[ef.ddItem, value === item.code && ef.ddItemOn]}
                  onPress={() => onSelect(item.code)}
                >
                  {value === item.code && (
                    <Ionicons
                      name="checkmark"
                      size={13}
                      color={C.navy}
                      style={{ marginRight: 4 }}
                    />
                  )}
                  <Text
                    style={[
                      ef.ddItemTxt,
                      value === item.code && ef.ddItemTxtOn,
                    ]}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}
      {error ? (
        <View style={ef.ddErrRow}>
          <Ionicons name="alert-circle-outline" size={12} color={C.danger} />
          <Text style={ef.ddErrTxt}>{error}</Text>
        </View>
      ) : null}
    </View>
  );

  // ── OTP step renderer ─────────────────────────────────────────────────────
  const renderOtpStep = ({
    otpValues,
    setOtpValues,
    otpState,
    otpTimer,
    otpError,
    masked,
    resendsLeft,
    canResend,
    onVerify,
    onResend,
    stepTitle,
  }) => (
    <View>
      <View style={em.infoCard}>
        <View style={em.infoCardIcon}>
          <Ionicons name="mail-open-outline" size={18} color="#1d4ed8" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={em.infoCardTitle}>
            Code sent to{" "}
            <Text style={{ fontWeight: "700", color: C.navy }}>{masked}</Text>
          </Text>
          <Text style={em.infoCardSub}>
            Expires in <Text style={{ fontWeight: "700" }}>2 minutes</Text>. Do
            not share.
          </Text>
        </View>
      </View>
      {otpState !== "attempts-exceeded" && (
        <View
          style={[
            em.timerPill,
            otpTimer <= 30 && otpTimer > 0 && em.timerWarn,
            otpTimer === 0 && em.timerExpired,
          ]}
        >
          <Ionicons
            name="time-outline"
            size={13}
            color={
              otpTimer === 0 ? C.danger : otpTimer <= 30 ? C.amber : C.navy
            }
          />
          <Text
            style={[
              em.timerTxt,
              otpTimer <= 30 && otpTimer > 0 && { color: C.amber },
              otpTimer === 0 && { color: C.danger },
            ]}
          >
            {otpTimer > 0
              ? `Expires in ${formatTimer(otpTimer)}`
              : "Code expired. Request a new one."}
          </Text>
        </View>
      )}
      {otpError !== "" && (
        <View
          style={[
            em.banner,
            otpState === "attempts-exceeded" && em.bannerAmber,
          ]}
        >
          <Ionicons
            name={otpState === "attempts-exceeded" ? "warning" : "close-circle"}
            size={15}
            color={C.white}
          />
          <Text style={em.bannerTxt}>{otpError}</Text>
        </View>
      )}
      <OtpBoxes
        values={otpValues}
        onChange={(idx, val) =>
          setOtpValues((p) => {
            const n = [...p];
            n[idx] = val;
            return n;
          })
        }
        disabled={emailModalLoading || otpState !== "active"}
      />
      {otpState === "active" && (
        <TouchableOpacity
          style={[
            em.primaryBtn,
            (otpValues.join("").length !== 6 || emailModalLoading) &&
              em.primaryBtnOff,
          ]}
          onPress={onVerify}
          disabled={otpValues.join("").length !== 6 || emailModalLoading}
        >
          {emailModalLoading ? (
            <ActivityIndicator size="small" color={C.white} />
          ) : null}
          <Text style={em.primaryBtnTxt}>
            {emailModalLoading ? "Verifying…" : stepTitle}
          </Text>
        </TouchableOpacity>
      )}
      <View style={em.resendWrap}>
        {resendsLeft <= 0 ? (
          <Text style={em.resendExhausted}>
            No more resends available for this session
          </Text>
        ) : canResend ? (
          <TouchableOpacity
            style={[em.resendBtn, emailModalLoading && { opacity: 0.5 }]}
            onPress={onResend}
            disabled={emailModalLoading}
          >
            <Ionicons
              name="refresh"
              size={13}
              color={emailModalLoading ? C.textLight : C.navy}
            />
            <Text
              style={[
                em.resendBtnTxt,
                emailModalLoading && { color: C.textLight },
              ]}
            >
              {emailModalLoading
                ? "Sending…"
                : `Resend Code (${resendsLeft} left)`}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

const renderEmailLockedStep = ({
  iconBg, iconColor, iconName, title, message, submessage, countdown,
}) => (
  <View style={em.lockedWrap}>
    {/* Double ring icon */}
    <View style={em.lockedIconOuter}>
      <View style={em.lockedIconInner}>
        <Ionicons name={iconName} size={32} color={C.navy} />
      </View>
    </View>

    {/* Title & message */}
    <Text style={em.lockedTitle}>{title}</Text>
    <Text style={em.lockedMsg}>{message}</Text>

    {/* Countdown */}
    {!!countdown && (
      <View style={em.lockedCountdownWrap}>
        <Text style={em.lockedSubmsg}>{submessage}</Text>
        <View style={em.lockedCountdownBadge}>
          <Ionicons name="time-outline" size={18} color={C.textMuted} />
          <Text style={em.lockedCountdownTxt}>{countdown}</Text>
        </View>
      </View>
    )}

    {/* Button */}
    <TouchableOpacity
  style={[em.lockedBtn, { backgroundColor: "#C1272D" }]}
  onPress={closeEmailModal}
  activeOpacity={0.85}
>
  <Text style={[em.lockedBtnTxt, { color: "#FFFFFF" }]}>Close</Text>
</TouchableOpacity>
  </View>
);
  // ── Loading / empty states ────────────────────────────────────────────────
  if (loading)
    return (
      <SafeAreaView style={st.safe}>
        <View style={st.center}>
          <ActivityIndicator size="large" color={C.navy} />
          <Text style={st.centerLbl}>Loading profile…</Text>
        </View>
      </SafeAreaView>
    );
  if (!profileData)
    return (
      <SafeAreaView style={st.safe}>
        <View style={st.center}>
          <Ionicons
            name="person-circle-outline"
            size={64}
            color={C.textLight}
          />
          <Text style={st.emptyTitle}>No profile data</Text>
          <TouchableOpacity
            style={st.solidBtn}
            onPress={() =>
              navigation.reset({ index: 0, routes: [{ name: "Login" }] })
            }
          >
            <Text style={st.solidBtnTxt}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );

  const displayName =
    V.formatDisplayName(
      profileData.first_name,
      profileData.middle_name,
      profileData.last_name,
      profileData.suffix,
    ) || "Officer Name";

  return (
    <SafeAreaView style={st.safe}>
      <ScrollView
        style={st.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ════════════════════ HEADER ════════════════════ */}
        <View style={st.header}>
          {/* Avatar */}
          <TouchableOpacity
            style={st.avatarWrap}
            onPress={() => !uploadingPhoto && setShowPhotoModal(true)}
            activeOpacity={0.85}
          >
            {profileData.profile_picture ? (
              <Image
                source={{ uri: profileData.profile_picture }}
                style={st.avatar}
              />
            ) : (
              <View style={st.avatarPlaceholder}>
                <Text style={st.avatarInitials}>
                  {profileData.first_name?.[0] ?? ""}
                  {profileData.last_name?.[0] ?? ""}
                </Text>
              </View>
            )}
            <View style={st.cameraOverlay}>
              <Ionicons name="camera" size={11} color={C.white} />
            </View>
            {uploadingPhoto && (
              <View style={st.avatarUploadingOverlay}>
                <ActivityIndicator size="small" color={C.white} />
              </View>
            )}
          </TouchableOpacity>

          {/* Name */}
          <Text style={st.headerName}>{displayName}</Text>

          {/* Username pill */}
          {!!profileData.username && (
            <View style={st.usernamePill}>
              <Ionicons
                name="at-outline"
                size={12}
                color="rgba(255,255,255,0.55)"
              />
              <Text style={st.usernameText}>
                {showUsername
                  ? profileData.username
                  : "•".repeat(Math.min(profileData.username.length, 12))}
              </Text>
              <TouchableOpacity
                onPress={() => setShowUsername((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showUsername ? "eye-outline" : "eye-off-outline"}
                  size={13}
                  color="rgba(255,255,255,0.4)"
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Role / Rank / Dept pills */}
          <View style={st.pillsRow}>
            {!!profileData.role && (
              <View style={st.rolePill}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={11}
                  color="rgba(255,255,255,0.9)"
                />
                <Text style={st.rolePillTxt}>{profileData.role}</Text>
              </View>
            )}
            {!!profileData.rank && (
              <View style={st.rankPill}>
                <Ionicons name="star-outline" size={10} color={C.gold} />
                <Text style={st.rankPillTxt}>{profileData.rank}</Text>
              </View>
            )}
            {!!profileData.department && (
              <View style={st.deptPill}>
                <Text style={st.deptPillTxt}>{profileData.department}</Text>
              </View>
            )}
          </View>

          {/* Stats strip */}
          {(profileData.department || profileData.mobile_patrol) && (
            <View style={st.statsStrip}>
              {!!profileData.department && (
                <View style={st.statItem}>
                  <Ionicons
                    name="briefcase-outline"
                    size={13}
                    color="rgba(255,255,255,0.6)"
                  />
                  <Text style={st.statItemTxt}>{profileData.department}</Text>
                </View>
              )}
              {profileData.department && profileData.mobile_patrol && (
                <View style={st.statSep} />
              )}
              {!!profileData.mobile_patrol && (
                <View style={st.statItem}>
                  <Ionicons
                    name="car-outline"
                    size={13}
                    color="rgba(255,255,255,0.6)"
                  />
                  <Text style={st.statItemTxt}>
                    Patrol {profileData.mobile_patrol}
                  </Text>
                </View>
              )}
            </View>
          )}

          {refreshing && (
            <View style={st.syncRow}>
              <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
              <Text style={st.syncTxt}>Syncing…</Text>
            </View>
          )}
        </View>

        {/* ════════════════════ QUICK ACTIONS ════════════════════ */}
        <View style={st.actionSection}>
          <View style={st.actionRow}>
            <ActionCard
              icon="create-outline"
              label="Edit Profile"
              sublabel="Update info"
              color={C.navy}
              onPress={startEdit}
            />
            <ActionCard
              icon="lock-closed-outline"
              label="Change Password"
              color={C.red}
              onPress={() => navigation.navigate("ChangePassword")}
            />
            <ActionCard
              icon="mail-outline"
              label="Update Email"
              color={C.cyan}
              onPress={openEmailModal}
            />
          </View>
        </View>

        {/* ════════════════════ INFO SECTIONS ════════════════════ */}
       <SectionCard
  collapsible
  title="Personal Information"
  subtitle="Name · Birthday · Gender"
  icon="person-outline"
  accentColor={C.navy}
>
          
          <InfoRow
            icon="person-outline"
            label="Full Name"
            iconColor={C.navy}
            iconBg={C.navyLight}
            value={[
              profileData.first_name,
              profileData.middle_name,
              profileData.last_name,
              profileData.suffix,
            ]
              .filter(Boolean)
              .join(" ")}
          />
          <InfoRow
            icon="calendar-outline"
            label="Date of Birth"
            iconColor={C.navy}
            iconBg={C.navyLight}
            value={
              profileData.date_of_birth
                ? new Date(profileData.date_of_birth).toLocaleDateString(
                    "en-PH",
                    { year: "numeric", month: "long", day: "numeric" },
                  )
                : null
            }
          />
          <InfoRow
            icon="male-female-outline"
            label="Gender"
            iconColor={C.navy}
            iconBg={C.navyLight}
            value={profileData.gender}
            last
          />
        </SectionCard>

     <SectionCard
  collapsible
  title="Contact Information"
  subtitle="Phone · Email · Alternate"
  icon="call-outline"
  accentColor={C.green}
>

          <InfoRow
            icon="call-outline"
            label="Phone Number"
            iconColor={C.navy}
            iconBg={C.navyLight}
            value={
              profileData.phone ? `+63 ${V.maskPhone(profileData.phone)}` : null
            }
          />
          <InfoRow
            icon="phone-portrait-outline"
            label="Alternate Phone"
            iconColor={C.navy}
            iconBg={C.navyLight}
            value={
              profileData.alternate_phone
                ? `+63 ${V.maskPhone(profileData.alternate_phone)}`
                : null
            }
          />
          <InfoRow
            icon="mail-outline"
            label="Email Address"
            iconColor={C.navy}
            iconBg={C.navyLight}
            value={profileData.email ? V.maskEmail(profileData.email) : null}
            last
          />
        </SectionCard>

     <SectionCard
  collapsible
  title="Address"
  subtitle="Region · Province · Barangay"
  icon="location-outline"
  accentColor="#D97706"
>

          <InfoRow
            icon="flag-outline"
            label="Region"
            iconColor={C.navy}
            iconBg={C.navyLight}
            value={resolvedAddr.region || profileData.region}
          />
          <InfoRow
            icon="map-outline"
            label="Province"
            iconColor={C.navy}
            iconBg={C.navyLight}
            value={resolvedAddr.province || profileData.province}
          />
          <InfoRow
            icon="business-outline"
            label="City / Municipality"
            iconColor={C.navy}
            iconBg={C.navyLight}
            value={
              resolvedAddr.municipality ||
              profileData.municipality ||
              profileData.city
            }
          />
          <InfoRow
            icon="home-outline"
            label="Barangay"
            iconColor={C.navy}
            iconBg={C.navyLight}
            value={resolvedAddr.barangay || profileData.barangay}
          />
          <InfoRow
            icon="pin-outline"
            label="Address Line"
            iconColor={C.navy}
            iconBg={C.navyLight}
            value={profileData.address_line}
            last
          />
        </SectionCard>

        {/* Official Information — always show all fields, use "—" for blanks like the web */}
   <SectionCard
  collapsible
  title="Official Information"
  subtitle="Role · Rank · Department"
  icon="briefcase-outline"
  accentColor="#7C3AED"
>

          <InfoRow
            icon="shield-outline"
            label="Role"
            iconColor={C.navy}
            iconBg={C.navyLight}
            value={profileData.role || "—"}
          />
          <InfoRow
            icon="medal-outline"
            label="Rank"
            iconColor={C.navy}
            iconBg={C.navyLight}
            value={profileData.rank || "—"}
          />
          <InfoRow
            icon="business-outline"
            label="Department"
            iconColor={C.navy}
            iconBg={C.navyLight}
            value={profileData.department || "—"}
          />
          <InfoRow
            icon="car-sport-outline"
            label="Mobile Patrol No."
            iconColor={C.navy}
            iconBg={C.navyLight}
            value={profileData.mobile_patrol || "—"}
          />
          <InfoRow
            icon="calendar-outline"
            label="Date Joined"
            iconColor={C.navy}
            iconBg={C.navyLight}
            value={
              profileData.date_joined
                ? new Date(profileData.date_joined).toLocaleDateString(
                    "en-PH",
                    { year: "numeric", month: "long", day: "numeric" },
                  )
                : profileData.created_at
                  ? new Date(profileData.created_at).toLocaleDateString(
                      "en-PH",
                      { year: "numeric", month: "long", day: "numeric" },
                    )
                  : "—"
            }
            last
          />
        </SectionCard>

        {/* ════════════════════ LOGOUT ════════════════════ */}
        <View style={st.logoutSection}>
          <TouchableOpacity
            style={st.logoutBtn}
            onPress={logout}
            activeOpacity={0.8}
          >
            <View style={st.logoutIconWrap}>
              <Ionicons name="log-out-outline" size={18} color={C.red} />
            </View>
            <Text style={st.logoutBtnTxt}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Toasts */}
      {!!successMsg && (
        <View style={st.toastWrap}>
          <View style={st.toastOk}>
            <View style={st.toastIconWrap}>
              <Ionicons name="checkmark-circle" size={18} color={C.white} />
            </View>
            <Text style={st.toastTxt}>{successMsg}</Text>
          </View>
        </View>
      )}
      {!!errorMsg && (
        <View style={st.toastWrap}>
          <View style={st.toastErr}>
            <View style={st.toastIconWrap}>
              <Ionicons name="close-circle" size={18} color={C.white} />
            </View>
            <Text style={st.toastTxt}>{errorMsg}</Text>
          </View>
        </View>
      )}

      {/* ════════════════════ EMAIL MODAL ════════════════════ */}
      <Modal
        visible={emailModalVisible}
        animationType="slide"
        transparent={false}
      >
        <SafeAreaView style={em.safe}>
          <View style={em.header}>
            <TouchableOpacity
              onPress={closeEmailModal}
              style={em.headerBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <View style={em.headerBtnInner}>
                <Ionicons name="close" size={19} color={C.white} />
              </View>
            </TouchableOpacity>
            <View style={em.headerCenter}>
              <Text style={em.headerTitle}>Update Email</Text>
              {![
                "checking",
                "cooldown",
                "session-locked",
                "pw-locked",
                "done",
              ].includes(emailStep) && (
                <Text style={em.headerSub}>
                  Step {emailStepIdx} of {EMAIL_STEPS.length}
                </Text>
              )}
            </View>
            <View style={{ width: 44 }} />
          </View>
          {![
            "checking",
            "cooldown",
            "session-locked",
            "pw-locked",
            "done",
          ].includes(emailStep) && (
            <View style={em.progressWrap}>
              <ProgressDots current={emailStepIdx} total={EMAIL_STEPS.length} />
            </View>
          )}
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={em.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {emailStep === "checking" && (
                <View style={em.centerBox}>
                  <ActivityIndicator size="large" color={C.navy} />
                  <Text style={em.centerTxt}>Checking availability…</Text>
                </View>
              )}
              {emailStep === "cooldown" && (
                <View style={em.lockedWrap}>
                  <View
                    style={[em.lockedIcon, { backgroundColor: C.navyLight }]}
                  >
                    <Ionicons name="lock-closed" size={34} color={C.navy} />
                  </View>
                  <Text style={em.lockedTitle}>Email Change Unavailable</Text>
                  <Text style={em.lockedMsg}>
                    Your email was already changed today.
                  </Text>
                  <Text style={[em.lockedMsg]}>
                    For security, email updates are limited to once every 24
                    hours.
                  </Text>
                  <Text
                    style={[
                      em.lockedMsg,
                      {
                        fontWeight: "800",
                        color: C.text,
                        marginTop: 12,
                        marginBottom: 4,
                      },
                    ]}
                  >
                    You can update your email again in:
                  </Text>
                  <View style={em.countdownBadge}>
                    <Ionicons name="time-outline" size={16} color="#92400E" />
                    <Text style={em.countdownTxt}>
                      {emailCooldownCountdown || "Calculating…"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      em.primaryBtn,
                      {
                        backgroundColor: C.navy,
                        marginTop: 20,
                        alignSelf: "stretch",
                      },
                    ]}
                    onPress={closeEmailModal}
                    activeOpacity={0.8}
                  >
                    <Text style={em.primaryBtnTxt}>Got it, Close</Text>
                  </TouchableOpacity>
                </View>
              )}
{emailStep === "session-locked" &&
  renderEmailLockedStep({
    iconBg: "#F1F5F9",
    iconColor: C.navy,
    iconName: "shield-off-outline",
    title: "Temporarily Locked",
    message: "For your security, this process has been temporarily locked due to too many failed attempts.",
    submessage: "TRY AGAIN IN",
    countdown: emailSessionCountdown || "Calculating…",
  })}
 {emailStep === "pw-locked" &&
  renderEmailLockedStep({
    iconBg: "#F1F5F9",
    iconColor: C.navy,
    iconName: "key-outline",
    title: "Too Many Attempts",
    message: "Your account is temporarily locked due to too many incorrect password attempts.",
    submessage: "TRY AGAIN IN",
    countdown: emailPwLockedCountdown || "Calculating…",
  })}
          {emailStep === "done" && (
                <View style={em.lockedWrap}>
                  <View
                    style={[em.lockedIcon, { backgroundColor: C.greenLight }]}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={30}
                      color={C.green}
                    />
                  </View>
                  <Text style={[em.lockedTitle, { color: C.green }]}>
                    Email Updated!
                  </Text>
                  <Text style={em.lockedMsg}>
                    Your email address has been successfully changed.
                  </Text>
                  <Text style={em.lockedMsg}>
                    Security notifications sent to both email addresses.
                  </Text>
                  <TouchableOpacity
                    style={[
                      em.primaryBtn,
                      { backgroundColor: C.green, marginTop: 20 },
                    ]}
                    onPress={closeEmailModal}
                  >
                    <Text style={em.primaryBtnTxt}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}

          {emailStep === "password" && (
  <View>
    <View style={em.stepIconRow}>
      <View style={em.stepIconOuter}>
        <View style={em.stepIconCircle}>
          <Ionicons name="shield-checkmark" size={28} color={C.navy} />
        </View>
      </View>
    </View>
                  <Text style={em.stepTitle}>Verify Your Identity</Text>
                  <Text style={em.stepSub}>
                    Enter your current password to continue.
                  </Text>
                  <View style={em.fieldCard}>
                    <Text style={em.fieldLabel}>CURRENT PASSWORD</Text>
                    {/* FIX: eye toggle — eye-off when hidden, eye when visible */}
                    <View
                      style={[em.inputRow, emailPasswordErr && em.inputRowErr]}
                    >
                      <Ionicons
                        name="lock-closed-outline"
                        size={16}
                        color={C.textMuted}
                        style={{ marginRight: 6 }}
                      />
                      <TextInput
                        style={em.input}
                        placeholder="Enter your password"
                        placeholderTextColor={C.textLight}
                        value={emailPassword}
                        onChangeText={(v) => {
                          setEmailPassword(v);
                          setEmailPasswordErr("");
                        }}
                        secureTextEntry={!emailPasswordShow}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!emailPasswordLoading}
                      />
                      <TouchableOpacity
                        onPress={() => setEmailPasswordShow((v) => !v)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons
                          name={
                            emailPasswordShow
                              ? "eye-outline"
                              : "eye-off-outline"
                          }
                          size={19}
                          color={C.textMuted}
                        />
                      </TouchableOpacity>
                    </View>
                    {emailPasswordErr ? (
                      <View style={em.errRow}>
                        <Ionicons
                          name="alert-circle-outline"
                          size={12}
                          color={C.danger}
                        />
                        <Text style={em.errTxt}>{emailPasswordErr}</Text>
                      </View>
                    ) : null}
                  </View>
                  {/* FIX: removed arrow icon from button */}
                  <TouchableOpacity
                    style={[
                      em.primaryBtn,
                      (!emailPassword.trim() || emailPasswordLoading) &&
                        em.primaryBtnOff,
                    ]}
                    onPress={handleEmailVerifyPassword}
                    disabled={!emailPassword.trim() || emailPasswordLoading}
                  >
                    {emailPasswordLoading ? (
                      <ActivityIndicator size="small" color={C.white} />
                    ) : null}
                    <Text style={em.primaryBtnTxt}>
                      {emailPasswordLoading ? "Verifying…" : "Verify Password"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {emailStep === "old-send" && (
                <View style={em.lockedWrap}>
                  <View
                    style={[em.lockedIcon, { backgroundColor: C.navyLight }]}
                  >
                    <Ionicons name="mail" size={30} color={C.navy} />
                  </View>
                  <Text style={em.lockedTitle}>Verify Current Email</Text>
                  <Text style={em.lockedMsg}>
                    We'll send a code to your current email to confirm it's you.
                  </Text>
                  <TouchableOpacity
                    style={[
                      em.primaryBtn,
                      { alignSelf: "stretch", marginTop: 20 },
                      emailModalLoading && em.primaryBtnOff,
                    ]}
                    onPress={handleSendOldOtp}
                    disabled={emailModalLoading}
                  >
                    {emailModalLoading ? (
                      <ActivityIndicator size="small" color={C.white} />
                    ) : null}
                    <Text style={em.primaryBtnTxt}>
                      {emailModalLoading
                        ? "Sending…"
                        : "Send Code to Current Email"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {emailStep === "old-otp" &&
                renderOtpStep({
                  otpValues: oldOtpValues,
                  setOtpValues: setOldOtpValues,
                  otpState: oldOtpState,
                  otpTimer: oldOtpTimer,
                  otpError: oldOtpError,
                  masked: emailOldMasked,
                  resendsLeft: oldResendsLeft,
                  canResend: canResendOld,
                  onVerify: handleVerifyOldOtp,
                  onResend: handleResendOldOtp,
                  stepTitle: "Verify Code",
                })}

              {emailStep === "new-email" && (
                <View>
                  <View style={em.stepIconRow}>
                    <View style={em.stepIconCircle}>
                      <Ionicons name="mail" size={24} color={C.navy} />
                    </View>
                  </View>
                  <Text style={em.stepTitle}>Enter New Email</Text>
                  <Text style={em.stepSub}>
                    Enter the email address you want to use.
                  </Text>
                  <View style={em.fieldCard}>
                    <Text style={em.fieldLabel}>NEW EMAIL ADDRESS</Text>
                    <View style={[em.inputRow, emailNewErr && em.inputRowErr]}>
                      <Ionicons
                        name="mail-outline"
                        size={16}
                        color={C.textMuted}
                        style={{ marginRight: 6 }}
                      />
                      <TextInput
                        style={em.input}
                        placeholder="newaddress@example.com"
                        placeholderTextColor={C.textLight}
                        value={emailNewAddress}
                        onChangeText={(v) => {
                          setEmailNewAddress(v);
                          setEmailNewErr("");
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!emailModalLoading}
                      />
                    </View>
                    {emailNewErr ? (
                      <View style={em.errRow}>
                        <Ionicons
                          name="alert-circle-outline"
                          size={12}
                          color={C.danger}
                        />
                        <Text style={em.errTxt}>{emailNewErr}</Text>
                      </View>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={[
                      em.primaryBtn,
                      (!emailNewAddress.trim() || emailModalLoading) &&
                        em.primaryBtnOff,
                    ]}
                    onPress={handleSendNewOtp}
                    disabled={!emailNewAddress.trim() || emailModalLoading}
                  >
                    {emailModalLoading ? (
                      <ActivityIndicator size="small" color={C.white} />
                    ) : null}
                    <Text style={em.primaryBtnTxt}>
                      {emailModalLoading
                        ? "Sending…"
                        : "Send Code to New Email"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={em.backBtn}
                    onPress={() => setEmailStep("old-send")}
                  >
                    <Ionicons name="chevron-back" size={13} color={C.textSub} />
                    <Text style={em.backBtnTxt}>Back</Text>
                  </TouchableOpacity>
                </View>
              )}

              {emailStep === "new-otp" &&
                renderOtpStep({
                  otpValues: newOtpValues,
                  setOtpValues: setNewOtpValues,
                  otpState: newOtpState,
                  otpTimer: newOtpTimer,
                  otpError: newOtpError,
                  masked: newOtpMasked,
                  resendsLeft: newResendsLeft,
                  canResend: canResendNew,
                  onVerify: handleVerifyNewOtp,
                  onResend: handleResendNewOtp,
                  stepTitle: "Confirm New Email",
                })}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ════════════════════ EDIT PROFILE MODAL ════════════════════ */}
      <Modal visible={isEditing} animationType="slide" transparent={false}>
        <SafeAreaView style={ef.safe}>
          {/* Header - FIX: removed Save button from top header, Save is only at the bottom */}
          <View style={ef.header}>
            <TouchableOpacity
              onPress={cancelEdit}
              style={ef.headerBackWrap}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <View style={ef.headerBackInner}>
                <Ionicons name="chevron-back" size={20} color={C.white} />
              </View>
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={ef.headerTitle}>Edit Profile</Text>
              <Text style={ef.headerSub}>Update your personal information</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView
            style={ef.scroll}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            <View style={{ height: 16 }} />

            {/* ── Personal ── */}
            <SectionLabel icon="person-outline" color={C.navy}>
              Personal Information
            </SectionLabel>
            <View style={ef.card}>
              {[
                {
                  name: "first_name",
                  label: "First Name",
                  icon: "person-outline",
                  req: true,
                },
                {
                  name: "last_name",
                  label: "Last Name",
                  icon: "people-outline",
                  req: true,
                },
                {
                  name: "middle_name",
                  label: "Middle Name",
                  icon: "person-add-outline",
                  req: false,
                },
                {
                  name: "suffix",
                  label: "Suffix",
                  icon: "text-outline",
                  req: false,
                  placeholder: "e.g. Jr., III",
                },
              ].map((f, idx, arr) => (
                <View
                  key={f.name}
                  style={[
                    ef.fieldRow,
                    idx < arr.length - 1 && ef.fieldRowBorder,
                  ]}
                >
                  <View style={ef.fieldIcon}>
                    <Ionicons name={f.icon} size={15} color={C.navy} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={ef.fieldLabel}>
                      {f.label}
                      {f.req && <Text style={{ color: C.red }}> *</Text>}
                    </Text>
                    <TextInput
                      style={[
                        ef.fieldInput,
                        errors[f.name] && ef.fieldInputErr,
                      ]}
                      placeholder={
                        f.placeholder || `Enter ${f.label.toLowerCase()}`
                      }
                      placeholderTextColor={C.textLight}
                      value={formData[f.name]}
                      onChangeText={(v) => onChange(f.name, v)}
                      maxLength={f.name === "suffix" ? 5 : 50}
                      editable={!isSaving}
                    />
                    {errors[f.name] && (
                      <Text style={ef.fieldErrTxt}>{errors[f.name]}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>

            <View style={ef.card}>
              {/* DOB */}
              <View style={[ef.fieldRow, ef.fieldRowBorder]}>
                <View style={[ef.fieldIcon, { backgroundColor: "#F1F5F9" }]}>
                  <Ionicons
                    name="calendar-outline"
                    size={15}
                    color={C.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ef.fieldLabel}>Date of Birth</Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      marginTop: 2,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        color: C.textSub,
                        fontWeight: "500",
                        flex: 1,
                      }}
                    >
                      {formData.date_of_birth
                        ? new Date(formData.date_of_birth).toLocaleDateString(
                            "en-PH",
                            { year: "numeric", month: "long", day: "numeric" },
                          )
                        : "Not set"}
                    </Text>
                  </View>
                  <Text style={ef.fieldHint}>Contact admin to update</Text>
                </View>
              </View>
              {/* Gender */}
              <View style={ef.fieldRow}>
                <View style={ef.fieldIcon}>
                  <Ionicons
                    name="male-female-outline"
                    size={15}
                    color={C.navy}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ef.fieldLabel}>Gender</Text>
                  <View style={ef.genderRow}>
                    {["Male", "Female"].map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={[
                          ef.genderBtn,
                          formData.gender === g && ef.genderBtnOn,
                        ]}
                        onPress={() => onChange("gender", g)}
                      >
                        <Ionicons
                          name={g === "Male" ? "male" : "female"}
                          size={14}
                          color={formData.gender === g ? C.white : C.textMuted}
                        />
                        <Text
                          style={[
                            ef.genderTxt,
                            formData.gender === g && ef.genderTxtOn,
                          ]}
                        >
                          {g}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </View>

            {/* ── Contact ── */}
            <SectionLabel icon="call-outline" color={C.navy}>
              Contact Information
            </SectionLabel>
            <View style={ef.card}>
              {/* Phone */}
              <View style={[ef.fieldRow, ef.fieldRowBorder]}>
                <View
                  style={[
                    ef.fieldIcon,
                    { backgroundColor: phoneChanged ? "#FEF3C7" : C.navyLight },
                  ]}
                >
                  <Ionicons
                    name="call-outline"
                    size={15}
                    color={phoneChanged ? "#B45309" : C.navy}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ef.fieldLabel}>Phone Number</Text>
                  {/* FIX: amber/yellow highlight same as web when typing */}
                  <View
                    style={[
                      ef.phoneRow,
                      phoneChanged && ef.phoneRowActiveAmber,
                      errors.phone && ef.phoneRowErr,
                    ]}
                  >
                    <Text style={ef.phonePrefix}>+63</Text>
                    <TextInput
                      style={ef.phoneInput}
                      placeholder={
                        originalFormData.phone
                          ? V.maskPhone(originalFormData.phone)
                          : "9XXXXXXXXX"
                      }
                      placeholderTextColor={C.textLight}
                      value={formData.phone}
                      onChangeText={(v) => onPhone("phone", v)}
                      maxLength={10}
                      keyboardType="phone-pad"
                      editable={!isSaving}
                    />
                  </View>
                  {/* FIX: hide hint when error is shown to avoid duplication/confusion */}
                  {errors.phone ? (
                    <Text style={ef.fieldErrTxt}>{errors.phone}</Text>
                  ) : (
                    <Text
                      style={[
                        ef.fieldHint,
                        phoneChanged && { color: "#B45309", fontWeight: "600" },
                      ]}
                    >
                      {phoneChanged
                        ? "New number replaces current on save"
                        : "Leave blank to keep current"}
                    </Text>
                  )}
                </View>
              </View>
              {/* Alt phone */}
              <View style={[ef.fieldRow, ef.fieldRowBorder]}>
                <View
                  style={[
                    ef.fieldIcon,
                    {
                      backgroundColor: altPhoneChanged
                        ? "#FEF3C7"
                        : C.navyLight,
                    },
                  ]}
                >
                  <Ionicons
                    name="phone-portrait-outline"
                    size={15}
                    color={altPhoneChanged ? "#B45309" : C.navy}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ef.fieldLabel}>Alternate Phone</Text>
                  <View
                    style={[
                      ef.phoneRow,
                      altPhoneChanged && ef.phoneRowActiveAmber,
                      errors.alternate_phone && ef.phoneRowErr,
                    ]}
                  >
                    <Text style={ef.phonePrefix}>+63</Text>
                    <TextInput
                      style={ef.phoneInput}
                      placeholder={
                        originalFormData.alternate_phone
                          ? V.maskPhone(originalFormData.alternate_phone)
                          : "Optional"
                      }
                      placeholderTextColor={C.textLight}
                      value={formData.alternate_phone}
                      onChangeText={(v) => onPhone("alternate_phone", v)}
                      maxLength={10}
                      keyboardType="phone-pad"
                      editable={!isSaving}
                    />
                  </View>
                  {/* FIX: only show error OR hint, not both */}
                  {errors.alternate_phone && (
                    <Text style={ef.fieldErrTxt}>{errors.alternate_phone}</Text>
                  )}
                </View>
              </View>
              {/* Email — FIX: removed "Use Update Email" badge, hint text is enough */}
              <View style={ef.fieldRow}>
                <View style={[ef.fieldIcon, { backgroundColor: "#F1F5F9" }]}>
                  <Ionicons name="mail-outline" size={15} color={C.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ef.fieldLabel}>Email Address</Text>
                  <Text
                    style={{
                      fontSize: 14,
                      color: C.textSub,
                      fontWeight: "500",
                      marginTop: 2,
                    }}
                    numberOfLines={1}
                  >
                    {V.maskEmail(originalFormData.email) || "—"}
                  </Text>
                  <Text style={ef.fieldHint}>Use "Update Email" to change</Text>
                </View>
              </View>
            </View>

            {/* ── Address ── */}
            <SectionLabel icon="location-outline" color={C.navy}>
              Address Information
            </SectionLabel>
            <View
              style={[ef.card, { overflow: "visible", paddingVertical: 0 }]}
            >
              <Dropdown
                id="region"
                label="Region *"
                value={formData.region_code}
                items={regions}
                onSelect={onRegion}
                loading={psgcLoading.regions}
                disabled={false}
                error={errors.region_code}
              />
              <Dropdown
                id="province"
                label="Province *"
                value={formData.province_code}
                items={provinces}
                onSelect={onProvince}
                loading={psgcLoading.provinces}
                disabled={!formData.region_code}
                error={errors.province_code}
              />
              <Dropdown
                id="municipality"
                label="City / Municipality *"
                value={formData.municipality_code}
                items={municipalities}
                onSelect={onMunicipality}
                loading={psgcLoading.municipalities}
                disabled={!formData.province_code}
                error={errors.municipality_code}
              />
              <Dropdown
                id="barangay"
                label="Barangay *"
                value={formData.barangay_code}
                items={barangays}
                onSelect={onBarangay}
                loading={psgcLoading.barangays}
                disabled={!formData.municipality_code}
                error={errors.barangay_code}
              />
              <View
                style={[
                  ef.fieldRow,
                  { borderTopWidth: 1, borderTopColor: C.border },
                ]}
              >
                <View style={[ef.fieldIcon, { backgroundColor: C.navyLight }]}>
                  <Ionicons name="pin-outline" size={15} color={C.navy} />
                </View>
                <View style={{ flex: 1 }}>
                  {/* FIX: removed "(Optional)" from Address Line label */}
                  <Text style={ef.fieldLabel}>Address Line</Text>
                  <TextInput
                    style={[
                      ef.fieldInput,
                      {
                        minHeight: 70,
                        textAlignVertical: "top",
                        paddingTop: 8,
                      },
                      errors.address_line && ef.fieldInputErr,
                    ]}
                    placeholder="House No., Street, Subdivision…"
                    placeholderTextColor={C.textLight}
                    value={formData.address_line}
                    onChangeText={(v) => onChange("address_line", v)}
                    maxLength={255}
                    multiline
                    numberOfLines={3}
                    editable={!isSaving}
                  />
                  <Text style={[ef.fieldHint, { textAlign: "right" }]}>
                    {(formData.address_line || "").length}/255
                  </Text>
                  {errors.address_line && (
                    <Text style={ef.fieldErrTxt}>{errors.address_line}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Bottom buttons */}
            <View style={ef.bottomRow}>
              <TouchableOpacity
                style={[ef.saveBtn, isSaving && { opacity: 0.55 }]}
                onPress={onSavePress}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={C.red} />
                ) : (
                  <Ionicons name="checkmark-circle" size={18} color={C.white} />
                )}
                <Text style={ef.saveBtnTxt}>Save Changes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={ef.cancelBtn}
                onPress={cancelEdit}
                disabled={isSaving}
              >
                <Ionicons name="close" size={16} color={C.textSub} />
                <Text style={ef.cancelBtnTxt}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 48 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Photo picker sheet */}
      <Modal visible={showPhotoModal} animationType="slide" transparent>
        <View style={st.photoOverlay}>
          <View style={st.photoSheet}>
            <View style={st.photoHandle} />
            <Text style={st.photoTitle}>Update Profile Photo</Text>
            <TouchableOpacity style={st.photoOpt} onPress={takeWithCamera}>
              <View style={st.photoOptIcon}>
                <Ionicons name="camera" size={24} color={C.navy} />
              </View>
              <View>
                <Text style={st.photoOptTxt}>Take a Photo</Text>
                <Text style={st.photoOptSub}>Use your camera</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={st.photoOpt} onPress={pickFromGallery}>
              <View style={st.photoOptIcon}>
                <Ionicons name="image" size={24} color={C.navy} />
              </View>
              <View>
                <Text style={st.photoOptTxt}>Choose from Gallery</Text>
                <Text style={st.photoOptSub}>Pick an existing photo</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={st.photoCancelBtn}
              onPress={() => setShowPhotoModal(false)}
            >
              <Text style={st.photoCancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <LoadingOverlay visible={isSaving} message="Saving your profile…" />
      <LoadingOverlay visible={uploadingPhoto} message="Uploading photo…" />
      <ConfirmModal
        visible={confirm.visible}
        title={confirm.title}
        message={confirm.message}
        onConfirm={confirm.onConfirm}
        onCancel={hideConfirm}
        confirmText={confirm.confirmText}
        confirmColor={confirm.confirmColor}
      />
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EMAIL MODAL STYLES
// ══════════════════════════════════════════════════════════════════════════════
const em = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.navy,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerBtn: { width: 44, alignItems: "flex-start" },
  headerBtnInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: C.white,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
    fontWeight: "500",
  },
  progressWrap: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  scrollContent: { padding: 20 },
  centerBox: { alignItems: "center", paddingVertical: 32 },
  centerTxt: {
    fontSize: 13,
    color: C.textMuted,
    marginTop: 14,
    fontWeight: "500",
  },
lockedWrap: {
  alignItems: "center",
  paddingVertical: 40,
  paddingHorizontal: 24,
  width: "100%",
},
lockedIconOuter: {
  width: 100,
  height: 100,
  borderRadius: 50,
  backgroundColor: "#EEF3FF",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 24,
  borderWidth: 1,
  borderColor: "#D6E0F5",
  shadowColor: C.navy,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 4,
},
lockedIconInner: {
  width: 70,
  height: 70,
  borderRadius: 35,
  backgroundColor: "#DCE8FF",
  alignItems: "center",
  justifyContent: "center",
},
lockedTitle: {
  fontSize: 20,
  fontWeight: "800",
  color: C.text,
  marginBottom: 10,
  textAlign: "center",
  letterSpacing: -0.3,
},
lockedMsg: {
  fontSize: 14,
  color: C.textSub,
  textAlign: "center",
  lineHeight: 22,
  paddingHorizontal: 8,
  marginBottom: 4,
},
lockedCountdownWrap: {
  alignItems: "center",
  width: "100%",
  marginTop: 16,
  marginBottom: 8,
  gap: 8,
},
lockedCountdownBadge: {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  backgroundColor: C.white,
  borderWidth: 1,
  borderColor: C.border,
  borderRadius: 14,
  paddingVertical: 14,
  paddingHorizontal: 32,
  width: "100%",
  justifyContent: "center",
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 8,
  elevation: 2,
},
lockedSubmsg: {
  fontSize: 12,
  fontWeight: "700",
  color: C.navy,
  textTransform: "uppercase",
  letterSpacing: 0.8,
  textAlign: "center",
},
lockedCountdownTxt: {
  fontSize: 28,
  fontWeight: "800",
  color: C.text,
  letterSpacing: 1.5,
},
lockedBtn: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  marginTop: 24,
  paddingVertical: 15,
  borderRadius: 14,
  width: "100%",
  backgroundColor: C.red,
  shadowColor: C.red,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 10,
  elevation: 5,
},
lockedBtnTxt: {
  fontSize: 15,
  fontWeight: "800",
  color: C.white,
  letterSpacing: -0.2,
},
lockedSubmsg: {
  fontSize: 12,
  fontWeight: "700",
  color: C.textMuted,
  textTransform: "uppercase",
  letterSpacing: 0.8,
},
  stepIconRow: { alignItems: "center", marginBottom: 12 },
  stepIconOuter: {
  width: 90,
  height: 90,
  borderRadius: 45,
  backgroundColor: C.navyLight,
  alignItems: "center",
  justifyContent: "center",
  shadowColor: C.navy,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.15,
  shadowRadius: 14,
  elevation: 6,
},
stepIconCircle: {
  width: 64,
  height: 64,
  borderRadius: 32,
  backgroundColor: "#D6E4FF",
  alignItems: "center",
  justifyContent: "center",
},
  stepTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: C.text,
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  stepSub: {
    fontSize: 13,
    color: C.textSub,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  fieldCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: C.border,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: C.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.surfaceAlt,
    paddingHorizontal: 12,
    gap: 6,
  },
  inputRowErr: { borderColor: C.danger, backgroundColor: C.dangerLight },
  input: { flex: 1, fontSize: 15, color: C.text, paddingVertical: 13 },
  errRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 7 },
  errTxt: { color: C.danger, fontSize: 12, fontWeight: "500", flex: 1 },
  primaryBtn: {
    flexDirection: "row",
    backgroundColor: C.navy,
    borderRadius: 13,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryBtnOff: { opacity: 0.4, shadowOpacity: 0 },
  primaryBtnTxt: {
    fontSize: 15,
    fontWeight: "800",
    color: C.white,
    letterSpacing: -0.2,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 12,
    paddingVertical: 8,
  },
  backBtnTxt: { fontSize: 13, color: C.textSub, fontWeight: "600" },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EFF6FF",
    borderRadius: 13,
    padding: 13,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  infoCardIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCardTitle: {
    fontSize: 14,
    color: C.text,
    fontWeight: "500",
    marginBottom: 3,
  },
  infoCardSub: { fontSize: 12, color: C.textSub, lineHeight: 17 },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.navyLight,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 13,
    marginBottom: 8,
    justifyContent: "center",
  },
  timerWarn: { backgroundColor: C.amberLight },
  timerExpired: { backgroundColor: C.dangerLight },
  timerTxt: { fontSize: 13, fontWeight: "700", color: C.navy },
  banner: {
    flexDirection: "row",
    backgroundColor: C.danger,
    borderRadius: 12,
    padding: 12,
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 8,
  },
  bannerAmber: { backgroundColor: C.amber },
  bannerTxt: {
    color: C.white,
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    lineHeight: 18,
  },
  resendWrap: { alignItems: "center", marginTop: 16, minHeight: 34 },
  resendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: C.navy,
    backgroundColor: C.navyLight,
  },
  resendBtnTxt: { fontSize: 14, fontWeight: "700", color: C.navy },
  resendExhausted: { fontSize: 13, color: C.textMuted, fontStyle: "italic" },
countdownBadge: {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  backgroundColor: C.white,
  borderWidth: 2,
  borderColor: C.border,
  borderRadius: 16,
  paddingVertical: 12,
  paddingHorizontal: 28,
  marginVertical: 12,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.07,
  shadowRadius: 8,
  elevation: 3,
},
countdownTxt: {
  fontSize: 26,
  fontWeight: "800",
  color: C.text,
  letterSpacing: 1.5,
},

countdownTxt: {
    fontSize: 26,
    fontWeight: "800",
    color: C.text,
    letterSpacing: 1.5,
  },
  // ← DITO ILAGAY YUNG BAGONG STYLES
  lockedIconOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  lockedIconInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  lockedCountdownWrap: {
    alignItems: "center",
    width: "100%",
    marginVertical: 8,
    gap: 8,
  },
lockedCountdownBadge: {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  backgroundColor: C.navyLight,
  borderWidth: 1,
  borderColor: "#D6E0F5",
  borderRadius: 14,
  paddingVertical: 14,
  paddingHorizontal: 32,
  width: "100%",
  justifyContent: "center",
  shadowColor: C.navy,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
},
  lockedCountdownIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  lockedCountdownTxt: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 2,
  },
  lockedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 16,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  lockedBtnTxt: {
    fontSize: 15,
    fontWeight: "800",
    color: C.white,
    letterSpacing: -0.2,
  },
  lockedSubmsg: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  // ← closing ng em StyleSheet
});

// ══════════════════════════════════════════════════════════════════════════════
// EDIT FORM STYLES
// ══════════════════════════════════════════════════════════════════════════════
const ef = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.navy,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: C.navyDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  headerBackWrap: { width: 44 },
  headerBackInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: C.white,
    letterSpacing: -0.3,
  },
  headerSub: { fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 },
  headerSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  headerSaveTxt: { fontSize: 14, fontWeight: "800", color: C.white },
  scroll: { flex: 1, paddingHorizontal: 16 },

  card: {
    backgroundColor: C.white,
    borderRadius: 18,
    marginBottom: 6,
    overflow: "hidden",
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: C.border,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  fieldRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  fieldIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.navyLight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: C.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  fieldLabelSm: {
    fontSize: 10,
    fontWeight: "800",
    color: C.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 6,
    paddingHorizontal: 14,
  },
  fieldInput: {
    fontSize: 15,
    color: C.text,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: C.surfaceAlt,
  },
  fieldInputErr: { borderColor: C.danger, backgroundColor: C.dangerLight },
  fieldErrTxt: {
    fontSize: 12,
    color: C.danger,
    fontWeight: "500",
    marginTop: 5,
  },
  fieldHint: { fontSize: 11, color: C.textMuted, marginTop: 5 },

  readOnlyBadge: {
    backgroundColor: C.textLight + "44",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  readOnlyBadgeTxt: { fontSize: 10, fontWeight: "700", color: C.textMuted },

  genderRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  genderBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: C.surfaceAlt,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  genderBtnOn: { backgroundColor: C.navy, borderColor: C.navy },
  genderTxt: { fontSize: 14, fontWeight: "600", color: C.textSub },
  genderTxtOn: { color: C.white },

  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    backgroundColor: C.surfaceAlt,
    paddingHorizontal: 10,
    marginTop: 2,
  },
  // FIX: amber/yellow highlight when typing phone number (matches web design)
  phoneRowActiveAmber: { borderColor: "#F59E0B", backgroundColor: "#FFFBEB" },
  phoneRowErr: { borderColor: C.danger, backgroundColor: C.dangerLight },
  phonePrefix: {
    fontSize: 14,
    fontWeight: "700",
    color: C.textMuted,
    marginRight: 4,
  },
  phoneInput: { flex: 1, fontSize: 15, color: C.text, paddingVertical: 10 },

  dropdownGroup: { paddingVertical: 10, position: "relative" },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: C.surfaceAlt,
    marginHorizontal: 14,
  },
  dropdownErr: { borderColor: C.danger, backgroundColor: C.dangerLight },
  dropdownOff: { backgroundColor: C.bg, opacity: 0.6 },
  dropdownTxt: { fontSize: 14, color: C.text, fontWeight: "500", flex: 1 },
  dropdownPlaceholder: { color: C.textLight },
  ddList: {
    position: "absolute",
    top: 62,
    left: 14,
    right: 14,
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 13,
    zIndex: 9999,
    elevation: 20,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    overflow: "hidden",
  },
  ddItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.bg,
  },
  ddItemOn: { backgroundColor: C.navyLight },
  ddItemTxt: { fontSize: 14, color: C.text, fontWeight: "500", flex: 1 },
  ddItemTxtOn: { color: C.navy, fontWeight: "700" },
  ddLoader: {
    paddingVertical: 18,
    alignItems: "center",
    gap: 8,
    flexDirection: "row",
    justifyContent: "center",
  },
  ddLoaderTxt: { fontSize: 12, color: C.textMuted },
  ddErrRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
    paddingHorizontal: 14,
  },
  ddErrTxt: { color: C.danger, fontSize: 12, fontWeight: "500", flex: 1 },

  bottomRow: { flexDirection: "row", gap: 10, marginTop: 24 },
  saveBtn: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: C.navy,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 5,
  },
  saveBtnTxt: {
    color: C.white,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  cancelBtnTxt: { color: C.textSub, fontSize: 14, fontWeight: "700" },
});

// ══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN STYLES
// ══════════════════════════════════════════════════════════════════════════════
const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    padding: 24,
  },
  centerLbl: { fontSize: 14, color: C.textMuted, fontWeight: "500" },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: C.text },

  // ── HEADER — FIX: darker background, no decorative circles ──
  header: {
    backgroundColor: C.navyDark,
    paddingTop: 40,
    paddingBottom: 36,
    paddingHorizontal: 20,
    alignItems: "center",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 18,
  },

  avatarWrap: { position: "relative", marginBottom: 16 },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 4,
    borderColor: C.red,
  },
  avatarPlaceholder: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 4,
    borderColor: C.red,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: "800",
    color: C.white,
    letterSpacing: 1,
  },
  cameraOverlay: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.red,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: C.navy,
  },
  avatarUploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 52,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },

  headerName: {
    fontSize: 22,
    fontWeight: "800",
    color: C.white,
    letterSpacing: -0.4,
    textAlign: "center",
    marginBottom: 10,
  },
  usernamePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  usernameText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.82)",
    fontWeight: "600",
    letterSpacing: 0.3,
  },

  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginBottom: 14,
  },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  rolePillTxt: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "700",
  },
  rankPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(215,119,6,0.25)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(215,119,6,0.3)",
  },
  rankPillTxt: {
    fontSize: 12,
    color: C.gold,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  deptPill: {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  deptPillTxt: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
  },

  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginTop: 4,
  },
  statItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  statItemTxt: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
  },
  statSep: { width: 1, height: 18, backgroundColor: "rgba(255,255,255,0.2)" },

  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  syncTxt: { fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: "500" },

  // ── ACTION CARDS ──
  actionSection: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  actionRow: { flexDirection: "row", gap: 10 },

  // ── LOGOUT — FIX: removed subtitle ──
  logoutSection: { marginHorizontal: 16, marginTop: 20 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.5,
    borderColor: C.redLight,
    shadowColor: C.red,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  logoutIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.redLight,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutBtnTxt: { fontSize: 15, fontWeight: "700", color: C.red },

  // ── TOASTS ──
  toastWrap: { position: "absolute", bottom: 28, left: 16, right: 16 },
  toastOk: {
    flexDirection: "row",
    backgroundColor: C.green,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 8,
  },
  toastErr: {
    flexDirection: "row",
    backgroundColor: C.danger,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 8,
  },
  toastIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  toastTxt: { color: C.white, fontSize: 13, fontWeight: "600", flex: 1 },

  // ── SHARED BUTTONS ──
  solidBtn: {
    flexDirection: "row",
    backgroundColor: C.navy,
    paddingVertical: 15,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 5,
  },
  solidBtnTxt: {
    color: C.white,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },

  // ── PHOTO PICKER ──
  photoOverlay: {
    flex: 1,
    backgroundColor: "rgba(7,29,71,0.55)",
    justifyContent: "flex-end",
  },
  photoSheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 40,
  },
  photoHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: "center",
    marginBottom: 20,
  },
  photoTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: C.text,
    textAlign: "center",
    marginBottom: 20,
    letterSpacing: -0.2,
  },
  photoOpt: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
    backgroundColor: C.surfaceAlt,
    borderRadius: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  photoOptIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.navyLight,
    alignItems: "center",
    justifyContent: "center",
  },
  photoOptTxt: { fontSize: 15, fontWeight: "700", color: C.text },
  photoOptSub: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  photoCancelBtn: {
    marginTop: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: "center",
  },
  photoCancelTxt: { fontSize: 15, fontWeight: "700", color: C.red },

  
});
