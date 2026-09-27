// screens/LoginActivityScreen.js
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  getSessions,
  revokeSession,
  revokeAllOtherSessions,
  getSessionHistory,
} from "./services/api";

const C = {
  navy: "#0B2D6B",
  navyDark: "#071D47",
  navyLight: "#EEF3FF",
  red: "#C1272D",
  green: "#16a34a",
  bg: "#F0F4FA",
  white: "#FFFFFF",
  text: "#0F172A",
  textSub: "#475569",
  textMuted: "#94A3B8",
  border: "#E2E8F0",
  danger: "#DC2626",
  dangerLight: "#FEF2F2",
};

// Same label logic as web's parseDeviceLabel — client_app_label wins (mobile
// apps set this explicitly), otherwise pattern-match the user agent.
const parseDeviceLabel = (session) => {
  if (session.client_app_label) return session.client_app_label;
  const ua = session.user_agent || "";
  let browser = "Unknown Browser";
  if (/edg/i.test(ua)) browser = "Edge";
  else if (/chrome/i.test(ua)) browser = "Chrome";
  else if (/firefox/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua)) browser = "Safari";
  let os = "";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/mac os/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad/i.test(ua)) os = "iOS";
  else if (/linux/i.test(ua)) os = "Linux";
  if (session.device_type === "mobile" && !os) os = "Mobile";
  return os ? `${browser} on ${os}` : browser;
};

const formatSessionTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const timeStr = d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
  if (isSameDay(d, now)) return `Today at ${timeStr}`;
  if (isSameDay(d, yesterday)) return `Yesterday at ${timeStr}`;
  const dateStr = d.toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    ...(d.getFullYear() !== now.getFullYear() && { year: "numeric" }),
  });
  return `${dateStr} at ${timeStr}`;
};

const formatFullTimestamp = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

function DeviceRow({ session, onPress, faded }) {
  const isCurrent = session.is_current;
  const isRevoked = session.is_revoked;
  return (
    <TouchableOpacity
      style={[s.deviceRow, isCurrent && s.deviceRowCurrent, faded && { opacity: 0.55 }]}
      onPress={() => onPress(session)}
      activeOpacity={0.75}
    >
      <View style={s.deviceIconWrap}>
        <Ionicons
          name={session.device_type === "mobile" ? "phone-portrait-outline" : "desktop-outline"}
          size={20}
          color={C.navy}
        />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={s.deviceName} numberOfLines={1}>{parseDeviceLabel(session)}</Text>
          {session.is_trusted && (
            <Ionicons name="shield-checkmark" size={13} color={C.green} style={{ marginLeft: 5 }} />
          )}
        </View>
        <Text style={s.deviceLoc} numberOfLines={1}>
          {session.location_label || session.ip_address || ""}
        </Text>
        <Text style={s.deviceTime}>
          {isCurrent
            ? "This device"
            : isRevoked
            ? `Logged out ${formatSessionTime(session.revoked_at)}`
            : formatSessionTime(session.last_active_at)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
    </TouchableOpacity>
  );
}

export default function LoginActivityScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [view, setView] = useState("list"); // "list" | "detail"
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const [revokingId, setRevokingId] = useState(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  const fetchSessions = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const d = await getSessions();
      if (d.success) setSessions(d.sessions || []);
      else setError(d.message || "Failed to load sessions");
    } catch {
      setError("Failed to load active sessions");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const openDetail = async (session) => {
    setSelected(session);
    setView("detail");
    setHistoryLoading(true);
    setHistoryError("");
    setHistory([]);
    try {
      const d = await getSessionHistory(session.token_id);
      if (d.success) setHistory(d.history || []);
      else setHistoryError(d.message || "Failed to load login history");
    } catch {
      setHistoryError("Failed to load login history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const backToList = () => {
    setView("list");
    setSelected(null);
    setHistory([]);
    setHistoryError("");
  };

  const handleRevoke = async (tokenId) => {
    setRevokingId(tokenId);
    setError("");
    try {
      const d = await revokeSession(tokenId);
      if (!d.success) {
        setError(d.message || "Failed to log out that device");
        return;
      }
      const revokedAt = new Date().toISOString();
      setSessions((prev) =>
        prev.map((s) => (s.token_id === tokenId ? { ...s, is_revoked: true, revoked_at: revokedAt } : s))
      );
      if (selected?.token_id === tokenId) {
        setSelected((prev) => (prev ? { ...prev, is_revoked: true, revoked_at: revokedAt } : prev));
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    setError("");
    try {
      const d = await revokeAllOtherSessions();
      if (!d.success) {
        setError(d.message || "Failed to log out other devices");
        return;
      }
      const revokedAt = new Date().toISOString();
      setSessions((prev) =>
        prev.map((s) => (s.is_current || s.is_revoked ? s : { ...s, is_revoked: true, revoked_at: revokedAt }))
      );
      setConfirmAll(false);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setRevokingAll(false);
    }
  };

  const current = sessions.filter((s) => s.is_current);
  const others = sessions.filter((s) => !s.is_current && !s.is_revoked);
  const revoked = sessions.filter((s) => s.is_revoked);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={view === "detail" ? backToList : () => navigation.goBack()}
          style={s.headerBtn}
        >
          <Ionicons name={view === "detail" ? "chevron-back" : "arrow-back"} size={20} color={C.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>
            {view === "list" ? "Login Activity" : `Logins on ${selected ? parseDeviceLabel(selected) : "device"}`}
          </Text>
          <Text style={s.headerSub}>Manage where you're signed in</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
        refreshControl={
          view === "list" ? (
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchSessions(true)} colors={[C.navy]} tintColor={C.navy} />
          ) : undefined
        }
      >
        {!!error && (
          <View style={s.alert}>
            <Ionicons name="alert-circle-outline" size={15} color={C.danger} />
            <Text style={s.alertTxt}>{error}</Text>
          </View>
        )}

        {view === "list" && (
          loading ? (
            <View style={{ paddingTop: 40, alignItems: "center" }}>
              <ActivityIndicator size="large" color={C.navy} />
            </View>
          ) : (
            <>
              {current.length > 0 && (
                <>
                  <Text style={s.sectionLabel}>You're currently logged in on this device</Text>
                  {current.map((sess) => (
                    <DeviceRow key={sess.token_id} session={sess} onPress={openDetail} />
                  ))}
                </>
              )}

              {others.length > 0 && (
                <>
                  <Text style={[s.sectionLabel, { marginTop: 18 }]}>Logins on other devices</Text>
                  {others.map((sess) => (
                    <DeviceRow key={sess.token_id} session={sess} onPress={openDetail} />
                  ))}
                  <TouchableOpacity style={s.revokeAllBtn} onPress={() => setConfirmAll(true)}>
                    <Text style={s.revokeAllTxt}>Log out of all other devices</Text>
                  </TouchableOpacity>
                </>
              )}

              {revoked.length > 0 && (
                <>
                  <Text style={[s.sectionLabel, { marginTop: 18 }]}>Logged out devices</Text>
                  {revoked.map((sess) => (
                    <DeviceRow key={sess.token_id} session={sess} onPress={openDetail} faded />
                  ))}
                </>
              )}

              {sessions.length === 0 && (
                <Text style={s.emptyTxt}>No active sessions found.</Text>
              )}
            </>
          )
        )}

        {view === "detail" && selected && (
          <>
            <View style={s.detailCard}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={s.deviceName}>{selected.location_label || selected.ip_address || "Unknown location"}</Text>
                {selected.is_trusted && (
                  <Ionicons name="shield-checkmark" size={14} color={C.green} style={{ marginLeft: 6 }} />
                )}
              </View>
              <Text style={s.deviceLoc}>
                {selected.is_revoked
                  ? `Logged out ${formatSessionTime(selected.revoked_at)}`
                  : selected.is_current
                  ? "Active now"
                  : `Last login: ${formatSessionTime(selected.last_active_at)}`}
              </Text>
              {!selected.is_current && !selected.is_revoked && (
                <TouchableOpacity
                  style={s.logoutDeviceBtn}
                  onPress={() => handleRevoke(selected.token_id)}
                  disabled={revokingId === selected.token_id}
                >
                  {revokingId === selected.token_id ? (
                    <ActivityIndicator size="small" color={C.white} />
                  ) : (
                    <Text style={s.logoutDeviceTxt}>Log Out</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

            <Text style={[s.sectionLabel, { marginTop: 18 }]}>Recent logins</Text>
            {historyLoading ? (
              <ActivityIndicator size="small" color={C.navy} style={{ marginTop: 12 }} />
            ) : historyError ? (
              <View style={s.alert}>
                <Ionicons name="alert-circle-outline" size={15} color={C.danger} />
                <Text style={s.alertTxt}>{historyError}</Text>
              </View>
            ) : history.length === 0 ? (
              <Text style={s.emptyTxt}>No login history found for this device.</Text>
            ) : (
              history.map((h, i) => (
                <View key={i} style={s.historyRow}>
                  <Text style={s.deviceName}>{selected.location_label || h.ip_address || "Unknown location"}</Text>
                  <Text style={s.deviceLoc}>{formatFullTimestamp(h.created_at)}</Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Confirm: log out all other devices */}
      <Modal visible={confirmAll} transparent animationType="fade" onRequestClose={() => setConfirmAll(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Log Out All Other Devices?</Text>
            <Text style={s.modalMsg}>This device stays signed in; every other session ends immediately.</Text>
            <View style={s.modalRow}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setConfirmAll(false)} disabled={revokingAll}>
                <Text style={s.modalCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalConfirm} onPress={handleRevokeAll} disabled={revokingAll}>
                {revokingAll ? (
                  <ActivityIndicator size="small" color={C.white} />
                ) : (
                  <Text style={s.modalConfirmTxt}>Log Out Others</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.navyDark,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "800", color: C.white },
  headerSub: { fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 },

  alert: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.dangerLight, borderWidth: 1, borderColor: "#FCA5A5",
    borderRadius: 10, padding: 12, marginBottom: 14,
  },
  alertTxt: { color: C.danger, fontSize: 12.5, flex: 1 },

  sectionLabel: {
    fontSize: 11, fontWeight: "700", color: C.textMuted,
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8,
  },

  deviceRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.white, borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: C.border,
  },
  deviceRowCurrent: { borderColor: C.navy, backgroundColor: C.navyLight },
  deviceIconWrap: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: C.navyLight,
    alignItems: "center", justifyContent: "center",
  },
  deviceName: { fontSize: 14, fontWeight: "700", color: C.text },
  deviceLoc: { fontSize: 12, color: C.textSub, marginTop: 2 },
  deviceTime: { fontSize: 11, color: C.textMuted, marginTop: 2 },

  revokeAllBtn: { paddingVertical: 12, alignItems: "center" },
  revokeAllTxt: { fontSize: 13, color: C.red, fontWeight: "700" },

  emptyTxt: { fontSize: 13, color: C.textMuted, textAlign: "center", marginTop: 24 },

  detailCard: {
    backgroundColor: C.white, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: C.border,
  },
  logoutDeviceBtn: {
    marginTop: 14, backgroundColor: C.red, borderRadius: 10,
    paddingVertical: 11, alignItems: "center",
  },
  logoutDeviceTxt: { color: C.white, fontWeight: "700", fontSize: 13 },

  historyRow: {
    backgroundColor: C.white, borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: C.border,
  },

  modalOverlay: {
    flex: 1, backgroundColor: "rgba(7,29,71,0.55)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  modalBox: {
    backgroundColor: C.white, borderRadius: 18, padding: 22, width: "100%", maxWidth: 360,
  },
  modalTitle: { fontSize: 16, fontWeight: "800", color: C.text, marginBottom: 8, textAlign: "center" },
  modalMsg: { fontSize: 13, color: C.textSub, textAlign: "center", marginBottom: 20, lineHeight: 19 },
  modalRow: { flexDirection: "row", gap: 10 },
  modalCancel: {
    flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center",
    borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white,
  },
  modalCancelTxt: { fontSize: 13.5, fontWeight: "700", color: C.textSub },
  modalConfirm: {
    flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center", backgroundColor: C.red,
  },
  modalConfirmTxt: { fontSize: 13.5, fontWeight: "700", color: C.white },
});