//Change password

// ================================================================================
// ChangePasswordScreen.js — BANTAY Mobile (v5 — UI Fixes + Security)
// ================================================================================
// FIXES v5:
// 1. Eye toggle: correct icon logic — eye-off-outline when password is hidden,
//    eye-outline when password is visible. Added to all 3 password fields.
// 2. Removed arrow/chevron icons from action buttons (Continue, Send Code, etc.)
// 3. "Sending…" on OTP step is now a solid visible button with ActivityIndicator.
// 4. Temporarily Locked / Unavailable screens redesigned to match web (Image 4/5):
//    full-width layout, large amber icon circle, bold colored submessage, solid button.
// 5. Session-locked & blocked screens also redesigned consistently.
// BACKEND NOTE (reported bug):
//    User says they can access Change Password after 2 changes in 24hrs.
//    The backend POST /users/password/status should return { blocked: true }
//    after 2 changes in 24h. If mobile sees this screen it means the status
//    endpoint is not returning blocked:true. Check the backend password change
//    counter logic — mobile side is correct (calls /status on mount).
// ================================================================================
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BASE_URL } from "../screens/services/api";

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
  amberDark: "#92400E",
  amberLight: "#FEF3C7",
  amberMid: "#FFFBEB",
  danger: "#DC2626",
  dangerLight: "#FEF2F2",
  bg: "#F0F4FA",
  surface: "#FFFFFF",
  surfaceAlt: "#F8FAFC",
  border: "#E2E8F0",
  text: "#0F172A",
  textSub: "#475569",
  textMuted: "#94A3B8",
  textLight: "#CBD5E1",
  white: "#FFFFFF",
};

// ── Password Requirements ──────────────────────────────────────────────────────
const REQUIREMENTS = [
  { id: "length", label: "At least 8 characters", test: (p) => p.length >= 8 },
  {
    id: "upper",
    label: "Uppercase letter (A–Z)",
    test: (p) => /[A-Z]/.test(p),
  },
  {
    id: "lower",
    label: "Lowercase letter (a–z)",
    test: (p) => /[a-z]/.test(p),
  },
  { id: "number", label: "Number (0–9)", test: (p) => /[0-9]/.test(p) },
  {
    id: "special",
    label: "Special character (@$!%*?&#)",
    test: (p) => /[@$!%*?&#]/.test(p),
  },
];

// ── OTP Input Row ──────────────────────────────────────────────────────────────
function OtpRow({ values, onChange, disabled }) {
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
    <View style={otp.row}>
      {values.map((v, i) => (
        <TextInput
          key={i}
          ref={refs[i]}
          style={[otp.box, disabled && otp.off, v && otp.filled]}
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
const otp = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginVertical: 22,
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

// ── Step Progress Bar ──────────────────────────────────────────────────────────
function StepBar({ current, total }) {
  return (
    <View style={sb.wrap}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[sb.seg, i < current && sb.done]} />
      ))}
    </View>
  );
}
const sb = StyleSheet.create({
  wrap: { flexDirection: "row", gap: 4, marginBottom: 20 },
  seg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.border },
  done: { backgroundColor: C.navy },
});

// ── Password Input with Eye Toggle ────────────────────────────────────────────
// FIX: eye-off-outline = currently hidden (secureTextEntry=true), eye-outline = visible
function PasswordInput({
  value,
  onChangeText,
  placeholder,
  hasError,
  editable = true,
}) {
  const [show, setShow] = useState(false);
  return (
    <View style={[pi.row, hasError && pi.rowErr]}>
      <Ionicons
        name="lock-closed-outline"
        size={17}
        color={C.textMuted}
        style={{ marginRight: 4 }}
      />
      <TextInput
        style={pi.input}
        placeholder={placeholder}
        placeholderTextColor={C.textLight}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        editable={editable}
      />
      <TouchableOpacity
        onPress={() => setShow((v) => !v)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {/* When hidden: show eye-off (tap to reveal). When visible: show eye (tap to hide) */}
        <Ionicons
          name={show ? "eye-outline" : "eye-off-outline"}
          size={19}
          color={C.textMuted}
        />
      </TouchableOpacity>
    </View>
  );
}
const pi = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.surfaceAlt,
    paddingHorizontal: 12,
    gap: 4,
  },
  rowErr: { borderColor: C.danger, backgroundColor: C.dangerLight },
  input: { flex: 1, fontSize: 15, color: C.text, paddingVertical: 13 },
});

// ── Status / Locked Screen (redesigned like web) ───────────────────────────────
function StatusScreen({
  iconBg,
  iconColor,
  iconName,
  title,
  message,
  submessage,
  onClose,
  btnColor,
}) {
  return (
    <View style={lk.wrap}>
      <View style={[lk.iconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={34} color={iconColor} />
      </View>
      <Text style={lk.title}>{title}</Text>
      <Text style={lk.msg}>{message}</Text>
      {submessage ? (
        <Text style={[lk.submsg, { color: iconColor }]}>{submessage}</Text>
      ) : null}
      <TouchableOpacity
        style={[lk.btn, { backgroundColor: btnColor || C.navy }]}
        onPress={onClose}
        activeOpacity={0.8}
      >
        <Text style={lk.btnTxt}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}
const lk = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  iconOuter: {
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
  iconInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#DCE8FF",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: C.text,
    marginBottom: 10,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  msg: {
    fontSize: 14,
    color: C.textSub,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  countdownWrap: {
    alignItems: "center",
    width: "100%",
    marginTop: 16,
    marginBottom: 8,
    gap: 8,
  },
  countdownLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: C.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    textAlign: "center",
  },
  countdownBadge: {
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
  countdownTxt: {
    fontSize: 28,
    fontWeight: "800",
    color: C.text,
    letterSpacing: 1.5,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
    paddingVertical: 15,
    borderRadius: 14,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  btnTxt: {
    fontSize: 15,
    fontWeight: "800",
    color: C.white,
    letterSpacing: -0.2,
  },
  countdownBadge: {
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
  },
});
// ═══════════════════════════════════════════════════════════════════════════════
export default function ChangePasswordScreen({ navigation }) {
  const [step, setStep] = useState("checking");
  const [curPassword, setCurPassword] = useState("");
  const [curPasswordErr, setCurPasswordErr] = useState("");
  const [curLoading, setCurLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [blockedHours, setBlockedHours] = useState(0);
  const [sessionLockMins, setSessionLockMins] = useState(0);
  const [pwLockedMins, setPwLockedMins] = useState(0);

  // Live countdown state — exact timestamps from backend msLeft
  const [blockedUntilTs, setBlockedUntilTs] = useState(null);
  const [sessionLockedUntilTs, setSessionLockedUntilTs] = useState(null);
  const [pwLockedUntilTs, setPwLockedUntilTs] = useState(null);
  const [blockedCountdown, setBlockedCountdown] = useState("");
  const [sessionCountdown, setSessionCountdown] = useState("");
  const [pwCountdown, setPwCountdown] = useState("");
  const countdownRef = useRef(null);
  const [otpValues, setOtpValues] = useState(["", "", "", "", "", ""]);
  const [otpMasked, setOtpMasked] = useState("");
  const [otpTimer, setOtpTimer] = useState(0);
  const [resendsLeft, setResendsLeft] = useState(3);
  const [otpError, setOtpError] = useState("");
  const [otpState, setOtpState] = useState("active");

  const otpTimerRef = useRef(null);
  const isResendingRef = useRef(false);
  const resendsLeftRef = useRef(3);

  useEffect(() => {
    resendsLeftRef.current = resendsLeft;
  }, [resendsLeft]);

  // ── Live countdown timer for blocked/locked screens ────────────────────────
  const fmtCountdown = (msLeft) => {
    if (msLeft <= 0) return "0m 00s";
    const totalSecs = Math.ceil(msLeft / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return h > 0
      ? `${h}h ${String(m).padStart(2, "0")}m`
      : `${m}m ${String(s).padStart(2, "0")}s`;
  };

  useEffect(() => {
    clearInterval(countdownRef.current);
    const activeTs =
      step === "blocked"
        ? blockedUntilTs
        : step === "session-locked"
          ? sessionLockedUntilTs
          : step === "pw-locked"
            ? pwLockedUntilTs
            : null;
    if (!activeTs) return;
    const tick = () => {
      const ms = activeTs - Date.now();
      const str = fmtCountdown(ms);
      if (step === "blocked") setBlockedCountdown(str);
      if (step === "session-locked") setSessionCountdown(str);
      if (step === "pw-locked") setPwCountdown(str);
      if (ms <= 0) clearInterval(countdownRef.current);
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => clearInterval(countdownRef.current);
  }, [step, blockedUntilTs, sessionLockedUntilTs, pwLockedUntilTs]);

  const canResend =
    resendsLeft > 0 && (otpTimer === 0 || otpState === "attempts-exceeded");
  const reqStatus = REQUIREMENTS.map((r) => ({
    ...r,
    met: r.test(newPassword),
  }));
  const allMet = reqStatus.every((r) => r.met);
  const passwordsMatch =
    newPassword.length > 0 && newPassword === confirmPassword;

  useEffect(() => {
    checkStatus();
    return () => clearInterval(otpTimerRef.current);
  }, []);

 const checkStatus = async () => {
  setStep("checking");

  // FIX: Check AsyncStorage for active pw lock FIRST
  try {
    const savedPwLock = await AsyncStorage.getItem("cpm_pw_locked");
    if (savedPwLock) {
      const { until } = JSON.parse(savedPwLock);
      if (Date.now() < until) {
        setPwLockedUntilTs(until);
        setPwLockedMins(Math.ceil((until - Date.now()) / 60_000));
        setStep("pw-locked");
        return;
      }
      await AsyncStorage.removeItem("cpm_pw_locked");
    }
  } catch {
    await AsyncStorage.removeItem("cpm_pw_locked");
  }

  // Check session lock
  try {
    const stored = await AsyncStorage.getItem("cpm_session_locked");
    if (stored) {
      const { until } = JSON.parse(stored);
      if (Date.now() < until) {
        setSessionLockMins(Math.ceil((until - Date.now()) / 60_000));
        setSessionLockedUntilTs(until);
        setStep("session-locked");
        return;
      }
      await AsyncStorage.removeItem("cpm_session_locked");
    }
  } catch {
    await AsyncStorage.removeItem("cpm_session_locked");
  }

  // API status check
  try {
    const token = await AsyncStorage.getItem("token");
    const res = await fetch(`${BASE_URL}/users/password/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await res.json();
    if (d.blocked) {
      setBlockedHours(d.hoursLeft ?? 0);
      setBlockedUntilTs(Date.now() + (d.msLeft ?? (d.hoursLeft ?? 24) * 3_600_000));
      setStep("blocked");
    } else if (d.sessionLocked) {
      const lm = d.minsLeft ?? 15;
      setSessionLockMins(lm);
      const untilTs = Date.now() + (d.msLeft ?? lm * 60_000);
      setSessionLockedUntilTs(untilTs);
      await AsyncStorage.setItem(
        "cpm_session_locked",
        JSON.stringify({ until: untilTs }),
      );
      setStep("session-locked");
    } else if (d.pwLocked) {
      const lm = d.minsLeft ?? 15;
      setPwLockedMins(lm);
      // Check saved timestamp first
      try {
        const saved = await AsyncStorage.getItem("cpm_pw_locked");
        if (saved) {
          const { until } = JSON.parse(saved);
          if (Date.now() < until) {
            setPwLockedUntilTs(until);
            setStep("pw-locked");
            return;
          }
          await AsyncStorage.removeItem("cpm_pw_locked");
        }
      } catch {}
      const untilTs = Date.now() + (d.msLeft ?? lm * 60_000);
      setPwLockedUntilTs(untilTs);
      await AsyncStorage.setItem(
        "cpm_pw_locked",
        JSON.stringify({ until: untilTs }),
      );
      setStep("pw-locked");
    } else {
      setStep("verify-current");
    }
  } catch {
    setStep("verify-current");
  }
};

  // FIX: force-lock backend call when timer expires with 0 resends
  const startOtpTimer = (expiresAt) => {
    clearInterval(otpTimerRef.current);
    setOtpState("active");
    const tick = () => {
      const secs = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setOtpTimer(secs);
      if (secs <= 0) {
        clearInterval(otpTimerRef.current);
        if (resendsLeftRef.current <= 0) {
          AsyncStorage.getItem("token")
            .then((token) => {
              fetch(`${BASE_URL}/users/password/force-lock`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              }).catch(() => {});
            })
            .catch(() => {});
          const lockMins = 15;
          AsyncStorage.setItem(
            "cpm_session_locked",
            JSON.stringify({ until: Date.now() + lockMins * 60_000 }),
          ).catch(() => {});
          setSessionLockMins(lockMins);
          setOtpError("");
          setStep("session-locked");
          return;
        }
        setOtpState((prev) =>
          prev === "attempts-exceeded" ? "attempts-exceeded" : "expired",
        );
      }
    };
    tick();
    otpTimerRef.current = setInterval(tick, 1000);
  };

  const formatTimer = (secs) =>
    `${Math.floor(secs / 60)
      .toString()
      .padStart(2, "0")}:${(secs % 60).toString().padStart(2, "0")}`;

  const handleVerifyCurrent = async () => {
    if (!curPassword.trim()) {
      setCurPasswordErr("Current password is required");
      return;
    }
    setCurLoading(true);
    setCurPasswordErr("");
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${BASE_URL}/users/password/verify-current`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ currentPassword: curPassword }),
      });
      const d = await res.json();
      if (!res.ok) {

       if (d.locked || d.pwLocked) {
  const lm = d.minutesLeft ?? 15;
  setPwLockedMins(lm);
  const untilTs = Date.now() + (d.msLeft ?? lm * 60_000);
  setPwLockedUntilTs(untilTs);
  await AsyncStorage.setItem(
    "cpm_pw_locked",
    JSON.stringify({ until: untilTs }),
  );
  setStep("pw-locked");
  return;
}
        if (d.sessionLocked) {
          const lm = d.minutesLeft ?? 15;
          setSessionLockMins(lm);
          setSessionLockedUntilTs(Date.now() + lm * 60_000);
          await AsyncStorage.setItem(
            "cpm_session_locked",
            JSON.stringify({ until: Date.now() + lm * 60_000 }),
          );
          setStep("session-locked");
          return;
        }
        setCurPasswordErr(d.message || "Incorrect password");
        return;
      }
      setStep("form");
    } catch {
      setCurPasswordErr("Network error. Check your connection.");
    } finally {
      setCurLoading(false);
    }
  };

  const validate = () => {
    const e = {};
    if (!newPassword) e.newPassword = "New password is required";
    else if (!allMet) e.newPassword = "Password does not meet all requirements";
    if (!confirmPassword)
      e.confirmPassword = "Please confirm your new password";
    else if (!passwordsMatch) e.confirmPassword = "Passwords do not match";
    if (newPassword && curPassword && newPassword === curPassword)
      e.newPassword = "New password must be different from current password";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRequestOtp = async () => {
    if (!validate()) return;
    setIsLoading(true);
    setFormErrors({});
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${BASE_URL}/users/password/request-otp`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: curPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.blocked) {
          setBlockedHours(d.hoursLeft ?? 0);
          setBlockedUntilTs(
            Date.now() + (d.msLeft ?? (d.hoursLeft ?? 24) * 3_600_000),
          );
          setStep("blocked");
          return;
        }
        if (d.sessionLocked) {
          const lm = d.minutesLeft ?? 15;
          setSessionLockMins(lm);
          setSessionLockedUntilTs(Date.now() + lm * 60_000);
          await AsyncStorage.setItem(
            "cpm_session_locked",
            JSON.stringify({ until: Date.now() + lm * 60_000 }),
          );
          setStep("session-locked");
          return;
        }
        if (d.locked) {
          setFormErrors({ general: d.message });
          return;
        }
        if (res.status === 401) {
          setFormErrors({
            general: "Incorrect current password — please go back",
          });
          return;
        }
        if (d.errors) {
          const be = {};
          d.errors.forEach((e) => {
            if (e.field) be[e.field] = e.message;
          });
          setFormErrors(be);
          return;
        }
        setFormErrors({ general: d.message || "Failed to send code" });
        return;
      }
      setOtpMasked(d.maskedEmail || "");
      const rl = d.resendsLeft ?? 2;
      setResendsLeft(rl);
      resendsLeftRef.current = rl;
      setOtpValues(["", "", "", "", "", ""]);
      setOtpError("");
      setOtpState("active");
      setStep("otp");
      if (d.otpExpiresAt) startOtpTimer(d.otpExpiresAt);
    } catch {
      setFormErrors({ general: "Network error. Check your connection." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || isResendingRef.current) return;
    isResendingRef.current = true;
    setIsLoading(true);
    setOtpError("");
    setOtpValues(["", "", "", "", "", ""]);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${BASE_URL}/users/password/request-otp`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: curPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.sessionLocked) {
          const lm = d.minutesLeft ?? 15;
          setSessionLockMins(lm);
          setSessionLockedUntilTs(Date.now() + lm * 60_000);
          await AsyncStorage.setItem(
            "cpm_session_locked",
            JSON.stringify({ until: Date.now() + lm * 60_000 }),
          );
          setStep("session-locked");
          return;
        }
        if (d.blocked) {
          setBlockedHours(d.hoursLeft ?? 0);
          setBlockedUntilTs(
            Date.now() + (d.msLeft ?? (d.hoursLeft ?? 24) * 3_600_000),
          );
          setStep("blocked");
          return;
        }
        if (d.resendsLeft === 0) {
          setResendsLeft(0);
          resendsLeftRef.current = 0;
          setOtpError("No more resends available.");
          return;
        }
        setOtpError(d.message || "Failed to resend code");
        return;
      }
      const rl = d.resendsLeft ?? 0;
      setResendsLeft(rl);
      resendsLeftRef.current = rl;
      setOtpState("active");
      if (d.otpExpiresAt) startOtpTimer(d.otpExpiresAt);
    } catch {
      setOtpError("Network error. Check your connection.");
    } finally {
      setIsLoading(false);
      isResendingRef.current = false;
    }
  };

  const handleVerifyOtp = async () => {
    const code = otpValues.join("");
    if (code.length !== 6) {
      setOtpError("Please enter all 6 digits");
      return;
    }
    setIsLoading(true);
    setOtpError("");
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${BASE_URL}/users/password/verify-otp`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ otp: code }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.sessionLocked || d.autoClose) {
          const lm = d.minutesLeft ?? 15;
          setSessionLockMins(lm);
          await AsyncStorage.setItem(
            "cpm_session_locked",
            JSON.stringify({ until: Date.now() + lm * 60_000 }),
          );
          setOtpError("");
          setStep("session-locked");
          return;
        }
        if (d.forceResend || d.attemptLocked || res.status === 429) {
          setOtpState("attempts-exceeded");
          setOtpValues(["", "", "", "", "", ""]);
          clearInterval(otpTimerRef.current);
          setOtpTimer(0);
          if (d.resendsLeft !== undefined) {
            setResendsLeft(d.resendsLeft);
            resendsLeftRef.current = d.resendsLeft;
          }
          setOtpError(
            "Too many incorrect attempts. Please request a new code.",
          );
          return;
        }
        setOtpError(d.message || "Incorrect code");
        setOtpValues(["", "", "", "", "", ""]);
        return;
      }
      clearInterval(otpTimerRef.current);
      setStep("done");
      setTimeout(async () => {
        await AsyncStorage.clear();
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
      }, 3000);
    } catch {
      setOtpError("Network error. Check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const STEP_NUM = { "verify-current": 1, form: 2, otp: 3, done: 3 };

  return (
    <SafeAreaView style={s.safe}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <View style={s.backBtnInner}>
            <Ionicons name="chevron-back" size={20} color={C.white} />
          </View>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Change Password</Text>
          {STEP_NUM[step] && (
            <Text style={s.headerSub}>Step {STEP_NUM[step]} of 3</Text>
          )}
        </View>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── CHECKING ── */}
          {step === "checking" && (
            <View style={s.centerWrap}>
              <ActivityIndicator size="large" color={C.navy} />
              <Text style={s.centerCaption}>Checking availability…</Text>
            </View>
          )}

          {/* ── BLOCKED (Password changed 2x in 24h) ── */}
          {step === "blocked" && (
            <View style={lk.wrap}>
              <View style={[lk.iconCircle, { backgroundColor: "#FFF7ED" }]}>
                <Ionicons name="lock-closed" size={34} color="#0B2D6B" />
              </View>
              <Text style={lk.title}>Change Password Unavailable</Text>
              <Text style={lk.msg}>
                You've already changed your password{" "}
                <Text style={{ fontWeight: "800" }}>twice</Text> in the last 24
                hours.{"\n\n"}
                This limit protects your account from unauthorized changes.
              </Text>
              <Text
                style={[
                  lk.msg,
                  { fontWeight: "700", color: C.text, marginTop: 4 },
                ]}
              >
                You can change your password again in:
              </Text>
              <View style={lk.countdownBadge}>
                <Ionicons name="time-outline" size={16} color="#C1272D" />
                <Text style={lk.countdownTxt}>
                  {blockedCountdown || "Calculating…"}
                </Text>
              </View>
              <TouchableOpacity
                style={[lk.btn, { backgroundColor: "#0B2D6B" }]}
                onPress={() => navigation.goBack()}
                activeOpacity={0.8}
              >
                <Text style={lk.btnTxt}>Got it, Close</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── SESSION LOCKED ── */}
          {step === "session-locked" && (
  <View style={lk.wrap}>
    <View style={lk.iconOuter}>
      <View style={lk.iconInner}>
        <Ionicons name="shield-off-outline" size={32} color={C.navy} />
      </View>
    </View>
    <Text style={lk.title}>Temporarily Locked</Text>
    <Text style={lk.msg}>
      For your security, this process has been temporarily locked due to too many failed attempts.
    </Text>
    <Text style={lk.msg}>
      Please wait for the timer to expire before trying again.
    </Text>
    <View style={lk.countdownWrap}>
      <Text style={lk.countdownLabel}>Try again in</Text>
      <View style={lk.countdownBadge}>
        <Ionicons name="time-outline" size={18} color={C.textMuted} />
        <Text style={lk.countdownTxt}>
          {sessionCountdown || "Calculating…"}
        </Text>
      </View>
    </View>
    <TouchableOpacity
      style={[lk.btn, { backgroundColor: C.navy }]}
      onPress={() => navigation.goBack()}
      activeOpacity={0.85}
    >
      <Text style={lk.btnTxt}>Got it, Go Back</Text>
    </TouchableOpacity>
  </View>
)}

          {/* ── PW LOCKED ── */}
      {step === "pw-locked" && (
  <View style={lk.wrap}>
    <View style={lk.iconOuter}>
      <View style={lk.iconInner}>
        <Ionicons name="key-outline" size={32} color={C.navy} />
      </View>
    </View>
    <Text style={lk.title}>Too Many Attempts</Text>
    <Text style={lk.msg}>
      Your account is temporarily locked due to too many incorrect password attempts.
    </Text>
  
    <View style={lk.countdownWrap}>
      <Text style={lk.countdownLabel}>Try again in</Text>
      <View style={lk.countdownBadge}>
        <Ionicons name="time-outline" size={18} color={C.textMuted} />
        <Text style={lk.countdownTxt}>
          {pwCountdown || "Calculating…"}
        </Text>
      </View>
    </View>
    <TouchableOpacity
      style={[lk.btn, { backgroundColor: C.red }]}
      onPress={() => navigation.goBack()}
      activeOpacity={0.85}
    >
      <Text style={lk.btnTxt}>Close</Text>
    </TouchableOpacity>
  </View>
)}

          {/* ── DONE ── */}
          {step === "done" && (
            <View style={s.doneWrap}>
              <View style={s.doneIconCircle}>
                <Ionicons name="checkmark" size={38} color={C.white} />
              </View>
              <Text style={s.doneTitle}>Password Changed!</Text>
              <Text style={s.doneSub}>
                Your password has been updated and all active sessions have been
                revoked.
              </Text>
              <Text style={s.doneSub}>
                A security notification was sent to your email.
              </Text>
              <View style={s.doneSpinRow}>
                <ActivityIndicator size="small" color={C.green} />
                <Text style={s.doneSpinTxt}>Signing you out…</Text>
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════
              STEP 1 — Verify Current Password
          ══════════════════════════════════════════ */}
          {step === "verify-current" && (
            <View style={s.stepWrap}>
              <StepBar current={1} total={3} />
<View style={s.stepIconRow}>
  <View style={s.stepIconOuter}>
    <View style={s.stepIconCircle}>
      <Ionicons name="shield-checkmark" size={26} color={C.navy} />
    </View>
  </View>
</View>
              <Text style={s.stepTitle}>Confirm Your Identity</Text>
              <Text style={s.stepSub}>
                Enter your current password to continue.
              </Text>

              <View style={s.fieldCard}>
                <Text style={s.fieldLabel}>CURRENT PASSWORD</Text>
                {/* FIX: PasswordInput with correct eye toggle logic */}
                <PasswordInput
                  value={curPassword}
                  onChangeText={(v) => {
                    setCurPassword(v);
                    setCurPasswordErr("");
                  }}
                  placeholder="Enter your current password"
                  hasError={!!curPasswordErr}
                  editable={!curLoading}
                />
                {curPasswordErr ? (
                  <View style={s.errRow}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={13}
                      color={C.danger}
                    />
                    <Text style={s.errTxt}>{curPasswordErr}</Text>
                  </View>
                ) : null}
              </View>

              <View style={s.btnRow}>
                {/* FIX: removed chevron-back icon from Cancel button */}
                <TouchableOpacity
                  style={s.outlineBtn}
                  onPress={() => navigation.goBack()}
                  disabled={curLoading}
                >
                  <Text style={s.outlineBtnTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    s.primaryBtn,
                    s.primaryBtnFlex,
                    (!curPassword.trim() || curLoading) && s.btnDisabled,
                  ]}
                  onPress={handleVerifyCurrent}
                  disabled={!curPassword.trim() || curLoading}
                >
                  {curLoading ? (
                    <ActivityIndicator size="small" color={C.white} />
                  ) : null}
                  {/* FIX: removed arrow-forward icon from Continue button */}
                  <Text style={s.primaryBtnTxt}>
                    {curLoading ? "Verifying…" : "Continue"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════
              STEP 2 — New Password Form
          ══════════════════════════════════════════ */}
          {step === "form" && (
            <View style={s.stepWrap}>
              <StepBar current={2} total={3} />

             <View style={s.stepIconRow}>
  <View style={s.stepIconOuter}>
    <View style={s.stepIconCircle}>
      <Ionicons name="create-outline" size={26} color={C.navy} />
    </View>
  </View>
</View>
              <Text style={s.stepTitle}>Set New Password</Text>
              <Text style={s.stepSub}>
                Create a strong password that meets all requirements below.
              </Text>

              {formErrors.general && (
                <View style={s.banner}>
                  <Ionicons name="alert-circle" size={16} color={C.white} />
                  <Text style={s.bannerTxt}>{formErrors.general}</Text>
                </View>
              )}

              <View style={s.fieldCard}>
                <Text style={s.fieldLabel}>NEW PASSWORD</Text>
                {/* FIX: PasswordInput with correct eye toggle */}
                <PasswordInput
                  value={newPassword}
                  onChangeText={(v) => {
                    setNewPassword(v);
                    if (formErrors.newPassword)
                      setFormErrors((p) => {
                        const n = { ...p };
                        delete n.newPassword;
                        return n;
                      });
                  }}
                  placeholder="Create a strong new password"
                  hasError={!!formErrors.newPassword}
                  editable={!isLoading}
                />
                {formErrors.newPassword ? (
                  <View style={s.errRow}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={13}
                      color={C.danger}
                    />
                    <Text style={s.errTxt}>{formErrors.newPassword}</Text>
                  </View>
                ) : null}

                <View style={{ height: 16 }} />

                <Text style={s.fieldLabel}>CONFIRM PASSWORD</Text>
                <PasswordInput
                  value={confirmPassword}
                  onChangeText={(v) => {
                    setConfirmPassword(v);
                    if (formErrors.confirmPassword)
                      setFormErrors((p) => {
                        const n = { ...p };
                        delete n.confirmPassword;
                        return n;
                      });
                  }}
                  placeholder="Re-enter your new password"
                  hasError={!!formErrors.confirmPassword}
                  editable={!isLoading}
                />
                {confirmPassword.length > 0 && (
                  <View style={s.matchRow}>
                    <View
                      style={[
                        s.matchDot,
                        {
                          backgroundColor: passwordsMatch ? C.green : C.danger,
                        },
                      ]}
                    >
                      <Ionicons
                        name={passwordsMatch ? "checkmark" : "close"}
                        size={10}
                        color={C.white}
                      />
                    </View>
                    <Text
                      style={[
                        s.matchTxt,
                        { color: passwordsMatch ? C.green : C.danger },
                      ]}
                    >
                      {passwordsMatch
                        ? "Passwords match"
                        : "Passwords do not match"}
                    </Text>
                  </View>
                )}
                {formErrors.confirmPassword ? (
                  <View style={s.errRow}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={13}
                      color={C.danger}
                    />
                    <Text style={s.errTxt}>{formErrors.confirmPassword}</Text>
                  </View>
                ) : null}
              </View>

              {/* Requirements card */}
              <View style={s.reqCard}>
                <View style={s.reqCardHeader}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={15}
                    color={C.navy}
                  />
                  <Text style={s.reqCardTitle}>PASSWORD REQUIREMENTS</Text>
                </View>
                {reqStatus.map((r) => (
                  <View key={r.id} style={s.reqRow}>
                    <View
                      style={[
                        s.reqDot,
                        r.met
                          ? s.reqDotMet
                          : newPassword.length > 0
                            ? s.reqDotFail
                            : s.reqDotIdle,
                      ]}
                    >
                      <Ionicons
                        name={r.met ? "checkmark" : "remove"}
                        size={10}
                        color={
                          r.met
                            ? C.white
                            : newPassword.length > 0
                              ? C.white
                              : C.textMuted
                        }
                      />
                    </View>
                    <Text
                      style={[
                        s.reqTxt,
                        r.met
                          ? s.reqTxtMet
                          : newPassword.length > 0
                            ? s.reqTxtFail
                            : {},
                      ]}
                    >
                      {r.label}
                    </Text>
                  </View>
                ))}
                <View style={s.reqRow}>
                  <View
                    style={[
                      s.reqDot,
                      passwordsMatch
                        ? s.reqDotMet
                        : confirmPassword.length > 0
                          ? s.reqDotFail
                          : s.reqDotIdle,
                    ]}
                  >
                    <Ionicons
                      name={passwordsMatch ? "checkmark" : "remove"}
                      size={10}
                      color={
                        passwordsMatch
                          ? C.white
                          : confirmPassword.length > 0
                            ? C.white
                            : C.textMuted
                      }
                    />
                  </View>
                  <Text
                    style={[
                      s.reqTxt,
                      passwordsMatch
                        ? s.reqTxtMet
                        : confirmPassword.length > 0
                          ? s.reqTxtFail
                          : {},
                    ]}
                  >
                    Passwords match
                  </Text>
                </View>
              </View>

              <View style={s.btnRow}>
                {/* FIX: removed chevron-back icon from Back button */}
                <TouchableOpacity
                  style={s.outlineBtn}
                  onPress={() => setStep("verify-current")}
                  disabled={isLoading}
                >
                  <Text style={s.outlineBtnTxt}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    s.primaryBtn,
                    s.primaryBtnFlex,
                    (!allMet || !passwordsMatch || isLoading) && s.btnDisabled,
                  ]}
                  onPress={handleRequestOtp}
                  disabled={isLoading || !allMet || !passwordsMatch}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={C.white} />
                  ) : null}
                  {/* FIX: removed send icon from Send Code button */}
                  <Text style={s.primaryBtnTxt}>
                    {isLoading ? "Sending Code…" : "Send Code"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════
              STEP 3 — OTP Verification
          ══════════════════════════════════════════ */}
          {step === "otp" && (
            <View style={s.stepWrap}>
              <StepBar current={3} total={3} />

            <View style={s.stepIconRow}>
  <View style={s.stepIconOuter}>
    <View style={s.stepIconCircle}>
      <Ionicons name="mail" size={26} color={C.navy} />
    </View>
  </View>
</View>
              <Text style={s.stepTitle}>Enter Verification Code</Text>

              {/* Info card */}
              <View style={s.infoCard}>
                <View style={s.infoCardIcon}>
                  <Ionicons
                    name="mail-open-outline"
                    size={18}
                    color="#1d4ed8"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.infoCardTitle}>
                    Code sent to{" "}
                    <Text style={{ fontWeight: "700", color: C.navy }}>
                      {otpMasked}
                    </Text>
                  </Text>
                  <Text style={s.infoCardSub}>
                    Expires in{" "}
                    <Text style={{ fontWeight: "700" }}>2 minutes</Text>. Do not
                    share.
                  </Text>
                </View>
              </View>

              {/* Timer pill */}
              {otpState !== "attempts-exceeded" && (
                <View
                  style={[
                    s.timerPill,
                    otpTimer <= 30 && otpTimer > 0 && s.timerWarn,
                    otpTimer === 0 && s.timerExpired,
                  ]}
                >
                  <Ionicons
                    name="time-outline"
                    size={14}
                    color={
                      otpTimer === 0
                        ? C.danger
                        : otpTimer <= 30
                          ? C.amber
                          : C.navy
                    }
                  />
                  <Text
                    style={[
                      s.timerTxt,
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

              {/* Error banner */}
              {otpError !== "" && (
                <View
                  style={[
                    s.banner,
                    otpState === "attempts-exceeded" && s.bannerAmber,
                  ]}
                >
                  <Ionicons
                    name={
                      otpState === "attempts-exceeded"
                        ? "warning"
                        : "close-circle"
                    }
                    size={16}
                    color={C.white}
                  />
                  <Text style={s.bannerTxt}>{otpError}</Text>
                </View>
              )}

              <OtpRow
                values={otpValues}
                onChange={(idx, val) =>
                  setOtpValues((prev) => {
                    const n = [...prev];
                    n[idx] = val;
                    return n;
                  })
                }
                disabled={isLoading || otpState !== "active"}
              />

              {/* FIX: "Sending..." / Confirm button is always visible and solid */}
              {otpState === "active" && (
                <TouchableOpacity
                  style={[
                    s.primaryBtn,
                    s.primaryBtnFull,
                    (otpValues.join("").length !== 6 || isLoading) &&
                      s.btnDisabled,
                  ]}
                  onPress={handleVerifyOtp}
                  disabled={otpValues.join("").length !== 6 || isLoading}
                >
                  {isLoading && (
                    <ActivityIndicator size="small" color={C.white} />
                  )}
                  <Text style={s.primaryBtnTxt}>
                    {isLoading ? "Verifying…" : "Confirm Password Change"}
                  </Text>
                </TouchableOpacity>
              )}

              <View style={s.resendWrap}>
                {resendsLeft <= 0 ? (
                  <Text style={s.resendExhausted}>
                    No more resends available for this session
                  </Text>
                ) : canResend ? (
                  <TouchableOpacity
                    style={[s.resendBtn, isLoading && { opacity: 0.5 }]}
                    onPress={handleResend}
                    disabled={isLoading}
                  >
                    <Ionicons
                      name="refresh"
                      size={14}
                      color={isLoading ? C.textLight : C.navy}
                    />
                    <Text
                      style={[s.resendTxt, isLoading && { color: C.textLight }]}
                    >
                      {isLoading
                        ? "Sending…"
                        : `Resend Code (${resendsLeft} left)`}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          )}

          <View style={{ height: 48 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.navyDark,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  backBtn: { width: 44 },
  backBtnInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
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
    color: "rgba(255,255,255,0.55)",
    marginTop: 2,
    fontWeight: "500",
  },

  centerWrap: { alignItems: "center", paddingVertical: 72, gap: 16 },
  centerCaption: { fontSize: 14, color: C.textMuted, fontWeight: "500" },

  doneWrap: { alignItems: "center", paddingVertical: 36, paddingHorizontal: 8 },
  doneIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: C.green,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
    shadowColor: C.green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  doneTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: C.green,
    marginBottom: 14,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  doneSub: {
    fontSize: 14,
    color: C.textSub,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  doneSpinRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  doneSpinTxt: { fontSize: 13, color: C.green, fontWeight: "700" },

  stepWrap: { paddingTop: 24, paddingBottom: 12 },
stepIconRow: { alignItems: "center", marginBottom: 14 },
stepIconOuter: {
  width: 90,
  height: 90,
  borderRadius: 45,
  backgroundColor: "#EEF3FF",
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1,
  borderColor: "#D6E0F5",
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
  backgroundColor: "#DCE8FF",
  alignItems: "center",
  justifyContent: "center",
},
  stepTitle: {
    fontSize: 20,
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
    marginBottom: 22,
    paddingHorizontal: 8,
  },

  fieldCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
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
    gap: 8,
  },
  inputRowErr: { borderColor: C.danger, backgroundColor: C.dangerLight },
  inputIcon: {},
  input: { flex: 1, fontSize: 15, color: C.text, paddingVertical: 13 },
  errRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 7 },
  errTxt: { color: C.danger, fontSize: 12, fontWeight: "500", flex: 1 },

  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 9,
  },
  matchDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  matchTxt: { fontSize: 12, fontWeight: "600" },

  reqCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: C.navy,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: C.border,
  },
  reqCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 14,
  },
  reqCardTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: C.navy,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  reqRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 9,
  },
  reqDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.border,
  },
  reqDotIdle: { backgroundColor: C.border },
  reqDotMet: { backgroundColor: C.green },
  reqDotFail: { backgroundColor: C.danger },
  reqTxt: { fontSize: 13, color: C.textMuted, flex: 1 },
  reqTxtMet: { color: C.green, fontWeight: "600" },
  reqTxtFail: { color: C.danger },

  btnRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  outlineBtnTxt: { fontSize: 14, fontWeight: "700", color: C.textSub },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 13,
    backgroundColor: C.navy,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryBtnFlex: { flex: 1 },
  primaryBtnFull: { width: "100%", marginTop: 4 },
  primaryBtnTxt: {
    fontSize: 15,
    fontWeight: "800",
    color: C.white,
    letterSpacing: -0.2,
  },
  btnDisabled: { opacity: 0.4, shadowOpacity: 0 },

  banner: {
    flexDirection: "row",
    backgroundColor: C.danger,
    borderRadius: 12,
    padding: 13,
    alignItems: "flex-start",
    marginBottom: 14,
    gap: 9,
  },
  bannerAmber: { backgroundColor: C.amber },
  bannerTxt: {
    color: C.white,
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    lineHeight: 19,
  },

  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EFF6FF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  infoCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    gap: 7,
    backgroundColor: C.navyLight,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    justifyContent: "center",
  },
  timerWarn: { backgroundColor: C.amberLight },
  timerExpired: { backgroundColor: C.dangerLight },
  timerTxt: { fontSize: 13, fontWeight: "700", color: C.navy },

  resendWrap: { alignItems: "center", marginTop: 16, minHeight: 36 },
  resendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.navy,
    backgroundColor: C.navyLight,
  },
  resendTxt: { fontSize: 14, fontWeight: "700", color: C.navy },
  resendExhausted: { fontSize: 13, color: C.textMuted, fontStyle: "italic" },
});
